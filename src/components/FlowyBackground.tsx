import React, { useEffect, useState, useRef } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { animate, utils } from "animejs";

export function FlowyBackground() {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);
  const particleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Anime.js floating particle animation loop
  useEffect(() => {
    if (!mounted || !particleContainerRef.current) return;

    const particles = particleContainerRef.current.querySelectorAll('.anime-particle');
    
    // Anime.js v4 continuous floating animation
    const anim = animate(particles, {
      translateX: () => utils.random(-150, 150),
      translateY: () => utils.random(-150, 150),
      scale: () => [utils.random(0.5, 1.2), utils.random(0.8, 1.6)],
      opacity: () => [utils.random(0.2, 0.5), utils.random(0.5, 0.9)],
      duration: () => utils.random(4000, 8000),
      delay: () => utils.random(0, 2000),
      direction: 'alternate',
      loop: true,
      ease: 'inOutSine'
    });

    return () => {
      anim.pause();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -10, overflow: "hidden" }}>
      <MeshGradient
        width={dimensions.width}
        height={dimensions.height}
        colors={["#000000", "#0a1930", "#112240", "#020c1b", "#172a45", "#0a1930"]}
        distortion={0.8}
        swirl={0.6}
        grainMixer={0}
        grainOverlay={0}
        speed={0.42}
        offsetX={0.08}
      />
      
      {/* Anime.js Floating Glowing Particles Overlay */}
      <div ref={particleContainerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="anime-particle"
            style={{
              position: "absolute",
              top: `${(i * 6.5) % 90 + 5}%`,
              left: `${(i * 12.3) % 90 + 5}%`,
              width: `${(i % 3) * 6 + 6}px`,
              height: `${(i % 3) * 6 + 6}px`,
              borderRadius: "50%",
              background: i % 2 === 0 ? "radial-gradient(circle, rgba(90,82,255,0.8) 0%, rgba(90,82,255,0) 70%)" : "radial-gradient(circle, rgba(0,230,118,0.8) 0%, rgba(0,230,118,0) 70%)",
              boxShadow: i % 2 === 0 ? "0 0 16px rgba(90,82,255,0.6)" : "0 0 16px rgba(0,230,118,0.6)",
              pointerEvents: "none"
            }}
          />
        ))}
      </div>

      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.4)", pointerEvents: "none" }} />
    </div>
  );
}
