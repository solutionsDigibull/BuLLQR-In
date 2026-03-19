import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

export default function UserProfileDropdown() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open) {
      // Use click (fires after mouseup) so dropdown items register before close
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  }, [open, handleClickOutside]);

  if (!user) return null;

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = user.role.replace('_', ' ');

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/20 transition-colors cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          className={`w-5 h-5 text-white/80 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{user.full_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">{roleLabel}</p>
            {user.station_id && (
              <p className="text-xs text-gray-400 mt-0.5">Station: {user.station_id}</p>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-danger transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
