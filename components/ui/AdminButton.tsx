import React from "react";
import clsx from "clsx";

export interface AdminButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  active?: boolean;
}

function getBrightness(color: string) {
  const rgb = color.match(/\d+/g)?.map(Number);
  if (!rgb) return 255;
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

function useAdaptiveTheme() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const bg = window.getComputedStyle(document.body).backgroundColor;
    setIsDark(getBrightness(bg) < 128);
  }, []);

  return isDark;
}

export function AdminButton({
  variant = "secondary",
  active,
  className = "",
  children,
  ...props
}: AdminButtonProps) {
  const isDark = useAdaptiveTheme();

  const baseClasses =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const themeClasses = isDark
    ? "bg-neutral-800 text-white border border-neutral-600 hover:bg-neutral-700 focus:ring-white"
    : "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100 focus:ring-neutral-500";

  const primaryClasses =
    "bg-primary text-white border border-primary hover:bg-primary/90 focus:ring-primary";

  const outlineClasses = isDark
    ? "bg-transparent text-white border border-white/60 hover:bg-white/10 focus:ring-white"
    : "bg-transparent text-neutral-900 border border-neutral-300 hover:bg-neutral-50 focus:ring-neutral-500";

  const variantClasses =
    variant === "primary" || active
      ? primaryClasses
      : variant === "outline"
      ? outlineClasses
      : themeClasses;

  return (
    <button className={clsx(baseClasses, variantClasses, className)} {...props}>
      {children}
    </button>
  );
}

export default AdminButton;
