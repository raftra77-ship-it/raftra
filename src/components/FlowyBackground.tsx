import React from "react";
import { MeshGradient } from "@paper-design/shaders-react";

// This renders on every route, so it has to stay cheap:
// - minPixelRatio 1 instead of the library default of 2 (2x DPI = 4x the pixels every frame).
// - maxPixelCount caps the shader on high-DPI/4K screens (library default is 8.29M pixels).
// A mesh gradient is a soft blur, so neither is noticeable, but both cut GPU work sharply.
// width/height are inline CSS only (not render resolution), so CSS handles resizing and we
// don't need a resize listener re-rendering React on every frame of a window drag.
const MAX_PIXELS = 1920 * 1080; // ~2.07M vs the 8.29M default

function FlowyBackgroundImpl() {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -10 }}>
      <MeshGradient
        width="100%"
        height="100%"
        colors={["#000000", "#0a1930", "#112240", "#020c1b", "#172a45", "#0a1930"]}
        distortion={0.8}
        swirl={0.6}
        grainMixer={0}
        grainOverlay={0}
        speed={0.42}
        offsetX={0.08}
        minPixelRatio={1}
        maxPixelCount={MAX_PIXELS}
      />
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.4)", pointerEvents: "none" }} />
    </div>
  );
}

// Takes no props, so memo stops route changes from re-rendering (and remounting) the shader.
export const FlowyBackground = React.memo(FlowyBackgroundImpl);
