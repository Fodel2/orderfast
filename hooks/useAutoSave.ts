import { useCallback, useEffect, useRef } from 'react';

type AutoSaveOptions = {
  save: () => Promise<void> | void;
  delay?: number;
};

export function useAutoSave({ save, delay = 800 }: AutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerAutoSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      Promise.resolve(save()).catch((error) => {
        console.error('Auto-save failed', error);
      });
    }, delay);
  }, [delay, save]);

  return { triggerAutoSave };
}
