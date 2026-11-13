import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAuthRedirectPath,
  getAuthenticatorBackScreen,
} from '../utils/navigation-guard.ts';
import { parseDevicePairingQrPayload } from '../services/qr-payload.service.ts';
import {
  REGISTRATION_PAGES,
  validateRegistrationPage,
  getNextRegistrationPage,
  getPrevRegistrationPage,
  evaluatePasswordRules,
  parseGoogleOAuthCallbackUrl,
} from '../utils/registration-wizard.ts';
import { AuthService } from '../services/auth.service.ts';
import { AppsStorageService } from '../services/apps-storage.service.ts';

test('resolveAuthRedirectPath redirects unauthenticated users away from protected routes', () => {
  assert.equal(resolveAuthRedirectPath(false, '/'), '/login');
  assert.equal(resolveAuthRedirectPath(false, '/vault'), '/login');
  assert.equal(resolveAuthRedirectPath(false, '/devices'), '/login');
  assert.equal(resolveAuthRedirectPath(false, '/explore'), '/login');
  assert.equal(resolveAuthRedirectPath(false, ''), '/login');
});

test('resolveAuthRedirectPath allows unauthenticated users on auth routes', () => {
  assert.equal(resolveAuthRedirectPath(false, '/login'), null);
  assert.equal(resolveAuthRedirectPath(false, '/register'), null);
  assert.equal(resolveAuthRedirectPath(false, '/verify-otp'), null);
});

test('resolveAuthRedirectPath redirects authenticated users away from auth routes', () => {
  assert.equal(resolveAuthRedirectPath(true, '/login'), '/');
  assert.equal(resolveAuthRedirectPath(true, '/register'), '/');
  assert.equal(resolveAuthRedirectPath(true, '/verify-otp'), '/');
  assert.equal(resolveAuthRedirectPath(true, '/'), null);
  assert.equal(resolveAuthRedirectPath(true, '/vault'), null);
  assert.equal(resolveAuthRedirectPath(true, '/devices'), null);
  assert.equal(resolveAuthRedirectPath(true, '/explore'), null);
});

test('getAuthenticatorBackScreen maps nested screens back deterministically', () => {
  assert.equal(getAuthenticatorBackScreen('push-harness'), 'security-settings');
  assert.equal(getAuthenticatorBackScreen('add-account'), 'vault');
  assert.equal(getAuthenticatorBackScreen('account-detail'), 'vault');
  assert.equal(getAuthenticatorBackScreen('security-settings'), 'vault');
  assert.equal(getAuthenticatorBackScreen('vault'), null);
});

test('parseDevicePairingQrPayload parses Vanguard dashboard JSON QR payload', () => {
  const payload = JSON.stringify({
    pairingKey: 'vg-4821-9932',
    pairingToken: 'vg_mob_pair_123456',
    email: 'analyst@vanguard.security',
    issuer: 'Vanguard IAM',
  });

  const parsed = parseDevicePairingQrPayload(payload);
  assert.equal(parsed.pairingKey, 'VG-4821-9932');
  assert.equal(parsed.pairingToken, 'vg_mob_pair_123456');
  assert.equal(parsed.email, 'analyst@vanguard.security');
  assert.equal(parsed.issuer, 'Vanguard IAM');
});

test('parseDevicePairingQrPayload parses direct key and vanguard-enroll deep link', () => {
  const direct = parseDevicePairingQrPayload('  vg-ab12-cd34  ');
  assert.equal(direct.pairingKey, 'VG-AB12-CD34');

  const url = parseDevicePairingQrPayload(
    'vanguard-enroll://pair?key=vg-9988-7766&token=tok_123&email=user%40corp.io'
  );
  assert.equal(url.pairingKey, 'VG-9988-7766');
  assert.equal(url.pairingToken, 'tok_123');
  assert.equal(url.email, 'user@corp.io');
});

