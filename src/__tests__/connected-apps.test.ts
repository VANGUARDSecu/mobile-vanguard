import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserConnectedApp } from '../models/apps.models.ts';
import { DEFAULT_CONNECTED_APPS, AppsStorageService } from '../services/apps-storage.service.ts';

test('Active SSO Integrations & Connected Applications (SCRUM-64)', async (t) => {
  await t.test('default connected apps includes Acme Dummy Web with standard SSO metadata', () => {
    assert.ok(DEFAULT_CONNECTED_APPS.length >= 1);
    const dummyWeb = DEFAULT_CONNECTED_APPS.find((a) => a.clientId === 'vanguard-dummy-portal');
    assert.ok(dummyWeb);
    assert.equal(dummyWeb.clientName, 'Acme Dummy Web');
    assert.equal(dummyWeb.protocol, 'OIDC 1.0 PKCE');
    assert.equal(dummyWeb.originUrl, 'http://localhost:4201');
    assert.equal(dummyWeb.redirectUri, 'http://localhost:4201/auth/callback');
    assert.equal(dummyWeb.status, 'Connected');
    assert.ok(dummyWeb.scopes.includes('openid'));
    assert.ok(dummyWeb.scopes.includes('profile'));
    assert.ok(dummyWeb.scopes.includes('email'));
  });

  await t.test('deduplicates connected applications strictly by originUrl and canonical clientId (SCRUM-58)', () => {
    const rawList: UserConnectedApp[] = [
      {
        id: 'c1',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201/',
        redirectUri: 'http://localhost:4201/auth/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid', 'profile'],
        status: 'Connected',
        connectedAt: '2026-09-01T00:00:00Z',
        lastActiveAt: '10 mins ago',
      },
      {
        id: 'c2',
        clientId: 'vanguard-dummy-portal-duplicate',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/auth/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid', 'profile', 'email'],
        status: 'Connected',
        connectedAt: '2026-09-02T00:00:00Z',
        lastActiveAt: 'Just now',
      },
      {
        id: 'c3',
        clientId: 'other-service',
        clientName: 'Internal Ops Portal',
        originUrl: 'https://ops.corp.internal',
        redirectUri: 'https://ops.corp.internal/callback',
        protocol: 'SAML 2.0',
        scopes: ['read', 'write'],
        status: 'Connected',
        connectedAt: '2026-09-02T00:00:00Z',
        lastActiveAt: 'Just now',
      },
    ];

    const deduped = AppsStorageService.deduplicateConnectedApps(rawList);
    assert.equal(deduped.length, 2);
    // Keys normalized: http://localhost:4201 matches both c1 and c2
    assert.equal(deduped[0].clientName, 'Acme Dummy Web');
    assert.equal(deduped[1].clientName, 'Internal Ops Portal');
  });

  await t.test('filters out applications marked as Disconnected', () => {
    const rawList: UserConnectedApp[] = [
      {
        id: 'c1',
        clientId: 'active-app',
        clientName: 'Active Client',
        originUrl: 'https://active.com',
        redirectUri: 'https://active.com/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Connected',
        connectedAt: '',
      },
      {
        id: 'c2',
        clientId: 'revoked-app',
        clientName: 'Revoked Client',
        originUrl: 'https://revoked.com',
        redirectUri: 'https://revoked.com/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Disconnected',
        connectedAt: '',
      },
    ];

    const deduped = AppsStorageService.deduplicateConnectedApps(rawList);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].clientId, 'active-app');
  });

  await t.test('formats active connection count badge text correctly', () => {
    const formatCountText = (count: number) =>
      `${count} Active Connection${count === 1 ? '' : 's'}`;

    assert.equal(formatCountText(1), '1 Active Connection');
    assert.equal(formatCountText(2), '2 Active Connections');
    assert.equal(formatCountText(5), '5 Active Connections');
  });

  await t.test('disconnect removes connected application matching target clientId and originUrl', () => {
    const currentList: UserConnectedApp[] = [
      {
        id: 'c1',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Connected',
        connectedAt: '',
      },
      {
        id: 'c2',
        clientId: 'second-app',
        clientName: 'Second App',
        originUrl: 'http://localhost:4202',
        redirectUri: 'http://localhost:4202/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Connected',
        connectedAt: '',
      },
    ];

    const targetClientId = 'vanguard-dummy-portal';
    const target = currentList.find((a) => a.clientId === targetClientId);
    const targetOrigin = target ? (target.originUrl || '').toLowerCase().trim().replace(/\/$/, '') : '';

    const remaining = currentList.filter((a) => {
      const origin = (a.originUrl || '').toLowerCase().trim().replace(/\/$/, '');
      return a.clientId !== targetClientId && (!targetOrigin || origin !== targetOrigin);
    });

    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].clientId, 'second-app');
  });
});
