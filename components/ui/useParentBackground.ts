import * as React from "react";

export function useParentBackground() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.body;
    if (!el) return;
    const bg = window.getComputedStyle(el).backgroundColor;
    if (!bg) {
      setIsDark(false);
      return;
    }

    const values = bg.match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (!values || values.length < 3) {
      setIsDark(false);
      return;
    }

    const [r, g, b, alpha] = values as [number, number, number, number?];
    if (typeof alpha === "number" && alpha === 0) {
      setIsDark(false);
      return;
    }

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    setIsDark(brightness < 128);
  }, []);

  return isDark;
}
