import React from "react";
import clsx from "clsx";

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
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium transition-all select-none focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed",
        {
          "bg-primary text-white hover:bg-primary/90": variant === "primary" || active,
          "bg-neutral-100 text-neutral-800 hover:bg-neutral-200": variant === "secondary" && !active,
          "border border-neutral-300 text-neutral-700 hover:bg-neutral-50": variant === "outline",
        },
        className,
      )}
    />
  );
}

export type { AdminButtonProps };
