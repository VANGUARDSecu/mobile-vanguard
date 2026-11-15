import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDeviceSize,
  computeOtpDigitMetrics,
  computeResponsiveMetrics,
} from '../utils/responsive-layout.ts';

test('Responsive Phone Layout & Adaptive System Chrome Metrics (SCRUM-200)', async (t) => {
  await t.test('1. Classifies compact, regular, large, and tablet tiers accurately', () => {
    assert.equal(classifyDeviceSize(320), 'compact');
    assert.equal(classifyDeviceSize(359), 'compact');
    assert.equal(classifyDeviceSize(360), 'regular');
    assert.equal(classifyDeviceSize(390), 'regular');
    assert.equal(classifyDeviceSize(428), 'large');
    assert.equal(classifyDeviceSize(640), 'tablet');
  });

  await t.test('2. Computes side-by-side actions on >= 360dp phones and stacks below 360dp or huge fontScale', () => {
    const compact = computeResponsiveMetrics({
      width: 320,
      height: 568,
      fontScale: 1,
      bottomInset: 0,
      platformOS: 'android',
    });
    assert.equal(compact.tier, 'compact');
    assert.equal(compact.stackActionButtons, true);
    assert.equal(compact.isShortScreen, true);
    assert.equal(compact.tabBar.authenticatorLabel, '2FA');

    const androidRegular = computeResponsiveMetrics({
      width: 360,
      height: 800,
      fontScale: 1,
      bottomInset: 48,
      platformOS: 'android',
    });
    assert.equal(androidRegular.tier, 'regular');
    assert.equal(androidRegular.stackActionButtons, false);
    assert.equal(androidRegular.tabBar.paddingBottom, 48);
    assert.equal(androidRegular.tabBar.height, 104);
    assert.equal(androidRegular.tabBar.authenticatorLabel, '2FA Vault');

    const scaledAccessibility = computeResponsiveMetrics({
      width: 380,
      height: 800,
      fontScale: 1.4,
      bottomInset: 24,
      platformOS: 'android',
    });
    assert.equal(scaledAccessibility.stackActionButtons, true);
  });

  await t.test('3. Enables 2-column grid and centered max width on foldable/tablet viewports', () => {
    const tablet = computeResponsiveMetrics({
      width: 768,
      height: 1024,
      fontScale: 1,
      bottomInset: 20,
      platformOS: 'ios',
    });
    assert.equal(tablet.tier, 'tablet');
    assert.equal(tablet.gridColumns, 2);
    assert.ok(tablet.contentMaxWidth && tablet.contentMaxWidth <= 680);
  });

  await t.test('4. Fits 8-digit Email OTP and 6-digit TOTP inputs without horizontal overflow on 320dp phones', () => {
    const narrowEmail = computeOtpDigitMetrics(320, 8, 32, 24);
    const totalNeeded8 =
      narrowEmail.boxWidth * 8 + narrowEmail.gap * 7 + 14;
    assert.ok(totalNeeded8 <= 320 - 56, `Expected 8-digit row ${totalNeeded8} <= 264`);

    const narrowTotp = computeOtpDigitMetrics(320, 6, 32, 24);
    const totalNeeded6 = narrowTotp.boxWidth * 6 + narrowTotp.gap * 5;
    assert.ok(totalNeeded6 <= 320 - 56, `Expected 6-digit row ${totalNeeded6} <= 264`);
  });
});
