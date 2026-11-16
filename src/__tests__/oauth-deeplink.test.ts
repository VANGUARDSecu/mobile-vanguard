import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOAuthErrorRedirect,
  buildWebPortalAuthorizeUrl,
  isCustomMobileSsoCallbackUrl,
  isPushChallengeDeepLink,
  parseOAuthAuthorizeDeepLink,
} from '../utils/oauth-deeplink.ts';
import { AuthService } from '../services/auth.service.ts';

test('OAuth Deep-Link Handoff Utilities & Approval (SCRUM-188)', async (t) => {
  await t.test('parses valid vanguard-auth://oauth/authorize deep links with PKCE params', () => {
    const deepLink =
      'vanguard-auth://oauth/authorize?client_id=vanguard-dummy-mobile&client_name=StockPulse%20Inventory%20(Mobile)&redirect_uri=vanguard-dummy%3A%2F%2Foauth%2Fcallback&response_type=code&scope=openid%20profile%20email&state=st_123&nonce=nc_456&code_challenge=ch_789&code_challenge_method=S256';

    const parsed = parseOAuthAuthorizeDeepLink(deepLink);
    assert.ok(parsed);
    assert.equal(parsed.client_id, 'vanguard-dummy-mobile');
    assert.equal(parsed.client_name, 'StockPulse Inventory (Mobile)');
    assert.equal(parsed.redirect_uri, 'vanguard-dummy://oauth/callback');
    assert.equal(parsed.response_type, 'code');
    assert.equal(parsed.scope, 'openid profile email');
    assert.equal(parsed.state, 'st_123');
    assert.equal(parsed.nonce, 'nc_456');
    assert.equal(parsed.code_challenge, 'ch_789');
    assert.equal(parsed.code_challenge_method, 'S256');
  });

  await t.test('rejects invalid routes, missing parameters, or unsafe redirect URIs', () => {
    assert.equal(parseOAuthAuthorizeDeepLink(''), null);
    assert.equal(parseOAuthAuthorizeDeepLink('vanguard-auth://devices/pair?token=abc'), null);
    assert.equal(parseOAuthAuthorizeDeepLink('vanguard-auth://oauth/authorize?client_id=abc'), null);
    assert.equal(
      parseOAuthAuthorizeDeepLink(
        'vanguard-auth://oauth/authorize?client_id=abc&redirect_uri=javascript%3Aalert(1)',
      ),
      null,
    );
  });

  await t.test('builds RFC 6749 error redirects and deployed web portal fallback URLs', () => {
    const deniedUrl = buildOAuthErrorRedirect(
      'vanguard-dummy://oauth/callback',
      'access_denied',
      'User denied SSO request',
      'st_abc',
    );
    const parsedDenied = new URL(deniedUrl);
    assert.equal(parsedDenied.searchParams.get('error'), 'access_denied');
    assert.equal(parsedDenied.searchParams.get('error_description'), 'User denied SSO request');
    assert.equal(parsedDenied.searchParams.get('state'), 'st_abc');

    const portalUrl = buildWebPortalAuthorizeUrl({
      client_id: 'vanguard-dummy-mobile',
      client_name: 'StockPulse Inventory (Mobile)',
      redirect_uri: 'vanguard-dummy://oauth/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'st_portal',
      code_challenge: 'pkce_chal',
      code_challenge_method: 'S256',
    });
    assert.ok(portalUrl.startsWith('https://vanguard-security.pages.dev/login?'));
    assert.ok(portalUrl.includes('client_id=vanguard-dummy-mobile'));
    assert.ok(portalUrl.includes('code_challenge=pkce_chal'));
  });

  await t.test('approves OAuth deep-link request via POST /oauth/approve with Bearer token', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedAuth = '';
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedAuth = headers.Authorization ?? '';
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 'auth_code_999',
          redirectUrl: 'vanguard-dummy://oauth/callback?code=auth_code_999&state=st_ok',
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await AuthService.approveOAuthAuthorization(
        {
          client_id: 'vanguard-dummy-mobile',
          client_name: 'StockPulse Inventory (Mobile)',
          redirect_uri: 'vanguard-dummy://oauth/callback',
          response_type: 'code',
          scope: 'openid profile email',
          state: 'st_ok',
          code_challenge: 'chal_1',
          code_challenge_method: 'S256',
        },
        {
          token: 'vanguard_jwt_123',
          user: {
            id: 'usr_1',
            email: 'operator@stockpulse.io',
            name: 'Warehouse Operator',
            role: 'user',
            department: 'Fulfillment',
          },
          backendUrl: 'https://backend-vanguard.onrender.com',
        },
      );

      assert.equal(capturedUrl, 'https://backend-vanguard.onrender.com/oauth/approve');
      assert.equal(capturedAuth, 'Bearer vanguard_jwt_123');
      assert.equal(capturedBody.client_id, 'vanguard-dummy-mobile');
      assert.equal(capturedBody.email, 'operator@stockpulse.io');
      assert.equal(result.code, 'auth_code_999');
      assert.equal(result.redirectUrl, 'vanguard-dummy://oauth/callback?code=auth_code_999&state=st_ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('SCRUM-207: validates mobile callback schemes, push challenge deep links & global layout push wiring', () => {
    assert.equal(
      isCustomMobileSsoCallbackUrl('vanguard-dummy://oauth/callback?code=abc'),
      true,
    );
    assert.equal(
      isCustomMobileSsoCallbackUrl('exp://192.168.1.25:8081/--/oauth/callback?code=abc'),
      true,
    );
    assert.equal(isCustomMobileSsoCallbackUrl('https://acme.example.com/callback'), false);
    assert.equal(isCustomMobileSsoCallbackUrl(undefined), false);

    assert.equal(isPushChallengeDeepLink('vanguard-auth://mfa/challenge?id=123'), true);
    assert.equal(isPushChallengeDeepLink('vanguard-auth://devices/pair'), false);
    assert.equal(isPushChallengeDeepLink(null), false);

    const layoutPath = path.resolve(import.meta.dirname ?? '.', '../app/_layout.tsx');
    const vaultRoutePath = path.resolve(import.meta.dirname ?? '.', '../app/vault.tsx');
    const layoutSource = fs.readFileSync(layoutPath, 'utf8');
    const vaultSource = fs.readFileSync(vaultRoutePath, 'utf8');

    assert.ok(
      layoutSource.includes('PushApprovalModal') && layoutSource.includes('pushMfaService.startPolling'),
      'RootNavigator in _layout.tsx must mount global PushApprovalModal and background push polling across all tabs',
    );
    assert.ok(
      vaultSource.includes('enableLivePushPolling={false}'),
      'VaultRoute must disable duplicate live push polling inside AuthenticatorNavigator',
    );
  });
});
