import { ReactNode, SVGProps } from 'react';

interface PlateIconShapesProps {
  accentFallback?: string;
}

export function PlateIconShapes({ accentFallback = '#9ca3af' }: PlateIconShapesProps = {}) {
  return (
    <>
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M45 40c0 6-5 11-11 11s-11-5-11-11c0-1.2 1.1-2 2.2-1.6 2.7.9 5.7 1.4 8.8 1.4s6.1-.5 8.8-1.4c1.1-.4 2.2.4 2.2 1.6Z"
        fill={`var(--brand, ${accentFallback})`}
      />
      <path
        d="M21 36c3.2 2.4 7.1 3.8 11 3.8s7.8-1.4 11-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
}

interface PlateIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
  children?: ReactNode;
  accentFallback?: string;
  title?: string;
}

export default function PlateIcon(props: PlateIconProps) {
  const {
    size = 32,
    className = '',
    children,
    accentFallback,
    title,
    role,
    'aria-hidden': ariaHidden,
    ...rest
  } = props;

  const resolvedRole = title ? 'img' : role ?? 'presentation';
  const resolvedAriaHidden = title ? ariaHidden : ariaHidden ?? true;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={resolvedRole}
      aria-label={title}
      aria-hidden={resolvedAriaHidden}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <PlateIconShapes accentFallback={accentFallback} />
      {children}
    </svg>
  );
}
