import { useEffect, useState } from 'react';

interface BreakCountdownProps {
  breakUntil: string;
  onEnd: () => void;
  variant?: 'dashboard' | 'kod';
  className?: string;
}

export default function BreakCountdown({
  breakUntil,
  onEnd,
  variant = 'dashboard',
  className = '',
}: BreakCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(
    new Date(breakUntil).getTime() - Date.now()
  );

  useEffect(() => {
    const update = () => {
      const diff = new Date(breakUntil).getTime() - Date.now();
      if (diff <= 0) {
        onEnd();
        setTimeLeft(0);
        return;
      }
      setTimeLeft(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [breakUntil, onEnd]);

  if (timeLeft <= 0) return null;

  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);
  const resumeAt = new Date(breakUntil).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const baseClass =
    variant === 'kod'
      ? 'rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-rose-100 shadow-lg shadow-black/30 backdrop-blur'
      : 'bg-red-100 text-red-800 font-bold rounded p-2 mb-2 inline-block';

  const labelClass = variant === 'kod' ? 'text-[10px]' : 'text-sm';
  const timeClass = variant === 'kod' ? 'text-base' : 'text-lg';
  const subClass = variant === 'kod' ? 'text-[10px]' : 'text-xs font-normal';

  return (
    <div className={`${baseClass} ${className}`}>
      <div className={labelClass}>On Break</div>
      <div className={timeClass}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className={subClass}>Resumes at {resumeAt}</div>
    </div>
  );
}
