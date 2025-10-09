import React from "react";

export default function SafeZoneOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "5%",
          bottom: "5%",
          left: "5%",
          right: "5%",
          border: "1px dashed rgba(255,255,255,0.3)",
          borderRadius: "4px",
        }}
      />
    </div>
  );
}
