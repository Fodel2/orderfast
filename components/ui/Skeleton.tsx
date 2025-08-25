import React from 'react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function Skeleton({ className = '', ...props }: { className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse bg-neutral-200/80', className)} {...props} />;
}

export default Skeleton;
