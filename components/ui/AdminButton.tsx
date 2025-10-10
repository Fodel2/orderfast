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
        "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium select-none border border-neutral-300 bg-white text-neutral-700 shadow-sm transition-colors transition-shadow duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 disabled:shadow-none",
        {
          "bg-primary text-white border-primary shadow-md hover:bg-primary/90 hover:shadow-md": variant === "primary" || active,
          "hover:bg-neutral-50 hover:shadow-md": (variant === "secondary" || variant === "outline") && !active,
        },
        className,
      )}
    />
  );
}

export type { AdminButtonProps };
