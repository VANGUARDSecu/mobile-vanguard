import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
  PersonalAppInput,
  AppCategory,
  AppItemCategory,
  isAppMatchedConnectedApp,
  countUnifiedIntegratedApps,
  isIntegratedAppSlotTaken,
} from '@/models/apps.models';
import { AppsStorageService } from '@/services/apps-storage.service';
import { AppLauncherService } from '@/services/app-launcher.service';
import { AuthService } from '@/services/auth.service';
import vaultService from '@/services/vault.service';
import { syncCoordinatorService } from '@/services/sync-coordinator.service';
import { credentialVaultSyncService } from '@/services/credential-vault-sync.service';
import {
  SecurityActivityService,
  type AdminDirectorySnapshot,
  type MobileAuditLogEvent,
  type MobileEnrolledDevice,
  type SecurityPostureSnapshot,
} from '@/services/security-activity.service';
import { BillingLimitError, isBillingLimitError } from '@/models/billing.models';
import { AuthContext } from './auth-context';
import { useOptionalBilling } from './billing-context';

interface AppsContextType {
  isPersonalWorkspace: boolean;
  setIsPersonalWorkspace: (isPersonal: boolean) => void;
  isCompanyAdmin: boolean;
  selectedCategory: AppCategory;
  setSelectedCategory: (category: AppCategory) => void;
  apps: SaaSApp[];
  personalApps: SaaSApp[];
  activeAppsList: SaaSApp[];
  totalIntegratedAppsCount: number;
  filteredApps: SaaSApp[];
  connectedApps: UserConnectedApp[];
  activeConnectedApps: UserConnectedApp[];
  accessRequests: AppAccessRequest[];
  pendingRequestsCount: number;
  pendingAdminRequests: AppAccessRequest[];
  approveAccessRequest: (id: string) => Promise<void>;
  rejectAccessRequest: (id: string, notes?: string) => Promise<void>;
  vaultCredentials: PersonalVaultItem[];
  vaultUnlocked: boolean;
  hasRemoteVault: boolean;
  vaultRevision: number;
  unlockCredentialVault: (password: string) => Promise<PersonalVaultItem[]>;
  lockCredentialVault: () => void;
  upsertCredential: (input: {
    id?: string;
    title: string;
    category?: PersonalVaultItem['category'];
    username: string;
    password?: string;
    url?: string;
    notes?: string;
    favorite?: boolean;
  }) => Promise<PersonalVaultItem[]>;
  deleteCredential: (id: string) => Promise<PersonalVaultItem[]>;
  pinVaultCredentialToApps: (item: PersonalVaultItem) => Promise<SaaSApp>;
  enrolledDevices: MobileEnrolledDevice[];
  refreshDevices: () => Promise<void>;
  auditEvents: MobileAuditLogEvent[];
  securityPosture: SecurityPostureSnapshot | null;
  adminSnapshot: AdminDirectorySnapshot | null;
  refreshSecurityData: () => Promise<void>;
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
  const billing = useOptionalBilling();
  const refreshBilling = billing?.refreshSubscription;
  const currentUser = authContext?.currentUser ?? null;
  const userEmail = currentUser?.email;

  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('all');
  const [apps, setApps] = useState<SaaSApp[]>([]);
  const [personalApps, setPersonalApps] = useState<SaaSApp[]>([]);
  const [connectedApps, setConnectedApps] = useState<UserConnectedApp[]>([]);
  const [accessRequests, setAccessRequests] = useState<AppAccessRequest[]>([]);
  const [vaultCredentials, setVaultCredentials] = useState<PersonalVaultItem[]>([]);
  const [vaultUnlocked, setVaultUnlocked] = useState<boolean>(false);
  const [hasRemoteVault, setHasRemoteVault] = useState<boolean>(false);
  const [vaultRevision, setVaultRevision] = useState<number>(0);
  const [enrolledDevices, setEnrolledDevices] = useState<MobileEnrolledDevice[]>([]);
  const [auditEvents, setAuditEvents] = useState<MobileAuditLogEvent[]>([]);
  const [securityPosture, setSecurityPosture] = useState<SecurityPostureSnapshot | null>(null);
  const [adminSnapshot, setAdminSnapshot] = useState<AdminDirectorySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isCompanyAdminUser =
    currentUser?.accountType === 'company' &&
    (currentUser?.role === 'admin' || currentUser?.role === 'security_officer');

