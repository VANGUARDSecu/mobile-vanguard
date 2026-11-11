process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/auth.service.ts';

test('Two-Step Verification (OTP / TOTP) & Security Flows (SCRUM-79)', async (t) => {
  await t.test('login challenge returns requireMfa for registered database user (SCRUM-79)', async () => {
    const res = await AuthService.login({
      email: 'johnroben.manayon31@gmail.com',
      password: 'Manayon123!',
    });

    assert.equal(res.requireMfa, true);
    assert.equal(res.mfaChallenge.email, 'johnroben.manayon31@gmail.com');
    assert.ok(res.mfaChallenge.enrolledMethods?.includes('email_otp'));
  });

  await t.test('login rejects unregistered demo accounts with backend error (SCRUM-79)', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login({
          email: 'admin@vanguard.security',
          password: 'AdminPassword123!',
        });
      },
      { message: /Invalid login credentials/i }
    );
  });

  await t.test('verifyOtp rejects invalid or wrong verification codes', async () => {
    await assert.rejects(
      async () => {
        await AuthService.verifyOtp({
          email: 'johnroben.manayon31@gmail.com',
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
          email: 'johnroben.manayon31@gmail.com',
          token: '123',
        });
      },
      { message: /Verification code must be at least 6 digits/ }
    );
  });

  await t.test('verifyTotp accepts valid 6-digit dynamic authenticator code', async () => {
    const user = await AuthService.verifyTotp({
      email: 'johnroben.manayon31@gmail.com',
      code: '654321',
    });

    assert.equal(user.email, 'johnroben.manayon31@gmail.com');
    assert.ok(user.accessToken);
  });

  await t.test('verifyTotp rejects non-numeric or non-6-digit codes', async () => {
    await assert.rejects(
      async () => {
        await AuthService.verifyTotp({
          email: 'johnroben.manayon31@gmail.com',
          code: 'abc123',
        });
      },
      { message: /Authenticator code must be a 6-digit number/ }
    );

    await assert.rejects(
      async () => {
        await AuthService.verifyTotp({
          email: 'johnroben.manayon31@gmail.com',
          code: '12345',
        });
      },
      { message: /Authenticator code must be a 6-digit number/ }
    );
  });

  await t.test('resendOtp returns success and active cooldown timer (SCRUM-79)', async () => {
    const res = await AuthService.resendOtp({
      email: 'johnroben.manayon31@gmail.com',
      type: 'email',
    });

    assert.equal(res.success, true);
    assert.ok(res.message.length > 0);
    assert.equal(res.cooldown, 45);
  });
});


