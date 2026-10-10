"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Cloth, type Vec3 } from "./shop-cloth";
import type { ShopAsset } from "./shop-assets";
import { FIXED_STEP, FRONT_HALF, SIDE_YAW, RACK_SPACING as SPACING, RACK_MARGIN as RAIL_MARGIN, rackTargets, restX, stepHanger } from "./shop-rack-motion";

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
const HANGER_DROP = 0.265; // swivel sits inside the neckline
const GARMENT_TOP = 0.2;
const METAL = { color: "#e4e4e2", metalness: 0.35, roughness: 0.35 };


export type RackItem = { id: string; asset: ShopAsset };

type PointerState = { point: THREE.Vector3; velocity: THREE.Vector3 };

/* Soft shadow texture, drawn once: an ellipse that fades out at its edges. */
const shadowTextures: { blob?: THREE.Texture } = {};

function shadowTexture(kind: "blob") {
  const cached = shadowTextures[kind];
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  // an alphaMap is read from the green channel: white = shadow, black = none
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.55, "#8c8c8c");
  gradient.addColorStop(1, "#000");
  context.fillStyle = "#000";
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  shadowTextures[kind] = texture;
  return texture;
}

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
  openCollar = false,
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
    alphaTest: 0.3, // cut the light, half-transparent photo edges that ghost during the turn
    side: THREE.DoubleSide,
    roughness: 0.92,
    metalness: 0,
    depthWrite: false,
  });
  if (openCollar) {
    // The cutout photographs contain opaque pixels across the collar. Open only
    // the inner neckline so the physical hanger can be seen behind the fabric.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `#ifdef USE_MAP
          vec2 collar = (vMapUv - vec2(0.5, 0.965)) / vec2(0.12, 0.09);
          float neckline = smoothstep(0.94, 1.02, length(collar));
          diffuseColor.a *= neckline;
        #endif
        #include <alphatest_fragment>`,
      );
    };
    material.customProgramCacheKey = () => "shop-open-neckline-v1";
  }
  return { cloth, geometry, material, local };
}

/* Half of the visible width at the rail's depth, from the camera. */
function visibleHalfWidth(camera: THREE.Camera, aspect: number) {
  const perspective = camera as THREE.PerspectiveCamera;
  return perspective.position.z * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * aspect;
}

const EDGE = 0.06;

/*
 * Where the open garment hangs: at its place on the rail, moved inward
 * when it would not fit on screen.
 */
function openX(open: number, count: number, halfWidth: number) {
  const limit = Math.max(0, halfWidth - FRONT_HALF - EDGE);
  return THREE.MathUtils.clamp(restX(open, count), -limit, limit);
}

/** A continuous chrome hook: its contact with the rail never leaves the rail. */
function MetalHook() {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -HANGER_DROP, 0),
    new THREE.Vector3(0, -0.075, 0),
    new THREE.Vector3(0.048, -0.036, 0),
    new THREE.Vector3(0.062, 0.018, 0),
    new THREE.Vector3(0.043, 0.066, 0),
    new THREE.Vector3(-0.003, 0.082, 0),
    new THREE.Vector3(-0.05, 0.061, 0),
    new THREE.Vector3(-0.061, 0.015, 0),
  ]), []);
  return <mesh raycast={() => null}>
    <tubeGeometry args={[curve, 48, 0.006, 10, false]} />
    <meshStandardMaterial color="#bfc1c1" metalness={0.85} roughness={0.22} />
  </mesh>;
}

/** Beveled oak shoulders sit behind the photographed garment's neckline. */
function WoodenHanger() {
  const shape = useMemo(() => {
    const outline = new THREE.Shape();
    outline.moveTo(-0.035, 0);
    outline.lineTo(0.035, 0);
    outline.lineTo(0.052, -0.075);
    outline.quadraticCurveTo(0.23, -0.12, 0.46, -0.235);
    outline.quadraticCurveTo(0.49, -0.265, 0.442, -0.273);
    outline.quadraticCurveTo(0.2, -0.185, 0, -0.13);
    outline.quadraticCurveTo(-0.2, -0.185, -0.442, -0.273);
    outline.quadraticCurveTo(-0.49, -0.265, -0.46, -0.235);
    outline.quadraticCurveTo(-0.23, -0.12, -0.052, -0.075);
    outline.closePath();
    return outline;
  }, []);
  return <group position={[0, 0.005, -0.025]}>
    <mesh raycast={() => null}>
      <extrudeGeometry args={[shape, { depth: 0.04, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.008, bevelThickness: 0.006, curveSegments: 16 }]} />
      <meshStandardMaterial color="#9e673c" roughness={0.56} />
    </mesh>
    <mesh position={[0, -0.007, 0.02]} raycast={() => null}>
      <cylinderGeometry args={[0.012, 0.012, 0.024, 12]} />
      <meshStandardMaterial color="#a4a6a6" metalness={0.8} roughness={0.25} />
    </mesh>
  </group>;
}

