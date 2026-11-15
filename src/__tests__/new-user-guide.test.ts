import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUIDE_ROLE_TABS,
  GUIDE_STORAGE_PREFIX,
  buildGuideStorageKey,
  createMobileGuideController,
  getGuideProfile,
  normalizeGuideUserKey,
  resolveGuideRoleFromUser,
  resolveGuideStepRoute,
  type GuideRole,
  type GuideStorageAdapter,
} from '../utils/new-user-guide.ts';

function createMemoryStorage(initial: Record<string, string> = {}): {
  adapter: GuideStorageAdapter;
  store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    adapter: {
      async getItem(key: string): Promise<string | null> {
        return store.has(key) ? (store.get(key) ?? null) : null;
      },
      async setItem(key: string, value: string): Promise<void> {
        store.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        store.delete(key);
      },
    },
  };
}

test('Mobile New User Guide — role resolution & plain-English copy (SCRUM-195)', async (t) => {
  await t.test('resolveGuideRoleFromUser maps account flags deterministically', () => {
    assert.equal(resolveGuideRoleFromUser(null), 'company-admin');
    assert.equal(resolveGuideRoleFromUser(undefined), 'company-admin');
    assert.equal(
      resolveGuideRoleFromUser({ accountType: 'individual', role: 'user' }),
      'individual'
    );
    assert.equal(
      resolveGuideRoleFromUser({ accountType: 'individual', role: 'admin' }),
      'individual'
    );
    assert.equal(
      resolveGuideRoleFromUser({ accountType: 'company', role: 'admin' }),
      'company-admin'
    );
    assert.equal(
      resolveGuideRoleFromUser({ accountType: 'company', role: 'security_officer' }),
      'company-admin'
    );
    assert.equal(
      resolveGuideRoleFromUser({ accountType: 'company', role: 'user' }),
      'employee'
    );
    assert.equal(
      resolveGuideRoleFromUser({ role: 'admin' }),
      'company-admin'
    );
  });

  await t.test('all three role profiles expose clear 3-step plain-English copy without protocol jargon', () => {
    const roles: GuideRole[] = ['company-admin', 'employee', 'individual'];
    const bannedJargon = ['pkce', 'rs256', 'oidc', 'hmac', 'aes-', 'zero-trust', 'saml'];

    assert.equal(GUIDE_ROLE_TABS.length, 3);

    for (const role of roles) {
      const profile = getGuideProfile(role);
      assert.equal(profile.role, role);
      assert.ok(profile.tabLabel.length > 0);
      assert.ok(profile.badge.length > 0);
      assert.ok(profile.headline.length > 0);
      assert.ok(profile.summary.length > 0);
      assert.equal(profile.steps.length, 3);

      const combinedCopy = [
        profile.tabLabel,
        profile.badge,
        profile.headline,
        profile.summary,
        profile.loginActionLabel,
        ...profile.steps.flatMap((step) => [
          step.title,
          step.description,
          step.actionLabel,
          step.loginActionLabel,
        ]),
      ]
        .join(' ')
        .toLowerCase();

      for (const term of bannedJargon) {
        assert.ok(
          !combinedCopy.includes(term),
          `Role "${role}" guide copy must stay plain-English (found "${term}")`
        );
      }

      assert.deepEqual(
        profile.steps.map((s) => s.stepNumber),
        [1, 2, 3]
      );
    }
  });

  await t.test('normalizes user keys and storage keys consistently per user', () => {
    assert.equal(normalizeGuideUserKey('  Alice@Company.COM '), 'alice@company.com');
    assert.equal(normalizeGuideUserKey('   '), '');
    assert.equal(normalizeGuideUserKey(null), '');
    assert.equal(
      buildGuideStorageKey('  Alice@Company.COM '),
      `${GUIDE_STORAGE_PREFIX}alice@company.com`
    );
  });

  await t.test('resolves mobile tab routes on dashboard vs auth routes on login screen', () => {
    const companyProfile = getGuideProfile('company-admin');
    const employeeProfile = getGuideProfile('employee');
    const individualProfile = getGuideProfile('individual');

    assert.equal(resolveGuideStepRoute(companyProfile.steps[0], 'dashboard'), '/');
    assert.equal(resolveGuideStepRoute(companyProfile.steps[1], 'dashboard'), '/vault');
    assert.equal(resolveGuideStepRoute(companyProfile.steps[2], 'dashboard'), '/explore');

    assert.equal(resolveGuideStepRoute(employeeProfile.steps[0], 'dashboard'), '/');
    assert.equal(resolveGuideStepRoute(employeeProfile.steps[1], 'dashboard'), '/vault');
    assert.equal(resolveGuideStepRoute(employeeProfile.steps[2], 'dashboard'), '/devices');

    assert.equal(resolveGuideStepRoute(individualProfile.steps[0], 'dashboard'), '/');
    assert.equal(resolveGuideStepRoute(individualProfile.steps[1], 'dashboard'), '/vault');
    assert.equal(resolveGuideStepRoute(individualProfile.steps[2], 'dashboard'), '/explore');

    assert.equal(resolveGuideStepRoute(companyProfile.steps[0], 'login'), '/register');
    assert.equal(resolveGuideStepRoute(employeeProfile.steps[0], 'login'), '/login');
    assert.equal(resolveGuideStepRoute(individualProfile.steps[0], 'login'), '/register');
  });
});

