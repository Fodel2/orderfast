import React from "react";

import { tokens } from "../src/ui/tokens";

export default function SafeZoneOverlay({ visible }: { visible: boolean }) {
  const minInset = tokens.spacing.md;
  const maxInset = tokens.spacing.xl + tokens.spacing.sm;
  const safeInset = `clamp(${minInset}px, 5%, ${maxInset}px)`;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 998,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          width: `calc(100% - ${safeInset} * 2)`,
          height: `calc(100% - ${safeInset} * 2)`,
          border: `${tokens.border.thin}px dashed rgba(255, 255, 255, 0.4)`,
          borderRadius: `${tokens.radius.md}px`,
          boxShadow: "inset 0 0 20px rgba(255, 255, 255, 0.1)",
          transition: "all 0.2s ease",
        }}
      />
    </div>
  );
}