function Garment({
  asset,
  index,
  count,
  active,
  pointer,
  positions,
}: {
  asset: ShopAsset;
  index: number;
  count: number;
  active: RefObject<number | null>;
  pointer: RefObject<PointerState | null>;
  positions: RefObject<number[]>;
}) {
  const [front, side] = useLoader(THREE.TextureLoader, [asset.front, asset.side]);
  const { camera, size } = useThree();
  const slideGroup = useRef<THREE.Group>(null);
  const swingGroup = useRef<THREE.Group>(null);
  const yawGroup = useRef<THREE.Group>(null);

  const shadow = useRef<THREE.Mesh>(null);
  const shadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const motion = useRef({
    x: restX(index, count), xVelocity: 0,
    yaw: SIDE_YAW, yawVelocity: 0,
    swing: 0, swingVelocity: 0,
    ready: false,
    still: 0, // frames without motion; the cloth sleeps after a while
    accumulator: 0,
  });

  const sheets = useMemo(() => {
    const frontImage = front.image as HTMLImageElement;
    const sideImage = side.image as HTMLImageElement;
    // The top edge follows the hanger: a gentle slope down to the shoulders.
    const shoulder = (x: number, w: number) => HANGER_DROP - GARMENT_TOP - 0.18 * (x / (w / 2)) ** 2;
    const frontWidth = GARMENT_HEIGHT * (frontImage.width / frontImage.height);
    const sideWidth = GARMENT_HEIGHT * (sideImage.width / sideImage.height) * 0.5;
    return [
      makeSheet(front, frontWidth, (lx, ly) => new THREE.Vector3(lx, ly + shoulder(lx, frontWidth), 0), true),
      makeSheet(side, sideWidth, (lx, ly) => new THREE.Vector3(0, ly + HANGER_DROP - GARMENT_TOP - 0.18 * (lx / (sideWidth / 2)) ** 2 * 0.4, lx)),
    ];
  }, [front, side]);

  useEffect(() => () => {
    sheets.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); });
  }, [sheets]);

  const temp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const m = motion.current;
    const slideNode = slideGroup.current;
    const swingNode = swingGroup.current;
    const yawNode = yawGroup.current;
    if (!slideNode || !swingNode || !yawNode) return;

    const open = active.current;
    const halfWidth = visibleHalfWidth(camera, size.width / size.height);
    const targetX = rackTargets(count, open, halfWidth)[index];
    m.accumulator = Math.min(m.accumulator + Math.min(delta, 0.1), 0.1);
    const poses: { x: number; yaw: number; swing: number }[] = [];
    while (m.accumulator >= FIXED_STEP) {
      stepHanger(m, targetX, open === index);
      m.accumulator -= FIXED_STEP;
      poses.push({ x: m.x, yaw: m.yaw, swing: m.swing });
    }

    positions.current[index] = m.x;
    slideNode.position.x = m.x;
    // soft shadow on the wall behind: wider and darker as the garment turns forward
    const frontness = Math.abs(Math.cos(m.yaw));
    if (shadow.current && shadowMaterial.current) {
      shadow.current.position.x = m.x + 0.08 + m.swing * 0.6;
      shadow.current.scale.x = THREE.MathUtils.lerp(0.95, 2.05, frontness);
      shadowMaterial.current.opacity = THREE.MathUtils.lerp(0.09, 0.16, frontness);
    }
    // Hooks stay on the rail; all swing and turning happens below the swivel.
    slideNode.position.z = 0;
    swingNode.rotation.z = m.swing;
    yawNode.rotation.y = m.yaw;
    slideNode.updateMatrixWorld(true);
    const world = yawNode.matrixWorld;

    // sleep: once the garment has settled, skip the cloth until it moves again
    const moving =
      Math.abs(m.xVelocity) + Math.abs(m.yawVelocity) + Math.abs(m.swingVelocity) > 0.004 ||
      (pointer.current?.velocity.lengthSq() ?? 0) > 1e-4;
    m.still = moving ? 0 : m.still + 1;
    if (m.ready && m.still > 90) return;

    for (const [n, sheet] of sheets.entries()) {
      const { cloth, local, geometry, material } = sheet;
      if (!m.ready) cloth.reset((lx, ly) => local(lx, ly).applyMatrix4(world).toArray() as Vec3);
      for (const pose of poses) {
        slideNode.position.x = pose.x;
        swingNode.rotation.z = pose.swing;
        yawNode.rotation.y = pose.yaw;
        slideNode.updateMatrixWorld(true);
        cloth.step(
          FIXED_STEP,
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
            stiffness: 0.045,
          },
        );
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      // Switch surfaces near edge-on: avoid two ghost silhouettes at mid-turn.
      const sideWeight = THREE.MathUtils.smoothstep(m.yaw, 0.72, 0.88);
      material.opacity = n === 0 ? 1 - sideWeight : sideWeight;
      material.visible = material.opacity > 0.01;
    }
    m.ready = true;
  });

  return (
    <>
      <mesh
        ref={shadow}
        position={[restX(index, count), RAIL_Y - GARMENT_TOP - GARMENT_HEIGHT * 0.52, -0.45]}
        renderOrder={-1}
        raycast={() => null}
      >
        <planeGeometry args={[1, GARMENT_HEIGHT * 0.95]} />
        <meshBasicMaterial
          ref={shadowMaterial}
          color="#000"
          alphaMap={shadowTexture("blob")}
          transparent
          depthWrite={false}
        />
      </mesh>
      <group ref={slideGroup} position={[restX(index, count), RAIL_Y, 0]}>
        <MetalHook />
        <group ref={swingGroup} position={[0, -HANGER_DROP, 0]}>
          <group ref={yawGroup}>
            <WoodenHanger />
          </group>
        </group>
      </group>

      {sheets.map((sheet, n) => (
        <mesh key={n} geometry={sheet.geometry} material={sheet.material} renderOrder={(active.current === index ? 100 : index * 2) + n} raycast={() => null} />
      ))}
    </>
  );
}

