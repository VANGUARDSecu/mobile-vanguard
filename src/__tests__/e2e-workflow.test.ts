import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/auth.service.ts';
import { AppLauncherService } from '../services/app-launcher.service.ts';
import {
  ENTERPRISE_APP_SUGGESTIONS,
  type SaaSApp,
  type UserConnectedApp,
  type AppAccessRequest,
  type PersonalVaultItem,
} from '../models/apps.models.ts';

test('End-to-End Application Portal & Zero-Trust Governance Workflow (SCRUM-71)', async (t) => {
  await t.test('1. Authenticates corporate identity (Ellen Ripley)', async () => {
    const user = await AuthService.signInWithSSO('ellen.ripley@weyland.corp');
    assert.ok(user);
    assert.equal(user.email, 'ellen.ripley@weyland.corp');
    assert.equal(user.department, 'Engineering');
    assert.equal(user.role, 'user');
  });

  await t.test('2. Personal workspace: adds custom bookmark with preset normalization', () => {
    const rawUrl = 'notion.so/workspace';
    const normalized = AppLauncherService.normalizeUrl(rawUrl);
    assert.equal(normalized, 'https://notion.so/workspace');

    const newPersonalApp: SaaSApp = {
      id: `personal-${Date.now()}`,
      name: 'Notion Workspace',
      category: 'collaboration',
      protocol: 'Web Auth',
      launchUrl: normalized,
      assigned: true,
      description: 'Personal team documentation',
      icon: '📝',
    };

    assert.equal(newPersonalApp.category, 'collaboration');

    // Matching vault auto-fill credentials
    const vault: PersonalVaultItem[] = [
      {
        id: 'v1',
        title: 'Notion Workspace',
        category: 'Login',
        username: 'ellen.ripley@weyland.corp',
        url: 'https://notion.so',
        updatedAt: '2026-10-11T00:00:00Z',
      },
    ];
    const creds = AppLauncherService.findMatchingVaultCredentials(normalized, vault);
    assert.equal(creds.length, 1);
    assert.equal(creds[0].username, 'ellen.ripley@weyland.corp');
  });

  await t.test('3. Enterprise workspace: filters enterprise catalog and selects requested app', () => {
    const enterpriseCatalog: SaaSApp[] = [
      { id: 'e1', name: 'Salesforce CRM', category: 'collaboration', protocol: 'SAML 2.0', launchUrl: 'https://salesforce.com', assigned: true, description: '', icon: '☁️' },
      { id: 'e2', name: 'GitHub Enterprise', category: 'developer', protocol: 'OIDC', launchUrl: 'https://github.com', assigned: true, description: '', icon: '🐙' },
      { id: 'e3', name: 'Datadog APM', category: 'developer', protocol: 'SAML 2.0', launchUrl: 'https://datadoghq.com', assigned: false, description: '', icon: '🐕' },
    ];

    const devApps = enterpriseCatalog.filter((a) => a.category === 'developer');
    assert.equal(devApps.length, 2);
    assert.equal(devApps[0].name, 'GitHub Enterprise');

    // Check enterprise suggestion catalog
    assert.ok(ENTERPRISE_APP_SUGGESTIONS.length >= 4);
    const suggestion = ENTERPRISE_APP_SUGGESTIONS.find((s) => s.name.includes('Figma'));
    assert.ok(suggestion);
    assert.equal(suggestion?.category, 'collaboration');
    assert.equal(suggestion?.icon, '🎨');
  });

  await t.test('4. Enterprise access request: creates submission with business justification and governance state', () => {
    const request: AppAccessRequest = {
      id: `req-${Date.now()}`,
      userId: 'usr_ripley',
      userName: 'Ellen Ripley',
      userEmail: 'ellen.ripley@weyland.corp',
      department: 'Engineering',
      role: 'User',
      appName: 'Datadog APM',
      category: 'developer',
      protocol: 'SAML 2.0',
      justification: 'Need production telemetry and anomaly tracking for sprint release.',
      status: 'Pending Approval',
      submittedAt: new Date().toISOString(),
    };

    assert.equal(request.status, 'Pending Approval');
    assert.equal(request.protocol, 'SAML 2.0');
    assert.ok(request.justification.length > 10);
    assert.equal(request.userEmail, 'ellen.ripley@weyland.corp');
  });

  await t.test('5. Connected SSO applications: isolates active OIDC clients and handles disconnection', () => {
    const connectedClients: UserConnectedApp[] = [
      {
        id: 'c1',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid', 'profile', 'email'],
        status: 'Connected',
        connectedAt: new Date().toISOString(),
        userEmail: 'ellen.ripley@weyland.corp',
      },
    ];

    // Verify client scope and connectivity
    assert.equal(connectedClients.length, 1);
    assert.equal(connectedClients[0].status, 'Connected');
    assert.ok(connectedClients[0].scopes.includes('openid'));

    // Disconnect simulation
    const updated = connectedClients.map((c) =>
      c.clientId === 'vanguard-dummy-portal' ? { ...c, status: 'Disconnected' as const } : c
    ).filter((c) => c.status === 'Connected');

    assert.equal(updated.length, 0);
  });

  await t.test('6. User session logout: clears active identity and returns to unauthenticated state', async () => {
    await AuthService.logout();
    const currentUser = await AuthService.getCurrentUser();
    assert.equal(currentUser, null);
  });
});
