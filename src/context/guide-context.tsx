import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';

import {
  GUIDE_ROLE_TABS,
  createMobileGuideController,
  getGuideProfile,
  type GuideContext as GuideScreenContext,
  type GuideControllerState,
  type GuideRole,
  type GuideRoleProfile,
  type GuideStep,
  type MobileRoutePath,
} from '@/utils/new-user-guide';

export interface GuideContextValue {
  isOpen: boolean;
  context: GuideScreenContext;
  activeRole: GuideRole;
  dontShowAgain: boolean;
  activeProfile: GuideRoleProfile;
  roleTabs: typeof GUIDE_ROLE_TABS;
  autoOpenIfFirstDashboardVisit: (
    userKey: string | null | undefined,
    role: GuideRole
  ) => Promise<boolean>;
  openFromLogin: (role?: GuideRole) => void;
  openFromDashboard: (userKey: string | null | undefined, role: GuideRole) => Promise<void>;
  selectRole: (role: GuideRole) => void;
  setDontShowAgain: (value: boolean) => void;
  close: (persistPreference?: boolean) => Promise<void>;
  executeStepAction: (step: GuideStep) => Promise<void>;
}

const GuideCtx = createContext<GuideContextValue | undefined>(undefined);

/**
 * Provides global New User Guide modal state, persistence, and route actions across mobile tabs.
 */
export function GuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const controller = useMemo(() => createMobileGuideController(AsyncStorage), []);
  const [state, setState] = useState<GuideControllerState>(() => controller.getState());

  useEffect(() => {
    return controller.subscribe((next) => {
      setState(next);
    });
  }, [controller]);

  const navigateToRoute = useCallback(
    (route: MobileRoutePath) => {
      if (route === pathname) {
        return;
      }
      if (route === '/register') {
        router.push(route);
        return;
      }
      router.replace(route);
    },
    [pathname, router]
  );

  const autoOpenIfFirstDashboardVisit = useCallback(
    (userKey: string | null | undefined, role: GuideRole) =>
      controller.autoOpenIfFirstDashboardVisit(userKey, role),
    [controller]
  );

  const openFromLogin = useCallback(
    (role?: GuideRole) => {
      controller.openFromLogin(role);
    },
    [controller]
  );

  const openFromDashboard = useCallback(
    (userKey: string | null | undefined, role: GuideRole) =>
      controller.openFromDashboard(userKey, role),
    [controller]
  );

  const selectRole = useCallback(
    (role: GuideRole) => {
      controller.selectRole(role);
    },
    [controller]
  );

  const setDontShowAgain = useCallback(
    (value: boolean) => {
      controller.setDontShowAgain(value);
    },
    [controller]
  );

  const close = useCallback(
    (persistPreference = true) => controller.close(persistPreference),
    [controller]
  );

  const executeStepAction = useCallback(
    (step: GuideStep) => controller.executeStepAction(step, navigateToRoute),
    [controller, navigateToRoute]
  );

  const activeProfile = useMemo(
    () => getGuideProfile(state.activeRole),
    [state.activeRole]
  );

  const value = useMemo<GuideContextValue>(
    () => ({
      isOpen: state.isOpen,
      context: state.context,
      activeRole: state.activeRole,
      dontShowAgain: state.dontShowAgain,
      activeProfile,
      roleTabs: GUIDE_ROLE_TABS,
      autoOpenIfFirstDashboardVisit,
      openFromLogin,
      openFromDashboard,
      selectRole,
      setDontShowAgain,
      close,
      executeStepAction,
    }),
    [
      state.isOpen,
      state.context,
      state.activeRole,
      state.dontShowAgain,
      activeProfile,
      autoOpenIfFirstDashboardVisit,
      openFromLogin,
      openFromDashboard,
      selectRole,
      setDontShowAgain,
      close,
      executeStepAction,
    ]
  );

  return <GuideCtx.Provider value={value}>{children}</GuideCtx.Provider>;
}

/**
 * Returns the active New User Guide context; throws if accessed outside GuideProvider.
 */
export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideCtx);
  if (!ctx) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return ctx;
}

/**
 * Returns the New User Guide context when mounted inside GuideProvider, or null otherwise.
 */
export function useOptionalGuide(): GuideContextValue | null {
  return useContext(GuideCtx) ?? null;
}
