/**
 * Ensure a UTC timestamp string is recognized as UTC by the browser.
 * Backend sends ISO strings without timezone suffix — append 'Z' if missing.
 */
function ensureUtc(ts: string): string {
  if (!ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10)) {
    return ts + 'Z';
  }
  return ts;
}

/**
 * Format a UTC timestamp string to IST 12-hour format.
 */
export function formatIST(utcTimestamp: string): string {
  try {
    return new Date(ensureUtc(utcTimestamp)).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return utcTimestamp;
  }
}

/**
 * Format a UTC timestamp to IST time only (HH:MM:SS AM/PM).
 */
export function formatISTTime(utcTimestamp: string): string {
  try {
    return new Date(ensureUtc(utcTimestamp)).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return utcTimestamp;
  }
}
