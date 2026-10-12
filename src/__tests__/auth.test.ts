import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USERS, AuthService } from '../services/auth.service.ts';
import type { LoginCredentials } from '../models/auth.models.ts';

test('Authentication Layer & Login Validation (SCRUM-72)', async (t) => {
  await t.test('demo users dictionary contains valid preconfigured accounts', () => {
    assert.ok(DEMO_USERS['ellen.ripley@weyland.corp']);
    assert.equal(DEMO_USERS['ellen.ripley@weyland.corp'].name, 'Ellen Ripley');
    assert.equal(DEMO_USERS['ellen.ripley@weyland.corp'].role, 'user');

    assert.ok(DEMO_USERS['user@company.com']);
    assert.equal(DEMO_USERS['user@company.com'].firstName, 'John');

    assert.ok(DEMO_USERS['admin@vanguard.security']);
    assert.equal(DEMO_USERS['admin@vanguard.security'].role, 'admin');
  });

  await t.test('login rejects empty or invalid email addresses', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login({ email: '', password: 'Password123!' });
      },
      { message: 'Please enter a valid email address.' }
    );

    await assert.rejects(
      async () => {
        await AuthService.login({ email: 'not-an-email', password: 'Password123!' });
      },
      { message: 'Please enter a valid email address.' }
    );
  });

  await t.test('login rejects empty password when not using SSO mode', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login({ email: 'user@company.com', password: '' });
      },
      { message: 'Password is required.' }
    );

    await assert.rejects(
      async () => {
        await AuthService.login({ email: 'user@company.com', password: '   ' });
      },
      { message: 'Password is required.' }
    );
  });

  await t.test('login initiates 2-step MFA challenge for registered database user (SCRUM-79)', async () => {
    const creds: LoginCredentials = {
      email: 'johnroben.manayon31@gmail.com',
      password: 'Manayon123!',
    };

    const result = await AuthService.login(creds);
    assert.equal(result.requireMfa, true);
    assert.equal(result.mfaChallenge.email, 'johnroben.manayon31@gmail.com');
  });

  await t.test('login rejects unregistered or invalid credentials with backend error (SCRUM-79)', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login({
          email: 'unknown.user@company.com',
          password: 'WrongPassword123!',
        });
      },
      { message: /Invalid login credentials/i }
    );
  });

  await t.test('signInWithSSO defaults to Ellen Ripley and bypasses password check', async () => {
    const user = await AuthService.signInWithSSO();
    assert.equal(user.email, 'ellen.ripley@weyland.corp');
    assert.ok(user.accessToken);
  });

  await t.test('signInWithSSO supports custom target email', async () => {
    const user = await AuthService.signInWithSSO('admin@vanguard.security');
    assert.equal(user.email, 'admin@vanguard.security');
    assert.equal(user.role, 'admin');
    assert.ok(user.accessToken);
  });

  await t.test('login rejects fictional demo domains when not registered in database (SCRUM-79)', async () => {
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

  await t.test('logout executes without throwing errors', async () => {
    await assert.doesNotReject(async () => {
      await AuthService.logout();
    });
  });
});
