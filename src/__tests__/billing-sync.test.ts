import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  await t.test('5. Option 1 downgrade preserves paidCredit and restores paid tier at $0 via /billing/resume', async () => {
    const originalFetch = globalThis.fetch;
    const futurePaidUntil = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString();
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/billing/cancel')) {
        return new Response(
          JSON.stringify({
            accountType: 'company',
            planId: 'free',
            planName: 'Company Free Trial',
            status: 'active',
            scopeKey: 'company:tenant-99',
            tenantId: 'tenant-99',
            canManageBilling: true,
            priceMonthlyUsd: 0,
            priceMonthlyPhp: 0,
            paidCredit: {
              planId: 'business_pro',
              planName: 'Business Pro',
              paidUntil: futurePaidUntil,
              lastTransactionId: 'cs_pm_99',
            },
            invoices: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/billing/resume')) {
        return new Response(
          JSON.stringify({
            restored: true,
            amountChargedUsd: 0,
            message: 'Business Pro restored with $0 due.',
            subscription: {
              accountType: 'company',
              planId: 'business_pro',
              planName: 'Business Pro',
              status: 'active',
              scopeKey: 'company:tenant-99',
              tenantId: 'tenant-99',
              canManageBilling: true,
              priceMonthlyUsd: 29,
              priceMonthlyPhp: 1690,
              paidCredit: null,
              invoices: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    try {
      const downgraded = await BillingService.cancelSubscription(
        'live-jwt-admin',
        'company',
        'admin@acme.test',
      );
      assert.ok(downgraded);
      assert.equal(downgraded.planId, 'free');
      assert.equal(downgraded.paidCredit?.planId, 'business_pro');
      assert.equal(BillingService.canRestorePlanWithoutCharge(downgraded, 'business_pro'), true);
      assert.equal(BillingService.canRestorePlanWithoutCharge(downgraded, 'enterprise'), false);

      const expiredCopy = {
        ...downgraded,
        paidCredit: {
          ...downgraded.paidCredit!,
          paidUntil: new Date(Date.now() - 60_000).toISOString(),
        },
      };
      assert.equal(BillingService.canRestorePlanWithoutCharge(expiredCopy, 'business_pro'), false);

      const resumed = await BillingService.resumeSubscription(
        'live-jwt-admin',
        'business_pro',
        'company',
        'admin@acme.test',
      );
      assert.equal(resumed.subscription?.planId, 'business_pro');
      assert.equal(resumed.subscription?.paidCredit, null);
      assert.ok(calls.some((u) => u.endsWith('/billing/cancel')));
      assert.ok(calls.some((u) => u.endsWith('/billing/resume')));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('6. Resends official Vanguard receipt strictly to registered account email', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          receiptNumber: 'VG-RCPT-20261115-7741',
          sentTo: 'alt-registered@vanguard.test',
          message: 'Vanguard receipt VG-RCPT-20261115-7741 sent directly to registered email alt-registered@vanguard.test.',
          subscription: {
            accountType: 'individual',
            planId: 'personal_pro',
            planName: 'Personal Pro',
            status: 'active',
            scopeKey: 'individual:ind-alt',
            tenantId: null,
            canManageBilling: true,
            priceMonthlyUsd: 5,
            priceMonthlyPhp: 290,
            invoices: [
              {
                id: 'inv_7741',
                receiptNumber: 'VG-RCPT-20261115-7741',
                planId: 'personal_pro',
                planName: 'Personal Pro',
                amountUsd: 5,
                amountPhp: 290,
                status: 'paid',
                date: '2026-11-15',
                transactionId: 'cs_pm_7741',
                receiptSentTo: 'alt-registered@vanguard.test',
                gatewayPayerEmail: 'personal.gmail@gmail.com',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      const res = await BillingService.resendReceipt(
        'live-jwt-ind',
        'individual',
        'inv_7741',
        'alt-registered@vanguard.test',
      );
      assert.equal(res.sentTo, 'alt-registered@vanguard.test');
      assert.equal(res.receiptNumber, 'VG-RCPT-20261115-7741');
      assert.equal(res.subscription?.invoices[0]?.gatewayPayerEmail, 'personal.gmail@gmail.com');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('7. SCRUM-201: submitAccessRequest & approveAccessRequest roll back local cache on HTTP 403 billing limit', async () => {
    const originalFetch = globalThis.fetch;
    const empEmail = 'emp-403@acme.test';

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: 'Company Free Trial plan is limited to 1 integrated application (1/1 used).',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      await AppsStorageService.saveAccessRequests([], empEmail);
      await assert.rejects(
        () =>
          AppsStorageService.submitAccessRequest(
            {
              appName: 'GitHub',
              justification: 'Need repo access',
              userEmail: empEmail,
              userName: 'Emp',
              department: 'Engineering',
              role: 'user',
            },
            'live-jwt-emp-403',
          ),
        (err) => isBillingLimitError(err),
      );
      const afterSubmit = await AppsStorageService.getAccessRequests(empEmail);
      assert.equal(afterSubmit.length, 0);

      await AppsStorageService.saveAccessRequests(
        [
          {
            id: 'req-403-1',
            userId: 'u-1',
            userName: 'Emp',
            userEmail: empEmail,
            department: 'Eng',
            role: 'user',
            appName: 'GitHub',
            protocol: 'SAML 2.0',
            category: 'developer',
            justification: 'Code',
            status: 'Pending Approval',
            submittedAt: new Date().toISOString(),
          },
        ],
        empEmail,
      );
      await assert.rejects(
        () =>
          AppsStorageService.approveAccessRequest(
            'req-403-1',
            'Admin',
            'live-jwt-admin-403',
            'Approved',
            empEmail,
          ),
        (err) => isBillingLimitError(err),
      );
      const afterApprove = await AppsStorageService.getAccessRequests(empEmail);
      assert.equal(afterApprove[0].status, 'Pending Approval');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('8. SCRUM-209: Mobile BillingModal includes explicit Unsubscribe CTA and confirmation controls on active paid plans', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const modalSource = readFileSync(
      join(here, '..', 'components', 'billing', 'billing-modal.tsx'),
      'utf8',
    );
    assert.ok(modalSource.includes('testID="btn-unsubscribe-plan"'));
    assert.ok(modalSource.includes('testID="unsubscribe-confirm-panel"'));
    assert.ok(modalSource.includes('testID="btn-confirm-unsubscribe"'));
    assert.ok(modalSource.includes('testID="btn-cancel-unsubscribe"'));
    assert.ok(modalSource.includes('>Unsubscribe<'));
  });
});
