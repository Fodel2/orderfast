import React, { useEffect, useState } from 'react';

function readableText(color?: string | null) {
  if (!color) return '#111827';
  const c = color.trim();
  const rgbMatch = c.match(/rgb[a]?\(([^)]+)\)/i);
  const hslMatch = c.match(/hsl[a]?\(([^)]+)\)/i);
  let r: number, g: number, b: number;

  if (hslMatch) {
    const parts = hslMatch[1]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => v.replace('%', ''));
    const h = parseFloat(parts[0] || '0');
    const s = (parseFloat(parts[1] || '0') || 0) / 100;
    const l = (parseFloat(parts[2] || '0') || 0) / 100;
    const cVal = (1 - Math.abs(2 * l - 1)) * s;
    const x = cVal * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - cVal / 2;
    const [r1, g1, b1] =
      h < 60
        ? [cVal, x, 0]
        : h < 120
        ? [x, cVal, 0]
        : h < 180
        ? [0, cVal, x]
        : h < 240
        ? [0, x, cVal]
        : h < 300
        ? [x, 0, cVal]
        : [cVal, 0, x];
    r = Math.round((r1 + m) * 255);
    g = Math.round((g1 + m) * 255);
    b = Math.round((b1 + m) * 255);
  } else if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((v) => parseFloat(v.trim()));
    [r, g, b] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  } else {
    const h = c.replace('#', '');
    const hex = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    r = parseInt(hex.slice(0, 2) || '00', 16);
    g = parseInt(hex.slice(2, 4) || '00', 16);
    b = parseInt(hex.slice(4, 6) || '00', 16);
  }

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#111827' : '#ffffff';
}

export default function OpenBadge({ isOpen }: { isOpen?: boolean | null }) {
  const [colors, setColors] = useState({
    openBg: '#111827',
    closedBg: '#ffffff',
    closedBorder: '#9ca3af',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rootEl =
      (document.querySelector('[data-brand-root]') as HTMLElement | null) ||
      document.documentElement;
    const styles = getComputedStyle(rootEl);
    const openBg = styles.getPropertyValue('--brand').trim() || '#111827';
    const closedBg = styles.getPropertyValue('--card').trim() || '#ffffff';
    const closedBorder = styles.getPropertyValue('--muted').trim() || '#9ca3af';
    setColors({ openBg, closedBg, closedBorder });
  }, []);

  const isOpenState = Boolean(isOpen);
  const activeStyles = {
    border: `1px solid ${colors.openBg}`,
    background: colors.openBg,
    color: readableText(colors.openBg),
  } as const;
  const inactiveStyles = {
    border: `1px solid ${colors.closedBorder}`,
    background: colors.closedBg,
    color: readableText(colors.closedBg),
  } as const;

  return (
    <span className="pill" style={isOpenState ? activeStyles : inactiveStyles}>
      {isOpenState ? 'Open' : 'Closed'}
    </span>
  );
}
