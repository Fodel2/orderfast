import React from "react";

export default function SafeZoneOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[998] transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute top-[5%] left-[5%] right-[5%] bottom-[5%] rounded-lg border border-dashed border-white/40" />
    </div>
  );
}
