import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/auth.service.ts';

test('Two-Step Verification (OTP / TOTP) & Security Flows (SCRUM-74)', async (t) => {
  await t.test('login challenge returns requireMfa and mfaChallenge metadata', async () => {
    const res = await AuthService.login({
      email: 'user@company.com',
      password: 'Password123!',
    });

    assert.equal(res.requireMfa, true);
    assert.equal(res.mfaChallenge.email, 'user@company.com');
    assert.ok(res.mfaChallenge.enrolledMethods?.includes('email_otp'));
  });

  await t.test('verifyOtp accepts 8-digit dev bypass code (12345678)', async () => {
    const user = await AuthService.verifyOtp({
      email: 'user@company.com',
      token: '12345678',
      type: 'email',
    });

    assert.equal(user.email, 'user@company.com');
    assert.equal(user.firstName, 'John');
    assert.ok(user.accessToken);
  });

  await t.test('verifyOtp accepts 6-digit dev bypass code (123456)', async () => {
    const user = await AuthService.verifyOtp({
      email: 'admin@vanguard.security',
      token: '123456',
      type: 'email',
    });

    assert.equal(user.email, 'admin@vanguard.security');
    assert.equal(user.role, 'admin');
    assert.ok(user.accessToken);
  });

  await t.test('verifyOtp rejects invalid or wrong verification codes', async () => {
    await assert.rejects(
      async () => {
        await AuthService.verifyOtp({
          email: 'user@company.com',
          token: '99999999',
        });
      },
      { message: /(Invalid|expired|Token has expired)/i }
    );
  });

  await t.test('verifyOtp rejects tokens shorter than 6 digits', async () => {
    await assert.rejects(
      async () => {
        await AuthService.verifyOtp({
          email: 'user@company.com',
          token: '123',
        });
      },
      { message: /Verification code must be at least 6 digits/ }
    );
  });

  await t.test('verifyTotp accepts valid 6-digit dynamic authenticator code', async () => {
    const user = await AuthService.verifyTotp({
      email: 'admin@vanguard.security',
      code: '654321',
    });

    assert.equal(user.email, 'admin@vanguard.security');
    assert.ok(user.accessToken);
  });

  await t.test('verifyTotp rejects non-numeric or non-6-digit codes', async () => {
    await assert.rejects(
      async () => {
        await AuthService.verifyTotp({
          email: 'admin@vanguard.security',
          code: 'abc123',
        });
      },
      { message: /Authenticator code must be a 6-digit number/ }
    );

    await assert.rejects(
      async () => {
        await AuthService.verifyTotp({
          email: 'admin@vanguard.security',
          code: '12345',
        });
      },
      { message: /Authenticator code must be a 6-digit number/ }
    );
  });

  await t.test('resendOtp returns success and active cooldown timer', async () => {
    const res = await AuthService.resendOtp({
      email: 'user@company.com',
      type: 'email',
    });

    assert.equal(res.success, true);
    assert.ok(res.message.length > 0);
    assert.equal(res.cooldown, 45);
  });
});
