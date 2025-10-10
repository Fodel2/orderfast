import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 900) {
  const getInitialMatch = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(`(max-width:${breakpoint}px)`).matches;
  };

  const [isMobile, setIsMobile] = useState(getInitialMatch);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(`(max-width:${breakpoint}px)`);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if ("matches" in event) {
        setIsMobile(event.matches);
        return;
      }
      setIsMobile((event as MediaQueryList).matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    return () => mediaQuery.removeListener(handleChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
  }, [breakpoint]);

  return isMobile;
}
