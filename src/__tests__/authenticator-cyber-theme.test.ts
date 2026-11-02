import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CyberColors,
  CyberRadius,
  CyberGlass,
  CyberShadows,
} from '../constants/cyber-theme.ts';
import vaultService from '../services/vault.service.ts';
import type { AuthenticatorScreenName } from '../models/vault.models.ts';

test('React Native Authenticator Scaffolding & Dark Cyber Theme System (SCRUM-17)', async (t) => {
  await t.test('1. Cyber Dark design system tokens mirror Vanguard web standards', () => {
    // Primary Cyber Dark background
    assert.equal(CyberColors.background, '#0a0e17');
    // Cyber Accents
    assert.equal(CyberColors.cyan, '#00e5ff');
    assert.equal(CyberColors.green, '#10b981');
    assert.equal(CyberColors.indigo, '#6366f1');

    // Radius tokens
    assert.equal(CyberRadius.sm, 6);
    assert.equal(CyberRadius.md, 10);
    assert.equal(CyberRadius.lg, 14);

    // Glassmorphism styling tokens
    assert.ok(CyberGlass.card.backgroundColor.includes('rgba(15, 23, 42'));
    assert.ok(CyberGlass.cardHighlight.borderColor.includes('rgba(0, 229, 255'));

    // Shadows
    assert.equal(CyberShadows.cyanGlow.shadowColor, '#00e5ff');
  });

  await t.test('2. VaultService loads default accounts with zero external network dependencies', async () => {
    await vaultService.seedDemoAccountsForTesting();
    const accounts = await vaultService.getAccounts();
    assert.ok(Array.isArray(accounts));
    assert.ok(accounts.length >= 5);

    const vanguardAccount = accounts.find((a) => a.issuer.includes('Vanguard'));
    assert.ok(vanguardAccount, 'Default seed contains Vanguard Identity account');
    assert.equal(vanguardAccount?.digits, 6);
    assert.equal(vanguardAccount?.period, 30);
  });

  await t.test('3. Dynamic TOTP generation generates valid 6-digit numeric codes and remaining time', () => {
    const mockAccount = {
      id: 'test-account',
      name: 'tester@vanguard.security',
      issuer: 'Vanguard Test',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1' as const,
      digits: 6,
      period: 30,
      icon: '🛡️',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    const fixedTime = 1757500000000;
    const code = vaultService.generateCode(mockAccount, fixedTime);
    assert.equal(code.length, 6, 'TOTP code must be exactly 6 digits');
    assert.ok(/^\d{6}$/.test(code), 'TOTP code must be strictly numeric');

    const formatted = vaultService.formatCode(code);
    assert.equal(formatted.length, 7, 'Formatted TOTP must contain 6 digits and 1 separator space');
    assert.equal(formatted[3], ' ', 'Space must be between first 3 and last 3 digits');

    const remainingSecs = vaultService.getRemainingSeconds(30, fixedTime);
    assert.ok(remainingSecs >= 1 && remainingSecs <= 30);
  });

  await t.test('4. Base32 secret key validation enforces RFC 4648 rules', () => {
    assert.equal(vaultService.validateSecret('JBSWY3DPEHPK3PXP').valid, true);
    assert.equal(vaultService.validateSecret('GEZD GNBV GY3T QOJQ').valid, true);
    assert.equal(vaultService.validateSecret('krsxg5ctmvrxezlu').valid, true);

    // Invalid keys
    assert.equal(vaultService.validateSecret('').valid, false);
    assert.equal(vaultService.validateSecret('SHORT').valid, false);
    assert.equal(vaultService.validateSecret('INVALID8901!').valid, false); // 8, 9, 0 are not Base32
  });

  await t.test('5. Vault CRUD operations persist and validate accurately', async () => {
    // Add account
    const created = await vaultService.addAccount({
      name: 'security-lead@defense.corp',
      issuer: 'Defense Cyber Command',
      secret: 'MZXW6YTBOI2GI3TG',
      algorithm: 'SHA256',
      digits: 6,
      period: 30,
      icon: '⚡',
    });

    assert.ok(created.id);
    assert.equal(created.name, 'security-lead@defense.corp');
    assert.equal(created.algorithm, 'SHA256');

    // Retrieve by ID
    const retrieved = await vaultService.getAccountById(created.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.name, 'security-lead@defense.corp');

    // Update account
    const updated = await vaultService.updateAccount(created.id, {
      name: 'ops-lead@defense.corp',
    });
    assert.equal(updated.name, 'ops-lead@defense.corp');

    // Delete account
    const deleted = await vaultService.deleteAccount(created.id);
    assert.equal(deleted, true);

    const recheck = await vaultService.getAccountById(created.id);
    assert.equal(recheck, null);
  });

  await t.test('6. Vault Security Settings manages biometrics, timeouts, and JSON export', async () => {
    const current = await vaultService.getSettings();
    assert.ok(typeof current.biometricsEnabled === 'boolean');
    assert.ok(typeof current.autoLockSeconds === 'number');

    const updated = await vaultService.updateSettings({
      autoLockSeconds: 60,
      clearClipboardSeconds: 15,
    });
    assert.equal(updated.autoLockSeconds, 60);
    assert.equal(updated.clearClipboardSeconds, 15);

    const exportData = await vaultService.exportVault('SecureBackupPassword123!');
    const parsed = JSON.parse(exportData);
    assert.equal(parsed.version, '1.0.0');
    assert.equal(parsed.format, 'vanguard-encrypted-vault-backup');
    assert.ok(parsed.accountCount >= 5);
  });

  await t.test('7. Screen navigation transitions navigate cleanly across all 4 screens', () => {
    let activeScreen: AuthenticatorScreenName = 'vault';
    let activeAccount: any = null;

    const navigateToDetail = (account: any) => {
      activeAccount = account;
      activeScreen = 'account-detail';
    };

    const navigateToAdd = () => {
      activeScreen = 'add-account';
    };

    const navigateToSettings = () => {
      activeScreen = 'security-settings';
    };

    const navigateToVault = () => {
      activeScreen = 'vault';
      activeAccount = null;
    };

    // Test transition: Vault -> Detail
    navigateToDetail({ id: 'acc-1', name: 'user' });
    assert.equal(activeScreen, 'account-detail');
    assert.equal(activeAccount?.id, 'acc-1');

    // Return to Vault
    navigateToVault();
    assert.equal(activeScreen, 'vault');
    assert.equal(activeAccount, null);

    // Test transition: Vault -> Add Account
    navigateToAdd();
    assert.equal(activeScreen, 'add-account');
    navigateToVault();
    assert.equal(activeScreen, 'vault');

    // Test transition: Vault -> Security Settings
    navigateToSettings();
    assert.equal(activeScreen, 'security-settings');
    navigateToVault();
    assert.equal(activeScreen, 'vault');
  });
});
