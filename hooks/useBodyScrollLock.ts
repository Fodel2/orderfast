import { useEffect, useRef } from 'react';

type BodyScrollStyleSnapshot = {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
};

export const useBodyScrollLock = (locked: boolean) => {
  const scrollYRef = useRef(0);
  const previousStylesRef = useRef<BodyScrollStyleSnapshot | null>(null);

  useEffect(() => {
    if (!locked || typeof window === 'undefined') return;
    const body = document.body;

    previousStylesRef.current = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    scrollYRef.current = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      if (previousStylesRef.current) {
        const prev = previousStylesRef.current;
        body.style.position = prev.position;
        body.style.top = prev.top;
        body.style.left = prev.left;
        body.style.right = prev.right;
        body.style.width = prev.width;
        body.style.overflow = prev.overflow;
      }
      window.scrollTo(0, scrollYRef.current);
    };
  }, [locked]);
};
