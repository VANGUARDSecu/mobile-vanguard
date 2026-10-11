import test from 'node:test';
import assert from 'node:assert/strict';

test('Apps Models and Deduplication Logic', async (t) => {
  await t.test('deduplicates applications by name or id', () => {
    const rawApps = [
      { id: '1', name: 'Figma', category: 'collaboration', protocol: 'SAML 2.0', launchUrl: 'https://figma.com', assigned: true, description: '', icon: '🎨' },
      { id: '2', name: 'figma', category: 'collaboration', protocol: 'SAML 2.0', launchUrl: 'https://figma.com', assigned: true, description: '', icon: '🎨' },
      { id: '3', name: 'Slack', category: 'collaboration', protocol: 'SAML 2.0', launchUrl: 'https://slack.com', assigned: true, description: '', icon: '💬' },
    ];

    const seen = new Set<string>();
    const deduped: typeof rawApps = [];
    for (const app of rawApps) {
      const key = (app.name || app.id).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(app);
      }
    }

    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].name, 'Figma');
    assert.equal(deduped[1].name, 'Slack');
  });

  await t.test('deduplicates connected applications by originUrl or clientId', () => {
    const rawConnected = [
      { id: 'c1', clientId: 'vanguard-dummy-portal', clientName: 'Acme Dummy Web', originUrl: 'http://localhost:4201', redirectUri: 'http://localhost:4201/callback', protocol: 'OIDC 1.0 PKCE', scopes: ['openid'], status: 'Connected' as const, connectedAt: '' },
      { id: 'c2', clientId: 'vg_client_custom', clientName: 'Acme Dummy Web', originUrl: 'http://localhost:4201', redirectUri: 'http://localhost:4201/callback', protocol: 'OIDC 1.0 PKCE', scopes: ['openid'], status: 'Connected' as const, connectedAt: '' },
      { id: 'c3', clientId: 'other-app', clientName: 'Other App', originUrl: 'http://localhost:5000', redirectUri: 'http://localhost:5000/callback', protocol: 'OIDC 1.0 PKCE', scopes: ['openid'], status: 'Connected' as const, connectedAt: '' },
    ];

    const seen = new Set<string>();
    const deduped: typeof rawConnected = [];
    for (const conn of rawConnected) {
      const key = (conn.originUrl || conn.clientId).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(conn);
      }
    }

    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].clientName, 'Acme Dummy Web');
    assert.equal(deduped[1].clientName, 'Other App');
  });

  await t.test('filters applications by category accurately', () => {
    const apps = [
      { id: '1', name: 'AWS', category: 'cloud' as const, protocol: 'SAML 2.0', launchUrl: 'https://aws.amazon.com', assigned: true, description: '', icon: '☁️' },
      { id: '2', name: 'GitHub', category: 'developer' as const, protocol: 'SAML 2.0', launchUrl: 'https://github.com', assigned: true, description: '', icon: '🐙' },
      { id: '3', name: 'Figma', category: 'collaboration' as const, protocol: 'SAML 2.0', launchUrl: 'https://figma.com', assigned: true, description: '', icon: '🎨' },
    ];

    const cloudApps = apps.filter((a) => a.category === 'cloud');
    assert.equal(cloudApps.length, 1);
    assert.equal(cloudApps[0].name, 'AWS');

    const devApps = apps.filter((a) => a.category === 'developer');
    assert.equal(devApps.length, 1);
    assert.equal(devApps[0].name, 'GitHub');
  });

  await t.test('normalizes URLs missing http/https prefix', () => {
    const rawUrl = 'www.figma.com/login';
    let formatted = rawUrl.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    assert.equal(formatted, 'https://www.figma.com/login');
  });
});
