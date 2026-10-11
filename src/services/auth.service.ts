import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthUser,
  LoginCredentials,
  AuthResponse,
  LoginResult,
  VerifyOtpRequest,
  VerifyTotpRequest,
  ResendOtpRequest,
  ResendOtpResponse,
} from '../models/auth.models.ts';
import { AppsStorageService } from './apps-storage.service.ts';

const AUTH_STORAGE_KEYS = {
  CURRENT_USER: '@vanguard_auth_user',
  ACCESS_TOKEN: '@vanguard_auth_token',
};

export const DEMO_USERS: Record<string, AuthUser> = {
  'ellen.ripley@weyland.corp': {
    id: 'usr_sec_1001',
    email: 'ellen.ripley@weyland.corp',
    name: 'Ellen Ripley',
    firstName: 'Ellen',
    lastName: 'Ripley',
    role: 'user',
    department: 'Engineering',
    avatar: '👩‍🚀',
  },
  'user@company.com': {
    id: 'usr_sec_1002',
    email: 'user@company.com',
    name: 'John Roben Manayon',
    firstName: 'John',
    lastName: 'Manayon',
    role: 'user',
    department: 'Engineering',
    avatar: '👨‍💻',
  },
  'admin@vanguard.security': {
    id: 'usr_sec_0001',
    email: 'admin@vanguard.security',
    name: 'Security Operations Admin',
    firstName: 'SecOps',
    lastName: 'Admin',
    role: 'admin',
    department: 'Security Operations',
    avatar: '🛡️',
  },
};

// Internal simulated OTP cache for offline Expo Go development & tests
const simulatedOtpStore = new Map<string, { code: string; expiresAt: number }>();

export class AuthService {
  /**
   * Retrieves the currently authenticated user from local storage
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const data = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Synthesizes a valid AuthUser structure from an email address
   */
  static synthesizeUser(cleanEmail: string, role?: string): AuthUser {
    const demo = DEMO_USERS[cleanEmail];
    if (demo) {
      return {
        ...demo,
        role: role || demo.role,
        accessToken: `mock_jwt_${Date.now()}`,
      };
    }

    const names = cleanEmail.split('@')[0].split('.');
    const firstName = names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : 'User';
    const lastName = names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '';
    return {
      id: `usr_local_${Date.now()}`,
      email: cleanEmail,
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      role: role || 'user',
      department: 'Engineering',
      accessToken: `mock_jwt_${Date.now()}`,
    };
  }

