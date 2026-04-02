import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { useAdminAccess } from '../../context/AdminAccessContext.tsx';
import AdminPasswordModal from '../AdminPasswordModal.tsx';

const ADMIN_PATHS = ['/analytics', '/copq', '/config'];

interface AdminNavItem {
  path: string;
  label: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/analytics', label: 'Analytics' },
  { path: '/copq', label: 'COPQ' },
  { path: '/config', label: 'Configuration' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const { isAdminUnlocked, lockAdmin } = useAdminAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  if (!user) return null;

  const isOnAdminPage = ADMIN_PATHS.includes(location.pathname);
  const showAdminSection = ['supervisor', 'admin'].includes(user.role);

  const handleAdminClick = () => {
    if (isAdminUnlocked) {
      // Already unlocked — toggle collapse, and if collapsing, lock & go to scan
      if (adminExpanded) {
        lockAdmin();
        setAdminExpanded(false);
        if (isOnAdminPage) {
          navigate('/scan');
        }
      } else {
        // Re-expanding after collapse — require password again
        lockAdmin();
        setShowPasswordModal(true);
      }
    } else {
      // Not unlocked — show password prompt
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    setAdminExpanded(true);
    // Navigate to first admin page
    navigate('/analytics');
  };

  const handlePasswordClose = () => {
    setShowPasswordModal(false);
  };

  return (
    <>
      <aside className="w-56 bg-sidebar text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-sidebar-hover">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Navigation</p>
        </div>

        <nav className="flex-1 py-2">
          {/* Scan — always visible */}
          <NavLink
            to="/scan"
            className={({ isActive }) =>
              `block px-4 py-3 text-sm transition-colors ${
                isActive && !isOnAdminPage
                  ? 'bg-primary text-white'
                  : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            Scan
          </NavLink>

          {/* System Administrator section */}
          {showAdminSection && (
            <div>
              <button
                onClick={handleAdminClick}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                  isOnAdminPage && isAdminUnlocked
                    ? 'bg-primary/20 text-white'
                    : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <span>System Administrator</span>
                <svg
                  className={`w-4 h-4 transition-transform ${adminExpanded && isAdminUnlocked ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Sub-links — only shown when unlocked and expanded */}
              {isAdminUnlocked && adminExpanded && (
                <div className="bg-black/20">
                  {ADMIN_NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `block pl-8 pr-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-primary text-white'
                            : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-hover flex items-center gap-2">
          <img src="/bullmqr-logo.png" alt="BuLLMQR" className="h-14" />
        </div>
      </aside>

      <AdminPasswordModal
        open={showPasswordModal}
        onClose={handlePasswordClose}
        onSuccess={handlePasswordSuccess}
      />
    </>
  );
}