test('parseDevicePairingQrPayload rejects empty, otpauth, or malformed payloads', () => {
  assert.throws(() => parseDevicePairingQrPayload(''), /empty/i);
  assert.throws(
    () => parseDevicePairingQrPayload('otpauth://totp/Issuer:user?secret=JBSWY3DPEHPK3PXP'),
    /authenticator/i
  );
  assert.throws(() => parseDevicePairingQrPayload('{"foo":"bar"}'), /invalid/i);
  assert.throws(() => parseDevicePairingQrPayload('not-a-valid-key'), /invalid/i);
});

test('multi-page registration wizard validates each page and navigates deterministically', () => {
  assert.deepEqual(
    REGISTRATION_PAGES.map((p) => p.key),
    ['identity', 'contact', 'security']
  );

  assert.equal(getPrevRegistrationPage('identity'), null);
  assert.equal(getNextRegistrationPage('identity'), 'contact');
  assert.equal(getPrevRegistrationPage('contact'), 'identity');
  assert.equal(getNextRegistrationPage('contact'), 'security');
  assert.equal(getPrevRegistrationPage('security'), 'contact');
  assert.equal(getNextRegistrationPage('security'), null);

  // Page 1: identity validation
  assert.match(
    validateRegistrationPage('identity', {
      accountType: 'individual',
      firstName: '',
      lastName: 'Doe',
      companyName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    }) || '',
    /first name/i
  );

  assert.match(
    validateRegistrationPage('identity', {
      accountType: 'company',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    }) || '',
    /company/i
  );

  assert.equal(
    validateRegistrationPage('identity', {
      accountType: 'company',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Acme Corp',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    }),
    null
  );

  // Page 2: contact validation
  assert.match(
    validateRegistrationPage('contact', {
      accountType: 'company',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Acme Corp',
      email: 'jane@acme.corp',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    }) || '',
    /phone/i
  );

  assert.equal(
    validateRegistrationPage('contact', {
      accountType: 'individual',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: '',
      email: 'jane@example.com',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    }),
    null
  );

  // Page 3: security validation
  const rules = evaluatePasswordRules('StrongPass1!');
  assert.equal(rules.allMet, true);

  assert.match(
    validateRegistrationPage('security', {
      accountType: 'individual',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: '',
      email: 'jane@example.com',
      phone: '',
      password: 'Password1!',
      confirmPassword: 'MismatchPassword1!',
      agreeTerms: true,
    }) || '',
    /match/i
  );

  assert.equal(
    validateRegistrationPage('security', {
      accountType: 'individual',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: '',
      email: 'jane@example.com',
      phone: '',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      agreeTerms: true,
    }),
    null
  );
});

test('AuthService.signInWithGoogle strictly requires a verified OAuth token with zero bypass', async () => {
  // Rejects any attempt without a real OAuth access_token (no manual email bypass)
  await assert.rejects(
    async () => {
      await AuthService.signInWithGoogle({
        email: 'my.own.account@gmail.com',
        name: 'My Own Account',
      });
    },
    /OAuth session token is required/i
  );

  const payloadObj = {
    sub: 'google-sub-999',
    email: 'verified.oauth@gmail.com',
    user_metadata: {
      full_name: 'Verified OAuth User',
      given_name: 'Verified',
      family_name: 'User',
      picture: 'https://example.com/pic.png',
    },
  };
  const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const validOAuthJwt = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.sig`;
  const parsedCallback = parseGoogleOAuthCallbackUrl(
    `mobilevanguard://login#access_token=${validOAuthJwt}&refresh_token=ref_999`
  );
  assert.ok(parsedCallback);

  const result = await AuthService.signInWithGoogle(parsedCallback!);
  assert.equal(result.requireMfa, true);
  if (result.requireMfa) {
    assert.equal(result.mfaChallenge.email, 'verified.oauth@gmail.com');
  }
  await AuthService.logout();
});

test('parseGoogleOAuthCallbackUrl extracts JWT user claims from OAuth redirect hash', () => {
  const payloadObj = {
    sub: 'google-sub-123',
    email: 'oauth.user@gmail.com',
    user_metadata: {
      full_name: 'OAuth User',
      given_name: 'OAuth',
      family_name: 'User',
      picture: 'https://example.com/avatar.png',
    },
  };
  const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.sig`;
  const redirectUrl = `mobilevanguard://login#access_token=${fakeJwt}&refresh_token=ref_123&token_type=bearer`;

  const extracted = parseGoogleOAuthCallbackUrl(redirectUrl);
  assert.ok(extracted);
  assert.equal(extracted?.email, 'oauth.user@gmail.com');
  assert.equal(extracted?.name, 'OAuth User');
  assert.equal(extracted?.firstName, 'OAuth');
  assert.equal(extracted?.lastName, 'User');
  assert.equal(extracted?.accessToken, fakeJwt);
});

test('AppsStorageService.getBackendApiUrl avoids dead Render placeholder and resolves active backend', () => {
  const prev = process.env.EXPO_PUBLIC_API_URL;
  try {
    delete process.env.EXPO_PUBLIC_API_URL;
    assert.equal(AppsStorageService.getBackendApiUrl(), 'http://127.0.0.1:3000');

    process.env.EXPO_PUBLIC_API_URL = 'https://backend-vanguard.onrender.com/';
    assert.equal(AppsStorageService.getBackendApiUrl(), 'http://127.0.0.1:3000');

    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/';
    assert.equal(AppsStorageService.getBackendApiUrl(), 'http://localhost:3000');
  } finally {
    if (prev === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = prev;
    }
  }
});

test('AppsStorageService resolves primary and secondary Supabase keys from .env and builds Google OAuth URL', async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_KEY;
  const prevSecUrl = process.env.SUPABASE_URL_SECOND;
  const prevSecKey = process.env.SUPABASE_KEY_SECOND;

  try {
    process.env.SUPABASE_URL = 'https://jvvidkrwrqhlshnpufdd.supabase.co/';
    process.env.SUPABASE_KEY = 'sb_publishable_M44OcaVK3zxBqdy1Sj4SzQ_0FHQCzU5';
    process.env.SUPABASE_URL_SECOND = 'https://pqerfqomwujdyrfbnmer.supabase.co/';
    process.env.SUPABASE_KEY_SECOND = 'sb_publishable_Q70rh6zz4fgr81rguy-dvw_q5iZFnxU';

    assert.equal(
      AppsStorageService.getSupabaseUrl(),
      'https://jvvidkrwrqhlshnpufdd.supabase.co'
    );
    assert.equal(
      AppsStorageService.getSupabasePublishableKey(),
      'sb_publishable_M44OcaVK3zxBqdy1Sj4SzQ_0FHQCzU5'
    );
    assert.equal(
      AppsStorageService.getSecondarySupabaseUrl(),
      'https://pqerfqomwujdyrfbnmer.supabase.co'
    );
    assert.equal(
      AppsStorageService.getSecondarySupabasePublishableKey(),
      'sb_publishable_Q70rh6zz4fgr81rguy-dvw_q5iZFnxU'
    );

    const oauthUrl = await AuthService.getGoogleOAuthUrl('mobilevanguard://login');
    assert.ok(
      oauthUrl.startsWith('https://jvvidkrwrqhlshnpufdd.supabase.co/auth/v1/authorize')
    );
    assert.ok(oauthUrl.includes('provider=google'));
    assert.ok(oauthUrl.includes('redirect_to=mobilevanguard%3A%2F%2Flogin'));
    assert.ok(oauthUrl.includes('prompt=select_account'));
  } finally {
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = prevKey;
    if (prevSecUrl === undefined) delete process.env.SUPABASE_URL_SECOND;
    else process.env.SUPABASE_URL_SECOND = prevSecUrl;
    if (prevSecKey === undefined) delete process.env.SUPABASE_KEY_SECOND;
    else process.env.SUPABASE_KEY_SECOND = prevSecKey;
  }
});
