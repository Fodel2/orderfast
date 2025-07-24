import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface FloatingIconLayerProps {
  /**
   * Optional z-index for the container. Defaults to -1 so it stays behind content.
   */
  zIndex?: number;
  /** Additional Tailwind classes */
  className?: string;
}

/**
 * Renders a set of subtle floating food icons positioned randomly across the screen.
 * Uses framer-motion for lightweight animations.
 */
export default function FloatingIconLayer({ zIndex = -1, className = '' }: FloatingIconLayerProps) {
  const items = useMemo(() => {
    const icons = ['🍔', '🍕', '🍣', '🍩', '🌮', '🥗'];
    const count = 3 + Math.floor(Math.random() * 3); // between 3-5 icons

    return Array.from({ length: count }).map(() => ({
      icon: icons[Math.floor(Math.random() * icons.length)],
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 4,
    }));
  }, []);

  return (
    <div
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex }}
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl sm:text-5xl opacity-20 blur-sm select-none"
          style={{ top: `${item.top}%`, left: `${item.left}%`, translate: '-50% -50%' }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: item.delay }}
        >
          {item.icon}
        </motion.div>
      ))}
    </div>
  );
}
