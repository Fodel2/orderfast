import { ReactNode } from 'react';
import PlateIcon from '@/components/icons/PlateIcon';

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  className = '',
  icon,
  children,
}: EmptyStateProps) {
  const baseClass = 'flex flex-col items-center justify-center gap-3 text-center py-10';
  return (
    <div className={`${baseClass}${className ? ` ${className}` : ''}`}>
      {icon ?? <PlateIcon size={64} className="text-gray-300" aria-hidden />}
      {title ? <h3 className="text-base font-semibold text-gray-900">{title}</h3> : null}
      {description ? <p className="text-sm text-gray-500 max-w-sm">{description}</p> : null}
      {children}
    </div>
  );
}
