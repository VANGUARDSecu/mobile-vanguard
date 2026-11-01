import type {
  PushApprovalRequest,
  PushApprovalResult,
  PushHarnessPreset,
} from '../models/push-mfa.models.ts';
import { AppsStorageService } from './apps-storage.service.ts';

export const PUSH_HARNESS_PRESETS: PushHarnessPreset[] = [
  {
    id: 'preset-aws-console',
    title: 'AWS Management Console',
    description: 'Cloud production infrastructure access request from San Francisco, CA.',
    badge: 'BIOMETRIC',
    request: {
      appName: 'AWS Management Console',
      appIcon: '☁️',
      category: 'Cloud Infrastructure',
      ipAddress: '54.240.198.42',
      location: {
        city: 'San Francisco',
        region: 'CA',
        country: 'United States',
        flagEmoji: '🇺🇸',
      },
      device: 'Chrome 128 on macOS Sequoia',
      validitySeconds: 60,
      numberMatchingChallenge: {
        enabled: false,
        correctCode: 0,
        options: [],
      },
    },
  },
  {
    id: 'preset-vpn-gateway',
    title: 'Corporate Zero-Trust Gateway',
    description: 'Internal corporate VPN perimeter with mandatory 2-digit number verification.',
    badge: 'NUMBER MATCH',
    request: {
      appName: 'Corporate Zero-Trust Gateway',
      appIcon: '🛡️',
      category: 'Network Security',
      ipAddress: '198.51.100.18',
      location: {
        city: 'London',
        region: 'England',
        country: 'United Kingdom',
        flagEmoji: '🇬🇧',
      },
      device: 'OpenVPN Client on Windows 11 Enterprise',
      validitySeconds: 60,
      numberMatchingChallenge: {
        enabled: true,
        correctCode: 74,
        options: [28, 74, 91],
      },
    },
  },
  {
    id: 'preset-vanguard-admin',
    title: 'Vanguard Identity Admin Portal',
    description: 'Identity Provider administration console with 2-digit number challenge.',
    badge: 'NUMBER MATCH',
    request: {
      appName: 'Vanguard Identity Admin Portal',
      appIcon: '⚡',
      category: 'Identity & Access',
      ipAddress: '192.0.2.14',
      location: {
        city: 'Frankfurt',
        region: 'Hesse',
        country: 'Germany',
        flagEmoji: '🇩🇪',
      },
      device: 'Firefox 130 on Linux x86_64',
      validitySeconds: 60,
      numberMatchingChallenge: {
        enabled: true,
        correctCode: 42,
        options: [19, 42, 65],
      },
    },
  },
  {
    id: 'preset-suspicious-foreign',
    title: 'Suspicious Foreign Login Attempt',
    description: 'Anomalous connection from unknown TOR exit node; test Deny & Fraud reporting.',
    badge: 'SUSPICIOUS',
    request: {
      appName: 'GitHub Enterprise Server',
      appIcon: '🐙',
      category: 'Source Control',
      ipAddress: '185.220.101.5',
      location: {
        city: 'Unknown',
        region: 'TOR Exit Node',
        country: 'Seychelles',
        flagEmoji: '🚩',
      },
      device: 'Headless Python-Requests Automation Script',
      validitySeconds: 45,
      numberMatchingChallenge: {
        enabled: false,
        correctCode: 0,
        options: [],
      },
    },
  },
  {
    id: 'preset-quick-expire',
    title: 'Quick Expiration Simulation (10s)',
    description: 'Short 10-second validity window to test timeout and expired request states.',
    badge: 'TIMEOUT',
    request: {
      appName: 'Salesforce Enterprise CRM',
      appIcon: '💼',
      category: 'Enterprise SaaS',
      ipAddress: '13.107.4.52',
      location: {
        city: 'Sydney',
        region: 'NSW',
        country: 'Australia',
        flagEmoji: '🇦🇺',
      },
      device: 'Edge 128 on Windows 11',
      validitySeconds: 10,
      numberMatchingChallenge: {
        enabled: false,
        correctCode: 0,
        options: [],
      },
    },
  },
];

const getApiBaseUrl = (): string => {
  return AppsStorageService.getBackendApiUrl();
};

export class PushMfaService {
  private activeRequest: PushApprovalRequest | null = null;
  private history: PushApprovalRequest[] = [];
  private listeners: Set<(req: PushApprovalRequest | null) => void> = new Set();
  private pollInterval: any = null;
  private currentUserEmail: string | null = null;

  constructor() {
    this.history = [];
  }

  public getActiveRequest(): PushApprovalRequest | null {
    return this.activeRequest;
  }

