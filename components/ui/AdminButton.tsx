import React from "react";
import clsx from "clsx";
import { useParentBackground } from "./useParentBackground";

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  active?: boolean;
}

export function AdminButton({
  variant = "secondary",
  active,
  className,
  ...props
}: AdminButtonProps) {
  const isDark = useParentBackground();

  const baseClasses =
    "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium select-none transition-colors transition-shadow duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 disabled:shadow-none";

  const primaryClasses =
    "border border-primary bg-primary text-white shadow-md hover:bg-primary/90 hover:shadow-lg focus:ring-primary/40";

  const secondaryLightClasses =
    "border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:ring-neutral-500";

  const secondaryDarkClasses =
    "border border-neutral-600 bg-neutral-800 text-white shadow-sm hover:bg-neutral-700 hover:shadow-md focus:ring-white";

  const outlineLightClasses =
    "border border-neutral-300 text-neutral-700 bg-white shadow-sm hover:bg-neutral-50 hover:shadow-md focus:ring-neutral-500";

  const outlineDarkClasses =
    "border border-white/60 text-white bg-transparent shadow-sm hover:bg-white/10 hover:shadow-md focus:ring-white";

  const variantClasses =
    variant === "primary" || active
      ? primaryClasses
      : variant === "outline"
      ? isDark
        ? outlineDarkClasses
        : outlineLightClasses
      : isDark
      ? secondaryDarkClasses
      : secondaryLightClasses;

  return (
    <button
      {...props}
      className={clsx(baseClasses, variantClasses, className)}
    />
  );
}

export type { AdminButtonProps };
