import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENTERPRISE_APPS,
  DEFAULT_CONNECTED_APPS,
  DEFAULT_ACCESS_REQUESTS,
  DEFAULT_VAULT_ITEMS,
  AppsStorageService,
} from '../services/apps-storage.service.ts';
import type { AppAccessRequest, UserConnectedApp } from '../models/apps.models.ts';

test('Zero Hardcoded Dashboard Data Architecture (SCRUM-83)', async (t) => {
  await t.test('all default storage arrays are empty by default', () => {
    assert.equal(DEFAULT_ENTERPRISE_APPS.length, 0, 'Enterprise apps must be empty by default');
    assert.equal(DEFAULT_CONNECTED_APPS.length, 0, 'Connected apps must be empty by default');
    assert.equal(DEFAULT_ACCESS_REQUESTS.length, 0, 'Access requests must be empty by default');
    assert.equal(DEFAULT_VAULT_ITEMS.length, 0, 'Vault items must be empty by default');
  });

  await t.test('AppsStorageService returns empty arrays on fresh load', async () => {
    await AppsStorageService.resetToDefaults();
    const enterpriseApps = await AppsStorageService.getEnterpriseApps();
    const connectedApps = await AppsStorageService.getConnectedApps();
    const accessRequests = await AppsStorageService.getAccessRequests();
    const vaultItems = await AppsStorageService.getVaultItems();

    assert.equal(enterpriseApps.length, 0);
    assert.equal(connectedApps.length, 0);
    assert.equal(accessRequests.length, 0);
    assert.equal(vaultItems.length, 0);
  });

  await t.test('submitAccessRequest creates dynamically scoped requests without hardcoded fallbacks', async () => {
    const customUser = {
      name: 'Alice Henderson',
      email: 'alice.henderson@enterprise.com',
      department: 'Cybersecurity Ops',
      role: 'SecOps Analyst',
    };

    const createdReq = await AppsStorageService.submitAccessRequest({
      appName: 'GitHub Enterprise Internal',
      justification: 'Need access to internal repos',
      category: 'developer',
      userName: customUser.name,
      userEmail: customUser.email,
      department: customUser.department,
      role: customUser.role,
    });

    assert.equal(createdReq.userName, 'Alice Henderson');
    assert.equal(createdReq.userEmail, 'alice.henderson@enterprise.com');
    assert.equal(createdReq.department, 'Cybersecurity Ops');
    assert.equal(createdReq.role, 'SecOps Analyst');
    assert.equal(createdReq.appName, 'GitHub Enterprise Internal');
    assert.equal(createdReq.status, 'Pending Approval');

    // Make sure neither John Roben Manayon nor ellen.ripley exists
    assert.notEqual(createdReq.userName, 'John Roben Manayon');
    assert.notEqual(createdReq.userEmail, 'johnroben.manayon21@gmail.com');
  });

  await t.test('purges legacy seed access requests if encountered in storage', async () => {
    const legacySeedList: AppAccessRequest[] = [
      {
        id: 'req-aws-1',
        userId: 'usr-legacy',
        appName: 'AWS Management Console',
        userName: 'John Roben Manayon',
        userEmail: 'johnroben.manayon21@gmail.com',
        department: 'Core Infrastructure',
        role: 'Cloud Security Architect',
        protocol: 'SAML 2.0',
        category: 'cloud',
        justification: 'Legacy seed',
        status: 'Approved',
        submittedAt: '2026-09-01T08:00:00Z',
      },
      {
        id: 'req-clean-user',
        userId: 'usr-clean',
        appName: 'Clean App',
        userName: 'Clean User',
        userEmail: 'clean.user@enterprise.com',
        department: 'Engineering',
        role: 'Developer',
        protocol: 'SAML 2.0',
        category: 'developer',
        justification: 'Clean real request',
        status: 'Pending Approval',
        submittedAt: '2026-10-12T00:00:00Z',
      },
    ];

    await AppsStorageService.saveAccessRequests(legacySeedList);
    const retrieved = await AppsStorageService.getAccessRequests();

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].id, 'req-clean-user');
    assert.equal(retrieved[0].userEmail, 'clean.user@enterprise.com');
  });

  await t.test('purges legacy seed connected apps if encountered in storage', async () => {
    const legacySeedApps: UserConnectedApp[] = [
      {
        id: 'conn-acme-dummy',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/auth/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid', 'profile', 'email'],
        status: 'Connected',
        connectedAt: '2026-09-01T08:00:00Z',
        lastActiveAt: 'Just now',
        userEmail: 'ellen.ripley@weyland.corp',
      },
      {
        id: 'conn-real-user',
        clientId: 'real-portal',
        clientName: 'Real Portal',
        originUrl: 'https://portal.enterprise.com',
        redirectUri: 'https://portal.enterprise.com/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Connected',
        connectedAt: '2026-10-12T00:00:00Z',
        lastActiveAt: '1 min ago',
        userEmail: 'alice.henderson@enterprise.com',
      },
    ];

    await AppsStorageService.saveConnectedApps(legacySeedApps);
    const retrieved = await AppsStorageService.getConnectedApps();

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].id, 'conn-real-user');
    assert.equal(retrieved[0].userEmail, 'alice.henderson@enterprise.com');
  });
});
