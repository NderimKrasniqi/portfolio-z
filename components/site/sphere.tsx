"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Media } from "@/lib/model";
import { mediaUrl } from "./media";

export default function Sphere({ items, draft = false, onSelect, onReady }: {
  items: Media[];
  draft?: boolean;
  onSelect: (index: number) => void;
  onReady: (ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = container.current;
    if (!el || !items.length) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { queueMicrotask(() => { setFailed(true); onReady(false); }); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0xffffff, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.z = 7.5;
    const group = new THREE.Group();
    scene.add(group);
    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    const meshes: THREE.Mesh[] = [];
    const radius = 2.35;
    let disposed = false;
    items.forEach((item, index) => {
      const latitude = Math.acos(1 - 2 * (index + .5) / items.length);
      const longitude = Math.PI * (1 + Math.sqrt(5)) * index;
      const texture = loader.load(mediaUrl(item.thumbKey, draft), () => { if (!disposed) renderer.render(scene, camera); });
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: .94 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.59, .79), material);
      mesh.position.setFromSphericalCoords(radius, latitude, longitude);
      mesh.lookAt(mesh.position.clone().multiplyScalar(2));
      mesh.userData.index = index;
      meshes.push(mesh);
      group.add(mesh);
    });
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const resize = () => {
      const width = el.clientWidth, height = el.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    onReady(true);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes)[0];
      if (hit) onSelect(hit.object.userData.index as number);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      group.rotation.y += Math.sign(event.deltaY) * .16;
      renderer.render(scene, camera);
    };
    const onPointerDown = (event: PointerEvent) => { renderer.domElement.setPointerCapture(event.pointerId); lastX = event.clientX; };
    const onPointerMove = (event: PointerEvent) => {
      if (lastX === null) return;
      group.rotation.y += (event.clientX - lastX) * .004;
      lastX = event.clientX;
      renderer.render(scene, camera);
    };
    const onPointerUp = () => { lastX = null; };
    let lastX: number | null = null;
    const canvas = renderer.domElement;
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true, last = 0, frame = 0;
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    intersection.observe(el);
    const draw = (time: number) => {
      if (visible && !document.hidden) {
        if (!reduced.matches) group.rotation.y += Math.min(time - last, 50) * .0001;
        renderer.render(scene, camera);
      }
      last = time;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      onReady(false);
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      meshes.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose(); canvas.remove();
    };
  }, [items, draft, onSelect, onReady]);
  if (failed) return <p className="gallery-webgl-fallback" role="status">WEBGL UNAVAILABLE · USE GRID</p>;
  return <div ref={container} className="reference-three-sphere" />;
}
