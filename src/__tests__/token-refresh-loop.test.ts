import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthService, decodeJwtExpiryEpoch } from '../services/auth.service.ts';
import { PushMfaService } from '../services/push-mfa.service.ts';
import { SyncCoordinatorService } from '../services/sync-coordinator.service.ts';

function createFakeJwt(expEpochSec: number): string {
  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${b64url({ alg: 'ES256', typ: 'JWT' })}.${b64url({ sub: 'usr-1', exp: expEpochSec })}.sig`;
}

test('Token Auto-Refresh & 401 Polling Loop Guard (SCRUM-202)', async (t) => {
  await t.test('1. AuthService persists refreshToken and deduplicates concurrent POST /auth/refresh calls', async () => {
    const expiredJwt = createFakeJwt(Math.floor(Date.now() / 1000) - 60);
    const freshJwt = createFakeJwt(Math.floor(Date.now() / 1000) + 300);
    assert.ok(decodeJwtExpiryEpoch(expiredJwt)! < Math.floor(Date.now() / 1000));
    assert.equal(AuthService.isJwtExpired(expiredJwt, 30), true);

    await AuthService.saveSession(
      {
        id: 'usr-1',
        email: 'user@vanguard.dev',
        name: 'Test User',
        role: 'user',
        accessToken: expiredJwt,
      },
      expiredJwt,
      { refreshToken: 'refresh-tok-initial' },
    );

    assert.equal(await AuthService.getRefreshToken(), 'refresh-tok-initial');

    const originalFetch = globalThis.fetch;
    let refreshCalls = 0;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (url.toString().endsWith('/auth/refresh')) {
        refreshCalls++;
        const parsed = JSON.parse(String(init?.body || '{}'));
        assert.equal(parsed.refreshToken, 'refresh-tok-initial');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            session: {
              access_token: freshJwt,
              refresh_token: 'refresh-tok-rotated',
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected URL ${url.toString()}`);
    }) as any;

    try {
      const [t1, t2] = await Promise.all([
        AuthService.ensureValidAccessToken(expiredJwt),
        AuthService.ensureValidAccessToken(expiredJwt),
      ]);
      assert.equal(refreshCalls, 1);
      assert.equal(t1, freshJwt);
      assert.equal(t2, freshJwt);
      assert.equal(await AuthService.getAccessToken(), freshJwt);
      assert.equal(await AuthService.getRefreshToken(), 'refresh-tok-rotated');
    } finally {
      globalThis.fetch = originalFetch;
      await AuthService.logout();
    }
  });

  await t.test('2. PushMfaService retries once after refresh on 401 and stops polling when refresh is rejected', async () => {
    const expiredJwt = createFakeJwt(Math.floor(Date.now() / 1000) - 10);
    const freshJwt = createFakeJwt(Math.floor(Date.now() / 1000) + 300);

    await AuthService.saveSession(
      {
        id: 'usr-2',
        email: 'push@vanguard.dev',
        name: 'Push User',
        role: 'user',
        accessToken: expiredJwt,
      },
      expiredJwt,
      { refreshToken: 'ref-push-1' },
    );

    const pushService = new PushMfaService();
    const originalFetch = globalThis.fetch;
    let pendingAuthHeaders: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = url.toString();
      if (u.endsWith('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            session: { access_token: freshJwt, refresh_token: 'ref-push-2' },
          }),
        } as any;
      }
      if (u.includes('/oauth/mfa/push/pending')) {
        const auth = String((init?.headers as Record<string, string>)?.Authorization || '');
        pendingAuthHeaders.push(auth);
        return {
          ok: true,
          status: 200,
          json: async () => ({ activeRequest: null }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }) as any;

    try {
      await pushService.fetchPendingPush('push@vanguard.dev');
      assert.equal(pendingAuthHeaders[0], `Bearer ${freshJwt}`);

      // Simulate unrecoverable 401 -> stops polling loop immediately
      globalThis.fetch = (async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.endsWith('/auth/refresh')) {
          return { ok: false, status: 401, json: async () => ({ message: 'Invalid refresh token' }) } as any;
        }
        return { ok: false, status: 401, json: async () => ({ message: 'JWTExpired' }) } as any;
      }) as any;

      pushService.startPolling('push@vanguard.dev', 5000);
      assert.equal(Boolean((pushService as any).pollInterval), true);
      await new Promise((r) => setTimeout(r, 30));
      assert.equal((pushService as any).pollInterval, null);
    } finally {
      pushService.stopPolling();
      globalThis.fetch = originalFetch;
      await AuthService.logout();
    }
  });

  await t.test('3. SyncCoordinatorService refreshes token on 401 and stops polling on unrecoverable 401', async () => {
    const coordinator = new SyncCoordinatorService();
    const originalFetch = globalThis.fetch;
    const seenTokens: string[] = [];
    let forceUnauth = false;

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const auth = String((init?.headers as Record<string, string>)?.Authorization || '');
      seenTokens.push(auth);
      if (forceUnauth || auth.includes('expired-jwt')) {
        return { ok: false, status: 401, json: async () => ({ message: 'JWTExpired' }) } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totpUpdatedAt: '2026-11-16T00:00:00Z',
          personalAppsUpdatedAt: null,
          enterpriseAppsUpdatedAt: null,
          connectedAppsUpdatedAt: null,
          accessRequestsUpdatedAt: null,
        }),
      } as any;
    }) as any;

    let unauthTriggered = false;
    coordinator.configure({
      getToken: async () => 'expired-jwt.abc.def',
      refreshToken: async () => (forceUnauth ? null : 'refreshed-jwt.abc.def'),
      onUnauthorized: () => {
        unauthTriggered = true;
      },
      onDomainsChanged: () => {},
    });

    try {
      await coordinator.checkOnce();
      assert.deepEqual(seenTokens, [
        'Bearer expired-jwt.abc.def',
        'Bearer refreshed-jwt.abc.def',
      ]);
      assert.equal(unauthTriggered, false);

      forceUnauth = true;
      coordinator.start(5000);
      assert.equal(Boolean((coordinator as any).pollTimer), true);
      await coordinator.checkOnce();
      assert.equal(unauthTriggered, true);
      assert.equal((coordinator as any).pollTimer, null);
    } finally {
      coordinator.stop();
      globalThis.fetch = originalFetch;
    }
  });
});
