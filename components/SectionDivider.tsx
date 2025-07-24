import { motion } from 'framer-motion';

interface SectionDividerProps {
  /** Place the divider at the top or bottom of the section */
  position?: 'top' | 'bottom';
  /** Color used to fill the wave */
  fill?: string;
  /** Height of the divider in pixels */
  height?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Decorative SVG wave used to smoothly divide two full-height sections.
 * Appears at the bottom by default but can be positioned at the top.
 */
export default function SectionDivider({
  position = 'bottom',
  fill = '#ffffff',
  height = 120,
  className = '',
}: SectionDividerProps) {
  const isTop = position === 'top';
  return (
    <motion.div
      data-testid="section-divider"
      initial={{ opacity: 0, y: isTop ? -20 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`pointer-events-none w-full overflow-hidden leading-none ${
        isTop ? 'rotate-180' : ''
      } ${className}`.trim()}
      style={{ height }}
    >
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="block w-full h-full"
      >
        <path
          d="M0,192L80,176C160,160,320,128,480,128C640,128,800,160,960,181.3C1120,203,1280,213,1360,218.7L1440,224V320H1360C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320H0Z"
          fill={fill}
        />
      </svg>
    </motion.div>
  );
}
