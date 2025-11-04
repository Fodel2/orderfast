import type { ReactNode, SVGProps } from 'react';

export type PlateIconProps = {
  size?: number;
  className?: string;
  withBadge?: boolean;
  title?: string;
  color?: string;
  children?: ReactNode;
} & SVGProps<SVGSVGElement>;

export default function PlateIcon({
  size = 24,
  className,
  withBadge = false,
  title,
  color,
  children,
  role,
  ...rest
}: PlateIconProps) {
  const { ['aria-hidden']: ariaHidden, ...svgProps } = rest;
  const stroke = color ?? 'currentColor';
  const scale = size / 24;
  const strokeWidth = 1.5 * scale;
  const tongueColor = color ?? 'currentColor';
  const resolvedRole = title ? 'img' : role ?? 'presentation';
  const resolvedAriaHidden = title ? ariaHidden ?? undefined : ariaHidden ?? true;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={resolvedRole}
      aria-label={title}
      aria-hidden={resolvedAriaHidden}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={12} cy={12} r={10} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx={12} cy={12} r={8.25} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx={9} cy={10} r={0.8} fill={stroke} />
      <circle cx={15} cy={10} r={0.8} fill={stroke} />
      <path
        d="M7.6 13.2c1.6 2 5.2 2 6.8 0"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M13.45 14.25c1.2 0 2.15.6 2.15 1.4 0 .95-.95 1.75-1.85 1.75-.95 0-1.85-.75-1.85-1.65 0-.8.7-1.5 1.55-1.5z"
        fill={tongueColor}
        fillOpacity={0.9}
      />
      <path
        d="M14.35 14.7v1.1"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.6}
        strokeLinecap="round"
        opacity={0.3}
      />
      {withBadge ? (
        <g transform="translate(16.5 16.5)">
          <circle
            cx={0}
            cy={0}
            r={3.6}
            fill="var(--badge-bg, #fff)"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <path
            d="M0 -1.5v3M-1.5 0h3"
            stroke={stroke}
            strokeWidth={strokeWidth * 0.9}
            strokeLinecap="round"
          />
        </g>
      ) : null}
      {children}
    </svg>
  );
}
