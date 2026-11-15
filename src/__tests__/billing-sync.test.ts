import test from 'node:test';
import assert from 'node:assert/strict';

import { BillingService, buildDefaultSubscriptionState } from '../services/billing.service.ts';
import { isBillingLimitError } from '../models/billing.models.ts';
import { SyncCoordinatorService } from '../services/sync-coordinator.service.ts';
import { VaultService } from '../services/vault.service.ts';
import { MockKeychainProvider } from '../services/secure-storage.provider.ts';
import { AppsStorageService } from '../services/apps-storage.service.ts';

test('Mobile Billing Parity, Isolation & Web-Mobile Sync (SCRUM-185)', async (t) => {
  await t.test('1. Isolates Individual, Company Admin, and Tenant Employee billing plans & capabilities', () => {
    const individualPlans = BillingService.getVisiblePlans('individual');
    assert.deepEqual(
      individualPlans.map((p) => p.id),
      ['free', 'personal_pro'],
    );

    const companyPlans = BillingService.getVisiblePlans('company');
    assert.deepEqual(
      companyPlans.map((p) => p.id),
      ['free', 'business_pro', 'enterprise'],
    );

    const indivSub = buildDefaultSubscriptionState({
      id: 'ind-1',
      email: 'alex@personal.me',
      accountType: 'individual',
      role: 'user',
    });
    assert.equal(indivSub.canManageBilling, true);

    const adminSub = buildDefaultSubscriptionState({
      id: 'adm-1',
      email: 'ada@acme.com',
      accountType: 'company',
      role: 'admin',
      companyName: 'Acme Corp',
    });
    assert.equal(adminSub.canManageBilling, true);

    const empSub = buildDefaultSubscriptionState({
      id: 'emp-1',
      email: 'bob@acme.com',
      accountType: 'company',
      role: 'user',
      companyName: 'Acme Corp',
    });
    assert.equal(empSub.canManageBilling, false);
  });

  await t.test('2. Enforces identical Free-tier quotas (1 app, 3 2FA tokens) and unlocks when Web already paid', async () => {
    const originalFetch = globalThis.fetch;

    const freeSub = buildDefaultSubscriptionState({
      id: 'ind-free-1',
      email: 'free@personal.me',
      accountType: 'individual',
      role: 'user',
    });
    assert.equal(BillingService.checkAppQuota(0, freeSub).allowed, true);
    assert.equal(BillingService.checkAppQuota(1, freeSub).allowed, false);
    assert.equal(BillingService.checkTotpQuota(2, freeSub).allowed, true);
    assert.equal(BillingService.checkTotpQuota(3, freeSub).allowed, false);

    // Simulate user having already upgraded on Web -> backend GET /billing/subscription returns personal_pro
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          accountType: 'individual',
          planId: 'personal_pro',
          planName: 'Personal Pro',
          status: 'active',
          scopeKey: 'individual:ind-free-1',
          canManageBilling: true,
          roleLabel: 'Individual Account',
          priceMonthlyUsd: 5,
          priceMonthlyPhp: 290,
          entitlements: {
            maxIntegratedApps: -1,
            maxTotpAccounts: -1,
            maxVaultItems: -1,
            auditRetentionDays: 90,
            auditCsvExport: true,
            prioritySupport: false,
          },
          invoices: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      const synced = await BillingService.fetchSubscription('live-jwt-ind-1', {
        id: 'ind-free-1',
        email: 'free@personal.me',
        accountType: 'individual',
        role: 'user',
      });
      assert.ok(synced);
      assert.equal(synced.planId, 'personal_pro');
      assert.equal(BillingService.checkAppQuota(5, synced).allowed, true);
      assert.equal(BillingService.checkTotpQuota(10, synced).allowed, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('3. SyncCoordinatorService emits billing domain change when billingUpdatedAt bumps', async () => {
    const originalFetch = globalThis.fetch;
    let billingTs = '2026-11-15T06:00:00.000Z';

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          totpUpdatedAt: '2026-11-15T06:00:00.000Z',
          personalAppsUpdatedAt: '2026-11-15T06:00:00.000Z',
          enterpriseAppsUpdatedAt: '2026-11-15T06:00:00.000Z',
          connectedAppsUpdatedAt: '2026-11-15T06:00:00.000Z',
          accessRequestsUpdatedAt: '2026-11-15T06:00:00.000Z',
          billingUpdatedAt: billingTs,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      const changedBatches: string[][] = [];
      const coord = new SyncCoordinatorService();
      coord.configure({
        getToken: async () => 'live-jwt-sync-1',
        onDomainsChanged: (domains) => {
          changedBatches.push(domains);
        },
      });

      // Baseline poll establishes watermark
      await coord.checkOnce(false);
      assert.equal(changedBatches.length, 0);

      // Web payment completes -> billingUpdatedAt advances -> Mobile triggers billing refresh
      billingTs = '2026-11-15T06:00:05.000Z';
      const detected = await coord.checkOnce(false);
      assert.deepEqual(detected, ['billing']);
      assert.deepEqual(changedBatches[0], ['billing']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('4. Rolls back local optimistic save and throws BillingLimitError on 403 billing_limit_reached', async () => {
    const originalFetch = globalThis.fetch;
    await AppsStorageService.resetToDefaults();

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: 'billing_limit_reached',
          message: 'Free plan is limited to 3 2FA accounts / 1 app.',
          upgradeRequired: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      const vault = new VaultService(new MockKeychainProvider());
      vault.setCurrentUserEmail('limit@personal.me');
      vault.setAuthTokenProvider(async () => 'live-jwt-limit');

      await assert.rejects(
        () =>
          vault.saveAccount({
            issuer: 'OverQuota',
            accountName: 'limit@personal.me',
            secret: 'JBSWY3DPEHPK3PXP',
          }),
        (err) => isBillingLimitError(err),
      );
      assert.equal((await vault.getAccounts()).length, 0);

      await assert.rejects(
        () =>
          AppsStorageService.addPersonalApp(
            { name: 'SecondApp', launchUrl: 'https://example.com', category: 'cloud' },
            'limit@personal.me',
            'live-jwt-limit',
            'ind-limit-1',
          ),
        (err) => isBillingLimitError(err),
      );
      assert.equal((await AppsStorageService.getPersonalApps('limit@personal.me')).length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
