import { useEffect } from 'react';

interface ScanFeedbackProps {
  type: 'success' | 'error' | 'warning' | null;
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function ScanFeedback({
  type,
  message,
  onDismiss,
  autoDismissMs = 4000,
}: ScanFeedbackProps) {
  useEffect(() => {
    if ((type === 'success' || type === 'warning') && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, type === 'warning' ? 6000 : autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [type, onDismiss, autoDismissMs]);

  if (!type || !message) return null;

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  const icons = {
    success: '\u2705',
    error: '\u274C',
    warning: '\u26A0\uFE0F',
  };

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 p-4 rounded-md border ${styles[type]}`}
    >
      <span className="text-xl shrink-0">{icons[type]}</span>
      <p className="text-sm flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
