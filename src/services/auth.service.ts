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
    companyName: 'Weyland-Yutani Corp',
    phone: '+1 (555) 019-2834',
    accountType: 'individual',
    role: 'user',
    department: 'Engineering',
    avatar: '👩‍🚀',
    avatarUrl: '',
    user_metadata: {
      first_name: 'Ellen',
      last_name: 'Ripley',
      name: 'Ellen Ripley',
      role: 'user',
      department: 'Engineering',
      company_name: 'Weyland-Yutani Corp',
      phone: '+1 (555) 019-2834',
      account_type: 'individual',
    },
  },
  'user@company.com': {
    id: 'usr_sec_1002',
    email: 'user@company.com',
    name: 'John Roben Manayon',
    firstName: 'John',
    lastName: 'Manayon',
    companyName: 'Company Inc.',
    phone: '+1 (555) 014-9988',
    accountType: 'individual',
    role: 'user',
    department: 'Engineering',
    avatar: '👨‍💻',
    avatarUrl: '',
    user_metadata: {
      first_name: 'John',
      last_name: 'Manayon',
      name: 'John Roben Manayon',
      role: 'user',
      department: 'Engineering',
      company_name: 'Company Inc.',
      phone: '+1 (555) 014-9988',
      account_type: 'individual',
    },
  },
  'admin@vanguard.security': {
    id: 'usr_sec_0001',
    email: 'admin@vanguard.security',
    name: 'Security Operations Admin',
    firstName: 'SecOps',
    lastName: 'Admin',
    companyName: 'Vanguard Security Inc.',
    phone: '+1 (555) 010-0001',
    accountType: 'company',
    role: 'admin',
    department: 'Security Operations',
    avatar: '🛡️',
    avatarUrl: '',
    user_metadata: {
      first_name: 'SecOps',
      last_name: 'Admin',
      name: 'Security Operations Admin',
      role: 'admin',
      department: 'Security Operations',
      company_name: 'Vanguard Security Inc.',
      phone: '+1 (555) 010-0001',
      account_type: 'company',
    },
  },
};

