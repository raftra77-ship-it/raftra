import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

export function FlowyBackground() {
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [mounted, setMounted] = useState(false);
  const [useMesh, setUseMesh] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setUseMesh(false);
      }
    } catch {
      setUseMesh(false);
    }

    let timeoutId: any = null;
    const update = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Cap WebGL render buffer size to 1280x720 for ultra high 60fps performance without GPU lag
        const w = Math.min(window.innerWidth, 1280);
        const h = Math.min(window.innerHeight, 720);
        setDimensions({ width: w, height: h });
      }, 200);
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      width: "100vw", 
      height: "100vh", 
      zIndex: -10, 
      overflow: "hidden", 
      background: "linear-gradient(135deg, #030306 0%, #0a0e1a 50%, #030306 100%)",
      transform: "translateZ(0)",
      willChange: "transform"
    }}>
      {useMesh && (
        <div style={{ width: "100%", height: "100%", opacity: 0.85 }}>
          <MeshGradient
            width={dimensions.width}
            height={dimensions.height}
            colors={["#030306", "#0a1930", "#112240", "#020c1b", "#172a45", "#0a1930"]}
            distortion={0.7}
            swirl={0.5}
            grainMixer={0}
            grainOverlay={0}
            speed={0.25}
            offsetX={0.08}
          />
        </div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(3, 3, 3, 0.4)", pointerEvents: "none" }} />
    </div>
  );
}
