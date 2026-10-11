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

  await t.test('login successfully authenticates demo user in fallback mode', async () => {
    const creds: LoginCredentials = {
      email: 'ellen.ripley@weyland.corp',
      password: 'Password123!',
    };

    const user = await AuthService.login(creds);
    assert.equal(user.email, 'ellen.ripley@weyland.corp');
    assert.equal(user.name, 'Ellen Ripley');
    assert.ok(user.accessToken);
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

  await t.test('login synthesizes valid user structure for unknown domain emails', async () => {
    const user = await AuthService.login({
      email: 'alexander.mahone@fbi.gov',
      password: 'AnyPassword123!',
    });
    assert.equal(user.email, 'alexander.mahone@fbi.gov');
    assert.equal(user.firstName, 'Alexander');
    assert.equal(user.lastName, 'Mahone');
    assert.equal(user.role, 'user');
  });

  await t.test('logout executes without throwing errors', async () => {
    await assert.doesNotReject(async () => {
      await AuthService.logout();
    });
  });
});
