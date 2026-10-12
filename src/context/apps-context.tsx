import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
  PersonalAppInput,
  AppCategory,
  AppItemCategory,
} from '@/models/apps.models';
import { AppsStorageService } from '@/services/apps-storage.service';
import { AppLauncherService } from '@/services/app-launcher.service';
import { AuthContext } from './auth-context';

interface AppsContextType {
  isPersonalWorkspace: boolean;
  setIsPersonalWorkspace: (isPersonal: boolean) => void;
  isCompanyAdmin: boolean;
  selectedCategory: AppCategory;
  setSelectedCategory: (category: AppCategory) => void;
  apps: SaaSApp[];
  personalApps: SaaSApp[];
  activeAppsList: SaaSApp[];
  filteredApps: SaaSApp[];
  connectedApps: UserConnectedApp[];
  activeConnectedApps: UserConnectedApp[];
  accessRequests: AppAccessRequest[];
  pendingRequestsCount: number;
  pendingAdminRequests: AppAccessRequest[];
  approveAccessRequest: (id: string) => Promise<void>;
  rejectAccessRequest: (id: string, notes?: string) => Promise<void>;
  vaultCredentials: PersonalVaultItem[];
  findCredentialsForDomain: (domainOrUrl: string) => PersonalVaultItem[];
  addPersonalApp: (input: PersonalAppInput) => Promise<SaaSApp>;
  deletePersonalApp: (id: string) => Promise<void>;
  submitAppRequest: (input: {
    appName: string;
    justification: string;
    category?: AppItemCategory;
    icon?: string;
  }) => Promise<AppAccessRequest>;
  disconnectConnectedApp: (clientId: string) => Promise<void>;
  syncConnectedApps: () => Promise<void>;
  isLoading: boolean;
  refreshApps: () => Promise<void>;
}

const AppsContext = createContext<AppsContextType | undefined>(undefined);

