import { useCallback, useEffect, useRef, useState } from 'react';

type KeyboardViewportState = {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
  keyboardHeight: number;
  hasVisualViewport: boolean;
};

const defaultState: KeyboardViewportState = {
  height: 0,
  width: 0,
  offsetTop: 0,
  offsetLeft: 0,
  keyboardHeight: 0,
  hasVisualViewport: false,
};

const getKeyboardViewportState = (): KeyboardViewportState => {
  if (typeof window === 'undefined') return defaultState;
  const visualViewport = window.visualViewport;
  const height = visualViewport?.height ?? window.innerHeight;
  const width = visualViewport?.width ?? window.innerWidth;
  const offsetTop = visualViewport?.offsetTop ?? 0;
  const offsetLeft = visualViewport?.offsetLeft ?? 0;
  const keyboardHeight = Math.max(0, window.innerHeight - height - offsetTop);

  return {
    height,
    width,
    offsetTop,
    offsetLeft,
    keyboardHeight,
    hasVisualViewport: Boolean(visualViewport),
  };
};

const applyViewportCssVars = (state: KeyboardViewportState) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--vvh', `${state.height}px`);
  root.style.setProperty('--vv-offset-top', `${state.offsetTop}px`);
  root.style.setProperty('--keyboard-height', `${state.keyboardHeight}px`);
};

export const useKeyboardViewport = (enabled = true) => {
  const [state, setState] = useState<KeyboardViewportState>(defaultState);
  const rafRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const next = getKeyboardViewportState();
    setState(next);
    applyViewportCssVars(next);
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(update);
  }, [update]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const visualViewport = window.visualViewport;

    scheduleUpdate();

    visualViewport?.addEventListener('resize', scheduleUpdate);
    visualViewport?.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      visualViewport?.removeEventListener('resize', scheduleUpdate);
      visualViewport?.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
    };
  }, [enabled, scheduleUpdate]);

  return { ...state, refresh: scheduleUpdate };
};
