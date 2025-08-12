// dev: debug flag (auto-hides after 3s)
import React, { useEffect, useState } from 'react';

export default function DebugFlag({ label }: { label: string }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        background: 'rgba(220, 38, 38, 0.95)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 6px',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {label}
    </div>
  );
}
