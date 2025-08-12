import React from 'react';

export default function OpenBadge({ isOpen }: { isOpen?: boolean | null }) {
  return (
    <span
      className="brand-pill"
      style={{
        border: `1px solid var(--brand)`,
        color: isOpen ? 'var(--brand-700)' : 'var(--muted)',
        background: 'var(--card)',
      }}
    >
      {isOpen ? 'Open' : 'Closed'}
    </span>
  );
}
