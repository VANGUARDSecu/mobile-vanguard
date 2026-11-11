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
import { AuthService } from '@/services/auth.service';
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
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;

      const [entApps, pApps, cApps, requests, vault] = await Promise.all([
        AppsStorageService.getEnterpriseApps(userEmail),
        AppsStorageService.getPersonalApps(userEmail),
        AppsStorageService.getConnectedApps(),
        AppsStorageService.getAccessRequests(userEmail),
        AppsStorageService.getVaultItems(userEmail),
      ]);

      setApps(entApps);
      setPersonalApps(pApps);
      setConnectedApps(cApps);
      setAccessRequests(requests);
      setVaultCredentials(vault);

      // SCRUM-182: Await live synchronization from production backend when session token is present
      if (token) {
        try {
          const [syncedApps, syncedRequests] = await Promise.all([
            AppsStorageService.syncEnterpriseAppsWithBackend(token, userEmail),
            AppsStorageService.syncAccessRequestsWithBackend(token, userEmail),
          ]);
          if (syncedApps && syncedApps.length > 0) {
            setApps(syncedApps);
          }
          if (syncedRequests && syncedRequests.length > 0) {
            setAccessRequests(syncedRequests);
          }
        } catch {
          // Graceful offline fallback
        }
      }

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
  }, [currentUser, userEmail]);

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

  // SCRUM-84: Mode is strictly immutable and derived from account type.
  const setIsPersonalWorkspace = useCallback((_isPersonal: boolean) => {
    // Non-switchable per SCRUM-84 account architecture policy
  }, []);

  // SCRUM-84: isPersonalWorkspace is strictly derived from accountType (no arbitrary mode toggling)
  const isPersonalWorkspace = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.accountType === 'individual';
  }, [currentUser]);

  const isCompanyAdmin = useMemo(() => {
    return (
      currentUser?.accountType === 'company' &&
      (currentUser?.role === 'admin' || currentUser?.role === 'security_officer')
    );
  }, [currentUser]);

  // SCRUM-58, SCRUM-159 & SCRUM-182: Strict deduplication ensuring all active applications & approved requests render
  const activeAppsList = useMemo<SaaSApp[]>(() => {
    const email = currentUser?.email?.toLowerCase().trim();
    const uid = currentUser?.id;

    // In personal workspace, display personalApps.
    // In company workspace, display personalApps (custom shortcuts) AND enterprise tenant apps.
    const rawSource = isPersonalWorkspace ? personalApps : [...personalApps, ...apps];

    // Filter approved access requests in company workspace (SCRUM-159 parity with frontend)
    const approvedRequests: SaaSApp[] = !isPersonalWorkspace
      ? accessRequests
          .filter((r) => {
            if (r.status !== 'Approved') return false;
            return (
              (email && r.userEmail?.toLowerCase().trim() === email) ||
              (uid && r.userId === uid) ||
              (!email && !uid && r.userEmail?.includes('@vanguard.security'))
            );
          })
          .map((r) => ({
            id: r.id,
            name: r.appName,
            category: (r.category as SaaSApp['category']) || 'cloud',
            description: r.justification ? `${r.appName} (${r.justification})` : `${r.appName} (Approved access)`,
            icon: r.icon || '🚀',
            protocol: (r.protocol as SaaSApp['protocol']) || 'SAML 2.0',
            launchUrl: r.launchUrl || 'https://vanguard.security',
            assigned: true,
            status: 'Approved',
          }))
      : [];

    const seen = new Set<string>();
    const deduped: SaaSApp[] = [];

    for (const app of [...rawSource, ...approvedRequests]) {
      const key = (app.name || app.id || app.launchUrl).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(app);
      }
    }
    return deduped;
  }, [isPersonalWorkspace, personalApps, apps, accessRequests, currentUser]);

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
    async (id: string, notes?: string) => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      const updated = await AppsStorageService.approveAccessRequest(
        id,
        currentUser?.name || 'Company Admin',
        token,
        notes,
        userEmail
      );
      if (updated) {
        setAccessRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    },
    [currentUser, userEmail]
  );

  const rejectAccessRequest = useCallback(
    async (id: string, notes?: string) => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      const updated = await AppsStorageService.rejectAccessRequest(
        id,
        currentUser?.name || 'Company Admin',
        notes,
        token,
        userEmail
      );
      if (updated) {
        setAccessRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    },
    [currentUser, userEmail]
  );

  // Matching Vault Credential Detection (for Auto-Fill Ready badge)
  const findCredentialsForDomain = useCallback(
    (domainOrUrl: string): PersonalVaultItem[] => {
      return AppLauncherService.findMatchingVaultCredentials(domainOrUrl, vaultCredentials);
    },
    [vaultCredentials]
  );

  // Add Personal Application (SCRUM-182: updates both stores and syncs)
  const addPersonalApp = useCallback(
    async (input: PersonalAppInput): Promise<SaaSApp> => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      const uid = currentUser?.id;
      const created = await AppsStorageService.addPersonalApp(input, userEmail, token, uid);
      setPersonalApps((prev) => [
        created,
        ...prev.filter((a) => a.name.toLowerCase().trim() !== created.name.toLowerCase().trim()),
      ]);
      setApps((prev) => [
        created,
        ...prev.filter((a) => a.name.toLowerCase().trim() !== created.name.toLowerCase().trim()),
      ]);
      return created;
    },
    [currentUser, userEmail]
  );

  // Delete Personal Application (SCRUM-182: updates both stores and syncs)
  const deletePersonalApp = useCallback(
    async (id: string): Promise<void> => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      const uid = currentUser?.id;
      await AppsStorageService.deletePersonalApp(id, userEmail, token, uid);
      setPersonalApps((prev) => prev.filter((a) => a.id !== id));
      setApps((prev) => prev.filter((a) => a.id !== id));
    },
    [currentUser, userEmail]
  );

  // Submit Enterprise App Access Request (dynamic active user info)
  const submitAppRequest = useCallback(
    async (input: {
      appName: string;
      justification: string;
      category?: AppItemCategory;
      icon?: string;
    }): Promise<AppAccessRequest> => {
      const token = currentUser?.accessToken || (await AuthService.getAccessToken()) || undefined;
      const created = await AppsStorageService.submitAccessRequest(
        {
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
        },
        token
      );
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
