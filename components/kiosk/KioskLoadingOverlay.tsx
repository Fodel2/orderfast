import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';

const LOADING_JOKES = [
  'Stirring the sauce…',
  'Convincing the chef…',
  'Sharpening digital knives…',
  'Pre-heating virtual ovens…',
  'Whispering your order to the kitchen…',
];

function getRandomJoke() {
  return LOADING_JOKES[Math.floor(Math.random() * LOADING_JOKES.length)];
}

export default function KioskLoadingOverlay({
  visible,
}: {
  visible: boolean;
}) {
  const joke = useMemo(() => getRandomJoke(), [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-white/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="flex flex-col items-center gap-4 px-6 text-center text-neutral-800">
            <div className="h-16 w-16 rounded-full border-4 border-neutral-900/20 border-t-neutral-900/80 animate-spin" />
            <p className="text-lg font-semibold text-neutral-900 drop-shadow-sm">{joke}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
