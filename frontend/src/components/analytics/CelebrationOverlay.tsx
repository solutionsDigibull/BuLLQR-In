import { useEffect } from 'react';

interface CelebrationOverlayProps {
  onDismiss: () => void;
}

const BALLOONS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${8 + (i * 7.5)}%`,
  delay: `${(i * 0.15).toFixed(2)}s`,
  duration: `${2.5 + (i % 3) * 0.5}s`,
}));

export default function CelebrationOverlay({ onDismiss }: CelebrationOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {BALLOONS.map((b) => (
        <span
          key={b.id}
          className="absolute text-4xl animate-balloon"
          style={{
            left: b.left,
            bottom: '-60px',
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        >
          {'\uD83C\uDF88'}
        </span>
      ))}
      <div className="absolute inset-x-0 top-1/3 text-center pointer-events-auto">
        <div className="inline-block bg-white/90 backdrop-blur rounded-xl shadow-xl px-8 py-5">
          <p className="text-3xl font-bold text-primary mb-1">Target Completed!</p>
          <p className="text-gray-500">Congratulations to the team!</p>
        </div>
      </div>
    </div>
  );
}
