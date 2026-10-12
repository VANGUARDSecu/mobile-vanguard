import test from 'node:test';
import assert from 'node:assert/strict';
import { TotpEngine } from '../services/totp-engine.service.ts';
import vaultService from '../services/vault.service.ts';
import { CyberColors } from '../constants/cyber-theme.ts';
import { MockKeychainProvider } from '../services/secure-storage.provider.ts';

test('Offline RFC 6238 TOTP Generator Engine & Countdown Visualizer (SCRUM-19)', async (t) => {
  // RFC 6238 official test secret: ASCII "12345678901234567890" in Base32
  const RFC_BASE32_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  await t.test('1. RFC 6238 official test vectors match Google Authenticator output', () => {
    // Vector 1: Time = 59s -> 287082 (6 digits), 94287082 (8 digits)
    const code59_6 = TotpEngine.generate({
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      timestamp: 59 * 1000,
    });
    assert.equal(code59_6, '287082', 'RFC 6238 vector T=59s must match 287082');

    const code59_8 = TotpEngine.generate({
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 8,
      period: 30,
      timestamp: 59 * 1000,
    });
    assert.equal(code59_8, '94287082', 'RFC 6238 vector T=59s (8 digits) must match 94287082');

    // Vector 2: Time = 1111111109s -> 081804
    const code111 = TotpEngine.generate({
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      timestamp: 1111111109 * 1000,
    });
    assert.equal(code111, '081804', 'RFC 6238 vector T=1111111109s must match 081804');

    // Vector 3: Time = 1234567890s -> 005924
    const code123 = TotpEngine.generate({
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      timestamp: 1234567890 * 1000,
    });
    assert.equal(code123, '005924', 'RFC 6238 vector T=1234567890s must match 005924');

    // Vector 4: Time = 2000000000s -> 279037
    const code200 = TotpEngine.generate({
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      timestamp: 2000000000 * 1000,
    });
    assert.equal(code200, '279037', 'RFC 6238 vector T=2000000000s must match 279037');
  });

  await t.test('2. Circular countdown warning color shift (Cyan >10s, Amber <=10s, Red <=5s)', () => {
    // Normal interval (> 10s) -> Cyan
    assert.equal(
      TotpEngine.getWarningColor(30),
      CyberColors.cyan,
      '30s remaining must be Cyan'
    );
    assert.equal(
      TotpEngine.getWarningColor(15),
      CyberColors.cyan,
      '15s remaining must be Cyan'
    );
    assert.equal(
      TotpEngine.getWarningColor(11),
      CyberColors.cyan,
      '11s remaining must be Cyan'
    );

    // Warning interval (<= 10s and > 5s) -> Amber
    assert.equal(
      TotpEngine.getWarningColor(10),
      CyberColors.amber,
      '10s remaining must shift to Amber'
    );
    assert.equal(
      TotpEngine.getWarningColor(8),
      CyberColors.amber,
      '8s remaining must shift to Amber'
    );
    assert.equal(
      TotpEngine.getWarningColor(6),
      CyberColors.amber,
      '6s remaining must shift to Amber'
    );

    // Urgent interval (<= 5s) -> Red
    assert.equal(
      TotpEngine.getWarningColor(5),
      CyberColors.red,
      '5s remaining must shift to Red'
    );
    assert.equal(
      TotpEngine.getWarningColor(2),
      CyberColors.red,
      '2s remaining must shift to Red'
    );
    assert.equal(
      TotpEngine.getWarningColor(1),
      CyberColors.red,
      '1s remaining must shift to Red'
    );
  });

  await t.test('3. Base32 normalization and secret key validation', () => {
    // Strips spaces, unpads, and uppercases
    const rawNoisy = '  jbsw y3dp   ehpk 3pxp===  ';
    const cleaned = TotpEngine.cleanSecret(rawNoisy);
    assert.equal(cleaned, 'JBSWY3DPEHPK3PXP');
    assert.equal(TotpEngine.isValidBase32(rawNoisy), true);

    // Rejects non-Base32 characters (0, 1, 8, 9, punctuation)
    assert.equal(TotpEngine.isValidBase32('BADKEY8901'), false);
    assert.equal(TotpEngine.isValidBase32('TEST!@#$'), false);
    assert.equal(TotpEngine.isValidBase32('SHORT'), false); // Less than 8 chars

    // Decodes to valid byte buffer
    const decoded = TotpEngine.decodeBase32('JBSWY3DPEHPK3PXP');
    assert.ok(decoded instanceof Uint8Array);
    assert.ok(decoded.length > 0);
  });

  await t.test('4. Code formatting and tap-to-copy spacers', () => {
    // 6-digit formatting adds central space (3 + 3)
    assert.equal(TotpEngine.formatCode('287082'), '287 082');
    assert.equal(TotpEngine.formatCode('005924'), '005 924');

    // 8-digit formatting adds central space (4 + 4)
    assert.equal(TotpEngine.formatCode('94287082'), '9428 7082');

    // Empty or odd lengths returned sanitized
    assert.equal(TotpEngine.formatCode(''), '');
    assert.equal(TotpEngine.formatCode('1234'), '1234');
  });

  await t.test('5. Clock drift tolerance and step rollover validation', () => {
    const fixedTime = 1757500000000;
    const code = TotpEngine.generate({
      secret: 'JBSWY3DPEHPK3PXP',
      period: 30,
      timestamp: fixedTime,
    });

    // Exact match in same window
    assert.equal(
      TotpEngine.validate({
        token: code,
        secret: 'JBSWY3DPEHPK3PXP',
        period: 30,
        timestamp: fixedTime,
        window: 0,
      }),
      true
    );

    // Within ±1 window (drift tolerance)
    assert.equal(
      TotpEngine.validate({
        token: code,
        secret: 'JBSWY3DPEHPK3PXP',
        period: 30,
        timestamp: fixedTime + 29000, // Still within 1 step
        window: 1,
      }),
      true
    );

    // Reject incorrect or corrupt code
    assert.equal(
      TotpEngine.validate({
        token: '000000',
        secret: 'JBSWY3DPEHPK3PXP',
        period: 30,
        timestamp: fixedTime,
        window: 1,
      }),
      false
    );
  });

  await t.test('6. VaultService integrates TotpEngine and generates authentic codes', async () => {
    const mockStore = new MockKeychainProvider();
    vaultService.setStorageProvider(mockStore);

    const account = await vaultService.saveAccount({
      accountName: 'rfc-test@vanguard.security',
      issuer: 'RFC Test Suite',
      secret: RFC_BASE32_SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const code = vaultService.generateCode(account, 59 * 1000);
    assert.equal(code, '287082');

    const formatted = vaultService.formatCode(code);
    assert.equal(formatted, '287 082');

    const remaining = vaultService.getRemainingSeconds(30, 59 * 1000);
    assert.equal(remaining, 1); // 59 % 30 = 29 elapsed -> 1s remaining
  });
});
