"use client";

import { Suspense, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Cloth, type Vec3 } from "./shop-cloth";
import type { ShopAsset } from "./shop-assets";

/*
 * 3D shop rack with cloth physics.
 *
 * Every garment hangs from a hanger that slides along the rail, swings
 * (pendulum around the rail) and turns (yaw). Two cloth sheets hang from
 * each hanger at 90° to each other: the front photo and the side photo.
 * At rest the garments are turned sideways, so the side sheets face the
 * camera. The hovered garment turns its front to the camera and its
 * neighbours slide aside; the cloth lags, sways and settles. Each sheet
 * fades with the angle it shows to the camera.
 */

const RAIL_Y = 1.15;
const GARMENT_HEIGHT = 2.1;
const HANGER_DROP = 0.2; // hook on the rail to the top of the garment
const SIDE_YAW = Math.PI * 0.42;
const SPACING = 0.62;
const RAIL_MARGIN = 0.5;
const METAL = { color: "#e4e4e2", metalness: 0.35, roughness: 0.35 };

/* Push of a neighbour at distance 1, 2, 3 from the open garment. */
const PUSH = [0, 0.78, 0.38, 0.14];

export type RackItem = { id: string; asset: ShopAsset };

type Sheet = {
  cloth: Cloth;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  local: (x: number, y: number) => THREE.Vector3;
};

