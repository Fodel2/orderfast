import { type ReactNode } from 'react';

type NonFullscreenRestaurantShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
  contentClassName?: string;
};

export default function NonFullscreenRestaurantShell({
  children,
  maxWidthClassName = 'max-w-[440px]',
  contentClassName,
}: NonFullscreenRestaurantShellProps) {
  const resolvedContentClassName = ['relative z-10 mx-auto w-full', maxWidthClassName, contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-900">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 bg-slate-950"
        style={{ height: 'calc(env(safe-area-inset-top, 0px) + 112px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 bg-slate-950"
        style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 82px)' }}
      />

      <main
        className="relative min-h-screen px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <div className={resolvedContentClassName}>{children}</div>
      </main>
    </div>
  );
}
