import type { AuthUser } from '../models/auth.models.ts';

/**
 * Supported onboarding walkthrough roles displayed in Vanguard Mobile.
 */
export type GuideRole = 'company-admin' | 'employee' | 'individual';

/**
 * Screen context determining whether step shortcuts switch app tabs or route to sign-in/signup.
 */
export type GuideContext = 'login' | 'dashboard';

/**
 * Valid top-level mobile routes reachable from the quick guide shortcuts.
 */
export type MobileRoutePath = '/' | '/vault' | '/devices' | '/explore' | '/login' | '/register';

/**
 * Single plain-English onboarding step displayed inside the mobile New User Guide modal.
 */
export interface GuideStep {
  stepNumber: number;
  icon: string;
  title: string;
  description: string;
  dashboardRoute: MobileRoutePath;
  loginRoute: MobileRoutePath;
  actionLabel: string;
  loginActionLabel: string;
}

/**
 * Complete role walkthrough shown inside the mobile New User Guide modal.
 */
export interface GuideRoleProfile {
  role: GuideRole;
  tabLabel: string;
  badge: string;
  headline: string;
  summary: string;
  loginActionLabel: string;
  loginRoute: MobileRoutePath;
  steps: GuideStep[];
}

/**
 * Minimal async key-value storage contract compatible with AsyncStorage and unit test doubles.
 */
export interface GuideStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Observable UI snapshot exposed by the mobile New User Guide controller.
 */
export interface GuideControllerState {
  isOpen: boolean;
  context: GuideContext;
  activeRole: GuideRole;
  activeUserKey: string | null;
  dontShowAgain: boolean;
}

export const GUIDE_STORAGE_PREFIX = 'vanguard_mobile_guide_dismissed_';

export const GUIDE_ROLE_TABS: readonly { role: GuideRole; label: string }[] = [
  { role: 'company-admin', label: 'Company Owner' },
  { role: 'employee', label: 'Team Employee' },
  { role: 'individual', label: 'Personal Vault' },
];

