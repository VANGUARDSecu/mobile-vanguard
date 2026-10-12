export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  role: 'admin' | 'security_officer' | 'user' | string;
  accountType?: 'individual' | 'company';
  department?: string;
  avatar?: string;
  avatarUrl?: string;
  accessToken?: string;
  tenantId?: string;
  user_metadata?: Record<string, any>;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  isSso?: boolean;
}

export interface MfaChallengeResponse {
  requireMfa: boolean;
  email: string;
  hasTotp?: boolean;
  enrolledMethods?: ('email_otp' | 'totp')[];
  message?: string;
  challengeId?: string;
}

export interface VerifyOtpRequest {
  email: string;
  token: string;
  type?: 'signup' | 'email' | 'recovery' | 'magiclink' | 'signin';
}

export interface VerifyTotpRequest {
  email: string;
  code: string;
}

export interface ResendOtpRequest {
  email: string;
  type?: 'signup' | 'email_change' | 'sms' | 'email' | 'signin';
}

export interface ResendOtpResponse {
  success: boolean;
  message: string;
  cooldown: number;
}

export type LoginResult =
  | { requireMfa: true; mfaChallenge: MfaChallengeResponse }
  | { requireMfa: false; user: AuthUser };

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
  requireMfa?: boolean;
  hasTotp?: boolean;
  enrolledMethods?: ('email_otp' | 'totp')[];
  challengeId?: string;
  session?: {
    accessToken?: string;
    access_token?: string;
    refreshToken?: string;
    refresh_token?: string;
  };
}

export interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  phone?: string;
  accountType: 'individual' | 'company';
}

export interface SignupResult {
  success: boolean;
  message: string;
  requireOtp: boolean;
  email: string;
  accountType?: 'individual' | 'company';
  companyName?: string;
}
