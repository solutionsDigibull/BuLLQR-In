import { useRef, useEffect, type KeyboardEvent } from 'react';

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onScan: (barcode: string) => void;
  disabled?: boolean;
  error?: string;
}

const MIN_LENGTH = 20;
const MAX_LENGTH = 100;
const REFOCUS_INTERVAL_MS = 2000;

export default function BarcodeInput({
  value,
  onChange,
  onScan,
  disabled = false,
  error,
}: BarcodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and when re-enabled
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  // Interval-based refocus to keep barcode input active, but skip when the
  // user is interacting with another form control (e.g. <select> dropdowns).
  useEffect(() => {
    if (disabled) return;
    const interval = setInterval(() => {
      const active = document.activeElement;
      if (active && (active.tagName === 'SELECT' || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }
      inputRef.current?.focus();
    }, REFOCUS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [disabled]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH) {
        onScan(trimmed);
      }
    }
  }

  const trimmed = value.trim();
  const lengthHint =
    trimmed.length > 0 && trimmed.length < MIN_LENGTH
      ? `${trimmed.length}/${MIN_LENGTH} min characters`
      : trimmed.length > MAX_LENGTH
        ? `${trimmed.length}/${MAX_LENGTH} max characters`
        : null;

  const isInvalid =
    trimmed.length > 0 &&
    (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH);

  return (
    <div>
      <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Scan
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="barcode-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Scan here"
          autoComplete="off"
          className={`w-full px-4 py-3 text-lg font-mono border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200 ${
            error || isInvalid ? 'border-danger' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {trimmed.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
            {trimmed.length} chars
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      {!error && lengthHint && (
        <p className="mt-1 text-sm text-warning">{lengthHint}</p>
      )}
    </div>
  );
}
