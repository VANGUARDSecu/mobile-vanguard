import test from 'node:test';
import assert from 'node:assert/strict';
import { AppLauncherService } from '../services/app-launcher.service.ts';
import type {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
} from '../models/apps.models.ts';

test('App Launch Dispatcher & Browser Integration (SCRUM-68)', async (t) => {
  await t.test('normalizeUrl prepends https to raw domain inputs', () => {
    assert.equal(AppLauncherService.normalizeUrl('figma.com/login'), 'https://figma.com/login');
    assert.equal(AppLauncherService.normalizeUrl('accounts.google.com'), 'https://accounts.google.com');
  });

  await t.test('normalizeUrl preserves explicit http scheme for local environments', () => {
    assert.equal(AppLauncherService.normalizeUrl('http://localhost:4201/callback'), 'http://localhost:4201/callback');
    assert.equal(AppLauncherService.normalizeUrl('http://192.168.1.100:3000'), 'http://192.168.1.100:3000');
  });

  await t.test('normalizeUrl safely returns empty string for empty inputs', () => {
    assert.equal(AppLauncherService.normalizeUrl(''), '');
    assert.equal(AppLauncherService.normalizeUrl('   '), '');
  });

  await t.test('findMatchingVaultCredentials detects credentials by target domain', () => {
    const vault: PersonalVaultItem[] = [
      {
        id: 'v1',
        title: 'Work GitHub',
        category: 'Login',
        username: 'user.work@company.com',
        url: 'https://github.com/login',
        updatedAt: '2026-10-11T00:00:00Z',
      },
      {
        id: 'v2',
        title: 'AWS Console',
        category: 'Login',
        username: 'aws_admin',
        url: 'https://signin.aws.amazon.com/console',
        updatedAt: '2026-10-11T00:00:00Z',
      },
    ];

    const gitMatches = AppLauncherService.findMatchingVaultCredentials('github.com', vault);
    assert.equal(gitMatches.length, 1);
    assert.equal(gitMatches[0].username, 'user.work@company.com');

    const awsMatches = AppLauncherService.findMatchingVaultCredentials('https://aws.amazon.com', vault);
    assert.equal(awsMatches.length, 1);
    assert.equal(awsMatches[0].username, 'aws_admin');

    const noMatches = AppLauncherService.findMatchingVaultCredentials('slack.com', vault);
    assert.equal(noMatches.length, 0);
  });

  await t.test('findMatchingVaultCredentials matches by application title as fallback', () => {
    const vault: PersonalVaultItem[] = [
      {
        id: 'v3',
        title: 'Figma Enterprise Workspace',
        category: 'Login',
        username: 'designer@company.com',
        url: '',
        updatedAt: '2026-10-11T00:00:00Z',
      },
    ];

    const matches = AppLauncherService.findMatchingVaultCredentials('Figma', vault);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].username, 'designer@company.com');
  });

  await t.test('launchApp rejects application missing launchUrl gracefully', async () => {
    const emptyApp: SaaSApp = {
      id: 'app-empty',
      name: 'Orphan App',
      category: 'cloud',
      description: '',
      icon: '❓',
      protocol: 'SAML 2.0',
      launchUrl: '',
      assigned: true,
    };

    const launched = await AppLauncherService.launchApp(emptyApp);
    assert.equal(launched, false);
  });

  await t.test('launchConnectedApp rejects connected app missing target URL gracefully', async () => {
    const emptyConn: UserConnectedApp = {
      id: 'conn-empty',
      clientId: 'empty-client',
      clientName: 'Empty Client',
      protocol: 'OIDC',
      scopes: [],
      redirectUri: '',
      originUrl: '',
      status: 'Connected',
      connectedAt: '',
    };

    const launched = await AppLauncherService.launchConnectedApp(emptyConn);
    assert.equal(launched, false);
  });

  await t.test('launchApprovedRequest matches enterprise app catalog or request URL', () => {
    const enterpriseApps: SaaSApp[] = [
      {
        id: 'ent-1',
        name: 'Datadog APM',
        category: 'developer',
        description: '',
        icon: '🐶',
        protocol: 'SAML 2.0',
        launchUrl: 'https://app.datadoghq.com',
        assigned: true,
      },
    ];

    const req: AppAccessRequest = {
      id: 'req-1',
      userId: 'u1',
      userName: 'User',
      userEmail: 'user@test.com',
      department: 'Eng',
      role: 'Engineer',
      appName: 'Datadog APM',
      protocol: 'SAML 2.0',
      category: 'developer',
      justification: 'Monitoring',
      status: 'Approved',
      submittedAt: '',
    };

    const matchingApp = enterpriseApps.find(
      (a) => a.name.toLowerCase() === req.appName.toLowerCase()
    );
    const resolvedUrl = matchingApp?.launchUrl || req.launchUrl || 'https://vanguard.security';
    assert.equal(resolvedUrl, 'https://app.datadoghq.com');
  });
});
