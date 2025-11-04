import { memo } from 'react';
import PlateIcon from '@/components/icons/PlateIcon';

function PlateAdd({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <PlateIcon
      size={size}
      className={className}
      withBadge
      title="Add to Plate"
      color="var(--brand, currentColor)"
    />
  );
}

export default memo(PlateAdd);
