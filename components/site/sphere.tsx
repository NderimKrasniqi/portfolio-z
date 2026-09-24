"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Media } from "@/lib/model";
import { mediaUrl, MediaView } from "./media";
export default function Sphere({
  items,
  draft = false,
}: {
  items: Media[];
  draft?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 7;
    const group = new THREE.Group();
    scene.add(group);
    const textures: THREE.Texture[] = [];
    let disposed = false;
    const loader = new THREE.TextureLoader();
    items.forEach((item, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / items.length),
        theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const texture = loader.load(mediaUrl(item.thumbKey, draft), () => {
        if (disposed) return;
        renderer.render(scene, camera);
      });
      textures.push(texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, (0.9 * item.height) / item.width),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
      );
      mesh.position.setFromSphericalCoords(2, phi, theta);
      mesh.lookAt(mesh.position.clone().multiplyScalar(2));
      group.add(mesh);
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    resize.observe(el);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true,
      frame = 0,
      last = 0;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(el);
    const draw = (time: number) => {
      if (visible && !document.hidden) {
        if (!motion.matches)
          group.rotation.y += Math.min(time - last, 50) * 0.00012;
        renderer.render(scene, camera);
      }
      last = time;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      group.children.forEach((child) => {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [items, draft]);
  if (failed)
    return (
      <div className="gallery-grid">
        {items.map((m) => (
          <MediaView key={m.id} media={m} draft={draft} />
        ))}
      </div>
    );
  return (
    <>
      <div ref={container} className="sphere-stage" aria-hidden="true" />
      <p className="eyebrow">Switch to Grid to browse individual works.</p>
    </>
  );
}