const GUIDE_PROFILES: Record<GuideRole, GuideRoleProfile> = {
  'company-admin': {
    role: 'company-admin',
    tabLabel: 'Company Owner',
    badge: 'Team Control',
    headline: 'Manage your team safely on mobile',
    summary:
      'Review active company tools, keep recovery codes handy, and approve employee sign-ins or access requests anywhere.',
    loginActionLabel: 'Create Company Account',
    loginRoute: '/register',
    steps: [
      {
        stepNumber: 1,
        icon: '📊',
        title: 'Review Apps & Pending Requests',
        description:
          'See assigned company apps at a glance and approve or deny employee access requests right from the top banner.',
        dashboardRoute: '/',
        loginRoute: '/register',
        actionLabel: 'Open Apps',
        loginActionLabel: 'Create Company Account',
      },
      {
        stepNumber: 2,
        icon: '🔑',
        title: 'Keep Two-Step Codes Ready',
        description:
          'Keep your 6-digit login codes handy inside Authenticator so team sign-ins stay fast without sharing passwords.',
        dashboardRoute: '/vault',
        loginRoute: '/register',
        actionLabel: 'Open Authenticator',
        loginActionLabel: 'Start Team Setup',
      },
      {
        stepNumber: 3,
        icon: '🛡️',
        title: 'Check Security & Backup Codes',
        description:
          'Save backup codes and verify protection settings so your admin access stays locked down on the go.',
        dashboardRoute: '/explore',
        loginRoute: '/login',
        actionLabel: 'Open Security',
        loginActionLabel: 'Sign In as Admin',
      },
    ],
  },
  employee: {
    role: 'employee',
    tabLabel: 'Team Employee',
    badge: 'Easy Work Access',
    headline: 'Open your work apps safely in 3 quick steps',
    summary:
      'Launch apps assigned by your company, copy two-step codes on the go, and approve login prompts from your phone.',
    loginActionLabel: 'Sign In to Portal',
    loginRoute: '/login',
    steps: [
      {
        stepNumber: 1,
        icon: '🚀',
        title: 'Open Your Work Apps',
        description:
          'Tap any tool assigned by your team to launch it smoothly, or request access to another work app in one tap.',
        dashboardRoute: '/',
        loginRoute: '/login',
        actionLabel: 'Open Apps',
        loginActionLabel: 'Sign In to Work Portal',
      },
      {
        stepNumber: 2,
        icon: '🔑',
        title: 'Use Two-Step Login Codes',
        description:
          'Open Authenticator whenever a site asks for your 6-digit code so you can sign in within seconds.',
        dashboardRoute: '/vault',
        loginRoute: '/login',
        actionLabel: 'Open Authenticator',
        loginActionLabel: 'Open Employee Sign-In',
      },
      {
        stepNumber: 3,
        icon: '📱',
        title: 'Verify Your Phone for Prompts',
        description:
          'Link this phone in Devices so you can approve work sign-ins with one tap instead of typing codes by hand.',
        dashboardRoute: '/devices',
        loginRoute: '/login',
        actionLabel: 'Open Devices',
        loginActionLabel: 'Go to Sign In',
      },
    ],
  },
  individual: {
    role: 'individual',
    tabLabel: 'Personal Vault',
    badge: 'Personal Safety',
    headline: 'Protect your personal accounts in 3 easy steps',
    summary:
      'Organize favorite app shortcuts, keep private logins and codes offline, and check trusted phones in seconds.',
    loginActionLabel: 'Create Personal Account',
    loginRoute: '/register',
    steps: [
      {
        stepNumber: 1,
        icon: '🔖',
        title: 'Save Everyday App Bookmarks',
        description:
          'Add your favorite daily sites under Bookmarks so you can launch them quickly from one tidy screen.',
        dashboardRoute: '/',
        loginRoute: '/register',
        actionLabel: 'Open Bookmarks',
        loginActionLabel: 'Create Personal Account',
      },
      {
        stepNumber: 2,
        icon: '🔒',
        title: 'Keep Passwords & Codes Handy',
        description:
          'Store private logins and 6-digit two-step codes inside your Vault—ready even without an internet connection.',
        dashboardRoute: '/vault',
        loginRoute: '/register',
        actionLabel: 'Open Vault',
        loginActionLabel: 'Get Started Free',
      },
      {
        stepNumber: 3,
        icon: '🛟',
        title: 'Save Backup Codes & Check Security',
        description:
          'Review signed-in phones and download backup codes in case you ever switch or lose your device.',
        dashboardRoute: '/explore',
        loginRoute: '/login',
        actionLabel: 'Open Security',
        loginActionLabel: 'Sign In to Vault',
      },
    ],
  },
};

/**
 * Returns the complete plain-English guide profile for a given role.
 */
export function getGuideProfile(role: GuideRole): GuideRoleProfile {
  return GUIDE_PROFILES[role];
}

/**
 * Maps an authenticated mobile user to the most helpful default guide role.
 */
export function resolveGuideRoleFromUser(
  user: Pick<AuthUser, 'accountType' | 'role'> | null | undefined
): GuideRole {
  if (!user) return 'company-admin';
  if (user.accountType === 'individual') return 'individual';
  if (user.role === 'admin' || user.role === 'security_officer') return 'company-admin';
  return 'employee';
}

/**
 * Normalizes an email or user identifier into a stable lowercase dismissal lookup key.
 */
export function normalizeGuideUserKey(userKey: string | null | undefined): string {
  return (userKey ?? '').trim().toLowerCase();
}

/**
 * Builds the per-user AsyncStorage key storing automatic guide suppression.
 */
export function buildGuideStorageKey(userKey: string): string {
  return `${GUIDE_STORAGE_PREFIX}${normalizeGuideUserKey(userKey)}`;
}

/**
 * Resolves the destination mobile route when a guide step button is pressed.
 */
