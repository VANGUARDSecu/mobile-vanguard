import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  MobileChecklistItem,
  MobileGuideSlide,
} from '../models/guide.models.ts';

const STORAGE_KEYS = {
  CHECKLIST: '@vanguard_mobile_guide_checklist',
  COMPLETED: '@vanguard_mobile_guide_completed',
};

// In-memory fallback map for headless/test environments
const memoryGuideStore = new Map<string, string>();

async function getStoredItem(key: string): Promise<string | null> {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch {
    // In-memory fallback
  }
  return memoryGuideStore.get(key) ?? null;
}

async function setStoredItem(key: string, value: string): Promise<void> {
  memoryGuideStore.set(key, value);
  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // In-memory fallback
  }
}

export const DEFAULT_MOBILE_CHECKLIST: MobileChecklistItem[] = [
  {
    id: 'task-biometrics',
    title: 'Enable Native Biometric App Lock',
    description: 'Secure your mobile vault using Face ID, Touch ID, or fingerprint attestation for instant, protected access.',
    category: 'biometrics',
    targetAction: 'navigate_settings',
    actionLabel: 'Setup Biometrics',
    badge: 'Hardware Enclave',
    completed: false,
  },
  {
    id: 'task-totp',
    title: 'Enroll Offline Authenticator Account',
    description: 'Add your first 2FA TOTP token with 30s rotating countdown. Validated offline with zero network latency.',
    category: 'totp',
    targetAction: 'navigate_vault',
    actionLabel: 'Open Vault',
    badge: 'RFC 6238',
    completed: false,
  },
  {
    id: 'task-push',
    title: 'Test Out-of-Band Push Notification MFA',
    description: 'Familiarize yourself with 2-digit number matching challenges to protect against MFA fatigue attacks.',
    category: 'push_mfa',
    targetAction: 'open_push_sandbox',
    actionLabel: 'Launch Sandbox',
    badge: 'Zero-Trust',
    completed: false,
  },
  {
    id: 'task-sso',
    title: 'Explore Enterprise Application Launchpad',
    description: 'Launch assigned corporate SaaS tools (Slack, Google Workspace, AWS, GitHub) with 1-tap browser SSO.',
    category: 'sso',
    targetAction: 'navigate_apps',
    actionLabel: 'View Applications',
    badge: 'SSO Launchpad',
    completed: false,
  },
  {
    id: 'task-request',
    title: 'Submit Application Access Request',
    description: 'Request new SaaS application licenses by providing an operational business justification.',
    category: 'governance',
    targetAction: 'request_app',
    actionLabel: 'Request App',
    badge: 'Governance',
    completed: false,
  },
];

