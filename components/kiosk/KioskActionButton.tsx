import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-5 py-2 text-base font-semibold tracking-wide text-white shadow-md shadow-black/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kiosk-accent,#111827)]/40';

const accentClasses = 'bg-[var(--kiosk-accent,#111827)] hover:brightness-110 active:translate-y-px';

type KioskButtonBaseProps = {
  children: ReactNode;
  className?: string;
};

type ButtonVariantProps = KioskButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkVariantProps = KioskButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> &
  LinkProps & {
    href: LinkProps['href'];
  };

type KioskActionButtonProps = ButtonVariantProps | LinkVariantProps;

export default function KioskActionButton(props: KioskActionButtonProps) {
  if ('href' in props && typeof props.href !== 'undefined') {
    const { className, children, href, ...linkProps } = props as LinkVariantProps;
    return (
      <Link href={href} className={cn(baseClasses, accentClasses, className)} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { className, children, type = 'button', ...buttonProps } = props as ButtonVariantProps;

  return (
    <button type={type} className={cn(baseClasses, accentClasses, className)} {...buttonProps}>
      {children}
    </button>
  );
}