function Rail({ count }: { count: number }) {
  const half = ((count - 1) / 2) * SPACING + RAIL_MARGIN;
  return (
    <group position={[0, RAIL_Y, 0]}>
      {/* soft shadow under the rail, on the wall behind */}
      <mesh position={[0, -0.06, -0.45]} renderOrder={-1} raycast={() => null}>
        <planeGeometry args={[half * 2.1, 0.1]} />
        <meshBasicMaterial color="#000" alphaMap={shadowTexture("blob")} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, half * 2, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[-half, half].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0, -0.052]}>
            <boxGeometry args={[0.115, 0.24, 0.045]} />
            <meshStandardMaterial color="#b9bcbd" metalness={0.7} roughness={0.28} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.085, 24]} />
            <meshStandardMaterial color="#c8cbcc" metalness={0.8} roughness={0.2} />
          </mesh>
          {[-0.085, 0.085].map((y) => (
            <mesh key={y} position={[0, y, -0.025]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.007, 12]} />
              <meshStandardMaterial color="#777b7d" metalness={0.8} roughness={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/*
 * Frames the rack: the rail fills a set share of the width, and the rail
 * sits at a set height on screen (about a quarter from the top).
 */
function CameraRig({ count }: { count: number }) {
  const { camera, size, gl } = useThree();
  useFrame(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const mobile = size.width <= 800;
    const railLength = (count - 1) * SPACING + RAIL_MARGIN * 2 + 0.2;
    const tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / size.height;
    const widthShare = mobile ? 0.94 : 0.74;
    const byWidth = railLength / widthShare / (2 * tan * aspect);
    const byHeight = (GARMENT_HEIGHT + 0.6) / (mobile ? 0.5 : 0.62) / (2 * tan);
    const distance = Math.max(byWidth, byHeight);
    const visibleHeight = 2 * distance * tan;
    const railFromTop = mobile ? 0.36 : 0.27;
    perspective.position.set(0, RAIL_Y - (0.5 - railFromTop) * visibleHeight, distance);
    perspective.updateProjectionMatrix();
    gl.domElement.dataset.rackReady = "true";
  });
  return null;
}

/* Keeps the name label under the open garment, in screen space. */
function LabelTracker({
  onLabel,
  active,
  count,
  positions,
}: {
  onLabel: (position: { x: number; y: number } | null) => void;
  active: RefObject<number | null>;
  count: number;
  positions: RefObject<number[]>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const open = active.current;
    if (open === null) {
      onLabel(null);
      return;
    }
    point.set(positions.current[open] ?? openX(open, count, visibleHalfWidth(camera, size.width / size.height)), RAIL_Y - GARMENT_TOP - GARMENT_HEIGHT * 0.98, 0).project(camera);
    onLabel({ x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height + 10 });
  });
  return null;
}

/*
 * The rack inside the canvas. One invisible plane covers the whole rack;
 * hit testing follows the animated hanger positions. The open garment has
 * a wider hit region so it stays selected while the pointer crosses its front.
 */
function Rack({
  items,
  onLabel,
  onActive,
  activeIndex,
  onSelect,
}: {
  items: RackItem[];
  onLabel: (position: { x: number; y: number } | null) => void;
  onActive: (index: number | null) => void;
  activeIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const count = items.length;
  const active = useRef<number | null>(null);
  const pointer = useRef<PointerState | null>(null);
  const positions = useRef(items.map((_, index) => restX(index, count)));
  const pointerType = useRef("mouse");
  const leaveTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => { active.current = activeIndex; }, [activeIndex]);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const choose = (x: number) => {
    window.clearTimeout(leaveTimer.current);
    const open = active.current;
    if (open !== null && Math.abs(x - positions.current[open]) < FRONT_HALF * 0.85) return open;
    let slot = 0;
    for (let index = 1; index < count; index++) {
      if (Math.abs(x - positions.current[index]) < Math.abs(x - positions.current[slot])) slot = index;
    }
    if (Math.abs(x - positions.current[slot]) > SPACING * 0.7) {
      active.current = null;
      onActive(null);
      return null;
    }
    if (slot === open) return slot;
    active.current = slot;
    onActive(slot);
    return slot;
  };

  // leaving the rack closes the open garment after a short pause
  const leave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      if (active.current === null) return;
      active.current = null;
      onActive(null);
    }, 120);
  };

  useFrame(() => {
    pointer.current?.velocity.multiplyScalar(0.85);
  });

  const width = (count - 1) * SPACING + RAIL_MARGIN * 2;

  return (
    <>
      <CameraRig count={count} />
      <LabelTracker onLabel={onLabel} active={active} count={count} positions={positions} />
      <Rail count={count} />
      <mesh
        position={[0, RAIL_Y - HANGER_DROP - GARMENT_HEIGHT / 2, 0.4]}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          choose(event.point.x);
          const previous = pointer.current?.point ?? event.point.clone();
          pointer.current = {
            point: event.point.clone(),
            velocity: event.point.clone().sub(previous).multiplyScalar(60),
          };
        }}
        onPointerDown={(event) => { pointerType.current = event.pointerType; }}
        onClick={(event) => {
          const previous = active.current;
          const slot = choose(event.point.x);
          if (slot !== null && (pointerType.current !== "touch" || previous === slot)) onSelect(slot);
        }}
        onPointerLeave={(event) => { if (event.pointerType !== "touch") leave(); }}
      >
        <planeGeometry args={[width, GARMENT_HEIGHT]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        {items.map((item, index) => (
          <Garment
            key={item.id}
            asset={item.asset}
            index={index}
            count={count}
            active={active}
            pointer={pointer}
            positions={positions}
          />
        ))}
      </Suspense>
    </>
  );
}

export default function ShopRack3D({
  items,
  onLabel,
  onActive,
  activeIndex,
  onSelect,
  paused = false,
}: {
  items: RackItem[];
  /** Screen position for the open garment's name, or null when none is open. */
  onLabel: (position: { x: number; y: number } | null) => void;
  onActive: (index: number | null) => void;
  activeIndex: number | null;
  onSelect: (index: number) => void;
  paused?: boolean;
}) {
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop={paused ? "never" : "always"}
      camera={{ position: [0, 0, 7], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.8} />
      <directionalLight position={[-3, 1, 2]} intensity={0.6} />
      <Rack items={items} onLabel={onLabel} onActive={onActive} activeIndex={activeIndex} onSelect={onSelect} />
    </Canvas>
  );
}