  public getHistory(): PushApprovalRequest[] {
    return [...this.history];
  }

  public subscribe(listener: (req: PushApprovalRequest | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeRequest);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.activeRequest);
    }
  }

  /**
   * Fetches active pending push challenges from backend-vanguard (SCRUM-85)
   */
  public async fetchPendingPush(email?: string): Promise<PushApprovalRequest | null> {
    const targetEmail = email || this.currentUserEmail;
    try {
      const url = `${getApiBaseUrl()}/oauth/mfa/push/pending${targetEmail ? '?email=' + encodeURIComponent(targetEmail) : ''}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.activeRequest) {
        const req = data.activeRequest as PushApprovalRequest;
        // Only update and notify if new or different
        if (!this.activeRequest || this.activeRequest.id !== req.id) {
          this.activeRequest = req;
          this.notify();
        }
        return req;
      } else if (this.activeRequest && this.activeRequest.id.startsWith('push_mfa_')) {
        // If previous active backend request is no longer pending (e.g. expired or approved)
        this.activeRequest = null;
        this.notify();
      }
    } catch {
      // Ignore network errors during polling
    }
    return null;
  }

  /**
   * Starts background polling for live push challenges (SCRUM-85)
   */
  public startPolling(email?: string, intervalMs = 2000): void {
    if (email) {
      this.currentUserEmail = email;
    }
    this.stopPolling();
    this.fetchPendingPush(email);
    this.pollInterval = setInterval(() => {
      this.fetchPendingPush(this.currentUserEmail || undefined);
    }, intervalMs);
  }

  /**
   * Stops background polling
   */
  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Updates user enrollment preference on backend-vanguard (SCRUM-85)
   */
  public async syncPreference(email: string, enabled: boolean): Promise<boolean> {
    try {
      const url = `${getApiBaseUrl()}/oauth/mfa/push/preference`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, enabled }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return 'push-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
  }

  public triggerMockPush(input?: Partial<PushApprovalRequest>): PushApprovalRequest {
    const validitySeconds = input?.validitySeconds ?? 60;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validitySeconds * 1000).toISOString();

    const request: PushApprovalRequest = {
      id: input?.id || this.generateId(),
      appName: input?.appName || 'AWS Management Console',
      appIcon: input?.appIcon || '☁️',
      category: input?.category || 'Cloud Infrastructure',
      ipAddress: input?.ipAddress || '54.240.198.42',
      location: input?.location || {
        city: 'San Francisco',
        region: 'CA',
        country: 'United States',
        flagEmoji: '🇺🇸',
      },
      device: input?.device || 'Chrome 128 on macOS Sequoia',
      timestamp: input?.timestamp || now.toISOString(),
      validitySeconds,
      expiresAt,
      numberMatchingChallenge: input?.numberMatchingChallenge || {
        enabled: false,
        correctCode: 0,
        options: [],
      },
      status: 'pending',
    };

    this.activeRequest = request;
    this.notify();
    return request;
  }

  public triggerPreset(presetId: string): PushApprovalRequest {
    const preset = PUSH_HARNESS_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return this.triggerMockPush();
    }
    return this.triggerMockPush({
      ...preset.request,
      numberMatchingChallenge: preset.request.numberMatchingChallenge
        ? { ...preset.request.numberMatchingChallenge }
        : undefined,
    });
  }

  /**
   * Approve the active request.
   *
   * Live challenges (`push_mfa_*`) are decided by the backend. The app sends the number the
   * user selected, and the request resolves as approved only when the backend accepts it
   * (SCRUM-135 stores only a keyed verifier of the number, so the app cannot check it locally).
   * On rejection the request stays active so the user can retry, and the backend's message is returned.
   *
   * Offline demo presets (`triggerMockPush` / `triggerPreset`) carry the expected number and
   * are checked locally. They never contact the backend.
   */
  public async approveRequest(
    id: string,
    options?: { biometricVerified?: boolean; selectedCode?: number }
  ): Promise<PushApprovalResult> {
    if (!this.activeRequest || this.activeRequest.id !== id) {
      return {
        success: false,
        action: 'canceled',
        error: 'No active push request matching identifier',
      };
    }

    const now = Date.now();
    const expiresTime = new Date(this.activeRequest.expiresAt).getTime();
    if (now > expiresTime) {
      return this.expireRequest(id);
    }

    const isLive = id.startsWith('push_mfa_');
    const numberMatchingRequired = Boolean(this.activeRequest.numberMatchingChallenge?.enabled);

    if (numberMatchingRequired && options?.selectedCode === undefined) {
      return {
        success: false,
        action: 'canceled',
        biometricVerified: options?.biometricVerified,
        numberMatched: false,
        error: 'Select the 2-digit number shown on your screen',
      };
    }

    if (isLive) {
      const outcome = await this.sendLiveResponse({
        challengeId: id,
        action: 'approved',
        selectedCode: options?.selectedCode,
        biometricVerified: options?.biometricVerified ?? true,
      });
      if (!outcome.ok) {
        return {
          success: false,
          action: 'canceled',
          biometricVerified: options?.biometricVerified,
          numberMatched: false,
          error: outcome.error,
        };
      }
    } else if (numberMatchingRequired) {
      const expected = this.activeRequest.numberMatchingChallenge?.correctCode;
      if (expected === undefined || options?.selectedCode !== expected) {
        return {
          success: false,
          action: 'canceled',
          biometricVerified: options?.biometricVerified,
          numberMatched: false,
          error: `Number mismatch: selected ${options?.selectedCode ?? 'none'}, expected ${expected}`,
        };
      }
    }

    // Re-check: the request may have been resolved while the backend call was in flight.
    if (!this.activeRequest || this.activeRequest.id !== id) {
      return {
        success: false,
        action: 'canceled',
        error: 'No active push request matching identifier',
      };
    }

    const resolved: PushApprovalRequest = {
      ...this.activeRequest,
      status: 'approved',
      resolutionReason: 'Approved via Biometrics & Zero-Trust Verification',
      resolvedAt: new Date().toISOString(),
    };

    this.history.unshift(resolved);
    this.activeRequest = null;
    this.notify();

    return {
      success: true,
      action: 'approved',
      biometricVerified: options?.biometricVerified ?? true,
      numberMatched: numberMatchingRequired ? true : undefined,
    };
  }

  /** POST a decision to the backend. Returns the backend's message when it rejects the decision. */
  private async sendLiveResponse(body: {
    challengeId: string;
    action: 'approved';
    selectedCode?: number;
    biometricVerified: boolean;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/oauth/mfa/push/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return { ok: true };
      }
      let message = `The server rejected this response (HTTP ${res.status}).`;
      try {
        const json = await res.json();
        if (typeof json?.message === 'string') {
          message = json.message;
        } else if (Array.isArray(json?.message)) {
          message = json.message.join(' ');
        }
      } catch {
        // Keep the generic message when the body is not JSON.
      }
      return { ok: false, error: message };
    } catch {
      return { ok: false, error: 'Could not reach the server. Try again.' };
    }
  }

  public denyRequest(id: string, isFraud = false): PushApprovalResult {
    if (!this.activeRequest || this.activeRequest.id !== id) {
      return {
        success: false,
        action: 'canceled',
        error: 'No active push request matching identifier',
      };
    }

    const action = isFraud ? 'fraud_reported' : 'denied';
    const status = isFraud ? 'fraud_reported' : 'denied';

    const resolved: PushApprovalRequest = {
      ...this.activeRequest,
      status,
      resolutionReason: isFraud
        ? 'Denied & Reported as Fraudulent Compromise Attempt'
        : 'User rejected authentication request',
      resolvedAt: new Date().toISOString(),
    };

    this.history.unshift(resolved);
    this.activeRequest = null;
    this.notify();

    // Dispatch rejection to backend-vanguard if live challenge
    if (id.startsWith('push_mfa_')) {
      fetch(`${getApiBaseUrl()}/oauth/mfa/push/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: id,
          action: isFraud ? 'fraud_reported' : 'denied',
        }),
      }).catch(() => {});
    }

    return {
      success: true,
      action,
    };
  }

  public expireRequest(id: string): PushApprovalResult {
    if (!this.activeRequest || this.activeRequest.id !== id) {
      return {
        success: false,
        action: 'expired',
        error: 'No active push request matching identifier',
      };
    }

    const resolved: PushApprovalRequest = {
      ...this.activeRequest,
      status: 'expired',
      resolutionReason: 'Push verification request expired after validity window',
      resolvedAt: new Date().toISOString(),
    };

    this.history.unshift(resolved);
    this.activeRequest = null;
    this.notify();

    return {
      success: false,
      action: 'expired',
      error: 'Push verification challenge expired',
    };
  }

  public dismissRequest(id: string): void {
    if (this.activeRequest && this.activeRequest.id === id) {
      this.activeRequest = null;
      this.notify();
    }
  }

  public clearHistory(): void {
    this.history = [];
  }
}

export const pushMfaService = new PushMfaService();
export default pushMfaService;