function makeSheet(
  texture: THREE.Texture,
  width: number,
  local: (x: number, y: number) => THREE.Vector3,
): Sheet {
  const cloth = new Cloth(width, GARMENT_HEIGHT);
  const geometry = new THREE.BufferGeometry();
  const uv = new Float32Array(cloth.cols * cloth.rows * 2);
  const index: number[] = [];
  for (let r = 0; r < cloth.rows; r++) {
    for (let c = 0; c < cloth.cols; c++) {
      const i = cloth.index(c, r);
      uv[i * 2] = c / (cloth.cols - 1);
      uv[i * 2 + 1] = 1 - r / (cloth.rows - 1);
      if (c < cloth.cols - 1 && r < cloth.rows - 1) {
        const a = i, b = cloth.index(c + 1, r), d = cloth.index(c, r + 1), e = cloth.index(c + 1, r + 1);
        index.push(a, d, b, b, d, e);
      }
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(cloth.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    side: THREE.DoubleSide,
    roughness: 0.92,
    metalness: 0,
    depthWrite: false,
  });
  return { cloth, geometry, material, local };
}

function restX(index: number, count: number) {
  return (index - (count - 1) / 2) * SPACING;
}

function Garment({
  asset,
  index,
  count,
  active,
  onEnter,
  onLeave,
}: {
  asset: ShopAsset;
  index: number;
  count: number;
  active: RefObject<number | null>;
  onEnter: (index: number) => void;
  onLeave: (index: number) => void;
}) {
  const [front, side] = useLoader(THREE.TextureLoader, [asset.front, asset.side]);
  const slideGroup = useRef<THREE.Group>(null);
  const swingGroup = useRef<THREE.Group>(null);
  const yawGroup = useRef<THREE.Group>(null);
  const barMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const hit = useRef<THREE.Mesh>(null);
  const motion = useRef({
    x: restX(index, count), xVelocity: 0,
    yaw: SIDE_YAW, yawVelocity: 0,
    swing: 0, swingVelocity: 0,
    ready: false,
  });
  const pointer = useRef<{ point: THREE.Vector3; velocity: THREE.Vector3 } | null>(null);

  const sheets = useMemo(() => {
    const frontImage = front.image as HTMLImageElement;
    const sideImage = side.image as HTMLImageElement;
    // The top edge follows the hanger: a gentle slope down to the shoulders.
    const shoulder = (x: number, w: number) => -HANGER_DROP - 0.18 * (x / (w / 2)) ** 2;
    const frontWidth = GARMENT_HEIGHT * (frontImage.width / frontImage.height);
    const sideWidth = GARMENT_HEIGHT * (sideImage.width / sideImage.height);
    return [
      makeSheet(front, frontWidth, (lx, ly) => new THREE.Vector3(lx, ly + shoulder(lx, frontWidth), 0)),
      makeSheet(side, sideWidth, (lx, ly) => new THREE.Vector3(0, ly + shoulder(lx, sideWidth) * 0.4, lx)),
    ];
  }, [front, side]);

  const temp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const m = motion.current;
    const slideNode = slideGroup.current;
    const swingNode = swingGroup.current;
    const yawNode = yawGroup.current;
    if (!slideNode || !swingNode || !yawNode) return;

    // slide along the rail: neighbours of the open garment move aside,
    // but every hook stays on the rail
    const open = active.current;
    const distance = open === null ? 0 : index - open;
    const railHalf = ((count - 1) / 2) * SPACING + RAIL_MARGIN - 0.12;
    const pushed = restX(index, count) + Math.sign(distance) * (PUSH[Math.abs(distance)] ?? 0);
    const targetX = Math.max(-railHalf, Math.min(railHalf, pushed));
    const slideForce = (targetX - m.x) * 60 - m.xVelocity * 13;
    m.xVelocity += slideForce * dt;
    m.x += m.xVelocity * dt;

    // turn: spring towards the front (open) or the side
    const targetYaw = open === index ? 0 : SIDE_YAW;
    const yawForce = (targetYaw - m.yaw) * 38 - m.yawVelocity * 9;
    m.yawVelocity += yawForce * dt;
    m.yaw += m.yawVelocity * dt;

    // swing: pendulum around the rail, kicked by sliding and turning
    const swingForce =
      -(9.8 / 1.4) * Math.sin(m.swing) - m.swingVelocity * 1.6 + m.yawVelocity * 0.35 - m.xVelocity * 0.9;
    m.swingVelocity += swingForce * dt;
    m.swing += m.swingVelocity * dt;

    slideNode.position.x = m.x;
    slideNode.position.z = open === index ? 0.25 : 0;
    // the open garment is wider, so its hover area widens and comes first
    if (hit.current) hit.current.scale.x = open === index ? 2.9 : 1;
    swingNode.rotation.z = m.swing;
    yawNode.rotation.y = m.yaw;
    slideNode.updateMatrixWorld(true);
    const world = yawNode.matrixWorld;

    for (const [n, sheet] of sheets.entries()) {
      const { cloth, local, geometry, material } = sheet;
      if (!m.ready) cloth.reset((lx, ly) => local(lx, ly).applyMatrix4(world).toArray() as Vec3);
      cloth.step(
        dt,
        (c) => local(cloth.localX(c), 0).applyMatrix4(world).toArray() as Vec3,
        pointer.current
          ? (px, py, pz) => {
              const p = pointer.current!;
              const d = temp.set(px, py, pz).distanceTo(p.point);
              if (d > 0.45) return null;
              const k = (1 - d / 0.45) * 0.004;
              return [p.velocity.x * k, p.velocity.y * k * 0.3, p.velocity.x * k * 0.6];
            }
          : undefined,
        {
          at: (c, r) => local(cloth.localX(c), cloth.localY(r)).applyMatrix4(world).toArray() as Vec3,
          stiffness: 0.06,
        },
      );
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      // each sheet shows while it faces the camera
      const facing = n === 0 ? Math.abs(Math.cos(m.yaw)) : Math.abs(Math.sin(m.yaw));
      material.opacity = THREE.MathUtils.smoothstep(facing, 0.35, 0.8);
      if (n === 0 && barMaterial.current) {
        barMaterial.current.opacity = material.opacity;
        barMaterial.current.visible = material.opacity > 0.02;
      }
    }
    m.ready = true;
    if (pointer.current) pointer.current.velocity.multiplyScalar(0.85);
  });

  const hangerCurve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.26, -HANGER_DROP - 0.32, -0.03),
        new THREE.Vector3(0, -HANGER_DROP - 0.14, -0.03),
        new THREE.Vector3(0.26, -HANGER_DROP - 0.32, -0.03),
      ),
    [],
  );

  return (
    <>
      <group ref={slideGroup} position={[restX(index, count), RAIL_Y, 0]}>
        <group ref={swingGroup}>
          <group ref={yawGroup}>
            {/* hook over the rail */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.05, 0.008, 8, 24, Math.PI * 1.25]} />
              <meshStandardMaterial {...METAL} color="#b4b4b2" />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
              <meshStandardMaterial {...METAL} color="#b4b4b2" />
            </mesh>
            {/* wooden neck, and the shoulder bar hidden inside the garment */}
            <mesh position={[0, -HANGER_DROP - 0.06, -0.01]}>
              <boxGeometry args={[0.05, 0.1, 0.035]} />
              <meshStandardMaterial color="#9a5a2e" roughness={0.6} />
            </mesh>
            <mesh>
              <tubeGeometry args={[hangerCurve, 24, 0.022, 8, false]} />
              <meshStandardMaterial ref={barMaterial} color="#9a5a2e" roughness={0.6} transparent depthWrite={false} />
            </mesh>
          </group>
        </group>
        {/* invisible hover target: a column under the hook */}
        <mesh
          ref={hit}
          position={[0, -HANGER_DROP - GARMENT_HEIGHT / 2, 0.3]}
          onPointerOver={(event) => {
            event.stopPropagation();
            onEnter(index);
          }}
          onPointerOut={() => onLeave(index)}
          onClick={(event) => {
            event.stopPropagation();
            onEnter(index);
          }}
          onPointerMove={(event) => {
            const previous = pointer.current?.point ?? event.point.clone();
            pointer.current = {
              point: event.point.clone(),
              velocity: event.point.clone().sub(previous).multiplyScalar(60),
            };
          }}
        >
          <planeGeometry args={[SPACING, GARMENT_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>

      {sheets.map((sheet, n) => (
        <mesh key={n} geometry={sheet.geometry} material={sheet.material} renderOrder={index * 2 + n} raycast={() => null} />
      ))}
    </>
  );
}

