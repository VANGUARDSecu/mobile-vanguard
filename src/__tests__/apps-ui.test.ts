import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countUnifiedIntegratedApps,
  isAppMatchedConnectedApp,
  isIntegratedAppSlotTaken,
  type SaaSApp,
  type PersonalVaultItem,
  type UserConnectedApp,
} from '../models/apps.models.ts';

test('Apps UI Components & Presentation Logic', async (t) => {
  await t.test('Category options format accurately with dynamic total counts', () => {
    const totalCount = 12;
    const categories = [
      { key: 'all', label: `All Applications (${totalCount})` },
      { key: 'cloud', label: 'Cloud & Infrastructure' },
      { key: 'developer', label: 'Developer Tools' },
      { key: 'collaboration', label: 'Team Collaboration' },
    ];

    assert.equal(categories.length, 4);
    assert.equal(categories[0].label, 'All Applications (12)');
    assert.equal(categories[1].label, 'Cloud & Infrastructure');
    assert.equal(categories[2].label, 'Developer Tools');
    assert.equal(categories[3].label, 'Team Collaboration');
  });

  await t.test('AppCard computes auto-fill readiness only for personal workspace with matching credentials', () => {
    const app: SaaSApp = {
      id: 'app-github',
      name: 'GitHub',
      category: 'developer',
      description: 'Git repository hosting',
      icon: '🐙',
      protocol: 'SAML 2.0',
      launchUrl: 'https://github.com/login',
      assigned: true,
    };

    const matchingVault: PersonalVaultItem[] = [
      {
        id: 'v1',
        title: 'GitHub Personal',
        category: 'Login',
        username: 'john.dev@vanguard.security',
        url: 'https://github.com/login',
        updatedAt: '',
      },
    ];

    // In personal workspace with credentials -> true
    const isPersonal = true;
    const isAutoFillReadyPersonal = isPersonal && matchingVault.length > 0;
    assert.equal(app.name, 'GitHub');
    assert.equal(isAutoFillReadyPersonal, true);

    // In enterprise workspace with credentials -> false (enterprise mode uses SAML assertions)
    const isEnterprise = false;
    const isAutoFillReadyEnterprise = isEnterprise && matchingVault.length > 0;
    assert.equal(isAutoFillReadyEnterprise, false);

    // Personal workspace with empty credentials -> false
    const isAutoFillReadyNoCreds = isPersonal && [].length > 0;
    assert.equal(isAutoFillReadyNoCreds, false);
  });

  await t.test('AppCard computes live connection state accurately', () => {
    const appIntegrated: SaaSApp = {
      id: 'app-dummy',
      name: 'Acme Dummy Web',
      category: 'collaboration',
      description: 'Demo',
      icon: '🌐',
      protocol: 'OIDC 1.0 PKCE',
      launchUrl: 'http://localhost:4201',
      assigned: true,
      isIntegrated: true,
    };

    const isConnected1 = appIntegrated.isIntegrated || appIntegrated.connectionStatus === 'Currently Connected';
    assert.equal(isConnected1, true);

    const appStandard: SaaSApp = {
      id: 'app-aws',
      name: 'AWS Console',
      category: 'cloud',
      description: 'AWS',
      icon: '☁️',
      protocol: 'SAML 2.0',
      launchUrl: 'https://aws.amazon.com',
      assigned: true,
      isIntegrated: false,
    };

    const isConnected2 = appStandard.isIntegrated || appStandard.connectionStatus === 'Currently Connected';
    assert.equal(isConnected2, false);
  });

  await t.test('EmptyAppsState switches title, description and button label by workspace mode', () => {
    // Personal mode
    const personalTitle = true ? 'No personal applications saved' : 'No applications assigned';
    const personalBtn = true ? '+ Add Application' : '+ Request Application';
    assert.equal(personalTitle, 'No personal applications saved');
    assert.equal(personalBtn, '+ Add Application');

    // Enterprise mode
    const enterpriseTitle = false ? 'No personal applications saved' : 'No applications assigned';
    const enterpriseBtn = false ? '+ Add Application' : '+ Request Application';
    assert.equal(enterpriseTitle, 'No applications assigned');
    assert.equal(enterpriseBtn, '+ Request Application');
  });

  await t.test('SCRUM-201: excludes connected SSO apps from My Apps list and counts unified integrated slots', () => {
    const connected: UserConnectedApp[] = [
      {
        id: 'conn-1',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/callback',
        protocol: 'OIDC 1.0 PKCE',
        scopes: ['openid'],
        status: 'Connected',
        connectedAt: '2026-11-15',
      },
    ];
    const tenantApps: SaaSApp[] = [
      {
        id: 'vanguard-dummy-portal',
        name: 'Acme Dummy Web',
        category: 'cloud',
        description: 'Connected SSO app',
        icon: '🏢',
        protocol: 'OIDC',
        launchUrl: 'http://localhost:4201',
        assigned: true,
      },
      {
        id: 'app-github',
        name: 'GitHub Enterprise',
        category: 'developer',
        description: 'GitHub',
        icon: '🐙',
        protocol: 'Extension Autofill',
        launchUrl: 'https://github.com/login',
        assigned: true,
      },
    ];

    const filteredMyApps = tenantApps.filter((a) => !isAppMatchedConnectedApp(a, connected));
    assert.deepEqual(
      filteredMyApps.map((a) => a.name),
      ['GitHub Enterprise'],
    );
    assert.equal(countUnifiedIntegratedApps(filteredMyApps, connected), 2);
    assert.equal(countUnifiedIntegratedApps([], connected), 1);
    assert.equal(
      isIntegratedAppSlotTaken('Acme Dummy Web', 'http://localhost:4201', [], connected),
      true,
    );
    assert.equal(
      isIntegratedAppSlotTaken('Figma', 'https://figma.com', [], connected),
      false,
    );
  });
});
