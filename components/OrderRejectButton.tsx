import { useEffect, useRef, useState } from 'react';

interface OrderRejectButtonProps {
  status: string;
  onConfirm: () => void;
  disabled?: boolean;
  buttonClassName?: string;
  tooltipClassName?: string;
  tooltipBubbleClassName?: string;
  tooltipArrowClassName?: string;
}

export default function OrderRejectButton({
  status,
  onConfirm,
  disabled = false,
  buttonClassName = '',
  tooltipClassName = '',
  tooltipBubbleClassName = '',
  tooltipArrowClassName = '',
}: OrderRejectButtonProps) {
  const lastTap = useRef<number>(0);
  const [showRejectHint, setShowRejectHint] = useState(false);
  const hintTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
    };
  }, []);

  const label = status === 'pending' ? 'Reject' : 'Cancel';
  const hintText = status === 'pending' ? 'Double tap to reject' : 'Double tap to cancel';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          const now = Date.now();
          if (now - lastTap.current < 500) {
            if (hintTimer.current) clearTimeout(hintTimer.current);
            setShowRejectHint(false);
            onConfirm();
          } else {
            lastTap.current = now;
            setShowRejectHint(true);
            if (hintTimer.current) clearTimeout(hintTimer.current);
            hintTimer.current = setTimeout(() => setShowRejectHint(false), 1800);
          }
        }}
        onDoubleClick={() => {
          if (disabled) return;
          onConfirm();
        }}
        disabled={disabled}
        className={buttonClassName}
      >
        {label}
      </button>
      <div
        className={`pointer-events-none absolute bottom-full right-0 mb-2 text-xs transition-opacity duration-300 ${
          showRejectHint ? 'opacity-100' : 'opacity-0'
        } ${tooltipClassName}`}
        role="tooltip"
      >
        <div
          className={`relative rounded px-2 py-1 shadow ${tooltipBubbleClassName}`}
        >
          {hintText}
          <div
            className={`absolute left-1/2 -bottom-1 h-2 w-2 -translate-x-1/2 rotate-45 ${tooltipArrowClassName}`}
          />
        </div>
      </div>
    </div>
  );
}
