import { useWebSocket } from '../../context/WebSocketContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import UserProfileDropdown from './UserProfileDropdown.tsx';

export default function Header() {
  const { status } = useWebSocket();
  const { theme, toggleTheme } = useTheme();

  const statusColor =
    status === 'connected'
      ? 'bg-success'
      : status === 'connecting'
        ? 'bg-warning'
        : 'bg-danger';

  return (
    <header className="bg-black h-16 flex items-center justify-between px-6 shrink-0 shadow-md">
      <div className="flex items-center gap-3">
        <img src="/bullmqr-logo.png" alt="BuLLMQR" className="h-14" />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
          {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting...' : 'Offline'}
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <UserProfileDropdown />
      </div>
    </header>
  );
}
