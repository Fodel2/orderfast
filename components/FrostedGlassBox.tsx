import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface FrostedGlassBoxProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable frosted glass container with default fade-in and slide-up animation.
 */
export default function FrostedGlassBox({ children, className = '' }: FrostedGlassBoxProps) {
  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
