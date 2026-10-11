import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, LoginCredentials, AuthResponse } from '../models/auth.models.ts';
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
   * Performs login via Vanguard backend or local fallback
   */
  static async login(credentials: LoginCredentials): Promise<AuthUser> {
    const cleanEmail = credentials.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (!credentials.isSso && !credentials.password?.trim()) {
      throw new Error('Password is required.');
    }

    // Attempt live authentication against Vanguard backend if online
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

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
        if (body.success && body.user) {
          const user: AuthUser = {
            id: body.user.id || `usr_${Date.now()}`,
            email: body.user.email,
            name: body.user.name || `${body.user.firstName || ''} ${body.user.lastName || ''}`.trim() || cleanEmail,
            firstName: body.user.firstName,
            lastName: body.user.lastName,
            role: body.user.role || 'user',
            department: body.user.department || 'General Personnel',
            accessToken: body.session?.accessToken,
          };
          await this.saveSession(user, body.session?.accessToken);
          return user;
        }
      }
    } catch {
      // Backend unavailable; proceed to local demo directory fallback
    }

    // Local Directory Fallback (for offline testing & Expo Go development)
    const demo = DEMO_USERS[cleanEmail];
    let user: AuthUser;
    if (demo) {
      user = { ...demo, accessToken: `mock_jwt_${Date.now()}` };
    } else {
      const names = cleanEmail.split('@')[0].split('.');
      const firstName = names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : 'User';
      const lastName = names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '';
      user = {
        id: `usr_local_${Date.now()}`,
        email: cleanEmail,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        role: 'user',
        department: 'Engineering',
        accessToken: `mock_jwt_${Date.now()}`,
      };
    }

    await this.saveSession(user, user.accessToken);
    return user;
  }

  /**
   * Performs 1-tap Single Sign-On federation login
   */
  static async signInWithSSO(targetEmail = 'ellen.ripley@weyland.corp'): Promise<AuthUser> {
    return this.login({
      email: targetEmail,
      isSso: true,
    });
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
   * Clears the user session
   */
  static async logout(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        AUTH_STORAGE_KEYS.CURRENT_USER,
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      ]);
    } catch {
      // Non-blocking
    }
  }
}
