import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type { AuthUser, LoginCredentials } from '../models/auth.models.ts';
import { AuthService } from '../services/auth.service.ts';

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  loginWithSSO: (email?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from AsyncStorage on app boot
  useEffect(() => {
    let isMounted = true;
    AuthService.getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setCurrentUser(user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const user = await AuthService.login(credentials);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithSSO = useCallback(async (email?: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const user = await AuthService.signInWithSSO(email);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      login,
      loginWithSSO,
      logout,
    }),
    [currentUser, isLoading, login, loginWithSSO, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