export const MOBILE_GUIDE_SLIDES: MobileGuideSlide[] = [
  {
    stepNumber: 1,
    title: 'Welcome to Vanguard Mobile Companion',
    subtitle: 'Your Zero-Trust Mobile Identity & Security Vault',
    icon: '🛡️',
    summary: 'Vanguard Mobile provides instant two-factor authentication, secure application single sign-on, and out-of-band push authorization right from your pocket. Designed to keep enterprise access fast and protected.',
    keyPoints: [
      'Hardware-backed biometric lock protects tokens from unauthorized hands.',
      '100% offline RFC 6238 TOTP engine functions even without mobile signal.',
      'Real-time push verification with 2-digit number matching defeats push-bombing.',
    ],
  },
  {
    stepNumber: 2,
    title: 'Biometric Hardware Security',
    subtitle: 'Face ID, Touch ID & Screen Obscuration',
    icon: '🔒',
    summary: 'When you switch away from Vanguard Mobile, your screen is automatically obscured behind a cyber lock screen. Re-entering prompts your phone\'s native biometric sensor or device passcode.',
    keyPoints: [
      'Keys remain encrypted in the iOS Keychain or Android Keystore.',
      'Device passcode fallback is always available if biometrics fail.',
      'Configure auto-lock intervals in the Security Settings screen.',
    ],
    recommendedAction: {
      label: 'Go to Security Settings',
      targetAction: 'navigate_settings',
    },
  },
  {
    stepNumber: 3,
    title: 'Air-Gapped Authenticator Vault',
    subtitle: 'RFC 6238 Time-Based One-Time Passwords',
    icon: '⏱️',
    summary: 'Manage multi-factor authentication tokens for corporate and personal accounts. Codes refresh every 30 seconds with animated circular countdown rings and color shift warnings.',
    keyPoints: [
      'Tap any code or the "COPY" button for instant clipboard extraction.',
      'Add accounts manually or by scanning QR codes.',
      'Secrets are encrypted using 256-bit AES-GCM envelope encryption.',
    ],
    recommendedAction: {
      label: 'Open Authenticator Vault',
      targetAction: 'navigate_vault',
    },
  },
  {
    stepNumber: 4,
    title: 'Out-of-Band Push Notification MFA',
    subtitle: '2-Digit Number Matching Defense',
    icon: '📲',
    summary: 'When logging into corporate services on your desktop, an instant push challenge appears on your phone displaying the application name, location, and IP address. Match the 2-digit number displayed on your computer to approve.',
    keyPoints: [
      'Never approve a push prompt you did not initiate.',
      'Tap "Deny & Report Fraud" to immediately block suspected intrusion attempts.',
      'Test the workflow anytime using the built-in Push Sandbox.',
    ],
    recommendedAction: {
      label: 'Open Push Sandbox',
      targetAction: 'open_push_sandbox',
    },
  },
  {
    stepNumber: 5,
    title: 'Enterprise SaaS Launchpad & Requests',
    subtitle: 'One-Tap Passwordless Access to Corporate Tools',
    icon: '🚀',
    summary: 'Access assigned corporate tools directly from the Apps tab. If you need an application that is not yet assigned, submit a request with business justification for administrative review.',
    keyPoints: [
      'Filter apps by Cloud, Developer, or Collaboration categories.',
      'Approved requests unlock immediate launch with zero-trust assertions.',
      'Inspect active connected apps and revoke sessions on demand.',
    ],
    recommendedAction: {
      label: 'Open Applications Screen',
      targetAction: 'navigate_apps',
    },
  },
];

export class GuideService {
  async getChecklist(): Promise<MobileChecklistItem[]> {
    const raw = await getStoredItem(STORAGE_KEYS.CHECKLIST);
    if (!raw) {
      return [...DEFAULT_MOBILE_CHECKLIST];
    }
    try {
      const parsed: MobileChecklistItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback
    }
    return [...DEFAULT_MOBILE_CHECKLIST];
  }

  async toggleItem(itemId: string): Promise<MobileChecklistItem[]> {
    const current = await this.getChecklist();
    const updated = current.map((item) => {
      if (item.id === itemId) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    await setStoredItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(updated));

    const allCompleted = updated.every((item) => item.completed);
    if (allCompleted) {
      await this.setCompleted(true);
    }

    return updated;
  }

  async resetChecklist(): Promise<MobileChecklistItem[]> {
    const reset = DEFAULT_MOBILE_CHECKLIST.map((item) => ({ ...item, completed: false }));
    await setStoredItem(STORAGE_KEYS.CHECKLIST, JSON.stringify(reset));
    await this.setCompleted(false);
    return reset;
  }

  async isCompleted(): Promise<boolean> {
    const val = await getStoredItem(STORAGE_KEYS.COMPLETED);
    return val === 'true';
  }

  async setCompleted(completed: boolean): Promise<void> {
    await setStoredItem(STORAGE_KEYS.COMPLETED, completed ? 'true' : 'false');
  }

  getSlides(): MobileGuideSlide[] {
    return [...MOBILE_GUIDE_SLIDES];
  }

  calculateProgress(items: MobileChecklistItem[]): number {
    if (!items || items.length === 0) return 0;
    const completed = items.filter((i) => i.completed).length;
    return Math.round((completed / items.length) * 100);
  }
}

export const guideService = new GuideService();
export default guideService;