  // Keep React state synced with in-memory Zero-Knowledge Credential Vault
  useEffect(() => {
    return credentialVaultSyncService.subscribe((snap) => {
      setVaultUnlocked(snap.unlocked);
      setHasRemoteVault(snap.hasRemoteEnvelope);
      setVaultRevision(snap.revision);
      if (snap.unlocked) {
        setVaultCredentials(snap.items);
      } else {
        setVaultCredentials([]);
      }
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
    if (!AppsStorageService.isLiveToken(token)) return;
    const res = await SecurityActivityService.fetchEnrolledDevices(token, userEmail);
    if (res.ok) {
      setEnrolledDevices(res.devices);
    }
  }, [currentUser, userEmail]);

  const refreshSecurityData = useCallback(async () => {
    const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
    if (!AppsStorageService.isLiveToken(token)) return;
    const [logs, posture, admin] = await Promise.all([
      SecurityActivityService.fetchAuditLogs(token, { limit: 50 }),
      SecurityActivityService.fetchSecurityPosture(token, userEmail),
      isCompanyAdminUser
        ? SecurityActivityService.fetchAdminSnapshot(token)
        : Promise.resolve(null),
    ]);
    setAuditEvents(logs);
    if (posture) setSecurityPosture(posture);
    if (isCompanyAdminUser) {
      setAdminSnapshot(admin);
    } else {
      setAdminSnapshot(null);
    }
  }, [currentUser, isCompanyAdminUser, userEmail]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      vaultService.setAuthTokenProvider(async () =>
        AuthService.ensureValidAccessToken(currentUser?.accessToken),
      );
      if (userEmail) {
        vaultService.setCurrentUserEmail(userEmail);
      }

      const [entApps, pApps, cApps, requests] = await Promise.all([
        AppsStorageService.getEnterpriseApps(userEmail),
        AppsStorageService.getPersonalApps(userEmail),
        AppsStorageService.getConnectedApps(),
        AppsStorageService.getAccessRequests(userEmail),
      ]);

      setApps(entApps);
      setPersonalApps(pApps);
      setConnectedApps(cApps);
      setAccessRequests(requests);

      // SCRUM-178, SCRUM-182 & SCRUM-199: Authoritative backend sync across TOTP, Vault, Apps, Devices, Audit & Posture
      if (AppsStorageService.isLiveToken(token)) {
        try {
          vaultService.setCurrentUserEmail(userEmail || null);
          vaultService.setAuthTokenProvider(async () => token);
          const [syncedPersonal, syncedApps, syncedRequests, syncedConnected, devRes, logs, posture, admin] =
            await Promise.all([
              AppsStorageService.syncPersonalAppsWithBackend(token, userEmail),
              AppsStorageService.syncEnterpriseAppsWithBackend(token, userEmail),
              AppsStorageService.syncAccessRequestsWithBackend(token, userEmail),
              AppsStorageService.syncConnectedAppsWithBackend(userEmail, token),
              SecurityActivityService.fetchEnrolledDevices(token, userEmail),
              SecurityActivityService.fetchAuditLogs(token, { limit: 50 }),
              SecurityActivityService.fetchSecurityPosture(token, userEmail),
              isCompanyAdminUser
                ? SecurityActivityService.fetchAdminSnapshot(token)
                : Promise.resolve(null),
              vaultService.syncWithBackend(token),
              credentialVaultSyncService.hasSessionPassphrase() &&
              !credentialVaultSyncService.getSnapshot().unlocked
                ? credentialVaultSyncService.tryAutoUnlock(token)
                : credentialVaultSyncService.syncIfUnlocked(token),
            ]);
          setPersonalApps(syncedPersonal);
          setApps(syncedApps);
          setAccessRequests(syncedRequests);
          setConnectedApps(syncedConnected);
          if (devRes.ok) setEnrolledDevices(devRes.devices);
          setAuditEvents(logs);
          if (posture) setSecurityPosture(posture);
          setAdminSnapshot(isCompanyAdminUser ? admin : null);
        } catch {
          // Graceful offline fallback
        }
      } else {
        setEnrolledDevices([]);
        setAuditEvents([]);
        setSecurityPosture(null);
        setAdminSnapshot(null);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isCompanyAdminUser, userEmail]);

  const syncConnectedApps = useCallback(async () => {
    try {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      const synced = await AppsStorageService.syncConnectedAppsWithBackend(userEmail, token);
      setConnectedApps(synced);
    } catch {
      // Graceful fallback
    }
  }, [currentUser, userEmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // SCRUM-178: Cross-device watermark polling + foreground resume listener
  useEffect(() => {
    const getToken = async () =>
      AuthService.ensureValidAccessToken(currentUser?.accessToken);

    vaultService.setCurrentUserEmail(userEmail || null);
    vaultService.setAuthTokenProvider(getToken);
    syncCoordinatorService.resetWatermarks();
    syncCoordinatorService.configure({
      getToken,
      refreshToken: () => AuthService.refreshSession(),
      onDomainsChanged: async (domains) => {
        const token = (await getToken()) || undefined;
        if (!AppsStorageService.isLiveToken(token)) return;
        await Promise.all(
          domains.map(async (domain) => {
            if (domain === 'totp') {
              await vaultService.syncWithBackend(token);
            } else if (domain === 'vault') {
              await credentialVaultSyncService.syncIfUnlocked(token);
            } else if (domain === 'personalApps') {
              setPersonalApps(
                await AppsStorageService.syncPersonalAppsWithBackend(token, userEmail),
              );
            } else if (domain === 'enterpriseApps') {
              setApps(await AppsStorageService.syncEnterpriseAppsWithBackend(token, userEmail));
            } else if (domain === 'connectedApps') {
              setConnectedApps(
                await AppsStorageService.syncConnectedAppsWithBackend(userEmail, token),
              );
            } else if (domain === 'accessRequests') {
              setAccessRequests(
                await AppsStorageService.syncAccessRequestsWithBackend(token, userEmail),
              );
            } else if (domain === 'billing' && refreshBilling) {
              await refreshBilling();
            } else if (domain === 'devices') {
              await refreshDevices();
            }
          }),
        );
      },
    });

    if (currentUser) {
      syncCoordinatorService.start(5000);
    }

    const appStateSub = AppState?.addEventListener?.('change', (nextState) => {
      if (nextState === 'active') {
        void syncCoordinatorService.checkOnce();
      }
    });

    return () => {
      syncCoordinatorService.stop();
      appStateSub?.remove?.();
    };
  }, [currentUser, userEmail]);

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

  // SCRUM-58 & SCRUM-72: Strict deduplication and user account filtering (defined before activeAppsList so SSO apps are excluded from My Apps)
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

  // SCRUM-58, SCRUM-159, SCRUM-182 & SCRUM-201: Strict deduplication; connected SSO apps live in ConnectedAppsSection only
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
      if (isAppMatchedConnectedApp(app, activeConnectedApps)) {
        continue;
      }
      const key = (app.name || app.id || app.launchUrl).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(app);
      }
    }
    return deduped;
  }, [isPersonalWorkspace, personalApps, apps, accessRequests, currentUser, activeConnectedApps]);

