import React from "react";
import clsx from "clsx";
import { useParentBackground } from "./useParentBackground";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export default function Button({ className = "", type = "button", ...props }: ButtonProps) {
  const isDark = useParentBackground();

  const baseClasses =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none";

  const themeClasses = isDark
    ? "bg-neutral-800 text-white border border-neutral-600 shadow-sm hover:bg-neutral-700 hover:shadow-md focus:ring-white"
    : "bg-white text-neutral-900 border border-neutral-300 shadow-sm hover:bg-neutral-100 hover:shadow-md focus:ring-neutral-500";

  return (
    <button
      {...props}
      type={type}
      className={clsx("btn-primary", baseClasses, themeClasses, className)}
    />
  );
}