function Rail({ count }: { count: number }) {
  const half = ((count - 1) / 2) * SPACING + RAIL_MARGIN;
  return (
    <group position={[0, RAIL_Y, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, half * 2, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, 0, -0.04]}>
          <boxGeometry args={[0.07, 0.22, 0.05]} />
          <meshStandardMaterial {...METAL} color="#cfcfcd" />
        </mesh>
      ))}
    </group>
  );
}

/*
 * Frames the rack: the rail fills a set share of the width, and the rail
 * sits at a set height on screen (about a quarter from the top).
 */
function CameraRig({ count }: { count: number }) {
  const { camera, size } = useThree();
  useFrame(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const mobile = size.width <= 800;
    const railLength = (count - 1) * SPACING + RAIL_MARGIN * 2 + 0.2;
    const tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / size.height;
    const widthShare = mobile ? 0.94 : 0.56;
    const byWidth = railLength / widthShare / (2 * tan * aspect);
    const byHeight = (GARMENT_HEIGHT + 0.6) / (mobile ? 0.5 : 0.62) / (2 * tan);
    const distance = Math.max(byWidth, byHeight);
    const visibleHeight = 2 * distance * tan;
    const railFromTop = mobile ? 0.36 : 0.27;
    perspective.position.set(0, RAIL_Y - (0.5 - railFromTop) * visibleHeight, distance);
    perspective.updateProjectionMatrix();
  });
  return null;
}

/* Keeps the name label under the open garment, in screen space. */
function LabelTracker({
  onLabel,
  active,
  count,
}: {
  onLabel: (position: { x: number; y: number } | null) => void;
  active: RefObject<number | null>;
  count: number;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const open = active.current;
    if (open === null) {
      onLabel(null);
      return;
    }
    point.set(restX(open, count), RAIL_Y - HANGER_DROP - GARMENT_HEIGHT * 0.98, 0.25).project(camera);
    onLabel({ x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height + 10 });
  });
  return null;
}

export default function ShopRack3D({
  items,
  onLabel,
  onActive,
}: {
  items: RackItem[];
  /** Screen position for the open garment's name, or null when none is open. */
  onLabel: (position: { x: number; y: number } | null) => void;
  onActive: (index: number | null) => void;
}) {
  const active = useRef<number | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  const enter = (index: number) => {
    window.clearTimeout(leaveTimer.current);
    if (active.current === index) return;
    active.current = index;
    onActive(index);
  };
  // leaving one garment for the next should not close in between
  const leave = (index: number) => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      if (active.current !== index) return;
      active.current = null;
      onActive(null);
    }, 120);
  };

  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: [0, 0, 7], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.8} />
      <directionalLight position={[-3, 1, 2]} intensity={0.6} />
      <CameraRig count={items.length} />
      <LabelTracker onLabel={onLabel} active={active} count={items.length} />
      <Rail count={items.length} />
      <Suspense fallback={null}>
        {items.map((item, index) => (
          <Garment
            key={item.id}
            asset={item.asset}
            index={index}
            count={items.length}
            active={active}
            onEnter={enter}
            onLeave={leave}
          />
        ))}
      </Suspense>
    </Canvas>
  );
}
