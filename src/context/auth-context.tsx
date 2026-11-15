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
  SignupPayload,
  SignupResult,
} from '../models/auth.models.ts';
import {
  AuthService,
  type GoogleAccountProfile,
} from '../services/auth.service.ts';
import { credentialVaultSyncService } from '../services/credential-vault-sync.service.ts';

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  signup: (payload: SignupPayload) => Promise<SignupResult>;
  verifyOtp: (request: VerifyOtpRequest) => Promise<AuthUser>;
  verifyTotp: (request: VerifyTotpRequest) => Promise<AuthUser>;
  resendOtp: (request: ResendOtpRequest) => Promise<ResendOtpResponse>;
  loginWithSSO: (email?: string) => Promise<AuthUser>;
  loginWithGoogle: (account: GoogleAccountProfile) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Restore session from AsyncStorage on app boot and stay synced with token refreshes
  useEffect(() => {
    let isMounted = true;
    const unsubUpdated = AuthService.onSessionUpdated((updatedUser) => {
      if (isMounted) {
        setCurrentUser(updatedUser);
      }
    });
    const unsubInvalidated = AuthService.onSessionInvalidated(() => {
      if (isMounted) {
        setCurrentUser(null);
      }
    });

    AuthService.getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        setCurrentUser(user);
        if (user?.accessToken && AuthService.isJwtExpired(user.accessToken, 30)) {
          void AuthService.refreshSession();
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
      unsubUpdated();
      unsubInvalidated();
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      if (credentials.password) {
        credentialVaultSyncService.setSessionPassphrase(credentials.password);
      }
      const result = await AuthService.login(credentials);
      if (!result.requireMfa) {
        setCurrentUser(result.user);
        if (result.user?.accessToken) {
          void credentialVaultSyncService.tryAutoUnlock(result.user.accessToken);
        }
      }
      return result;
    } catch (err) {
      credentialVaultSyncService.setSessionPassphrase(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<SignupResult> => {
    setIsLoading(true);
    try {
      return await AuthService.signup(payload);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (request: VerifyOtpRequest): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const user = await AuthService.verifyOtp(request);
      setCurrentUser(user);
      if (user?.accessToken && credentialVaultSyncService.hasSessionPassphrase()) {
        void credentialVaultSyncService.tryAutoUnlock(user.accessToken);
      }
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
      if (user?.accessToken && credentialVaultSyncService.hasSessionPassphrase()) {
        void credentialVaultSyncService.tryAutoUnlock(user.accessToken);
      }
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

  const loginWithGoogle = useCallback(
    async (account: GoogleAccountProfile): Promise<LoginResult> => {
      setIsLoading(true);
      try {
        const result = await AuthService.signInWithGoogle(account);
        if (!result.requireMfa) {
          setCurrentUser(result.user);
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      credentialVaultSyncService.resetSession();
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
      signup,
      verifyOtp,
      verifyTotp,
      resendOtp,
      loginWithSSO,
      loginWithGoogle,
      logout,
    }),
    [
      currentUser,
      isLoading,
      isInitializing,
      login,
      signup,
      verifyOtp,
      verifyTotp,
      resendOtp,
      loginWithSSO,
      loginWithGoogle,
      logout,
    ]
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
