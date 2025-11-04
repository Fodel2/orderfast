import clsx from 'clsx';

type PlateIconProps = {
  size?: number;
  className?: string;
  tone?: string;
  badgeColor?: string;
  showPlus?: boolean;
};

function BasePlateIcon({
  size = 28,
  className = '',
  tone,
  badgeColor,
  showPlus = false,
}: PlateIconProps) {
  const strokeColor = tone || 'currentColor';
  const faceColor = tone || 'currentColor';
  const plusFill = badgeColor || 'var(--brand,#16a34a)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={clsx('shrink-0', className)}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="28" fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="32" r="20" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="28" r="2.6" fill={faceColor} />
      <circle cx="40" cy="28" r="2.6" fill={faceColor} />
      <path
        d="M21 36c3.2 2.4 7.1 3.8 11 3.8s7.8-1.4 11-3.8"
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M45 40c0 6-5 11-11 11s-11-5-11-11c0-1.2 1.1-2 2.2-1.6 2.7.9 5.7 1.4 8.8 1.4s6.1-.5 8.8-1.4c1.1-.4 2.2.4 2.2 1.6Z"
        fill={strokeColor}
        fillOpacity={0.18}
      />
      {showPlus ? (
        <g transform="translate(44,44)">
          <circle r="10" fill={plusFill} />
          <path d="M-6 0h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 -6v12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}

export function PlateIconAdd({ size, className, tone, badgeColor }: Omit<PlateIconProps, 'showPlus'>) {
  return (
    <BasePlateIcon
      size={size}
      className={className}
      tone={tone}
      badgeColor={badgeColor}
      showPlus
    />
  );
}

export default function PlateIcon({ size, className, tone }: Omit<PlateIconProps, 'showPlus' | 'badgeColor'>) {
  return <BasePlateIcon size={size} className={className} tone={tone} />;
}

