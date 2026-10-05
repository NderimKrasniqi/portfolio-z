"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Cloth, type Vec3 } from "./shop-cloth";
import type { ShopAsset } from "./shop-assets";

/*
 * Prototype: one garment on a 3D rail with cloth physics.
 *
 * The garment hangs from a hanger that can swing (pendulum around the rail)
 * and turn (yaw). Two cloth sheets hang from the hanger at 90° to each
 * other: the front photo and the side photo. At rest the garment is turned
 * sideways, so the side sheet faces the camera; on hover it turns to face
 * the camera. Each sheet fades with the angle it shows to the camera.
 */

const RAIL_Y = 1.15;
const METAL = { color: "#e4e4e2", metalness: 0.35, roughness: 0.35 };
const GARMENT_HEIGHT = 2.1;
const HANGER_DROP = 0.2; // hook on the rail to the top of the garment
const SIDE_YAW = Math.PI * 0.42;

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

function Garment({ asset, x }: { asset: ShopAsset; x: number }) {
  const [front, side] = useLoader(THREE.TextureLoader, [asset.front, asset.side]);
  const swingGroup = useRef<THREE.Group>(null);
  const yawGroup = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const motion = useRef({ yaw: SIDE_YAW, yawVelocity: 0, swing: 0, swingVelocity: 0, ready: false });
  const pointer = useRef<{ point: THREE.Vector3; velocity: THREE.Vector3 } | null>(null);

  const sheets = useMemo(() => {
    const frontAspect = (front.image as HTMLImageElement).width / (front.image as HTMLImageElement).height;
    const sideAspect = (side.image as HTMLImageElement).width / (side.image as HTMLImageElement).height;
    // The top edge follows the hanger: a gentle slope down to the shoulders.
    const shoulder = (x: number, w: number) => -HANGER_DROP - 0.18 * (x / (w / 2)) ** 2;
    const frontWidth = GARMENT_HEIGHT * frontAspect;
    const sideWidth = GARMENT_HEIGHT * sideAspect;
    return [
      makeSheet(front, frontWidth, (lx, ly) => new THREE.Vector3(lx, ly + shoulder(lx, frontWidth), 0)),
      makeSheet(side, sideWidth, (lx, ly) => new THREE.Vector3(0, ly + shoulder(lx, sideWidth) * 0.4, lx)),
    ];
  }, [front, side]);

  const temp = useMemo(() => new THREE.Vector3(), []);
  // the shoulder bar sits inside the garment; it fades with the front photo
  const barMaterial = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const m = motion.current;
    const swingNode = swingGroup.current;
    const yawNode = yawGroup.current;
    if (!swingNode || !yawNode) return;

    // turn: spring towards front (hovered) or side
    const target = hovered ? 0 : SIDE_YAW;
    const yawForce = (target - m.yaw) * 38 - m.yawVelocity * 9;
    m.yawVelocity += yawForce * dt;
    m.yaw += m.yawVelocity * dt;

    // swing: pendulum around the rail, kicked by turning and by the pointer
    const swingForce = -(9.8 / 1.4) * Math.sin(m.swing) - m.swingVelocity * 1.6 + m.yawVelocity * 0.35;
    m.swingVelocity += swingForce * dt;
    m.swing += m.swingVelocity * dt;

    swingNode.rotation.z = m.swing;
    yawNode.rotation.y = m.yaw;
    swingNode.updateMatrixWorld(true);
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
        new THREE.Vector3(-0.36, -HANGER_DROP - 0.3, -0.03),
        new THREE.Vector3(0, -HANGER_DROP - 0.1, -0.03),
        new THREE.Vector3(0.36, -HANGER_DROP - 0.3, -0.03),
      ),
    [],
  );

  return (
    <>
      <group ref={swingGroup} position={[x, RAIL_Y, 0]}>
        <group ref={yawGroup}>
          {/* hook over the rail */}
          <mesh position={[0, 0.0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.05, 0.008, 8, 24, Math.PI * 1.25]} />
            <meshStandardMaterial {...METAL} color="#b4b4b2" />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
            <meshStandardMaterial {...METAL} color="#b4b4b2" />
          </mesh>
          {/* wooden neck and shoulder bar (mostly hidden in the garment) */}
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

      {sheets.map((sheet, n) => (
        <mesh
          key={n}
          geometry={sheet.geometry}
          material={sheet.material}
          renderOrder={n}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onPointerMove={(event) => {
            const previous = pointer.current?.point ?? event.point.clone();
            pointer.current = {
              point: event.point.clone(),
              velocity: event.point.clone().sub(previous).multiplyScalar(60),
            };
          }}
        />
      ))}
    </>
  );
}

function Rail() {
  return (
    <group position={[0, RAIL_Y, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 4.6, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[-2.3, 2.3].map((x) => (
        <mesh key={x} position={[x, 0, -0.04]}>
          <boxGeometry args={[0.07, 0.22, 0.05]} />
          <meshStandardMaterial {...METAL} color="#cfcfcd" />
        </mesh>
      ))}
    </group>
  );
}

export default function ShopRack3D({ asset }: { asset: ShopAsset }) {
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: [0, 0, 6.4], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.8} />
      <directionalLight position={[-3, 1, 2]} intensity={0.6} />
      <Rail />
      <Suspense fallback={null}>
        <Garment asset={asset} x={0} />
      </Suspense>
    </Canvas>
  );
}