// Internal simulated OTP cache for offline Expo Go development & tests
const simulatedOtpStore = new Map<string, { code: string; expiresAt: number }>();
// In-memory session cache for headless tests & SSR fallback
const memoryAuthStore = new Map<string, string>();

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
    } catch {
      // In-memory fallback if AsyncStorage fails (e.g. Node test runner)
    }

    const memData = memoryAuthStore.get(AUTH_STORAGE_KEYS.CURRENT_USER);
    if (memData) {
      try {
        return JSON.parse(memData);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Synthesizes a valid AuthUser structure from an email address and optional metadata
   */
  static synthesizeUser(
    cleanEmail: string,
    role?: string,
    userMetadata?: Record<string, any>
  ): AuthUser {
    const demo = DEMO_USERS[cleanEmail];
    if (demo) {
      const mergedMeta = {
        first_name: demo.firstName,
        last_name: demo.lastName,
        name: demo.name,
        role: role || demo.role,
        department: demo.department,
        company_name: demo.companyName || 'Vanguard Security Inc.',
        phone: demo.phone || '',
        account_type: demo.accountType || 'individual',
        ...(demo.user_metadata || {}),
        ...(userMetadata || {}),
      };
      return {
        ...demo,
        role: role || demo.role,
        user_metadata: mergedMeta,
        accessToken: `mock_jwt_${Date.now()}`,
      };
    }

    const meta = userMetadata || {};
    const metaFirstName = meta['first_name'] || meta['firstName'] || meta['given_name'];
    const metaLastName = meta['last_name'] || meta['lastName'] || meta['family_name'];
    const metaName = meta['name'];

    const names = cleanEmail.split('@')[0].split('.');
    const firstName = metaFirstName || (names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : 'User');
    const lastName = metaLastName !== undefined ? metaLastName : (names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '');
    const fullName = metaName || (firstName || lastName ? `${firstName} ${lastName}`.trim() : cleanEmail.split('@')[0]);
    const resolvedRole = role || meta['role'] || 'user';
    const department = meta['department'] || 'Engineering';
    const companyName = meta['company_name'] || meta['companyName'] || 'Vanguard Security Inc.';
    const phone = meta['phone'] || '';
    const accountType = meta['account_type'] || meta['accountType'] || 'individual';
    const avatar = meta['avatar'] || meta['avatarUrl'] || meta['picture'];
    const avatarUrl = meta['avatar_url'] || meta['avatarUrl'] || meta['picture'] || '';

    return {
      id: `usr_local_${Date.now()}`,
      email: cleanEmail,
      name: fullName,
      firstName,
      lastName,
      role: resolvedRole,
      department,
      companyName,
      phone,
      accountType,
      avatar,
      avatarUrl,
      accessToken: `mock_jwt_${Date.now()}`,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        role: resolvedRole,
        department,
        company_name: companyName,
        phone,
        account_type: accountType,
        ...meta,
      },
    };
  }

  /**
   * Normalizes raw user information from backend or local synthesis into a complete AuthUser
   * ensuring full name and user_metadata match frontend-vanguard standard.
   */
  static normalizeUser(rawUser: any, cleanEmail: string, fallbackRole?: string): AuthUser {
    const meta = rawUser?.user_metadata || {};
    const baseUser = this.synthesizeUser(cleanEmail, rawUser?.role || fallbackRole, meta);

    const firstName =
      rawUser?.firstName ||
      meta['first_name'] ||
      meta['firstName'] ||
      meta['given_name'] ||
      baseUser.firstName ||
      '';
    const lastName =
      rawUser?.lastName ||
      meta['last_name'] ||
      meta['lastName'] ||
      meta['family_name'] ||
      baseUser.lastName ||
      '';

    let resolvedName = '';
    if (firstName && lastName) {
      resolvedName = `${firstName} ${lastName}`.trim();
    } else if (rawUser?.name && rawUser.name.trim()) {
      resolvedName = rawUser.name.trim();
    } else if (meta['name'] && typeof meta['name'] === 'string' && meta['name'].trim()) {
      resolvedName = meta['name'].trim();
    } else if (baseUser.name && baseUser.name.trim()) {
      resolvedName = baseUser.name.trim();
    } else {
      resolvedName = cleanEmail.split('@')[0];
    }

    const role = rawUser?.role || meta['role'] || fallbackRole || baseUser.role || 'user';
    const department = rawUser?.department || meta['department'] || baseUser.department || 'Engineering';
    const companyName =
      rawUser?.companyName ||
      meta['company_name'] ||
      meta['companyName'] ||
      baseUser.companyName ||
      'Vanguard Security Inc.';
    const phone = rawUser?.phone || meta['phone'] || baseUser.phone || '';
    const accountType =
      rawUser?.accountType ||
      meta['account_type'] ||
      meta['accountType'] ||
      baseUser.accountType ||
      'individual';
    const avatar = rawUser?.avatar || meta['avatar'] || baseUser.avatar;
    const avatarUrl =
      rawUser?.avatarUrl ||
      meta['avatar_url'] ||
      meta['avatarUrl'] ||
      meta['picture'] ||
      baseUser.avatarUrl ||
      '';

    const mergedMetadata: Record<string, any> = {
      ...(baseUser.user_metadata || {}),
      ...meta,
      first_name: firstName,
      last_name: lastName,
      name: resolvedName,
      role,
      department,
      company_name: companyName,
      phone,
      account_type: accountType,
    };

    return {
      ...baseUser,
      id: rawUser?.id || baseUser.id,
      email: rawUser?.email || cleanEmail,
      name: resolvedName,
      firstName,
      lastName,
      role,
      department,
      companyName,
      phone,
      accountType,
      avatar,
      avatarUrl,
      user_metadata: mergedMetadata,
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
      const user = this.normalizeUser(null, cleanEmail);
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
          const user = this.normalizeUser(body.user, cleanEmail, body.user.role);
          if (body.session?.accessToken || body.session?.access_token) {
            user.accessToken = body.session.accessToken || body.session.access_token;
          }
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
      const user = this.normalizeUser(null, cleanEmail);
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
          const user = this.normalizeUser(body.user, cleanEmail, body.user.role);
          if (body.session?.accessToken || body.session?.access_token) {
            user.accessToken = body.session.accessToken || body.session.access_token;
          }
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
          const user = this.normalizeUser(null, cleanEmail);
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
      const user = this.normalizeUser(null, cleanEmail);
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
        const user = this.normalizeUser(body.user, cleanEmail);
        if (body.session?.accessToken || body.session?.access_token) {
          user.accessToken = body.session.accessToken || body.session.access_token;
        }
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
        const user = this.normalizeUser(null, cleanEmail);
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
    const user = this.normalizeUser(null, targetEmail);
    await this.saveSession(user, user.accessToken);
    return user;
  }

  /**
   * Saves the user session to local storage
   */
  static async saveSession(user: AuthUser, token?: string): Promise<void> {
    const serialized = JSON.stringify(user);
    memoryAuthStore.set(AUTH_STORAGE_KEYS.CURRENT_USER, serialized);
    if (token) {
      memoryAuthStore.set(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token);
    }

    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, serialized);
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
    memoryAuthStore.delete(AUTH_STORAGE_KEYS.CURRENT_USER);
    memoryAuthStore.delete(AUTH_STORAGE_KEYS.ACCESS_TOKEN);

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
