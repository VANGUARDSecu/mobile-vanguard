import { AppsStorageService } from './apps-storage.service.ts';
import { isLiveBackendToken } from './totp-sync.service.ts';

export interface MobileAuditLogEvent {
  id: string;
  timestamp: string;
  email: string;
  action: string;
  movementType?: string;
  applicationName?: string;
  protocol?: string;
  status: string;
  device?: string;
  ip?: string;
  location?: string;
}

export interface MobileEnrolledDevice {
  id: string;
  name: string;
  model?: string;
  type: string;
  osVersion: string;
  biometricType: string;
  pairingKey?: string;
  complianceStatus: string;
  trustState?: string;
  pairedAt: string;
  lastSeenAt: string;
  lastSeen?: string;
}

export interface SecurityPostureSnapshot {
  totpEnrolled: boolean;
  totpFactorsCount: number;
  recoveryCodesRemaining: number;
  pushMfaEnabled: boolean;
  alertThreshold: 'all' | 'new_device';
  emailAlertsEnabled: boolean;
  secondaryEmail?: string;
  enrolledDevicesCount: number;
  evaluatedAt: string;
}

export interface AdminDirectorySnapshot {
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    department?: string;
    status: string;
  }>;
  tenantApps: Array<{
    id: string;
    name: string;
    category: string;
    protocol: string;
    launchUrl?: string;
  }>;
  tenantSettings: {
    name?: string;
    domain?: string | null;
    mfaEnforced?: boolean;
    blockHighRiskIps?: boolean;
    sessionDurationMinutes?: number;
  } | null;
}

async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 6000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

