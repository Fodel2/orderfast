import { useEffect, useState } from 'react';

interface BreakCountdownProps {
  breakUntil: string;
  onEnd: () => void;
}

export default function BreakCountdown({ breakUntil, onEnd }: BreakCountdownProps) {
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

  return (
    <div className="bg-red-100 text-red-800 font-bold rounded p-2 mb-2 inline-block">
      <div className="text-sm">On Break</div>
      <div className="text-lg">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
      <div className="text-xs font-normal">Resumes at {resumeAt}</div>
    </div>
  );
}