test('Mobile New User Guide — first-login auto-open, dismissal persistence & navigation (SCRUM-195)', async (t) => {
  await t.test('auto-opens once on first login and persists dismissal when dontShowAgain is checked', async () => {
    const { adapter, store } = createMemoryStorage();
    const controller = createMobileGuideController(adapter);

    const opened = await controller.autoOpenIfFirstDashboardVisit('Alice@Acme.com', 'employee');
    assert.equal(opened, true);
    assert.equal(controller.getState().isOpen, true);
    assert.equal(controller.getState().context, 'dashboard');
    assert.equal(controller.getState().activeRole, 'employee');
    assert.equal(controller.getState().dontShowAgain, true);

    await controller.close(true);
    assert.equal(controller.getState().isOpen, false);
    assert.equal(store.get(buildGuideStorageKey('alice@acme.com')), 'true');

    // Fresh controller simulates app restart for the same user -> stays hidden
    const restartedController = createMobileGuideController(adapter);
    const openedAfterRestart = await restartedController.autoOpenIfFirstDashboardVisit(
      'alice@acme.com',
      'employee'
    );
    assert.equal(openedAfterRestart, false);
    assert.equal(restartedController.getState().isOpen, false);

    // Different user on the same phone still receives first-login guide
    const openedForOtherUser = await restartedController.autoOpenIfFirstDashboardVisit(
      'bob@acme.com',
      'individual'
    );
    assert.equal(openedForOtherUser, true);
    assert.equal(restartedController.getState().activeRole, 'individual');
  });

  await t.test('suppresses current session only when closed with dontShowAgain unchecked', async () => {
    const { adapter, store } = createMemoryStorage();
    const controller = createMobileGuideController(adapter);

    await controller.autoOpenIfFirstDashboardVisit('carol@acme.com', 'company-admin');
    controller.setDontShowAgain(false);
    await controller.close(true);

    assert.equal(store.has(buildGuideStorageKey('carol@acme.com')), false);
    assert.equal(
      await controller.autoOpenIfFirstDashboardVisit('carol@acme.com', 'company-admin'),
      false
    );

    // Next app session auto-opens again because dontShowAgain was unchecked
    const nextAppLaunch = createMobileGuideController(adapter);
    assert.equal(
      await nextAppLaunch.autoOpenIfFirstDashboardVisit('carol@acme.com', 'company-admin'),
      true
    );
  });

  await t.test('explicit openFromDashboard & openFromLogin work regardless of prior dismissal', async () => {
    const { adapter, store } = createMemoryStorage({
      [buildGuideStorageKey('alice@acme.com')]: 'true',
    });
    const controller = createMobileGuideController(adapter);

    controller.openFromLogin('individual');
    assert.equal(controller.getState().isOpen, true);
    assert.equal(controller.getState().context, 'login');
    assert.equal(controller.getState().activeRole, 'individual');
    assert.equal(controller.getState().activeUserKey, null);

    await controller.close(true);
    assert.equal(controller.getState().isOpen, false);

    await controller.openFromDashboard('alice@acme.com', 'company-admin');
    assert.equal(controller.getState().isOpen, true);
    assert.equal(controller.getState().context, 'dashboard');
    assert.equal(controller.getState().activeRole, 'company-admin');
    assert.equal(controller.getState().dontShowAgain, true);

    controller.setDontShowAgain(false);
    await controller.close(true);
    assert.equal(store.has(buildGuideStorageKey('alice@acme.com')), false);
  });

  await t.test('executeStepAction closes modal cleanly and routes to target tab or auth screen', async () => {
    const { adapter } = createMemoryStorage();
    const controller = createMobileGuideController(adapter);
    const navigatedRoutes: string[] = [];

    await controller.autoOpenIfFirstDashboardVisit('dave@acme.com', 'employee');
    const stepTwo = getGuideProfile('employee').steps[1];
    await controller.executeStepAction(stepTwo, (route) => {
      navigatedRoutes.push(route);
    });

    assert.equal(controller.getState().isOpen, false);
    assert.deepEqual(navigatedRoutes, ['/vault']);

    controller.openFromLogin('company-admin');
    const loginStepOne = getGuideProfile('company-admin').steps[0];
    await controller.executeStepAction(loginStepOne, (route) => {
      navigatedRoutes.push(route);
    });
    assert.equal(controller.getState().isOpen, false);
    assert.deepEqual(navigatedRoutes, ['/vault', '/register']);
  });

  await t.test('handles storage failures gracefully without throwing', async () => {
    const failingAdapter: GuideStorageAdapter = {
      async getItem() {
        throw new Error('storage read disabled');
      },
      async setItem() {
        throw new Error('storage write quota exceeded');
      },
      async removeItem() {
        throw new Error('storage delete disabled');
      },
    };
    const controller = createMobileGuideController(failingAdapter);
    const opened = await controller.autoOpenIfFirstDashboardVisit('err@acme.com', 'individual');
    assert.equal(opened, true);
    await controller.close(true);
    assert.equal(controller.getState().isOpen, false);
  });
});
