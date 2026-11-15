export type PushApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'fraud_reported'
  | 'expired';

export interface PushGeoLocation {
  city: string;
  region?: string;
  country: string;
  flagEmoji?: string;
}

export interface NumberMatchingChallenge {
  enabled: boolean;
  correctCode?: number; // Offline demo presets only. Live challenges omit it: the backend checks the number.
  options: number[]; // 3 candidate choices (e.g. [17, 42, 89])
}

export interface PushApprovalRequest {
  id: string;
  appName: string;
  appIcon?: string;
  category?: string;
  ipAddress: string;
  location: PushGeoLocation;
  device: string;
  timestamp: string;
  validitySeconds: number;
  expiresAt: string;
  numberMatchingChallenge?: NumberMatchingChallenge;
  status: PushApprovalStatus;
  resolutionReason?: string;
  resolvedAt?: string;
}

export interface PushApprovalResult {
  success: boolean;
  action: 'approved' | 'denied' | 'fraud_reported' | 'expired' | 'canceled';
  biometricVerified?: boolean;
  numberMatched?: boolean;
  redirectUrl?: string;
  awaitingAdminApproval?: boolean;
  error?: string;
}

export interface PushHarnessPreset {
  id: string;
  title: string;
  description: string;
  badge: string;
  request: Omit<PushApprovalRequest, 'id' | 'timestamp' | 'expiresAt' | 'status'>;
}