export class SecurityActivityService {
  static async fetchAuditLogs(
    token?: string | null,
    options?: {
      limit?: number;
      movementType?: string;
      status?: string;
      employeeEmail?: string;
    },
  ): Promise<MobileAuditLogEvent[]> {
    if (!isLiveBackendToken(token)) return [];
    const params = new URLSearchParams();
    params.set('limit', String(options?.limit ?? 50));
    if (options?.movementType && options.movementType !== 'ALL') {
      params.set('movementType', options.movementType);
    }
    if (options?.status && options.status !== 'ALL') {
      params.set('status', options.status);
    }
    if (options?.employeeEmail) {
      params.set('employeeEmail', options.employeeEmail);
    }

    const baseUrl = AppsStorageService.getBackendApiUrl();
    const res = await fetchJsonWithTimeout(`${baseUrl}/auth/audit-logs?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok || !res.data) return [];

    const rawList: any[] = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data.events)
        ? res.data.events
        : Array.isArray(res.data.logs)
          ? res.data.logs
          : [];

    return rawList.map((e, idx) => ({
      id: String(e.id || `audit-${idx}-${Date.now()}`),
      timestamp: String(e.timestamp || e.isoTimestamp || e.createdAt || e.created_at || new Date().toISOString()),
      email: String(e.email || e.userEmail || ''),
      action: String(e.action || e.event || e.movementType || 'Security Event'),
      movementType: e.movementType ? String(e.movementType) : undefined,
      applicationName: e.applicationName || e.target ? String(e.applicationName || e.target) : undefined,
      protocol: e.protocol ? String(e.protocol) : undefined,
      status: String(e.status || 'SUCCESS').toUpperCase(),
      device: e.device || e.userAgent ? String(e.device || e.userAgent) : undefined,
      ip: e.ip || e.clientIp ? String(e.ip || e.clientIp) : undefined,
      location: e.location ? String(e.location) : undefined,
    }));
  }

  static async recordMovement(
    token: string | null | undefined,
    payload: {
      movementType: string;
      action: string;
      applicationName?: string;
      protocol?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    if (!isLiveBackendToken(token)) return false;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const res = await fetchJsonWithTimeout(`${baseUrl}/auth/audit-logs/movement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  }

  static async fetchEnrolledDevices(
    token?: string | null,
    email?: string | null,
  ): Promise<{ ok: boolean; devices: MobileEnrolledDevice[] }> {
    if (!isLiveBackendToken(token)) return { ok: false, devices: [] };
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const query = email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : '';
    const res = await fetchJsonWithTimeout(`${baseUrl}/oauth/devices${query}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok || !Array.isArray(res.data?.devices)) {
      return { ok: false, devices: [] };
    }
    return {
      ok: true,
      devices: res.data.devices.map((d: any) => ({
        id: String(d.id),
        name: String(d.name || 'Vanguard Companion'),
        model: d.model ? String(d.model) : undefined,
        type: String(d.type || 'ios'),
        osVersion: String(d.osVersion || d.os_version || 'Mobile OS'),
        biometricType: String(d.biometricType || d.biometric_type || 'Biometric Push MFA'),
        pairingKey: d.pairingKey || d.pairing_key ? String(d.pairingKey || d.pairing_key) : undefined,
        complianceStatus: String(d.complianceStatus || d.compliance_status || 'Compliant'),
        trustState: d.trustState ? String(d.trustState) : undefined,
        pairedAt: String(d.pairedAt || d.enrolledAt || d.enrolled_at || new Date().toISOString()),
        lastSeenAt: String(d.lastSeenAt || d.lastSync || d.last_sync || new Date().toISOString()),
        lastSeen: d.lastSeen ? String(d.lastSeen) : undefined,
      })),
    };
  }

  static async fetchSecurityPosture(
    token?: string | null,
    email?: string | null,
  ): Promise<SecurityPostureSnapshot | null> {
    if (!isLiveBackendToken(token)) return null;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const pushUrl = email
      ? `${baseUrl}/oauth/mfa/push/preference?email=${encodeURIComponent(email.trim().toLowerCase())}`
      : `${baseUrl}/oauth/mfa/push/preference`;

    const [factorsRes, recoveryRes, prefsRes, pushRes, devicesRes] = await Promise.all([
      fetchJsonWithTimeout(`${baseUrl}/auth/mfa/factors`, { method: 'GET', headers }),
      fetchJsonWithTimeout(`${baseUrl}/auth/recovery-codes/status`, { method: 'GET', headers }),
      fetchJsonWithTimeout(`${baseUrl}/auth/security-preferences`, { method: 'GET', headers }),
      fetchJsonWithTimeout(pushUrl, { method: 'GET', headers }),
      SecurityActivityService.fetchEnrolledDevices(token, email),
    ]);

    const factors = Array.isArray(factorsRes.data?.factors)
      ? factorsRes.data.factors
      : Array.isArray(factorsRes.data?.totp)
        ? factorsRes.data.totp
        : [];
    const verifiedFactors = factors.filter(
      (f: any) => !f.status || f.status === 'verified',
    );

    const remainingCodes =
      typeof recoveryRes.data?.remainingCount === 'number'
        ? recoveryRes.data.remainingCount
        : typeof recoveryRes.data?.remaining === 'number'
          ? recoveryRes.data.remaining
          : 0;

    return {
      totpEnrolled: verifiedFactors.length > 0,
      totpFactorsCount: verifiedFactors.length,
      recoveryCodesRemaining: remainingCodes,
      pushMfaEnabled:
        typeof pushRes.data?.enabled === 'boolean' ? pushRes.data.enabled : true,
      alertThreshold:
        prefsRes.data?.alertThreshold === 'new_device' ? 'new_device' : 'all',
      emailAlertsEnabled:
        typeof prefsRes.data?.emailAlertsEnabled === 'boolean'
          ? prefsRes.data.emailAlertsEnabled
          : true,
      secondaryEmail: prefsRes.data?.secondaryEmail || undefined,
      enrolledDevicesCount: devicesRes.ok ? devicesRes.devices.length : 0,
      evaluatedAt: new Date().toLocaleTimeString(),
    };
  }

  static async updateSecurityPreferences(
    token: string,
    body: {
      alertThreshold?: 'all' | 'new_device';
      emailAlertsEnabled?: boolean;
      secondaryEmail?: string;
    },
  ): Promise<boolean> {
    if (!isLiveBackendToken(token)) return false;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const res = await fetchJsonWithTimeout(`${baseUrl}/auth/security-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  static async regenerateRecoveryCodes(token: string): Promise<string[] | null> {
    if (!isLiveBackendToken(token)) return null;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const res = await fetchJsonWithTimeout(`${baseUrl}/auth/recovery-codes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return Array.isArray(res.data?.codes) ? res.data.codes : [];
  }

  static async revokeAllSessions(token: string): Promise<boolean> {
    if (!isLiveBackendToken(token)) return false;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const res = await fetchJsonWithTimeout(`${baseUrl}/auth/revoke-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    return res.ok;
  }

  static async fetchAdminSnapshot(
    token?: string | null,
  ): Promise<AdminDirectorySnapshot | null> {
    if (!isLiveBackendToken(token)) return null;
    const baseUrl = AppsStorageService.getBackendApiUrl();
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const [usersRes, appsRes, settingsRes] = await Promise.all([
      fetchJsonWithTimeout(`${baseUrl}/auth/directory-users`, { method: 'GET', headers }),
      fetchJsonWithTimeout(`${baseUrl}/apps/tenant`, { method: 'GET', headers }),
      fetchJsonWithTimeout(`${baseUrl}/auth/tenant-settings`, { method: 'GET', headers }),
    ]);

    const rawUsers: any[] = Array.isArray(usersRes.data?.users)
      ? usersRes.data.users
      : Array.isArray(usersRes.data)
        ? usersRes.data
        : [];

    const rawApps: any[] = Array.isArray(appsRes.data?.apps)
      ? appsRes.data.apps
      : Array.isArray(appsRes.data)
        ? appsRes.data
        : [];

    const settingsObj = settingsRes.data?.settings || settingsRes.data || null;

    return {
      users: rawUsers.map((u, idx) => ({
        id: String(u.id || u.user_id || `dir-${idx}`),
        email: String(u.email || ''),
        name: String(u.name || u.full_name || u.email || 'Directory Member'),
        role: String(u.role || 'member'),
        department: u.department ? String(u.department) : undefined,
        status: String(u.accountStatus || u.status || 'Active'),
      })),
      tenantApps: rawApps.map((a, idx) => ({
        id: String(a.id || `app-${idx}`),
        name: String(a.name || 'Enterprise App'),
        category: String(a.category || 'cloud'),
        protocol: String(a.protocol || 'OIDC'),
        launchUrl: a.launchUrl || a.launch_url ? String(a.launchUrl || a.launch_url) : undefined,
      })),
      tenantSettings: settingsObj
        ? {
            name: settingsObj.name || undefined,
            domain: settingsObj.domain ?? null,
            mfaEnforced: Boolean(settingsObj.mfaEnforced ?? settingsObj.mfa_enforced),
            blockHighRiskIps: Boolean(
              settingsObj.blockHighRiskIps ?? settingsObj.block_high_risk_ips,
            ),
            sessionDurationMinutes:
              typeof settingsObj.sessionDurationMinutes === 'number'
                ? settingsObj.sessionDurationMinutes
                : typeof settingsObj.session_duration_minutes === 'number'
                  ? settingsObj.session_duration_minutes
                  : undefined,
          }
        : null,
    };
  }
}
