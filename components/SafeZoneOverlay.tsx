import React from "react";

export default function SafeZoneOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute top-[5%] left-[5%] right-[5%] bottom-[5%] border border-dashed border-white/40 rounded-lg" />
    </div>
  );
}
