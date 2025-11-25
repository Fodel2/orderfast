import React from 'react';

export default function OpenBadge({ isOpen }: { isOpen?: boolean | null }) {
  const isOpenState = Boolean(isOpen);
  const activeStyles = {
    border: '1px solid var(--brand)',
    background: 'var(--brand)',
    color: '#ffffff',
  } as const;
  const inactiveStyles = {
    border: '1px solid var(--muted)',
    background: 'var(--card)',
    color: 'var(--muted)',
  } as const;

  return (
    <span
      className="pill"
      style={isOpenState ? activeStyles : inactiveStyles}
    >
      {isOpenState ? 'Open' : 'Closed'}
    </span>
  );
}
