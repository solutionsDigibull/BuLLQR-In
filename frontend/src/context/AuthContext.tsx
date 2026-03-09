import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { User, AuthState, LoginRequest, LoginResponse } from '../types/auth.ts';
import api from '../services/api.ts';
import {
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  clearAuth,
} from '../utils/token.ts';

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE_SESSION'; payload: { user: User; token: string } };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
    case 'RESTORE_SESSION':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return { user: null, token: null, isAuthenticated: false, isLoading: false };
    case 'LOGOUT':
      return { user: null, token: null, isAuthenticated: false, isLoading: false };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = getToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      try {
        const user: User = JSON.parse(storedUser);
        dispatch({ type: 'RESTORE_SESSION', payload: { user, token } });
      } catch {
        clearAuth();
        dispatch({ type: 'LOGIN_FAILURE' });
      }
    } else {
      dispatch({ type: 'LOGIN_FAILURE' });
    }
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      const { access_token, user } = response.data;
      setToken(access_token);
      setStoredUser(user);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token: access_token } });
    } catch (err: unknown) {
      dispatch({ type: 'LOGIN_FAILURE' });
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        const detail = axiosErr.response?.data?.detail;
        if (axiosErr.response?.status === 401) {
          throw new Error(detail || 'Invalid username or password');
        }
        throw new Error(detail || `Server error (${axiosErr.response?.status})`);
      }
      throw new Error('Unable to connect to server');
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    dispatch({ type: 'LOGOUT' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
