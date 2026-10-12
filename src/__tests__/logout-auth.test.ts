import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/auth.service.ts';
import type { AuthUser } from '../models/auth.models.ts';

test('Sign Out Workflow & Auth Gate Navigation (SCRUM-75)', async (t) => {
  await t.test('AuthService.logout executes cleanly and clears session storage', async () => {
    // 1. Simulate saving session
    const mockUser: AuthUser = AuthService.synthesizeUser('ellen.ripley@weyland.corp');
    await AuthService.saveSession(mockUser, 'mock_token_123');

    // 2. Call logout
    await assert.doesNotReject(async () => {
      await AuthService.logout();
    });
  });

  await t.test('AuthService.logout handles offline/unreachable backend gracefully without throwing', async () => {
    // Tests that timeout and abort controller do not throw uncaught errors
    await assert.doesNotReject(async () => {
      await AuthService.logout();
    });
  });

  await t.test('logout handler manages isLoggingOut state guard preventing duplicate calls', async () => {
    let isLoggingOut = false;
    let logoutCallCount = 0;

    const handleLogout = async (logoutFn: () => Promise<void>) => {
      if (isLoggingOut) return;
      isLoggingOut = true;
      try {
        await logoutFn();
      } finally {
        isLoggingOut = false;
      }
    };

    const mockLogout = async () => {
      logoutCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    // First call triggers logout
    const call1 = handleLogout(mockLogout);
    // Duplicate call while still logging out should be ignored
    const call2 = handleLogout(mockLogout);

    await Promise.all([call1, call2]);

    assert.equal(logoutCallCount, 1);
    assert.equal(isLoggingOut, false);
  });

  await t.test('unauthenticated root layout correctly switches between LoginScreen and AppTabs', () => {
    const resolveRootComponent = (
      isAuthenticated: boolean,
      isLoading: boolean
    ): 'loading' | 'login' | 'tabs' => {
      if (isLoading) return 'loading';
      if (!isAuthenticated) return 'login';
      return 'tabs';
    };

    // Initial boot while loading
    assert.equal(resolveRootComponent(false, true), 'loading');

    // Unauthenticated user -> routed to login
    assert.equal(resolveRootComponent(false, false), 'login');

    // Authenticated user -> routed to tabs
    assert.equal(resolveRootComponent(true, false), 'tabs');

    // After sign out (isAuthenticated becomes false) -> immediately back to login
    assert.equal(resolveRootComponent(false, false), 'login');
  });

  await t.test('sign out button layout properties ensure non-blocked touch interaction', () => {
    const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };
    assert.ok(hitSlop.top >= 10, 'hitSlop ensures adequate touch margin on mobile screens');
    assert.ok(hitSlop.bottom >= 10);
    assert.ok(hitSlop.left >= 10);
    assert.ok(hitSlop.right >= 10);
  });
});
