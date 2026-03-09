export type UserRole = 'operator' | 'quality_inspector' | 'supervisor' | 'admin';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  station_id: string | null;
  is_active: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
