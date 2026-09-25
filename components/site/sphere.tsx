"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Media } from "@/lib/model";
import { mediaUrl } from "./media";
import {
  CAMERA_FOV,
  CAMERA_Z,
  focalPx,
  roomScale,
  sphereUnits,
  targetCardPx,
} from "./gallery-geometry";

export default function Sphere({
  items,
  draft = false,
  onSelect,
  onReady,
  onRotationChange,
  rotationY = 0,
  animate = false,
}: {
  items: Media[];
  draft?: boolean;
  onSelect: (index: number) => void;
  onReady: (ready: boolean) => void;
  onRotationChange?: (rotation: number) => void;
  rotationY?: number;
  animate?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const worldRef = useRef<THREE.Group | null>(null);
  const rotationYRef = useRef(0);
  const animateRef = useRef(false);
  const needsRenderRef = useRef(false);

  const onSelectRef = useRef(onSelect);
  const onReadyRef = useRef(onReady);
  const onRotationChangeRef = useRef(onRotationChange);

  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
    onReadyRef.current = onReady;
    onRotationChangeRef.current = onRotationChange;
  }, [onReady, onRotationChange, onSelect]);

  useLayoutEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useLayoutEffect(() => {
    const rotation = rotationY ?? 0;
    rotationYRef.current = rotation;

    if (worldRef.current) {
      worldRef.current.rotation.y = rotation;
      needsRenderRef.current = true;
      onRotationChangeRef.current?.(rotation);
    }
  }, [rotationY]);

  useEffect(() => {
    const el = container.current;
    if (!el || !items.length) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => { setFailed(true); onReadyRef.current(false); });
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, .1, 100);
    camera.position.set(0, 0, CAMERA_Z);
    const world = new THREE.Group();
    world.rotation.x = -.055;
    world.rotation.y = rotationYRef.current;
    worldRef.current = world;
    scene.add(world);
    const loader = new THREE.TextureLoader();
    const points = sphereUnits(items.length);
    const textures: THREE.Texture[] = [];
    const sprites: THREE.Sprite[] = [];
    let disposed = false;

    const widthFor = (index: number) => {
      const viewportWidth = el.clientWidth || window.innerWidth;
      return targetCardPx(index, viewportWidth) * CAMERA_Z / focalPx(el.clientHeight || window.innerHeight);
    };
    const addTexture = (item: Media) => new Promise<THREE.Texture>((resolve) => {
      loader.load(
        mediaUrl(item.thumbKey, draft),
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          resolve(texture);
        },
        undefined,
        () => {
          const canvas = document.createElement("canvas");
          canvas.width = 4; canvas.height = 4;
          const context = canvas.getContext("2d");
          if (context) { context.fillStyle = "#ececea"; context.fillRect(0, 0, 4, 4); }
          resolve(new THREE.CanvasTexture(canvas));
        },
      );
    });

    const load = async () => {
      const loaded = await Promise.all(items.map(addTexture));
      if (disposed) {
        loaded.forEach((texture) => texture.dispose());
        return;
      }
      loaded.forEach((texture, index) => {
        textures.push(texture);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1, depthTest: true, depthWrite: true });
        const sprite = new THREE.Sprite(material);
        const point = points[index];
        const scale = roomScale(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight);
        sprite.position.set(point.x * scale.x, point.y * scale.y, point.z * scale.z);
        const cardWidth = widthFor(index);
        sprite.scale.set(cardWidth, cardWidth * 4 / 3, 1);
        sprite.userData.index = index;
        world.add(sprite);
        sprites.push(sprite);
      });
      renderer.render(scene, camera);
      onRotationChangeRef.current?.(world.rotation.y);
      onReadyRef.current(true);
    };

    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;

    const resize = () => {
      const width = Math.max(1, el.clientWidth || window.innerWidth);
      const height = Math.max(1, el.clientHeight || window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = CAMERA_FOV;
      camera.position.z = CAMERA_Z;
      camera.updateProjectionMatrix();
      const scale = roomScale(width, height);
      sprites.forEach((sprite, index) => {
        const point = points[index];
        sprite.position.set(point.x * scale.x, point.y * scale.y, point.z * scale.z);
        const cardWidth = targetCardPx(index, width) * CAMERA_Z / focalPx(height);
        sprite.scale.set(cardWidth, cardWidth * 4 / 3, 1);
      });
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas = renderer.domElement;
    const onClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(sprites)[0];
      if (hit) onSelectRef.current(hit.object.userData.index as number);
    };
    let spinVelocity = 0;
    let lastX: number | null = null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      spinVelocity = Math.max(-.072, Math.min(.072, spinVelocity + Math.max(-.026, Math.min(.026, event.deltaY * .0002))));
    };
    const onPointerDown = (event: PointerEvent) => { canvas.setPointerCapture(event.pointerId); lastX = event.clientX; };
    const onPointerMove = (event: PointerEvent) => {
      if (lastX === null) return;
      spinVelocity = Math.max(-.072, Math.min(.072, spinVelocity + (event.clientX - lastX) * .0002));
      lastX = event.clientX;
    };
    const onPointerUp = () => { lastX = null; };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let last = performance.now();
    let frame = 0;
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    intersection.observe(el);
    const draw = (time: number) => {
      const delta = Math.min(time - last, 50) / 1000;
      if (visible && !document.hidden && (animateRef.current || needsRenderRef.current)) {
        if (animateRef.current && Math.abs(spinVelocity) > .00002) {
          world.rotation.y += spinVelocity * delta * 60;
          spinVelocity *= Math.pow(.875, delta * 60);
        } else if (animateRef.current && !reduced.matches) {
          world.rotation.y += .13 * delta;
        }
        renderer.render(scene, camera);
        onRotationChangeRef.current?.(world.rotation.y);
        needsRenderRef.current = false;
      }
      if (!animateRef.current) spinVelocity = 0;
      last = time;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    void load();

    return () => {
      disposed = true;
      onReadyRef.current(false);
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      sprites.forEach((sprite) => { sprite.geometry.dispose(); (sprite.material as THREE.Material).dispose(); });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      canvas.remove();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [draft, items]);

  if (failed) return <p className="gallery-webgl-fallback" role="status">WEBGL UNAVAILABLE · USE GRID</p>;
  return <div ref={container} className="reference-three-sphere" />;
}