  /**
   * Performs primary credential validation via Vanguard backend or local fallback
   * Returns a LoginResult indicating whether MFA verification is required.
   */
  static async login(credentials: LoginCredentials): Promise<LoginResult> {
    const cleanEmail = credentials.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (!credentials.isSso && !credentials.password?.trim()) {
      throw new Error('Password is required.');
    }

    // Bypass MFA for explicit SSO federation requests
    if (credentials.isSso) {
      const user = this.synthesizeUser(cleanEmail);
      await this.saveSession(user, user.accessToken);
      return { requireMfa: false, user };
    }

    // Attempt live authentication against Vanguard backend if online
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: credentials.password?.trim() || 'Password123!',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body: AuthResponse = await response.json();

        // Backend challenges user with Multi-Factor Authentication
        if (body.requireMfa) {
          return {
            requireMfa: true,
            mfaChallenge: {
              requireMfa: true,
              email: cleanEmail,
              hasTotp: !!body.hasTotp,
              enrolledMethods: body.enrolledMethods || ['email_otp'],
              message:
                body.message || 'Login credentials verified. Please complete 2-Step Verification.',
            },
          };
        }

        // Direct authentication without MFA
        if (body.success && body.user) {
          const baseUser = this.synthesizeUser(cleanEmail, body.user.role);
          const user: AuthUser = {
            ...baseUser,
            id: body.user.id || baseUser.id,
            email: body.user.email,
            name: body.user.name || baseUser.name,
            role: body.user.role || baseUser.role,
            accessToken: body.session?.accessToken || body.session?.access_token || baseUser.accessToken,
          };
          await this.saveSession(user, user.accessToken);
          return { requireMfa: false, user };
        }
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Invalid login credentials');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.name !== 'AbortError' &&
          !err.message.toLowerCase().includes('fetch') &&
          !err.message.includes('Network')
        ) {
          throw err;
        }
      }
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        // Test runner offline fallback
        const simCode = '12345678';
        simulatedOtpStore.set(cleanEmail, {
          code: simCode,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        return {
          requireMfa: true,
          mfaChallenge: {
            requireMfa: true,
            email: cleanEmail,
            hasTotp: cleanEmail === 'admin@vanguard.security',
            enrolledMethods: ['email_otp'],
            message: 'Credentials verified. Enter the verification code.',
          },
        };
      }
      throw new Error(
        err instanceof Error && err.name === 'AbortError'
          ? 'Authentication server timed out. Please check your connection.'
          : 'Unable to connect to authentication server. Please ensure the backend is running at http://localhost:3000.'
      );
    }

    throw new Error('Login failed. Please check your credentials.');
  }

  /**
   * Verifies an Email One-Time Password (OTP) via Vanguard backend or local fallback
   */
  static async verifyOtp(request: VerifyOtpRequest): Promise<AuthUser> {
    const cleanEmail = request.email.trim().toLowerCase();
    const cleanToken = request.token.trim();

    if (!cleanToken || cleanToken.length < 6) {
      throw new Error('Verification code must be at least 6 digits.');
    }

    // Only allow test bypass codes in automated test runner (NODE_ENV === 'test')
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'test' &&
      (cleanToken === '123456' || cleanToken === '12345678' || cleanToken === '000000')
    ) {
      const user = this.synthesizeUser(cleanEmail);
      await this.saveSession(user, user.accessToken);
      return user;
    }

    // Attempt live verification with Vanguard backend
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          token: cleanToken,
          type: request.type || 'email',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body: AuthResponse = await response.json();
        if (body.success && body.user) {
          const baseUser = this.synthesizeUser(cleanEmail, body.user.role);
          const user: AuthUser = {
            ...baseUser,
            id: body.user.id || baseUser.id,
            email: body.user.email,
            name: body.user.name || baseUser.name,
            role: body.user.role || baseUser.role,
            accessToken: body.session?.accessToken || body.session?.access_token || baseUser.accessToken,
          };
          await this.saveSession(user, user.accessToken);
          return user;
        }
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(
          errJson?.message || 'Invalid or expired verification code.'
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (!err.message.includes('fetch') && !err.message.includes('Network')) {
          throw err;
        }
      }
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        const sim = simulatedOtpStore.get(cleanEmail);
        if (sim && sim.code === cleanToken && sim.expiresAt > Date.now()) {
          simulatedOtpStore.delete(cleanEmail);
          const user = this.synthesizeUser(cleanEmail);
          await this.saveSession(user, user.accessToken);
          return user;
        }
      }
      throw new Error(
        err instanceof Error ? err.message : 'Invalid or expired verification code.'
      );
    }

    throw new Error('Invalid or expired verification code.');
  }

  /**
   * Verifies an Authenticator App (TOTP) 6-digit code
   */
  static async verifyTotp(request: VerifyTotpRequest): Promise<AuthUser> {
    const cleanEmail = request.email.trim().toLowerCase();
    const cleanCode = request.code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error('Authenticator code must be a 6-digit number.');
    }

    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'test' &&
      cleanCode === '654321'
    ) {
      const user = this.synthesizeUser(cleanEmail);
      await this.saveSession(user, user.accessToken);
      return user;
    }

    // Attempt live verification
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${baseUrl}/auth/verify-totp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body: AuthResponse = await response.json();
        const baseUser = this.synthesizeUser(cleanEmail);
        const user: AuthUser = {
          ...baseUser,
          accessToken: body.session?.accessToken || body.session?.access_token || baseUser.accessToken,
        };
        await this.saveSession(user, user.accessToken);
        return user;
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Invalid authenticator code.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Network')) {
        throw err;
      }
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        const user = this.synthesizeUser(cleanEmail);
        await this.saveSession(user, user.accessToken);
        return user;
      }
      throw new Error(err instanceof Error ? err.message : 'Invalid authenticator code.');
    }
  }

  /**
   * Dispatches a new OTP verification code via Vanguard backend or local simulation
   */
  static async resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse> {
    const cleanEmail = request.email.trim().toLowerCase();

    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${baseUrl}/auth/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          type: request.type || 'email',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body = await response.json();
        return {
          success: true,
          message: body.message || 'New verification code dispatched to your email!',
          cooldown: 45,
        };
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to resend verification code.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Network')) {
        throw err;
      }
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        return {
          success: true,
          message: 'New verification code dispatched to your email!',
          cooldown: 45,
        };
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to resend verification code.');
    }
  }

  /**
   * Performs 1-tap Single Sign-On federation login (convenience wrapper)
   */
  static async signInWithSSO(targetEmail = 'ellen.ripley@weyland.corp'): Promise<AuthUser> {
    const result = await this.login({
      email: targetEmail,
      isSso: true,
    });
    if (!result.requireMfa && result.user) {
      return result.user;
    }
    const user = this.synthesizeUser(targetEmail);
    await this.saveSession(user, user.accessToken);
    return user;
  }

  /**
   * Saves the user session to local storage
   */
  static async saveSession(user: AuthUser, token?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      if (token) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token);
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Clears the user session locally and notifies Vanguard backend
   */
  static async logout(): Promise<void> {
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }).catch(() => {});
      clearTimeout(timeoutId);
    } catch {
      // Backend unavailable or offline; non-blocking
    }

    try {
      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEYS.CURRENT_USER,
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      ]);
    } catch {
      // Non-blocking fallback
    }
  }
}
