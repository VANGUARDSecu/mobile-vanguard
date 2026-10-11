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

interface AppsContextType {
  isPersonalWorkspace: boolean;
  setIsPersonalWorkspace: (isPersonal: boolean) => void;
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
  isLoading: boolean;
  refreshApps: () => Promise<void>;
}

const AppsContext = createContext<AppsContextType | undefined>(undefined);

export function AppsProvider({ children }: { children: ReactNode }) {
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
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // SCRUM-58: Strict deduplication of connected SSO client applications
  const activeConnectedApps = useMemo<UserConnectedApp[]>(() => {
    const seen = new Set<string>();
    const deduped: UserConnectedApp[] = [];

    for (const conn of connectedApps) {
      if (conn.status === 'Disconnected') continue;
      const key = (conn.originUrl || conn.clientId).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(conn);
      }
    }
    return deduped;
  }, [connectedApps]);

  // Access Requests Count
  const pendingRequestsCount = useMemo(() => {
    return accessRequests.filter((r) => r.status === 'Pending Approval').length;
  }, [accessRequests]);

  // Matching Vault Credential Detection (for Auto-Fill Ready badge)
  const findCredentialsForDomain = useCallback(
    (domainOrUrl: string): PersonalVaultItem[] => {
      if (!domainOrUrl) return [];
      const cleanTarget = domainOrUrl
        .toLowerCase()
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('/')[0]
        .split('?')[0];

      return vaultCredentials.filter((item) => {
        const itemUrl = (item.url || '')
          .toLowerCase()
          .trim()
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .split('/')[0]
          .split('?')[0];

        const itemTitle = item.title.toLowerCase();
        return (
          (cleanTarget && itemUrl.includes(cleanTarget)) ||
          (cleanTarget && cleanTarget.includes(itemUrl)) ||
          itemTitle.includes(cleanTarget)
        );
      });
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

  // Submit Enterprise App Access Request
  const submitAppRequest = useCallback(
    async (input: {
      appName: string;
      justification: string;
      category?: AppItemCategory;
      icon?: string;
    }): Promise<AppAccessRequest> => {
      const created = await AppsStorageService.submitAccessRequest(input);
      setAccessRequests((prev) => [created, ...prev]);
      return created;
    },
    []
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
      selectedCategory,
      setSelectedCategory,
      apps,
      personalApps,
      activeAppsList,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      accessRequests,
      pendingRequestsCount,
      vaultCredentials,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
      isLoading,
      refreshApps: loadData,
    }),
    [
      isPersonalWorkspace,
      setIsPersonalWorkspace,
      selectedCategory,
      apps,
      personalApps,
      activeAppsList,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      accessRequests,
      pendingRequestsCount,
      vaultCredentials,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
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
