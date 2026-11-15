import test from 'node:test';
import assert from 'node:assert/strict';

import { SyncCoordinatorService } from '../services/sync-coordinator.service.ts';
import {
  CredentialVaultSyncService,
  VAULT_PBKDF2_ITERATIONS,
} from '../services/credential-vault-sync.service.ts';
import { SecurityActivityService } from '../services/security-activity.service.ts';

// Live-looking JWT format so isLiveBackendToken passes cleanly in unit tests
const LIVE_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEifQ.signature';

test('Mobile <-> Frontend Synchronization Parity (SCRUM-199)', async (t) => {
  await t.test('1. SyncCoordinatorService tracks vaultRevision, vaultUpdatedAt, and devicesUpdatedAt watermarks', async () => {
    const coordinator = new SyncCoordinatorService();
    const originalFetch = globalThis.fetch;
    let callIndex = 0;

    globalThis.fetch = (async () => {
      callIndex += 1;
      const payload =
        callIndex === 1
          ? {
              totpUpdatedAt: '2026-11-15T10:00:00.000Z',
              vaultUpdatedAt: '2026-11-15T10:00:00.000Z',
              vaultRevision: 1,
              personalAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              enterpriseAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              connectedAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              accessRequestsUpdatedAt: '2026-11-15T10:00:00.000Z',
              billingUpdatedAt: '2026-11-15T10:00:00.000Z',
              devicesUpdatedAt: '2026-11-15T10:00:00.000Z',
            }
          : {
              totpUpdatedAt: '2026-11-15T10:00:00.000Z',
              vaultUpdatedAt: '2026-11-15T10:02:00.000Z',
              vaultRevision: 2,
              personalAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              enterpriseAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              connectedAppsUpdatedAt: '2026-11-15T10:00:00.000Z',
              accessRequestsUpdatedAt: '2026-11-15T10:00:00.000Z',
              billingUpdatedAt: '2026-11-15T10:00:00.000Z',
              devicesUpdatedAt: '2026-11-15T10:03:00.000Z',
            };
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      } as any;
    }) as typeof fetch;

    const changedBatches: string[][] = [];
    try {
      coordinator.configure({
        getToken: async () => LIVE_TEST_TOKEN,
        onDomainsChanged: (domains) => {
          changedBatches.push(domains);
        },
      });

      // Baseline poll records watermarks without firing empty diff
      const first = await coordinator.checkOnce(false);
      assert.deepEqual(first, []);

      // Second poll detects vault & devices advances
      const second = await coordinator.checkOnce(false);
      assert.ok(second.includes('vault'));
      assert.ok(second.includes('devices'));
      assert.equal(changedBatches.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('2. CredentialVaultSyncService decrypts frontend v1 PBKDF2-SHA256 envelope, pushes PUT /vault, and wipes RAM on lock()', async () => {
    const vaultSvc = new CredentialVaultSyncService();
    const masterPass = 'VanguardStrongPass!99';

    // Produce an envelope with exact frontend format (use lower iterations only for fast test crypto setup if needed, or standard)
    const sampleItems = [
      {
        id: 'vault-ext-1',
        title: 'GitHub Enterprise',
        category: 'Login' as const,
        username: 'alice@acme.com',
        password: 'ghp_secret_password',
        url: 'https://github.com/login',
        favorite: true,
        updatedAt: '2026-11-15T10:00:00.000Z',
      },
    ];
    const remoteEnvelope = await vaultSvc.encryptItems(sampleItems, masterPass, VAULT_PBKDF2_ITERATIONS);
    let storedRevision = 3;
    let storedEnvelope = remoteEnvelope;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.endsWith('/vault') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ envelope: storedEnvelope, revision: storedRevision }),
        } as any;
      }
      if (urlStr.endsWith('/vault') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body || '{}'));
        assert.equal(body.version, 'v1');
        assert.equal(body.cipher, 'AES-GCM-256');
        assert.equal(body.expectedRevision, 3);
        storedEnvelope = body;
        storedRevision = 4;
        return {
          ok: true,
          status: 200,
          json: async () => ({ revision: storedRevision, updatedAt: body.updatedAt }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }) as typeof fetch;

    try {
      // Wrong password must reject cleanly
      await assert.rejects(
        () => vaultSvc.unlockWithPassword('WrongPassword!', LIVE_TEST_TOKEN),
        /Incorrect vault password/,
      );

      // Correct password unlocks & decrypts item written from extension/web
      const decrypted = await vaultSvc.unlockWithPassword(masterPass, LIVE_TEST_TOKEN);
      assert.equal(decrypted.length, 1);
      assert.equal(decrypted[0].title, 'GitHub Enterprise');
      assert.equal(decrypted[0].password, 'ghp_secret_password');

      // Upserting on mobile re-encrypts & bumps backend revision via PUT /vault
      const updated = await vaultSvc.upsertItem(
        {
          title: 'AWS Console',
          username: 'alice-aws',
          password: 'aws-secret-value',
          url: 'https://aws.amazon.com',
        },
        LIVE_TEST_TOKEN,
      );
      assert.equal(updated.length, 2);
      assert.equal(vaultSvc.getSnapshot().revision, 4);

      // Locking wipes decrypted items & passphrase from RAM
      vaultSvc.lock();
      const lockedSnap = vaultSvc.getSnapshot();
      assert.equal(lockedSnap.unlocked, false);
      assert.equal(lockedSnap.items.length, 0);
      assert.equal(vaultSvc.hasSessionPassphrase(), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('3. SecurityActivityService maps multi-device fleet, audit logs, and security posture cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/oauth/devices')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            devices: [
              { id: 'd-1', name: 'Pixel 9 Pro', type: 'android', osVersion: 'Android 15', biometricType: 'Fingerprint', complianceStatus: 'Compliant' },
              { id: 'd-2', name: 'iPhone 16 Pro', type: 'ios', osVersion: 'iOS 18', biometricType: 'FaceID', complianceStatus: 'Compliant' },
            ],
          }),
        } as any;
      }
      if (u.includes('/auth/audit-logs')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            events: [
              { id: 'a-1', action: 'Launched Slack', movementType: 'APP_LAUNCH', applicationName: 'Slack', status: 'SUCCESS', timestamp: '2026-11-15T12:00:00.000Z' },
            ],
          }),
        } as any;
      }
      if (u.includes('/auth/mfa/factors')) {
        return { ok: true, status: 200, json: async () => ({ factors: [{ id: 'f-1', status: 'verified' }] }) } as any;
      }
      if (u.includes('/auth/recovery-codes/status')) {
        return { ok: true, status: 200, json: async () => ({ remainingCount: 8 }) } as any;
      }
      if (u.includes('/auth/security-preferences')) {
        return { ok: true, status: 200, json: async () => ({ alertThreshold: 'new_device', emailAlertsEnabled: true }) } as any;
      }
      if (u.includes('/oauth/mfa/push/preference')) {
        return { ok: true, status: 200, json: async () => ({ enabled: true }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }) as typeof fetch;

    try {
      const devicesRes = await SecurityActivityService.fetchEnrolledDevices(LIVE_TEST_TOKEN, 'alice@acme.com');
      assert.equal(devicesRes.ok, true);
      assert.equal(devicesRes.devices.length, 2);
      assert.equal(devicesRes.devices[1].name, 'iPhone 16 Pro');

      const logs = await SecurityActivityService.fetchAuditLogs(LIVE_TEST_TOKEN);
      assert.equal(logs.length, 1);
      assert.equal(logs[0].movementType, 'APP_LAUNCH');

      const posture = await SecurityActivityService.fetchSecurityPosture(LIVE_TEST_TOKEN, 'alice@acme.com');
      assert.ok(posture);
      assert.equal(posture.totpEnrolled, true);
      assert.equal(posture.recoveryCodesRemaining, 8);
      assert.equal(posture.alertThreshold, 'new_device');
      assert.equal(posture.enrolledDevicesCount, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
