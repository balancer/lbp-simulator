"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";

type Background3DProps = {
  /**
   * Set to true while sidebar is opening/closing.
   * This will reduce GPU load (lower DPR + half-rate particle updates)
   * to keep UI animations smooth.
   */
  sidebarAnimating?: boolean;

  /**
   * Particle count (default 300)
   */
  count?: number;
};

type Particle = {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  z: number;
  orbitSpeed: number;
  orbitRadius: number;
  initialAngle: number;
  animationDelay: number;
  animationDuration: number;
};

function Particles({
  count = 300,
  sidebarAnimating = false,
}: {
  count?: number;
  sidebarAnimating?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  const { resolvedTheme } = useTheme();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const startTime = useRef<number>(0);
  const frameCount = useRef(0);

  // Mark instanceMatrix as dynamic (driver hint, helps perf)
  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  /**
   * IMPORTANT PERF CHANGE:
   * - We generate particles ONCE (only depends on count)
   * - We intentionally do NOT regenerate on viewport resize.
   *   Resizing (sidebar open/close) would otherwise recreate all particles and spike FPS.
   *
   * We "sample" the viewport at creation time.
   */
  const particles = useMemo<Particle[]>(() => {
    const temp: Particle[] = [];

    // Sample initial viewport size once
    const vw = viewport.width;
    const vh = viewport.height;

    const centerY = 0;
    const spreadRadius = 8;
    const borderDistance = Math.max(vw, vh) * 0.6;

    for (let i = 0; i < count; i++) {
      const targetAngle = Math.random() * Math.PI * 2;
      const targetRadius = Math.random() * spreadRadius;

      const targetX = Math.cos(targetAngle) * targetRadius;
      const targetY = centerY + Math.sin(targetAngle) * targetRadius;

      const edge = Math.floor(Math.random() * 4);
      let startX = 0;
      let startY = 0;

      if (edge === 0) {
        startX = (Math.random() - 0.5) * vw;
        startY = borderDistance;
      } else if (edge === 1) {
        startX = borderDistance;
        startY = (Math.random() - 0.5) * vh;
      } else if (edge === 2) {
        startX = (Math.random() - 0.5) * vw;
        startY = -borderDistance;
      } else {
        startX = -borderDistance;
        startY = (Math.random() - 0.5) * vh;
      }

      const z = (Math.random() - 0.5) * 10;
      const orbitSpeed = 0.3 + Math.random() * 0.5;
      const orbitRadius = targetRadius;
      const initialAngle = targetAngle;
      const animationDelay = Math.random() * 0.5;
      const animationDuration = 1.5 + Math.random() * 0.5;

      temp.push({
        startX,
        startY,
        targetX,
        targetY,
        x: startX,
        y: startY,
        z,
        orbitSpeed,
        orbitRadius,
        initialAngle,
        animationDelay,
        animationDuration,
      });
    }

    return temp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    startTime.current = performance.now();
  }, []);

  useFrame((state) => {
    const currentMesh = mesh.current;
    if (!currentMesh) return;

    // PERF: while sidebar animates, update at half rate (still looks smooth)
    if (sidebarAnimating) {
      frameCount.current++;
      if (frameCount.current % 2 === 0) return;
    }

    const time = state.clock.elapsedTime;
    const elapsed = (performance.now() - startTime.current) / 1000;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      const animTime = Math.max(0, elapsed - p.animationDelay);
      const progress = Math.min(1, animTime / p.animationDuration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const currentX = p.startX + (p.targetX - p.startX) * easedProgress;
      const currentY = p.startY + (p.targetY - p.startY) * easedProgress;

      let finalX = currentX;
      let finalY = currentY;

      if (progress >= 1) {
        const timeSinceComplete = elapsed - p.animationDelay - p.animationDuration;

        const angle = p.initialAngle + timeSinceComplete * p.orbitSpeed;
        const orbitX = Math.cos(angle) * p.orbitRadius;
        const orbitY = Math.sin(angle) * p.orbitRadius;

        const floatY = Math.sin(time * 0.5 + i * 0.1) * 0.5;
        const floatX = Math.cos(time * 0.3 + i * 0.15) * 0.3;

        finalX = orbitX + floatX;
        finalY = orbitY + floatY;
      }

      p.x = finalX;
      p.y = finalY;

      const zOffset = Math.sin(time * 0.4 + i * 0.1) * 1;

      dummy.position.set(p.x, p.y, p.z + zOffset);

      const scale = 0.7 + Math.sin(time * 2 + i * 0.1) * 0.3;
      dummy.scale.set(scale, scale, scale);

      const rotation = time * 0.5 + i * 0.1;
      dummy.rotation.set(rotation * 0.5, rotation * 0.3, rotation * 0.4);

      dummy.updateMatrix();
      currentMesh.setMatrixAt(i, dummy.matrix);
    }

    currentMesh.instanceMatrix.needsUpdate = true;
  });

  const color = resolvedTheme === "dark" ? "#ffffff" : "#000000";
  const opacity = resolvedTheme === "dark" ? 0.3 : 0.2;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.05, 0]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.5}
        metalness={0.5}
      />
    </instancedMesh>
  );
}

export function Background3D({
  sidebarAnimating = false,
  count = 300,
}: Background3DProps) {
  // PERF: don’t use React state for mouse position. Update transforms via refs + rAF.
  const lightRef = useRef<HTMLDivElement>(null);
  const lightDarkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let x = 0;
    let y = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;

      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;

        // Move with transform only (no layout). translate3d keeps it on compositor.
        const t = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

        if (lightRef.current) lightRef.current.style.transform = t;
        if (lightDarkRef.current) lightDarkRef.current.style.transform = t;
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Light mode blur */}
      <div
        ref={lightRef}
        className="fixed pointer-events-none -z-10 dark:hidden"
        style={{
          left: 0,
          top: 0,
          width: "800px",
          height: "800px",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 30%, transparent 60%)",
          borderRadius: "50%",
          filter: "blur(80px)",
          mixBlendMode: "overlay",
          willChange: "transform",
          transform: "translate3d(0px, 0px, 0) translate(-50%, -50%)",
        }}
      />

      {/* Dark mode blur */}
      <div
        ref={lightDarkRef}
        className="fixed pointer-events-none -z-10 hidden dark:block"
        style={{
          left: 0,
          top: 0,
          width: "800px",
          height: "800px",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 30%, transparent 60%)",
          borderRadius: "50%",
          filter: "blur(80px)",
          mixBlendMode: "overlay",
          willChange: "transform",
          transform: "translate3d(0px, 0px, 0) translate(-50%, -50%)",
        }}
      />

      {/* 3D particles */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 75 }}
          // PERF: lower DPR while sidebar animates (less GPU work)
          dpr={sidebarAnimating ? 1 : [1, 2]}
          // Optional: avoid extra overhead
          gl={{ powerPreference: "high-performance", antialias: false }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Particles count={count} sidebarAnimating={sidebarAnimating} />
        </Canvas>
      </div>
    </>
  );
}
