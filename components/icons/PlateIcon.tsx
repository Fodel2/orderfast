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
  const primaryTone = tone || 'var(--brand-primary,#0d9488)';
  const faceTone = 'var(--plate-face,#0f172a)';
  const plusTone = badgeColor || 'var(--plate-plus,#16a34a)';

  const viewBox = 64;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      className={className}
      aria-hidden="true"
    >
      <g fill="none" strokeLinejoin="round">
        <circle
          cx="32"
          cy="32"
          r="29"
          fill="var(--plate-outer,#f8fafc)"
          stroke={primaryTone}
          strokeWidth="2.5"
        />
        <circle
          cx="32"
          cy="32"
          r="20"
          fill="#ffffff"
          stroke={primaryTone}
          strokeWidth="1.8"
          strokeOpacity="0.35"
        />
        <g fill={faceTone} stroke={faceTone} strokeLinecap="round" strokeWidth="2.4">
          <circle cx="24.5" cy="28" r="2.8" />
          <circle cx="39.5" cy="28" r="2.8" />
          <path d="M22 40c3.4 4.4 16.6 4.4 20 0" strokeLinejoin="round" />
        </g>
      </g>
      {showPlus ? (
        <g transform="translate(44,44)">
          <circle r="10" fill={plusTone} />
          <path d="M-5 0h10M0 -5v10" stroke="#fff" strokeLinecap="round" strokeWidth="2.8" />
        </g>
      ) : null}
    </svg>
  );
}

export function PlateIconAdd({
  size,
  className,
  tone,
  badgeColor,
}: Omit<PlateIconProps, 'showPlus'>) {
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

export default function PlateIcon({ size, className, tone }: PlateIconProps) {
  return <BasePlateIcon size={size} className={className} tone={tone} />;
}

