import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

export function FlowyBackground() {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
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

    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -10, overflow: "hidden", background: "linear-gradient(135deg, #030306 0%, #0a0e1a 50%, #030306 100%)" }}>
      {useMesh && (
        <MeshGradient
          width={dimensions.width}
          height={dimensions.height}
          colors={["#030306", "#0a1930", "#112240", "#020c1b", "#172a45", "#0a1930"]}
          distortion={0.8}
          swirl={0.6}
          grainMixer={0}
          grainOverlay={0}
          speed={0.42}
          offsetX={0.08}
        />
      )}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(3, 3, 3, 0.4)", pointerEvents: "none" }} />
    </div>
  );
}
