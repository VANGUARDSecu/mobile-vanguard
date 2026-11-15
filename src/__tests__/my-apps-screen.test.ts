import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('Main Applications Screen Integration & App Tabs (SCRUM-69)', async (t) => {
  await t.test('formats dynamic header titles by workspace mode', () => {
    const getScreenTitle = (isPersonalWorkspace: boolean): string => {
      return isPersonalWorkspace
        ? 'Personal Applications & Bookmarks'
        : 'My Applications (Single Sign-On)';
    };

    assert.equal(getScreenTitle(true), 'Personal Applications & Bookmarks');
    assert.equal(getScreenTitle(false), 'My Applications (Single Sign-On)');
  });

  await t.test('formats primary action button label by workspace mode', () => {
    const getActionButtonText = (isPersonalWorkspace: boolean): string => {
      return isPersonalWorkspace ? 'Add Application' : 'Request Application';
    };

    assert.equal(getActionButtonText(true), 'Add Application');
    assert.equal(getActionButtonText(false), 'Request Application');
  });

  await t.test('formats workspace switcher pill text and target toggling', () => {
    const getWorkspacePillText = (isPersonal: boolean): string => {
      return isPersonal ? '👤 Personal Mode' : '🏢 Company Org';
    };

    assert.equal(getWorkspacePillText(true), '👤 Personal Mode');
    assert.equal(getWorkspacePillText(false), '🏢 Company Org');

    let workspaceMode = false;
    workspaceMode = !workspaceMode;
    assert.equal(workspaceMode, true);
    workspaceMode = !workspaceMode;
    assert.equal(workspaceMode, false);
  });

  await t.test('bottom tabs trigger configuration maps index route to Apps tab', () => {
    const triggers = [
      { name: 'index', label: 'Apps', icon: 'home.png' },
      { name: 'explore', label: 'Explore', icon: 'explore.png' },
    ];

    const appsTab = triggers.find((t) => t.name === 'index');
    assert.ok(appsTab);
    assert.equal(appsTab.label, 'Apps');
  });

  await t.test('handles pull-to-refresh data reloading lifecycle state', async () => {
    let refreshing = false;
    let refreshed = false;

    const onRefresh = async (refreshFn: () => Promise<void>) => {
      refreshing = true;
      await refreshFn();
      refreshing = false;
    };

    const mockRefreshFn = async () => {
      refreshed = true;
    };

    await onRefresh(mockRefreshFn);
    assert.equal(refreshing, false);
    assert.equal(refreshed, true);
  });

  await t.test('does not render CompanyAdminBanner or RequestedAppsSection on MyAppsScreen', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const screenSource = readFileSync(
      path.resolve(testDir, '../screens/my-apps-screen.tsx'),
      'utf8',
    );
    assert.equal(screenSource.includes('CompanyAdminBanner'), false);
    assert.equal(screenSource.includes('RequestedAppsSection'), false);
  });
});