  const totalIntegratedAppsCount = useMemo<number>(
    () => countUnifiedIntegratedApps(activeAppsList, activeConnectedApps),
    [activeAppsList, activeConnectedApps],
  );

  // Category Filtering
  const filteredApps = useMemo<SaaSApp[]>(() => {
    if (selectedCategory === 'all') {
      return activeAppsList;
    }
    return activeAppsList.filter((app) => app.category === selectedCategory);
  }, [activeAppsList, selectedCategory]);

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
      const targetReq = accessRequests.find((r) => r.id === id);
      if (
        billing &&
        targetReq &&
        !isIntegratedAppSlotTaken(targetReq.appName, targetReq.launchUrl, activeAppsList, activeConnectedApps)
      ) {
        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
        if (!quota.allowed) {
          billing.openBillingModal(quota.reason);
          return;
        }
      }

      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      try {
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
      } catch (err) {
        if (isBillingLimitError(err)) {
          await refreshBilling?.();
          billing?.openBillingModal(err.message);
          return;
        }
        throw err;
      }
    },
    [
      accessRequests,
      activeAppsList,
      activeConnectedApps,
      billing,
      currentUser,
      refreshBilling,
      totalIntegratedAppsCount,
      userEmail,
    ]
  );

  const rejectAccessRequest = useCallback(
    async (id: string, notes?: string) => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
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

  // Add Personal Application (SCRUM-178, SCRUM-185 & SCRUM-201: enforce Free-tier unified slot limit)
  const addPersonalApp = useCallback(
    async (input: PersonalAppInput): Promise<SaaSApp> => {
      const slotAlreadyCounted = isIntegratedAppSlotTaken(
        input.name,
        input.launchUrl,
        activeAppsList,
        activeConnectedApps,
      );
      if (billing && !slotAlreadyCounted) {
        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
        if (!quota.allowed) {
          billing.openBillingModal(quota.reason);
          throw new BillingLimitError(
            quota.reason || 'Free plan application limit reached.',
            'integrated_apps',
          );
        }
      }

      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      const uid = currentUser?.id;
      try {
        const created = await AppsStorageService.addPersonalApp(input, userEmail, token, uid);
        setPersonalApps((prev) => [
          created,
          ...prev.filter((a) => a.name.toLowerCase().trim() !== created.name.toLowerCase().trim()),
        ]);
        return created;
      } catch (err) {
        if (isBillingLimitError(err)) {
          await refreshBilling?.();
          billing?.openBillingModal(err.message);
        }
        throw err;
      }
    },
    [activeAppsList, activeConnectedApps, billing, currentUser, refreshBilling, totalIntegratedAppsCount, userEmail],
  );

  // Delete Personal Application (SCRUM-178)
  const deletePersonalApp = useCallback(
    async (id: string): Promise<void> => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      const uid = currentUser?.id;
      await AppsStorageService.deletePersonalApp(id, userEmail, token, uid);
      setPersonalApps((prev) => prev.filter((a) => a.id !== id));
      setApps((prev) => prev.filter((a) => a.id !== id));
    },
    [currentUser, userEmail]
  );

  // Submit Enterprise App Access Request (dynamic active user info + SCRUM-201 quota parity)
  const submitAppRequest = useCallback(
    async (input: {
      appName: string;
      justification: string;
      category?: AppItemCategory;
      icon?: string;
    }): Promise<AppAccessRequest> => {
      if (
        billing &&
        !isIntegratedAppSlotTaken(input.appName, undefined, activeAppsList, activeConnectedApps)
      ) {
        const quota = billing.checkAppQuota(totalIntegratedAppsCount);
        if (!quota.allowed) {
          billing.openBillingModal(quota.reason);
          throw new BillingLimitError(
            quota.reason || 'Free plan application limit reached.',
            'integrated_apps',
          );
        }
      }

      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      try {
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
      } catch (err) {
        if (isBillingLimitError(err)) {
          await refreshBilling?.();
          billing?.openBillingModal(err.message);
        }
        throw err;
      }
    },
    [activeAppsList, activeConnectedApps, billing, currentUser, refreshBilling, totalIntegratedAppsCount]
  );

  // Disconnect Connected SSO Application
  const disconnectConnectedApp = useCallback(
    async (clientId: string): Promise<void> => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      await AppsStorageService.disconnectConnectedApp(clientId, userEmail, token);
      setConnectedApps((prev) => prev.filter((c) => c.clientId !== clientId));
    },
    [currentUser, userEmail],
  );

  const unlockCredentialVault = useCallback(
    async (password: string): Promise<PersonalVaultItem[]> => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      return credentialVaultSyncService.unlockWithPassword(password, token);
    },
    [currentUser],
  );

  const lockCredentialVault = useCallback(() => {
    credentialVaultSyncService.lock();
  }, []);

  const upsertCredential = useCallback(
    async (input: {
      id?: string;
      title: string;
      category?: PersonalVaultItem['category'];
      username: string;
      password?: string;
      url?: string;
      notes?: string;
      favorite?: boolean;
    }): Promise<PersonalVaultItem[]> => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      return credentialVaultSyncService.upsertItem(input, token);
    },
    [currentUser],
  );

  const deleteCredential = useCallback(
    async (id: string): Promise<PersonalVaultItem[]> => {
      const token = (await AuthService.ensureValidAccessToken(currentUser?.accessToken)) || undefined;
      return credentialVaultSyncService.deleteItem(id, token);
    },
    [currentUser],
  );

  const pinVaultCredentialToApps = useCallback(
    async (item: PersonalVaultItem): Promise<SaaSApp> => {
      const rawUrl = (item.url || '').trim();
      const launchUrl = rawUrl
        ? /^https?:\/\//i.test(rawUrl)
          ? rawUrl
          : `https://${rawUrl}`
        : 'https://vanguard.security';
      return addPersonalApp({
        name: item.title || 'Saved Application',
        category: 'collaboration',
        launchUrl,
        description: `Pinned from Zero-Knowledge Vault (${item.username || 'Saved login'})`,
        icon: '🔑',
        username: item.username,
        password: item.password,
      });
    },
    [addPersonalApp],
  );

  const refreshApps = useCallback(async () => {
    await Promise.all([
      syncCoordinatorService.checkOnce(true),
      loadData(),
      refreshBilling ? refreshBilling() : Promise.resolve(),
    ]);
  }, [loadData, refreshBilling]);

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
      totalIntegratedAppsCount,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      accessRequests: visibleAccessRequests,
      pendingRequestsCount,
      pendingAdminRequests,
      approveAccessRequest,
      rejectAccessRequest,
      vaultCredentials,
      vaultUnlocked,
      hasRemoteVault,
      vaultRevision,
      unlockCredentialVault,
      lockCredentialVault,
      upsertCredential,
      deleteCredential,
      pinVaultCredentialToApps,
      enrolledDevices,
      refreshDevices,
      auditEvents,
      securityPosture,
      adminSnapshot,
      refreshSecurityData,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
      syncConnectedApps,
      isLoading,
      refreshApps,
    }),
    [
      isPersonalWorkspace,
      setIsPersonalWorkspace,
      isCompanyAdmin,
      selectedCategory,
      apps,
      personalApps,
      activeAppsList,
      totalIntegratedAppsCount,
      filteredApps,
      connectedApps,
      activeConnectedApps,
      visibleAccessRequests,
      pendingRequestsCount,
      pendingAdminRequests,
      approveAccessRequest,
      rejectAccessRequest,
      vaultCredentials,
      vaultUnlocked,
      hasRemoteVault,
      vaultRevision,
      unlockCredentialVault,
      lockCredentialVault,
      upsertCredential,
      deleteCredential,
      pinVaultCredentialToApps,
      enrolledDevices,
      refreshDevices,
      auditEvents,
      securityPosture,
      adminSnapshot,
      refreshSecurityData,
      findCredentialsForDomain,
      addPersonalApp,
      deletePersonalApp,
      submitAppRequest,
      disconnectConnectedApp,
      syncConnectedApps,
      isLoading,
      refreshApps,
    ]
  );

  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>;
}

export function useOptionalApps(): AppsContextType | undefined {
  return useContext(AppsContext);
}

export function useApps(): AppsContextType {
  const context = useContext(AppsContext);
  if (!context) {
    throw new Error('useApps must be used within an AppsProvider');
  }
  return context;
}
