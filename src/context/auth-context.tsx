import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type {
  AuthUser,
  LoginCredentials,
  LoginResult,
  VerifyOtpRequest,
  VerifyTotpRequest,
  ResendOtpRequest,
  ResendOtpResponse,
} from '../models/auth.models.ts';
import { AuthService } from '../services/auth.service.ts';

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  verifyOtp: (request: VerifyOtpRequest) => Promise<AuthUser>;
  verifyTotp: (request: VerifyTotpRequest) => Promise<AuthUser>;
  resendOtp: (request: ResendOtpRequest) => Promise<ResendOtpResponse>;
  loginWithSSO: (email?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const result = await AuthService.login(credentials);
      if (!result.requireMfa) {
        setCurrentUser(result.user);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (request: VerifyOtpRequest): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const user = await AuthService.verifyOtp(request);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyTotp = useCallback(async (request: VerifyTotpRequest): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const user = await AuthService.verifyTotp(request);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendOtp = useCallback(async (request: ResendOtpRequest): Promise<ResendOtpResponse> => {
    return AuthService.resendOtp(request);
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
      isInitializing,
      login,
      verifyOtp,
      verifyTotp,
      resendOtp,
      loginWithSSO,
      logout,
    }),
    [currentUser, isLoading, isInitializing, login, verifyOtp, verifyTotp, resendOtp, loginWithSSO, logout]
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
