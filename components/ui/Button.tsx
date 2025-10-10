import React from "react";
import clsx from "clsx";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

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

const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  type = "button",
  ...props
}) => {
  const isDark = useAdaptiveTheme();

  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-full px-4 py-2 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const themeClasses = isDark
    ? "bg-neutral-800 text-white border border-neutral-600 hover:bg-neutral-700 focus:ring-white"
    : "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100 focus:ring-neutral-500";

  return (
    <button
      type={type}
      className={clsx(baseClasses, themeClasses, className)}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
export { Button };
