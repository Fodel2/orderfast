import type { SVGProps } from 'react';

export type PlateIconProps = {
  size?: number;
  className?: string;
  withBadge?: boolean;
  title?: string;
  color?: string;
} & SVGProps<SVGSVGElement>;

export default function PlateIcon({
  size = 24,
  color,
  className,
  withBadge = false,
  title,
  role,
  "aria-hidden": ariaHidden,
  ...props
}: PlateIconProps) {
  const stroke = color ?? 'currentColor';
  const scale = size / 24;
  const strokeWidth = 1.5 * scale;
  const tongueColor = color ?? 'currentColor';
  const resolvedRole = title ? 'img' : role ?? 'presentation';
  const resolvedAriaHidden = title ? ariaHidden ?? undefined : ariaHidden ?? true;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={resolvedRole}
      aria-hidden={resolvedAriaHidden}
      aria-label={title}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={12} cy={12} r={10} />
      <circle cx={12} cy={12} r={8.5} />
      <path d="M8.5 13.5c1.2 1 3.8 1.1 5.3 0" strokeLinecap="round" />
      <path
        d="M13.6 13.9c.6 0 1.1.4 1.1.9 0 .6-.5 1.1-1.1 1.1-.5 0-1-.5-1-.9 0-.5.4-1.1 1-.9z"
        fill={tongueColor}
        fillOpacity={0.8}
        stroke="none"
      />
      {withBadge ? (
        <g transform="translate(16.5 16.5)">
          <circle cx={0} cy={0} r={3.6} fill="var(--badge-bg, #fff)" stroke={stroke} />
          <path d="M0 -1.5v3M-1.5 0h3" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}

export { PlateIcon };
