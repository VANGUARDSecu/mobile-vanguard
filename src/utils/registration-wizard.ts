export type RegistrationPageKey = 'identity' | 'contact' | 'security';

export interface RegistrationPageMeta {
  key: RegistrationPageKey;
  stepNumber: number;
  shortLabel: string;
  title: string;
  subtitle: string;
}

export const REGISTRATION_PAGES: readonly RegistrationPageMeta[] = [
  {
    key: 'identity',
    stepNumber: 1,
    shortLabel: 'Identity',
    title: 'Choose Account Type & Identity',
    subtitle: 'Select Personal Vault or Company Organization and enter your profile name.',
  },
  {
    key: 'contact',
    stepNumber: 2,
    shortLabel: 'Contact',
    title: 'Contact & Recovery Details',
    subtitle: 'Set your verification email address and recovery phone number.',
  },
  {
    key: 'security',
    stepNumber: 3,
    shortLabel: 'Security',
    title: 'Master Password & Policy',
    subtitle: 'Create a strong master password to protect your zero-trust account.',
  },
];

export interface RegistrationDraft {
  accountType: 'individual' | 'company';
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export interface PasswordRuleStatus {
  hasMinLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasSpecial: boolean;
  allMet: boolean;
}

export interface GoogleAccountSelection {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  accountType?: 'individual' | 'company';
  companyName?: string;
  accessToken?: string;
  refreshToken?: string;
}

export function getNextRegistrationPage(
  current: RegistrationPageKey
): RegistrationPageKey | null {
  if (current === 'identity') return 'contact';
  if (current === 'contact') return 'security';
  return null;
}

export function getPrevRegistrationPage(
  current: RegistrationPageKey
): RegistrationPageKey | null {
  if (current === 'security') return 'contact';
  if (current === 'contact') return 'identity';
  return null;
}

export function evaluatePasswordRules(password: string): PasswordRuleStatus {
  const val = password || '';
  const hasMinLength = val.length >= 8;
  const hasLower = /[a-z]/.test(val);
  const hasUpper = /[A-Z]/.test(val);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(val);

  return {
    hasMinLength,
    hasLower,
    hasUpper,
    hasSpecial,
    allMet: hasMinLength && hasLower && hasUpper && hasSpecial,
  };
}

export function validateRegistrationPage(
  page: RegistrationPageKey,
  draft: RegistrationDraft
): string | null {
  if (page === 'identity') {
    if (!draft.firstName.trim()) {
      return 'Please enter your first name.';
    }
    if (!draft.lastName.trim()) {
      return 'Please enter your last name.';
    }
    if (draft.accountType === 'company' && !draft.companyName.trim()) {
      return 'Please enter your company or organization name.';
    }
    return null;
  }

  if (page === 'contact') {
    const cleanEmail = draft.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return 'Please enter a valid email address.';
    }
    if (draft.accountType === 'company' && !draft.phone.trim()) {
      return 'Please enter a company contact phone number.';
    }
    return null;
  }

  if (!draft.password || draft.password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (draft.password !== draft.confirmPassword) {
    return 'Passwords do not match. Please verify both fields.';
  }
  if (!draft.agreeTerms) {
    return 'Please accept the Terms of Service and Privacy Policy to continue.';
  }

  return null;
}

function decodeBase64UrlJson(segment: string): Record<string, any> | null {
  try {
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let i = 0; i < base64.length; i += 4) {
      const enc1 = chars.indexOf(base64.charAt(i));
      const enc2 = chars.indexOf(base64.charAt(i + 1));
      const enc3 = chars.indexOf(base64.charAt(i + 2));
      const enc4 = chars.indexOf(base64.charAt(i + 3));
      if (enc1 < 0 || enc2 < 0) break;

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      output += String.fromCharCode(chr1);
      if (enc3 !== 64 && enc3 >= 0) output += String.fromCharCode(chr2);
      if (enc4 !== 64 && enc4 >= 0) output += String.fromCharCode(chr3);
    }

    const utf8 = decodeURIComponent(
      output
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

/**
 * Extracts Google OAuth user claims and tokens from a callback URL containing
 * `#access_token=...` or `?access_token=...`.
 */
export function parseGoogleOAuthCallbackUrl(
  callbackUrl: string
): GoogleAccountSelection | null {
  if (!callbackUrl || typeof callbackUrl !== 'string') {
    return null;
  }

  const hashIdx = callbackUrl.indexOf('#');
  const queryIdx = callbackUrl.indexOf('?');
  const rawParams =
    hashIdx >= 0
      ? callbackUrl.slice(hashIdx + 1)
      : queryIdx >= 0
      ? callbackUrl.slice(queryIdx + 1)
      : '';

  if (!rawParams) {
    return null;
  }

  const params = new URLSearchParams(rawParams);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token') || undefined;
  if (!accessToken) {
    return null;
  }

  const parts = accessToken.split('.');
  if (parts.length < 2) {
    return null;
  }

  const payload = decodeBase64UrlJson(parts[1]);
  const email = (payload?.email || '').trim().toLowerCase();
  if (!email) {
    return null;
  }

  const meta = payload?.user_metadata || {};
  const firstName =
    meta.given_name ||
    meta.first_name ||
    meta.full_name?.split(' ')[0] ||
    meta.name?.split(' ')[0] ||
    email.split('@')[0];
  const lastName =
    meta.family_name ||
    meta.last_name ||
    meta.full_name?.split(' ').slice(1).join(' ') ||
    meta.name?.split(' ').slice(1).join(' ') ||
    '';
  const name =
    meta.full_name || meta.name || `${firstName} ${lastName}`.trim() || email;
  const avatarUrl = meta.avatar_url || meta.picture || undefined;

  return {
    email,
    name,
    firstName,
    lastName,
    avatarUrl,
    accessToken,
    refreshToken,
  };
}
