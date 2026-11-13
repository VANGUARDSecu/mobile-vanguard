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

test('AuthService.getSavedGoogleAccounts has zero hardcoded accounts and only stores user Gmail', async () => {
  await AuthService.clearSavedGoogleAccounts();
  const initialAccounts = await AuthService.getSavedGoogleAccounts();
  assert.deepEqual(
    initialAccounts,
    [],
    'Must NEVER include any hardcoded Google accounts'
  );

  // Rejects non-Gmail manual entry
  await assert.rejects(
    async () => {
      await AuthService.signInWithGoogle({
        email: 'user@yahoo.com',
        name: 'Non Gmail User',
      });
    },
    /gmail/i
  );

  const user = await AuthService.signInWithGoogle({
    email: 'my.own.account@gmail.com',
    name: 'My Own Account',
    firstName: 'My',
    lastName: 'Account',
    accountType: 'individual',
  });

  assert.equal(user.email, 'my.own.account@gmail.com');
  assert.equal(user.name, 'My Own Account');
  assert.equal(user.user_metadata?.provider, 'google');

  const updatedAccounts = await AuthService.getSavedGoogleAccounts();
  assert.equal(updatedAccounts.length, 1);
  assert.equal(updatedAccounts[0].email, 'my.own.account@gmail.com');

  await AuthService.removeSavedGoogleAccount('my.own.account@gmail.com');
  const afterRemove = await AuthService.getSavedGoogleAccounts();
  assert.deepEqual(afterRemove, []);
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
