import test from 'node:test';
import assert from 'node:assert/strict';

import { VaultService } from '../services/vault.service.ts';
import {
  MockKeychainProvider,
  SecureStorageError,
} from '../services/secure-storage.provider.ts';
import { TotpEngine } from '../services/totp-engine.service.ts';
import { OtpAuthParser } from '../services/otpauth-parser.service.ts';
import { AesGcmService } from '../services/aes-gcm.service.ts';
import { ClipboardService } from '../services/clipboard.service.ts';
import pushMfaService from '../services/push-mfa.service.ts';

test('Mobile Secure Storage, Real TOTP/QR, Locking, Backup & Device-Bound Approvals (SCRUM-139)', async (t) => {
  await t.test('1. Fresh install starts completely empty without hardcoded seed accounts', async () => {
    const mockStorage = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockStorage);

    const accounts = await service.getAccounts();
    assert.equal(accounts.length, 0, 'Fresh install must start with 0 accounts');

    const status = service.getStorageStatus();
    assert.equal(status.error, null);
    assert.equal(status.isLocked, false);
    assert.equal(status.accountCount, 0);
  });

  await t.test('2. Native secure storage failures are explicit and not silently swallowed', async () => {
    const failingStorage = {
      async getItemAsync(): Promise<string | null> {
        throw new Error('KEYCHAIN_HARDWARE_UNAVAILABLE');
      },
      async setItemAsync(): Promise<void> {
        throw new Error('KEYCHAIN_HARDWARE_UNAVAILABLE');
      },
      async deleteItemAsync(): Promise<void> {
        throw new Error('KEYCHAIN_HARDWARE_UNAVAILABLE');
      },
    };

    const service = new VaultService();
    service.setStorageProvider(failingStorage);

    await assert.rejects(
      async () => {
        await service.getAccounts();
      },
      (err: any) => {
        assert.ok(err instanceof SecureStorageError, 'Must throw SecureStorageError');
        assert.ok(err.message.includes('Secure storage initialization failed'));
        return true;
      }
    );

    const status = service.getStorageStatus();
    assert.ok(status.error?.includes('KEYCHAIN_HARDWARE_UNAVAILABLE'));
  });

  await t.test('3. RFC 6238 official test vectors with standard HMAC-SHA1 TOTP engine', () => {
    // RFC 6238 Appendix B test secret: "12345678901234567890" (20 bytes)
    // Base32 representation: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    // Official test vector time steps (seconds) and expected 6-digit codes
    // At T=59s, step = 1: 6-digit code = "287082"
    const code59 = TotpEngine.generate(rfcSecret, { timestamp: 59 * 1000, digits: 6, period: 30 });
    assert.equal(code59, '287082', 'RFC 6238 vector T=59s mismatch');

    // At T=1111111109s, step = 37037036: 6-digit code = "081804"
    const code1109 = TotpEngine.generate(rfcSecret, { timestamp: 1111111109 * 1000, digits: 6, period: 30 });
    assert.equal(code1109, '081804', 'RFC 6238 vector T=1111111109s mismatch');

    // At T=1111111111s, step = 37037037: 6-digit code = "050471"
    const code1111 = TotpEngine.generate(rfcSecret, { timestamp: 1111111111 * 1000, digits: 6, period: 30 });
    assert.equal(code1111, '050471', 'RFC 6238 vector T=1111111111s mismatch');

    // At T=1234567890s, step = 41152263: 6-digit code = "005924"
    const code1234 = TotpEngine.generate(rfcSecret, { timestamp: 1234567890 * 1000, digits: 6, period: 30 });
    assert.equal(code1234, '005924', 'RFC 6238 vector T=1234567890s mismatch');

    // At T=2000000000s, step = 66666666: 6-digit code = "279037"
    const code2000 = TotpEngine.generate(rfcSecret, { timestamp: 2000000000 * 1000, digits: 6, period: 30 });
    assert.equal(code2000, '279037', 'RFC 6238 vector T=2000000000s mismatch');

    // Corrupted Base32 secret strictly throws error instead of falling back to polynomial hash
    assert.throws(() => {
      TotpEngine.generate('INVALID_BASE32_WITH_980!', { digits: 6, period: 30 });
    }, /INVALID_SECRET/i);
  });

  await t.test('4. Real QR / URI parsing validates RFC 6238 KeyUriFormat and rejects corrupt data', () => {
    // Valid standard URI
    const uri1 = 'otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60';
    const parsed1 = OtpAuthParser.parse(uri1);
    assert.equal(parsed1.accountName, 'john.doe@email.com');
    assert.equal(parsed1.issuer, 'ACME Co');
    assert.equal(parsed1.secret, 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ');
    assert.equal(parsed1.algorithm, 'SHA256');
    assert.equal(parsed1.digits, 8);
    assert.equal(parsed1.period, 60);

    // Standard Google Authenticator format (issuer in prefix only)
    const uri2 = 'otpauth://totp/GitHub:monalisa?secret=JBSWY3DPEHPK3PXP';
    const parsed2 = OtpAuthParser.parse(uri2);
    assert.equal(parsed2.accountName, 'monalisa');
    assert.equal(parsed2.issuer, 'GitHub');
    assert.equal(parsed2.digits, 6);
    assert.equal(parsed2.period, 30);
    assert.equal(parsed2.algorithm, 'SHA1');

    // Invalid scheme
    assert.throws(() => OtpAuthParser.parse('otpauth://hotp/test?secret=JBSWY3DPEHPK3PXP'), /UNSUPPORTED_TYPE/);
    assert.throws(() => OtpAuthParser.parse('https://example.com/qr'), /INVALID_SCHEME/);

    // Missing or invalid secret
    assert.throws(() => OtpAuthParser.parse('otpauth://totp/test?issuer=Test'), /MISSING_SECRET/);
    assert.throws(() => OtpAuthParser.parse('otpauth://totp/test?secret=INVALID890!'), /INVALID_SECRET/);

    // Invalid digits
    assert.throws(() => OtpAuthParser.parse('otpauth://totp/test?secret=JBSWY3DPEHPK3PXP&digits=7'), /INVALID_DIGITS/);
  });

  await t.test('5. Auto-lock clears in-memory state and prevents unauthorized access', async () => {
    const mockStorage = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockStorage);

    await service.saveAccount({
      accountName: 'analyst@defense.corp',
      issuer: 'Defense Corp',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    const accountsBeforeLock = await service.getAccounts();
    assert.equal(accountsBeforeLock.length, 1);

    // Lock vault
    service.lock();
    assert.equal(service.getStorageStatus().isLocked, true);

    // Locked access must reject
    await assert.rejects(
      async () => {
        await service.getAccounts();
      },
      /VAULT_LOCKED/
    );

    // Unlock restores access
    await service.unlock();
    assert.equal(service.getStorageStatus().isLocked, false);
    const accountsAfterUnlock = await service.getAccounts();
    assert.equal(accountsAfterUnlock.length, 1);
  });

  await t.test('6. ClipboardService auto-clears sensitive codes only when clipboard is still owned', async () => {
    let mockClipboard = '';
    const mockNativeClipboard = {
      async setStringAsync(text: string) {
        mockClipboard = text;
      },
      async getStringAsync() {
        return mockClipboard;
      },
    };

    const clipboard = new ClipboardService(mockNativeClipboard);

    // Copy with 0.05s (50ms) TTL for testing
    await clipboard.copyWithExpiration('123456', 0.05);
    assert.equal(await mockNativeClipboard.getStringAsync(), '123456');

    // Wait 80ms for auto-clear timer to fire
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(await mockNativeClipboard.getStringAsync(), '', 'Clipboard must be cleared after TTL');

    // Test non-overwrite: if user copied something else in another app, do not wipe
    await clipboard.copyWithExpiration('654321', 0.05);
    // User switches to browser and copies an email
    mockClipboard = 'external-user@company.com';
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(
      await mockNativeClipboard.getStringAsync(),
      'external-user@company.com',
      'Clipboard belonging to another operation must not be erased'
    );
  });

  await t.test('7. Genuine wipe operation clears keychain payload, keys, and memory permanently', async () => {
    const mockStorage = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockStorage);

    await service.saveAccount({
      accountName: 'wipe-me@security.org',
      issuer: 'Wipe Test',
      secret: 'MZXW6YTBOI2GI3TG',
    });

    assert.equal((await service.getAccounts()).length, 1);

    // Wipe without confirmation throws
    await assert.rejects(
      async () => {
        await service.wipeVault({ confirmed: false });
      },
      /WIPE_UNCONFIRMED/
    );

    // Confirmed wipe
    await service.wipeVault({ confirmed: true });

    // After wipe, storage must be empty
    const reloadedAccounts = await service.getAccounts();
    assert.equal(reloadedAccounts.length, 0, 'Wiped vault must be 0 accounts');

    // Simulated restart also finds 0 accounts (no demo reseeding)
    const restartedService = new VaultService();
    restartedService.setStorageProvider(mockStorage);
    const restartedAccounts = await restartedService.getAccounts();
    assert.equal(restartedAccounts.length, 0, 'Restarted service after wipe must stay completely empty');
  });

  await t.test('8. Encrypted export and import using PBKDF2-SHA256 and AES-GCM-256', async () => {
    const mockStorage = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockStorage);

    await service.saveAccount({
      accountName: 'alice@vanguard.security',
      issuer: 'Vanguard Corporate',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    await service.saveAccount({
      accountName: 'bob@infra.cloud',
      issuer: 'Infra Cloud',
      secret: 'GEZDGNBVGY3TQOJQ',
    });

    // Passphrase validation
    await assert.rejects(
      async () => {
        await service.exportVault('short');
      },
      /EXPORT_FAILED/
    );

    const passphrase = 'UltraSecurePassword2026!';
    const encryptedJson = await service.exportVault(passphrase);
    assert.ok(!encryptedJson.includes('JBSWY3DPEHPK3PXP'), 'Export must NOT contain plaintext secret');
    assert.ok(!encryptedJson.includes('GEZDGNBVGY3TQOJQ'), 'Export must NOT contain plaintext secret');

    const envelope = JSON.parse(encryptedJson);
    assert.equal(envelope.format, 'vanguard-encrypted-vault-backup');
    assert.equal(envelope.kdf.algorithm, 'PBKDF2');
    assert.equal(envelope.kdf.iterations, 100000);
    assert.equal(envelope.cipher.algorithm, 'AES-GCM-256');
    assert.equal(envelope.accountCount, 2);

    // Import into fresh new vault instance
    const freshStorage = new MockKeychainProvider();
    const freshService = new VaultService();
    freshService.setStorageProvider(freshStorage);

    // Import with wrong password fails
    await assert.rejects(
      async () => {
        await freshService.importVault(encryptedJson, 'WrongPassword123!');
      },
      /DECRYPTION_FAILED/
    );

    // Import with correct password succeeds
    const result = await freshService.importVault(encryptedJson, passphrase);
    assert.equal(result.importedCount, 2);

    const importedAccounts = await freshService.getAccounts();
    assert.equal(importedAccounts.length, 2);
    assert.ok(importedAccounts.some((a) => a.accountName === 'alice@vanguard.security'));
    assert.ok(importedAccounts.some((a) => a.accountName === 'bob@infra.cloud'));
  });

  await t.test('9. Device-bound push MFA refuses anonymous polling without authenticated identity', async () => {
    // Polling without authenticated email returns null (refuses anonymous query)
    const result = await pushMfaService.fetchPendingPush('');
    assert.equal(result, null, 'Anonymous poll must return null without querying backend');
  });
});
