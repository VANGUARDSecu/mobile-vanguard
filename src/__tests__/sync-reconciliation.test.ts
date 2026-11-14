import test from 'node:test';
import assert from 'node:assert/strict';

import { VaultService } from '../services/vault.service.ts';
import { MockKeychainProvider } from '../services/secure-storage.provider.ts';
import { AppsStorageService } from '../services/apps-storage.service.ts';
import { SyncCoordinatorService } from '../services/sync-coordinator.service.ts';

test('Cross-Platform Sync & Reconciliation (SCRUM-178)', async (t) => {
  await t.test('1. VaultService skips network sync for mock tokens and reconciles remote TOTP adds & deletes for live tokens', async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; auth?: string; body?: any }> = [];

    let remoteAccounts: any[] = [
      {
        id: 'totp-remote-1',
        issuer: 'GitHub',
        accountName: 'sync@vanguard.dev',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        icon: '🐙',
      },
    ];
    let deletedIds: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const headers = (init?.headers || {}) as Record<string, string>;
      const auth = headers['Authorization'] || headers['authorization'];
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, auth, body });

      if (url.endsWith('/totp-accounts') && method === 'GET') {
        return new Response(
          JSON.stringify({ accounts: remoteAccounts, deletedIds, updatedAt: '2026-11-15T01:00:00Z' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/totp-accounts') && method === 'POST') {
        return new Response(
          JSON.stringify({ account: body }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/totp-accounts/') && method === 'DELETE') {
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const vault = new VaultService(new MockKeychainProvider());
      vault.setCurrentUserEmail('sync@vanguard.dev');

      // Mock token MUST NOT dispatch backend network requests
      const mockSync = await vault.syncWithBackend('mock_jwt_12345');
      assert.equal(mockSync, false);
      assert.equal(calls.length, 0);

      // Live token pulls remote GitHub TOTP added on frontend
      const pulled = await vault.syncWithBackend('live-jwt-abc');
      assert.equal(pulled, true);
      let accounts = await vault.getAccounts();
      assert.equal(accounts.length, 1);
      assert.equal(accounts[0].issuer, 'GitHub');

      // Mobile saveAccount pushes to POST /totp-accounts when authTokenProvider returns live token
      vault.setAuthTokenProvider(async () => 'live-jwt-abc');
      let notified = 0;
      const unsub = vault.subscribe(() => {
        notified++;
      });

      const created = await vault.saveAccount({
        issuer: 'Linear',
        accountName: 'sync@vanguard.dev',
        secret: 'GEZDGNBVGY3TQOJQ',
      });
      // Give fire-and-forget push a microtask to enqueue
      await new Promise((r) => setTimeout(r, 15));
      assert.ok(notified >= 1);
      assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/totp-accounts') && c.body?.issuer === 'Linear'));

      // Frontend deletes Linear + GitHub: server returns empty accounts + deletedIds
      remoteAccounts = [];
      deletedIds = ['totp-remote-1', created.id];
      const reconciledDelete = await vault.syncWithBackend('live-jwt-abc');
      assert.equal(reconciledDelete, true);
      accounts = await vault.getAccounts();
      assert.equal(accounts.length, 0);
      unsub();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('2. AppsStorageService syncs /apps/personal, /oauth/connected-apps, and /apps/my with deletions', async () => {
    const originalFetch = globalThis.fetch;
    await AppsStorageService.resetToDefaults();
    const calls: Array<{ url: string; method: string; auth?: string }> = [];

    let remotePersonal: any[] = [
      {
        id: 'papp-web-1',
        name: 'Figma Web',
        category: 'collaboration',
        protocol: 'Extension Autofill',
        launchUrl: 'https://www.figma.com/login',
        icon: '🎨',
        assigned: true,
        status: 'Approved',
      },
    ];
    let remoteConnected: any[] = [
      {
        id: 'conn-acme',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        userEmail: 'sync@vanguard.dev',
        protocol: 'OIDC',
        scopes: ['openid', 'profile'],
        redirectUri: 'http://localhost:4201/callback',
        originUrl: 'http://localhost:4201',
        status: 'Active',
        connectedAt: '2026-11-15T00:00:00Z',
      },
    ];
    let remoteEnterprise: any[] = [
      {
        app_id: 'ent-slack',
        name: 'Slack',
        category: 'collaboration',
        protocol: 'SAML 2.0',
        launch_url: 'https://slack.com',
        icon: '💬',
      },
    ];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const headers = (init?.headers || {}) as Record<string, string>;
      const auth = headers['Authorization'] || headers['authorization'];
      calls.push({ url, method, auth });

      if (url.endsWith('/apps/personal') && method === 'GET') {
        return new Response(JSON.stringify(remotePersonal), { status: 200 });
      }
      if (url.endsWith('/apps/personal') && method === 'POST') {
        return new Response(init?.body || '{}', { status: 200 });
      }
      if (url.includes('/apps/personal/') && method === 'DELETE') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes('/oauth/connected-apps') && method === 'GET') {
        return new Response(JSON.stringify({ success: true, connectedApps: remoteConnected }), { status: 200 });
      }
      if (url.endsWith('/apps/my') && method === 'GET') {
        return new Response(JSON.stringify(remoteEnterprise), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const email = 'sync@vanguard.dev';
      const token = 'live-jwt-mobile';

      const pSynced = await AppsStorageService.syncPersonalAppsWithBackend(token, email);
      assert.equal(pSynced.length, 1);
      assert.equal(pSynced[0].name, 'Figma Web');

      const cSynced = await AppsStorageService.syncConnectedAppsWithBackend(email, token);
      assert.equal(cSynced.length, 1);
      assert.equal(cSynced[0].clientId, 'vanguard-dummy-portal');
      assert.ok(
        calls.some((c) => c.url.includes('/oauth/connected-apps') && c.auth === `Bearer ${token}`),
        'Connected apps fetch must send Bearer JWT',
      );

      const eSynced = await AppsStorageService.syncEnterpriseAppsWithBackend(token, email);
      assert.equal(eSynced.length, 1);
      assert.equal(eSynced[0].name, 'Slack');

      // Frontend deletes all three -> server returns [] and mobile reconciles deletions
      remotePersonal = [];
      remoteConnected = [];
      remoteEnterprise = [];

      assert.equal((await AppsStorageService.syncPersonalAppsWithBackend(token, email)).length, 0);
      assert.equal((await AppsStorageService.syncConnectedAppsWithBackend(email, token)).length, 0);
      assert.equal((await AppsStorageService.syncEnterpriseAppsWithBackend(token, email)).length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('3. SyncCoordinatorService notifies only domains whose watermark changed', async () => {
    const originalFetch = globalThis.fetch;
    let stateResponse = {
      totpUpdatedAt: 't1',
      personalAppsUpdatedAt: 'p1',
      enterpriseAppsUpdatedAt: 'e1',
      connectedAppsUpdatedAt: 'c1',
      accessRequestsUpdatedAt: 'r1',
    };

    globalThis.fetch = (async () =>
      new Response(JSON.stringify(stateResponse), { status: 200 })) as typeof fetch;

    try {
      const coordinator = new SyncCoordinatorService();
      const observed: string[][] = [];
      coordinator.configure({
        getToken: async () => 'live-jwt-coord',
        onDomainsChanged: (domains) => {
          observed.push(domains);
        },
      });

      // Baseline check records initial watermarks without redundant callbacks
      const initial = await coordinator.checkOnce(false);
      assert.deepEqual(initial, []);
      assert.equal(observed.length, 0);

      // Simulate frontend changing TOTP & connectedApps
      stateResponse = {
        ...stateResponse,
        totpUpdatedAt: 't2',
        connectedAppsUpdatedAt: 'c2',
      };
      const changed = await coordinator.checkOnce(false);
      assert.deepEqual(changed, ['totp', 'connectedApps']);
      assert.deepEqual(observed, [['totp', 'connectedApps']]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
