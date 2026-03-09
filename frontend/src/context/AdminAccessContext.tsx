import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import api from '../services/api.ts';

interface AdminAccessContextValue {
  isAdminUnlocked: boolean;
  unlockAdmin: (password: string) => Promise<void>;
  lockAdmin: () => void;
}

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  const unlockAdmin = useCallback(async (password: string) => {
    const response = await api.post<{ verified: boolean }>('/auth/verify-sa-password', { password });
    if (response.data.verified) {
      setIsAdminUnlocked(true);
    }
  }, []);

  const lockAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
  }, []);

  return (
    <AdminAccessContext.Provider value={{ isAdminUnlocked, unlockAdmin, lockAdmin }}>
      {children}
    </AdminAccessContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAccess(): AdminAccessContextValue {
  const context = useContext(AdminAccessContext);
  if (!context) {
    throw new Error('useAdminAccess must be used within an AdminAccessProvider');
  }
  return context;
}