export function AppsProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.currentUser ?? null;
  const userEmail = currentUser?.email;

  const [isPersonalWorkspace, setIsPersonalWorkspaceState] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('all');
  const [apps, setApps] = useState<SaaSApp[]>([]);
  const [personalApps, setPersonalApps] = useState<SaaSApp[]>([]);
  const [connectedApps, setConnectedApps] = useState<UserConnectedApp[]>([]);
  const [accessRequests, setAccessRequests] = useState<AppAccessRequest[]>([]);
  const [vaultCredentials, setVaultCredentials] = useState<PersonalVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [workspaceMode, entApps, pApps, cApps, requests, vault] = await Promise.all([
        AppsStorageService.getWorkspaceMode(),
        AppsStorageService.getEnterpriseApps(),
        AppsStorageService.getPersonalApps(),
        AppsStorageService.getConnectedApps(),
        AppsStorageService.getAccessRequests(),
        AppsStorageService.getVaultItems(),
      ]);

      setIsPersonalWorkspaceState(workspaceMode);
      setApps(entApps);
      setPersonalApps(pApps);
      setConnectedApps(cApps);
      setAccessRequests(requests);
      setVaultCredentials(vault);

      // Attempt live SSO connected apps sync from backend in the background for active user
      AppsStorageService.syncConnectedAppsWithBackend(userEmail)
        .then((synced) => {
          setConnectedApps(synced);
        })
        .catch(() => {});
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  const syncConnectedApps = useCallback(async () => {
    try {
      const synced = await AppsStorageService.syncConnectedAppsWithBackend(userEmail);
      setConnectedApps(synced);
    } catch {
      // Graceful fallback
    }
  }, [userEmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const setIsPersonalWorkspace = useCallback((isPersonal: boolean) => {
    setIsPersonalWorkspaceState(isPersonal);
    AppsStorageService.setWorkspaceMode(isPersonal);
  }, []);

  // SCRUM-58: Strict deduplication ensuring no application ever appears twice
  const activeAppsList = useMemo<SaaSApp[]>(() => {
    const source = isPersonalWorkspace ? personalApps : apps;
    const seen = new Set<string>();
    const deduped: SaaSApp[] = [];

    for (const app of source) {
      const key = (app.name || app.id || app.launchUrl).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(app);
      }
    }
    return deduped;
  }, [isPersonalWorkspace, personalApps, apps]);

  // Category Filtering
  const filteredApps = useMemo<SaaSApp[]>(() => {
    if (selectedCategory === 'all') {
      return activeAppsList;
    }
    return activeAppsList.filter((app) => app.category === selectedCategory);
  }, [activeAppsList, selectedCategory]);

  // SCRUM-58 & SCRUM-72: Strict deduplication and user account filtering
  const activeConnectedApps = useMemo<UserConnectedApp[]>(() => {
    const deduped = AppsStorageService.deduplicateConnectedApps(connectedApps);
    if (!userEmail) {
      return deduped;
    }
    const cleanUserEmail = userEmail.toLowerCase().trim();
    return deduped.filter(
      (conn) =>
        !conn.userEmail ||
        conn.userEmail === 'all' ||
        conn.userEmail.toLowerCase().trim() === cleanUserEmail
    );
  }, [connectedApps, userEmail]);

  const isCompanyAdmin =
    currentUser?.accountType === 'company' &&
    (currentUser?.role === 'admin' || currentUser?.role === 'security_officer');

  // SCRUM-84: isPersonalWorkspace is strictly derived from accountType (no arbitrary mode toggling)
  const isPersonalWorkspace = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.accountType === 'individual';
  }, [currentUser]);

  // For Admin: all requests in organization; for Employee: only their own requests
  const visibleAccessRequests = useMemo(() => {
    if (isCompanyAdmin) {
      return accessRequests;
    }
    if (!userEmail) return accessRequests;
    const clean = userEmail.toLowerCase().trim();
    return accessRequests.filter(
      (r) => !r.userEmail || r.userEmail.toLowerCase().trim() === clean
    );
  }, [accessRequests, isCompanyAdmin, userEmail]);

  // Pending requests requiring Company Admin action
  const pendingAdminRequests = useMemo(() => {
    return accessRequests.filter(
      (r) => r.status === 'Pending Approval' || (r.status as string) === 'Pending Review'
    );
  }, [accessRequests]);

  const pendingRequestsCount = useMemo(() => {
    return isCompanyAdmin
      ? pendingAdminRequests.length
      : visibleAccessRequests.filter((r) => r.status === 'Pending Approval').length;
  }, [isCompanyAdmin, pendingAdminRequests, visibleAccessRequests]);

  const approveAccessRequest = useCallback(
    async (id: string) => {
      const updated = await AppsStorageService.approveAccessRequest(
        id,
        currentUser?.name || 'Company Admin'
      );
      if (updated) {
        setAccessRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    },
    [currentUser]
  );

  const rejectAccessRequest = useCallback(
    async (id: string, notes?: string) => {
      const updated = await AppsStorageService.rejectAccessRequest(
        id,
        currentUser?.name || 'Company Admin',
        notes
      );
      if (updated) {
        setAccessRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    },
    [currentUser]
  );

  // Matching Vault Credential Detection (for Auto-Fill Ready badge)
  const findCredentialsForDomain = useCallback(
    (domainOrUrl: string): PersonalVaultItem[] => {
      return AppLauncherService.findMatchingVaultCredentials(domainOrUrl, vaultCredentials);
    },
    [vaultCredentials]
  );

  // Add Personal Application
  const addPersonalApp = useCallback(async (input: PersonalAppInput): Promise<SaaSApp> => {
    const created = await AppsStorageService.addPersonalApp(input);
    setPersonalApps((prev) => [created, ...prev]);
    return created;
  }, []);

  // Delete Personal Application
  const deletePersonalApp = useCallback(async (id: string): Promise<void> => {
    await AppsStorageService.deletePersonalApp(id);
    setPersonalApps((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Submit Enterprise App Access Request (dynamic active user info)
  const submitAppRequest = useCallback(
    async (input: {
      appName: string;
      justification: string;
      category?: AppItemCategory;
      icon?: string;
    }): Promise<AppAccessRequest> => {
      const created = await AppsStorageService.submitAccessRequest({
        ...input,
        userName:
          currentUser?.name ||
          (currentUser?.email ? currentUser.email.split('@')[0] : 'Authenticated User'),
        userEmail: currentUser?.email || '',
        department:
          currentUser?.department ||
          (currentUser?.user_metadata as any)?.['department'] ||
          'Engineering',
        role: currentUser?.role || 'user',
      });
      setAccessRequests((prev) => [created, ...prev]);
      return created;
    },
    [currentUser]
  );

  // Disconnect Connected SSO Application
  const disconnectConnectedApp = useCallback(async (clientId: string): Promise<void> => {
    await AppsStorageService.disconnectConnectedApp(clientId);
    setConnectedApps((prev) => prev.filter((c) => c.clientId !== clientId));
  }, []);

  const value = useMemo(
    () => ({
      isPersonalWorkspace,
      setIsPersonalWorkspace,
      isCompanyAdmin,
      selectedCategory,
      setSelectedCategory,
      apps,
      personalApps,
      activeAppsList,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      accessRequests: visibleAccessRequests,
      pendingRequestsCount,
      pendingAdminRequests,
      approveAccessRequest,
      rejectAccessRequest,
      vaultCredentials,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
      syncConnectedApps,
      isLoading,
      refreshApps: loadData,
    }),
    [
      isPersonalWorkspace,
      setIsPersonalWorkspace,
      isCompanyAdmin,
      selectedCategory,
      apps,
      personalApps,
      activeAppsList,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      visibleAccessRequests,
      pendingRequestsCount,
      pendingAdminRequests,
      approveAccessRequest,
      rejectAccessRequest,
      vaultCredentials,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
      syncConnectedApps,
      isLoading,
      loadData,
    ]
  );

  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>;
}

export function useApps(): AppsContextType {
  const context = useContext(AppsContext);
  if (!context) {
    throw new Error('useApps must be used within an AppsProvider');
  }
  return context;
}
