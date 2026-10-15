import test from 'node:test';
import assert from 'node:assert/strict';
import { GuideService, DEFAULT_MOBILE_CHECKLIST, MOBILE_GUIDE_SLIDES } from '../services/guide.service.ts';

test('Mobile First-Timer User Guide & Checklist Logic (SCRUM-87)', async (t) => {
  const guideService = new GuideService();

  await t.test('Initializes with 5 standard user mobile onboarding tasks', async () => {
    const checklist = await guideService.getChecklist();
    assert.equal(checklist.length, 5);
    assert.equal(checklist[0].id, 'task-biometrics');
    assert.equal(checklist[1].id, 'task-totp');
    assert.equal(checklist[2].id, 'task-push');
    assert.equal(checklist[3].id, 'task-sso');
    assert.equal(checklist[4].id, 'task-request');
  });

  await t.test('Calculates progress percentage accurately based on completed tasks', () => {
    const emptyProgress = guideService.calculateProgress([]);
    assert.equal(emptyProgress, 0);

    const items = DEFAULT_MOBILE_CHECKLIST.map((item) => ({ ...item, completed: false }));
    assert.equal(guideService.calculateProgress(items), 0);

    items[0].completed = true;
    assert.equal(guideService.calculateProgress(items), 20);

    items[1].completed = true;
    assert.equal(guideService.calculateProgress(items), 40);

    items[2].completed = true;
    items[3].completed = true;
    items[4].completed = true;
    assert.equal(guideService.calculateProgress(items), 100);
  });

  await t.test('Toggles checklist item completion state and persists to storage', async () => {
    await guideService.resetChecklist();

    const afterFirstToggle = await guideService.toggleItem('task-biometrics');
    const biometricsItem = afterFirstToggle.find((i) => i.id === 'task-biometrics');
    assert.equal(biometricsItem?.completed, true);
    assert.equal(guideService.calculateProgress(afterFirstToggle), 20);

    // Toggle back to incomplete
    const afterSecondToggle = await guideService.toggleItem('task-biometrics');
    const toggledBack = afterSecondToggle.find((i) => i.id === 'task-biometrics');
    assert.equal(toggledBack?.completed, false);
    assert.equal(guideService.calculateProgress(afterSecondToggle), 0);
  });

  await t.test('Auto-marks guide completed when all tasks are finished', async () => {
    await guideService.resetChecklist();
    assert.equal(await guideService.isCompleted(), false);

    for (const item of DEFAULT_MOBILE_CHECKLIST) {
      await guideService.toggleItem(item.id);
    }

    assert.equal(await guideService.isCompleted(), true);
  });

  await t.test('Resets all checklist items to incomplete and resets completed flag', async () => {
    const reset = await guideService.resetChecklist();
    assert.equal(reset.length, 5);
    assert.equal(reset.every((i) => !i.completed), true);
    assert.equal(guideService.calculateProgress(reset), 0);
    assert.equal(await guideService.isCompleted(), false);
  });

  await t.test('Provides 5 detailed walkthrough slides with key points and actions', () => {
    const slides = guideService.getSlides();
    assert.equal(slides.length, 5);

    assert.equal(slides[0].stepNumber, 1);
    assert.ok(slides[0].title.includes('Welcome'));
    assert.ok(slides[0].keyPoints.length >= 2);

    assert.equal(slides[1].stepNumber, 2);
    assert.ok(slides[1].title.includes('Biometric'));
    assert.equal(slides[1].recommendedAction?.targetAction, 'navigate_settings');

    assert.equal(slides[2].stepNumber, 3);
    assert.ok(slides[2].title.includes('Authenticator Vault'));
    assert.equal(slides[2].recommendedAction?.targetAction, 'navigate_vault');

    assert.equal(slides[3].stepNumber, 4);
    assert.ok(slides[3].title.includes('Push Notification'));
    assert.equal(slides[3].recommendedAction?.targetAction, 'open_push_sandbox');

    assert.equal(slides[4].stepNumber, 5);
    assert.ok(slides[4].title.includes('SaaS Launchpad'));
    assert.equal(slides[4].recommendedAction?.targetAction, 'navigate_apps');
  });

  await t.test('Strictly isolates standard user mobile scope and contains zero admin console features', () => {
    const allChecklistText = DEFAULT_MOBILE_CHECKLIST.map(
      (t) => `${t.title} ${t.description} ${t.targetAction} ${t.badge}`
    ).join(' ').toLowerCase();

    assert.equal(allChecklistText.includes('admin-directory'), false);
    assert.equal(allChecklistText.includes('saml-oidc'), false);
    assert.equal(allChecklistText.includes('cloud-ldap'), false);
    assert.equal(allChecklistText.includes('cloud-radius'), false);
    assert.equal(allChecklistText.includes('killswitch'), false);
    assert.equal(allChecklistText.includes('provision employee'), false);

    const allSlidesText = MOBILE_GUIDE_SLIDES.map(
      (s) => `${s.title} ${s.subtitle} ${s.summary} ${s.keyPoints.join(' ')}`
    ).join(' ').toLowerCase();

    assert.equal(allSlidesText.includes('admin console'), false);
    assert.equal(allSlidesText.includes('ldap server'), false);
    assert.equal(allSlidesText.includes('radius gateway'), false);
    assert.equal(allSlidesText.includes('killswitch'), false);
  });
});
