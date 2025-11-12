import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "icon" | "destructive"
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
}

export function Button({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 ease-out select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--brand-color,theme(colors.sky.500))]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        fullWidth && "w-full",

        // Sizes
        size === "sm" && "px-3 py-1 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-3 text-base",

        // Variants with improved contrast
        variant === "primary" &&
          "bg-[var(--brand-color,theme(colors.sky.500))] text-white hover:brightness-110 border border-transparent shadow-sm",
        variant === "secondary" &&
          "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50",
        variant === "icon" &&
          "w-9 h-9 rounded-full border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
        variant === "destructive" &&
          "bg-red-500 text-white hover:bg-red-600 border border-transparent shadow-sm",

        // Automatic adjustment for very light backgrounds
        "backdrop-saturate-150 supports-[backdrop-filter]:backdrop-blur-md",
        className
      )}
    >
      {children}
    </button>
  )
}

export default Button
