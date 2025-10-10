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
        "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium select-none transition-colors transition-shadow duration-150 ease-in-out shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 disabled:shadow-none",
        {
          "border border-primary bg-primary text-white shadow-md hover:bg-primary/90 hover:shadow-md":
            variant === "primary" || active,
          "border border-neutral-300 bg-neutral-50 text-neutral-800 hover:bg-neutral-100 hover:shadow-md":
            variant === "secondary" && !active,
          "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:shadow-md":
            variant === "outline" && !active,
        },
        className,
      )}
    />
  );
}

export type { AdminButtonProps };