export function resolveGuideStepRoute(step: GuideStep, context: GuideContext): MobileRoutePath {
  return context === 'dashboard' ? step.dashboardRoute : step.loginRoute;
}

/**
 * Stateful, storage-agnostic controller driving the mobile New User Guide lifecycle.
 */
export interface MobileGuideController {
  getState: () => GuideControllerState;
  subscribe: (listener: (state: GuideControllerState) => void) => () => void;
  autoOpenIfFirstDashboardVisit: (
    userKey: string | null | undefined,
    role: GuideRole
  ) => Promise<boolean>;
  openFromLogin: (role?: GuideRole) => void;
  openFromDashboard: (userKey: string | null | undefined, role: GuideRole) => Promise<void>;
  selectRole: (role: GuideRole) => void;
  setDontShowAgain: (value: boolean) => void;
  close: (persistPreference?: boolean) => Promise<void>;
  executeStepAction: (
    step: GuideStep,
    navigate: (route: MobileRoutePath) => void
  ) => Promise<void>;
}

/**
 * Creates a deterministic guide controller backed by an optional AsyncStorage-compatible adapter.
 */
export function createMobileGuideController(
  storage?: GuideStorageAdapter
): MobileGuideController {
  let state: GuideControllerState = {
    isOpen: false,
    context: 'login',
    activeRole: 'company-admin',
    activeUserKey: null,
    dontShowAgain: true,
  };

  const sessionDismissedKeys = new Set<string>();
  const listeners = new Set<(next: GuideControllerState) => void>();

  const emit = () => {
    const snapshot = { ...state };
    listeners.forEach((listener) => listener(snapshot));
  };

  const updateState = (patch: Partial<GuideControllerState>) => {
    state = { ...state, ...patch };
    emit();
  };

  const readPreference = async (userKey: string): Promise<string | null> => {
    if (!storage) return null;
    try {
      return await storage.getItem(buildGuideStorageKey(userKey));
    } catch {
      return null;
    }
  };

  return {
    getState: () => ({ ...state }),

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async autoOpenIfFirstDashboardVisit(userKey, role) {
      const normalized = normalizeGuideUserKey(userKey);
      if (!normalized || sessionDismissedKeys.has(normalized)) {
        return false;
      }

      const stored = await readPreference(normalized);
      if (stored === 'true') {
        return false;
      }

      updateState({
        activeUserKey: normalized,
        context: 'dashboard',
        activeRole: role,
        dontShowAgain: true,
        isOpen: true,
      });
      return true;
    },

    openFromLogin(role = 'company-admin') {
      updateState({
        activeUserKey: null,
        context: 'login',
        activeRole: role,
        isOpen: true,
      });
    },

    async openFromDashboard(userKey, role) {
      const normalized = normalizeGuideUserKey(userKey);
      let dontShowAgain = true;
      if (normalized) {
        const stored = await readPreference(normalized);
        dontShowAgain = stored === null ? true : stored === 'true';
      }

      updateState({
        activeUserKey: normalized || null,
        context: 'dashboard',
        activeRole: role,
        dontShowAgain,
        isOpen: true,
      });
    },

    selectRole(role) {
      updateState({ activeRole: role });
    },

    setDontShowAgain(value) {
      updateState({ dontShowAgain: Boolean(value) });
    },

    async close(persistPreference = true) {
      const { context, activeUserKey, dontShowAgain } = state;
      if (context === 'dashboard' && activeUserKey) {
        sessionDismissedKeys.add(activeUserKey);
        if (persistPreference && storage) {
          const storageKey = buildGuideStorageKey(activeUserKey);
          try {
            if (dontShowAgain) {
              await storage.setItem(storageKey, 'true');
            } else {
              await storage.removeItem(storageKey);
            }
          } catch {
            // Non-fatal when device storage is restricted or full.
          }
        }
      }

      updateState({ isOpen: false });
    },

    async executeStepAction(step, navigate) {
      const targetRoute = resolveGuideStepRoute(step, state.context);
      await this.close(true);
      navigate(targetRoute);
    },
  };
}
