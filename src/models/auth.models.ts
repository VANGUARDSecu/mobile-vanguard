export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'security_officer' | 'user' | string;
  department?: string;
  avatar?: string;
  accessToken?: string;
  tenantId?: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  isSso?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
  session?: {
    accessToken?: string;
    refreshToken?: string;
  };
}
