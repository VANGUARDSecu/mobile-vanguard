import test from 'node:test';
import assert from 'node:assert/strict';

import { VaultService, DEFAULT_ACCOUNTS } from '../services/vault.service.ts';
import { MockKeychainProvider } from '../services/secure-storage.provider.ts';
import { AesGcmService } from '../services/aes-gcm.service.ts';

test('Local Secure Vault & Keychain Storage for TOTP Secrets (SCRUM-18)', async (t) => {
  await t.test('1. Local account schema matches SCRUM-18 specifications', () => {
    const seed = DEFAULT_ACCOUNTS[0];

    // Schema fields
    assert.ok(seed.id, 'Account MUST have an id');
    assert.equal(typeof seed.id, 'string');
    assert.ok(seed.accountName, 'Account MUST have accountName (SCRUM-18)');
    assert.equal(seed.accountName, 'admin@vanguard.security');
    assert.equal(seed.name, 'admin@vanguard.security', 'name alias must match accountName');
    assert.equal(seed.issuer, 'Vanguard Security');
    assert.equal(seed.secret, 'JBSWY3DPEHPK3PXP');
    assert.equal(seed.algorithm, 'SHA1');
    assert.equal(seed.digits, 6);
    assert.equal(seed.period, 30);
  });

  await t.test('2. AesGcmService performs 256-bit AES-GCM encryption with IV and authentication tag', async () => {
    const masterKey = await AesGcmService.generateMasterKey();
    assert.ok(masterKey.length > 30, 'Master key must be a valid base64 key');

    const samplePayload = JSON.stringify({ secret: 'MZXW6YTBOI2GI3TG', service: 'GitHub' });
    const envelope = await AesGcmService.encrypt(samplePayload, masterKey);

    assert.equal(envelope.cipher, 'AES-GCM-256');
    assert.ok(envelope.iv, 'Envelope must contain initialization vector (IV)');
    assert.ok(envelope.ciphertext, 'Envelope must contain ciphertext');
    assert.ok(!envelope.ciphertext.includes('MZXW6YTBOI2GI3TG'), 'Ciphertext must NOT contain plaintext secret');

    const decrypted = await AesGcmService.decrypt(envelope, masterKey);
    assert.equal(decrypted, samplePayload);
  });

  await t.test('3. Raw storage contains only AES-GCM encrypted ciphertext and zero plaintext secrets', async () => {
    const mockKeychain = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockKeychain);
    await service.seedDemoAccountsForTesting();

    const accounts = await service.getAccounts();
    assert.ok(accounts.length >= 5);

    // Inspect mock keychain raw storage contents
    const rawVaultPayload = await mockKeychain.getItemAsync('@vanguard:encrypted_totp_vault_v1');
    assert.ok(rawVaultPayload, 'Vault payload must exist in secure keychain storage');

    // Parse envelope
    const parsedEnvelope = JSON.parse(rawVaultPayload!);
    assert.equal(parsedEnvelope.cipher, 'AES-GCM-256');

    // Verify raw storage DOES NOT contain plaintext secrets
    for (const acc of accounts) {
      assert.ok(
        !rawVaultPayload!.includes(acc.secret),
        `Plaintext secret for ${acc.issuer} must NEVER be stored in unencrypted form`
      );
    }
  });

  await t.test('4. Full CRUD operations: saveAccount, getAccounts, getAccountById, updateAccount, deleteAccount', async () => {
    const mockKeychain = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockKeychain);

    // saveAccount
    const saved = await service.saveAccount({
      accountName: 'secops@defense.mil',
      issuer: 'Defense Cyber Center',
      secret: 'MZXW6YTBOI2GI3TG',
      algorithm: 'SHA256',
      digits: 8,
      period: 30,
      icon: '🛡️',
    });

    assert.ok(saved.id, 'saveAccount must generate a unique UUID');
    assert.equal(saved.accountName, 'secops@defense.mil');
    assert.equal(saved.name, 'secops@defense.mil');
    assert.equal(saved.algorithm, 'SHA256');
    assert.equal(saved.digits, 8);

    // getAccountById
    const retrieved = await service.getAccountById(saved.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.accountName, 'secops@defense.mil');
    assert.equal(retrieved?.secret, 'MZXW6YTBOI2GI3TG');

    // updateAccount
    const updated = await service.updateAccount(saved.id, {
      accountName: 'lead-secops@defense.mil',
    });
    assert.equal(updated.accountName, 'lead-secops@defense.mil');
    assert.equal(updated.name, 'lead-secops@defense.mil');

    // deleteAccount
    const deleteSuccess = await service.deleteAccount(saved.id);
    assert.equal(deleteSuccess, true);

    const verifyDeleted = await service.getAccountById(saved.id);
    assert.equal(verifyDeleted, null);
  });

  await t.test('5. Data persistence across app reboot / simulated restarts', async () => {
    const sharedKeychain = new MockKeychainProvider();

    // Session 1: write account
    const instance1 = new VaultService();
    instance1.setStorageProvider(sharedKeychain);
    const added = await instance1.saveAccount({
      accountName: 'persistence-test@vanguard.security',
      issuer: 'Persistence Check',
      secret: 'KRSXG5CTMVRXEZLU',
    });

    // Session 2: simulate app closing and relaunch with new service instance
    const instance2 = new VaultService();
    instance2.setStorageProvider(sharedKeychain);

    const reloadedAccounts = await instance2.getAccounts();
    const found = reloadedAccounts.find((a) => a.id === added.id);

    assert.ok(found, 'Account must persist across restarts using the keychain store');
    assert.equal(found?.accountName, 'persistence-test@vanguard.security');
    assert.equal(found?.secret, 'KRSXG5CTMVRXEZLU');
  });

  await t.test('6. Base32 validation prevents corrupt secrets from being vaulted', async () => {
    const mockKeychain = new MockKeychainProvider();
    const service = new VaultService();
    service.setStorageProvider(mockKeychain);

    await assert.rejects(
      async () => {
        await service.saveAccount({
          accountName: 'invalid@test.com',
          issuer: 'Test',
          secret: 'BAD_KEY_WITH_890!',
        });
      },
      { message: /Invalid Base32 secret key/i }
    );
  });

  await t.test('7. Pure-JS Hermes fallback works without crypto.subtle and interoperates byte-for-byte with WebCrypto', async () => {
    const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const originalCrypto = globalThis.crypto;

    // Generate envelopes via standard WebCrypto first
    const masterKey = await AesGcmService.generateMasterKey();
    const webEnvelope = await AesGcmService.encrypt('{"item":"webcrypto"}', masterKey);
    const webPwdEnvelope = await AesGcmService.encryptWithPassword(
      '{"secret":"web-pwd"}',
      'VanguardMasterPass!99',
      1000,
    );

    try {
      // Simulate React Native Hermes where globalThis.crypto.subtle is absent
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        writable: true,
        value: {
          getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        },
      });

      // Decrypt WebCrypto payloads on simulated Hermes pure-JS path
      const decryptedFromWeb = await AesGcmService.decrypt(webEnvelope, masterKey);
      assert.equal(decryptedFromWeb, '{"item":"webcrypto"}');

      const decryptedPwdFromWeb = await AesGcmService.decryptWithPassword(
        webPwdEnvelope.ciphertext,
        webPwdEnvelope.iv,
        webPwdEnvelope.salt,
        'VanguardMasterPass!99',
        webPwdEnvelope.iterations,
      );
      assert.equal(decryptedPwdFromWeb, '{"secret":"web-pwd"}');

      // Generate master key + encrypt via pure-JS path + run full VaultService CRUD
      const hermesMasterKey = await AesGcmService.generateMasterKey();
      const hermesEnvelope = await AesGcmService.encrypt('{"item":"hermes"}', hermesMasterKey);
      const hermesPwdEnvelope = await AesGcmService.encryptWithPassword(
        '{"secret":"hermes-pwd"}',
        'VanguardMasterPass!99',
        1000,
      );

      const mockKeychain = new MockKeychainProvider();
      const service = new VaultService(mockKeychain);
      const saved = await service.saveAccount({
        accountName: 'android@vanguard.security',
        issuer: 'Android Hermes Check',
        secret: 'JBSWY3DPEHPK3PXP',
      });
      const accounts = await service.getAccounts();
      assert.ok(accounts.some((acc) => acc.id === saved.id));

      // Restore WebCrypto and verify it decrypts payloads created on Hermes
      if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
      }

      const webDecryptedHermes = await AesGcmService.decrypt(hermesEnvelope, hermesMasterKey);
      assert.equal(webDecryptedHermes, '{"item":"hermes"}');

      const webDecryptedHermesPwd = await AesGcmService.decryptWithPassword(
        hermesPwdEnvelope.ciphertext,
        hermesPwdEnvelope.iv,
        hermesPwdEnvelope.salt,
        'VanguardMasterPass!99',
        hermesPwdEnvelope.iterations,
      );
      assert.equal(webDecryptedHermesPwd, '{"secret":"hermes-pwd"}');
    } finally {
      if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
      } else {
        Object.defineProperty(globalThis, 'crypto', {
          configurable: true,
          writable: true,
          value: originalCrypto,
        });
      }
    }
  });
});
