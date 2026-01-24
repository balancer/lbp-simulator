"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";

function Particles({ count = 1000 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  const { resolvedTheme } = useTheme();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const startTime = useRef(Date.now());

  // Generate random positions and properties - particles will start from borders and move to center
  const particles = useMemo(() => {
    const temp = [];
    const centerY = 0; // Center of screen
    const spreadRadius = 8; // How far particles spread from center at target
    const borderDistance = Math.max(viewport.width, viewport.height) * 0.6; // Start from borders
    
    for (let i = 0; i < count; i++) {
      // Target position: around center
      const targetAngle = Math.random() * Math.PI * 2;
      const targetRadius = Math.random() * spreadRadius;
      const targetX = Math.cos(targetAngle) * targetRadius;
      const targetY = centerY + Math.sin(targetAngle) * targetRadius;
      
      // Start position: from borders (random edge)
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let startX, startY;
      
      if (edge === 0) { // Top
        startX = (Math.random() - 0.5) * viewport.width;
        startY = borderDistance;
      } else if (edge === 1) { // Right
        startX = borderDistance;
        startY = (Math.random() - 0.5) * viewport.height;
      } else if (edge === 2) { // Bottom
        startX = (Math.random() - 0.5) * viewport.width;
        startY = -borderDistance;
      } else { // Left
        startX = -borderDistance;
        startY = (Math.random() - 0.5) * viewport.height;
      }
      
      const z = (Math.random() - 0.5) * 10; // Depth variation
      const orbitSpeed = 0.3 + Math.random() * 0.5; // Orbital speed variation
      const orbitRadius = targetRadius;
      const initialAngle = targetAngle;
      const animationDelay = Math.random() * 0.5; // Stagger the animation
      const animationDuration = 1.5 + Math.random() * 0.5; // Vary animation duration
      
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
  }, [count, viewport.width, viewport.height]);

  useFrame((state) => {
    const currentMesh = mesh.current;
    if (!currentMesh) return;

    const time = state.clock.elapsedTime;
    const elapsed = (Date.now() - startTime.current) / 1000; // Time since component mounted

    particles.forEach((particle, i) => {
      // Calculate animation progress (0 to 1)
      const animTime = Math.max(0, elapsed - particle.animationDelay);
      const progress = Math.min(1, animTime / particle.animationDuration);
      
      // Easing function for smooth animation (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate from start position to target position
      const currentX = particle.startX + (particle.targetX - particle.startX) * easedProgress;
      const currentY = particle.startY + (particle.targetY - particle.startY) * easedProgress;
      
      // Once animation is complete, add orbital motion
      let finalX = currentX;
      let finalY = currentY;
      
      if (progress >= 1) {
        // Calculate time since animation completed
        const timeSinceComplete = elapsed - particle.animationDelay - particle.animationDuration;
        // Create orbital motion around the center (behind title)
        const angle = particle.initialAngle + timeSinceComplete * particle.orbitSpeed;
        const orbitX = Math.cos(angle) * particle.orbitRadius;
        const orbitY = Math.sin(angle) * particle.orbitRadius;
        
        // Add some floating/breathing effect
        const floatY = Math.sin(time * 0.5 + i * 0.1) * 0.5;
        const floatX = Math.cos(time * 0.3 + i * 0.15) * 0.3;
        
        finalX = orbitX + floatX;
        finalY = orbitY + floatY;
      }
      
      particle.x = finalX;
      particle.y = finalY;

      // Subtle z-axis oscillation for depth
      const zOffset = Math.sin(time * 0.4 + i * 0.1) * 1;

      // Update dummy object position
      dummy.position.set(particle.x, particle.y, particle.z + zOffset);

      // Subtle scale pulse
      const scale = 0.7 + Math.sin(time * 2 + i * 0.1) * 0.3;
      dummy.scale.set(scale, scale, scale);

      // Gentle rotation
      const rotation = time * 0.5 + i * 0.1;
      dummy.rotation.set(rotation * 0.5, rotation * 0.3, rotation * 0.4);
      dummy.updateMatrix();

      currentMesh.setMatrixAt(i, dummy.matrix);
    });

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

export function Background3D() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      {/* Circular blur effect that follows mouse - softer */}
      <div
        className="fixed pointer-events-none -z-10 transition-all duration-300 ease-out dark:hidden"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "800px",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 30%, transparent 60%)",
          borderRadius: "50%",
          filter: "blur(80px)",
          mixBlendMode: "overlay",
        }}
      />
      {/* Dark mode blur - softer */}
      <div
        className="fixed pointer-events-none -z-10 transition-all duration-300 ease-out hidden dark:block"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "800px",
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 30%, transparent 60%)",
          borderRadius: "50%",
          filter: "blur(80px)",
          mixBlendMode: "overlay",
        }}
      />
      {/* 3D Particles behind title */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Particles count={300} />
        </Canvas>
      </div>
    </>
  );
}
