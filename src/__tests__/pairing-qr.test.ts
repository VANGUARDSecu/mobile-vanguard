import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDevicePairingQrPayload } from '../utils/pairing-qr.ts';
import pushMfaService from '../services/push-mfa.service.ts';

describe('Vanguard Mobile Integration Pairing QR Parser (SCRUM-185)', () => {
  it('parses Vanguard JSON pairing payload emitted by frontend-vanguard Mobile Integration modal', () => {
    const raw = JSON.stringify({
      pairingKey: 'vg-4821-9932',
      pairingToken: 'tok_9f8e7d6c5b4a3210',
      email: 'SecurityUser@Vanguard.IO',
      issuer: 'Vanguard IAM',
    });

    const parsed = parseDevicePairingQrPayload(raw);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.pairingKey, 'VG-4821-9932');
    assert.equal(parsed.pairingToken, 'tok_9f8e7d6c5b4a3210');
    assert.equal(parsed.email, 'securityuser@vanguard.io');
    assert.equal(parsed.issuer, 'Vanguard IAM');
  });

  it('parses pairingToken-only JSON payload when pairingKey is omitted', () => {
    const raw = JSON.stringify({
      pairingToken: 'tok_only_abc123456',
      email: 'user@acme.com',
    });

    const parsed = parseDevicePairingQrPayload(raw);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.pairingKey, undefined);
    assert.equal(parsed.pairingToken, 'tok_only_abc123456');
  });

  it('parses vanguard-enroll:// deep-link URI query parameters', () => {
    const parsed = parseDevicePairingQrPayload(
      'vanguard-enroll://pair?pairingKey=vg-1122-3344&pairingToken=tok_dl_987654&email=dev@vanguard.security&issuer=Vanguard',
    );

    assert.equal(parsed.valid, true);
    assert.equal(parsed.pairingKey, 'VG-1122-3344');
    assert.equal(parsed.pairingToken, 'tok_dl_987654');
    assert.equal(parsed.email, 'dev@vanguard.security');
    assert.equal(parsed.issuer, 'Vanguard');
  });

  it('parses direct VG-XXXX-XXXX key or raw pairing token strings', () => {
    const directKey = parseDevicePairingQrPayload('vg-ab12-cd34');
    assert.equal(directKey.valid, true);
    assert.equal(directKey.pairingKey, 'VG-AB12-CD34');

    const rawToken = parseDevicePairingQrPayload('pair_token_abcdef123456');
    assert.equal(rawToken.valid, true);
    assert.equal(rawToken.pairingToken, 'pair_token_abcdef123456');
  });

  it('rejects otpauth:// 2FA QR codes with actionable guidance', () => {
    const otpResult = parseDevicePairingQrPayload(
      'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
    );
    assert.equal(otpResult.valid, false);
    assert.match(otpResult.error ?? '', /2FA Authenticator QR code/i);
  });

  it('rejects empty, malformed JSON, and missing-key payloads cleanly', () => {
    assert.equal(parseDevicePairingQrPayload('   ').valid, false);
    assert.equal(parseDevicePairingQrPayload('{broken-json').valid, false);
    assert.equal(parseDevicePairingQrPayload(JSON.stringify({ issuer: 'Vanguard' })).valid, false);
    assert.equal(parseDevicePairingQrPayload('hello world invalid').valid, false);
  });

  it('attaches Bearer token on PushMfaService.pairDevice and handles 401/403 account mismatches (SCRUM-180)', async () => {
    const originalFetch = globalThis.fetch;
    let capturedAuthHeader: string | undefined;

    globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
      const headers = (options?.headers || {}) as Record<string, string>;
      capturedAuthHeader = headers['Authorization'];
      return {
        ok: false,
        status: 403,
        json: async () => ({
          message: 'This pairing key belongs to a different Vanguard account.',
        }),
      } as any;
    }) as any;

    try {
      const res = await pushMfaService.pairDevice({
        pairingKey: 'VG-1234-5678',
        email: 'bob@corp.com',
        accessToken: 'jwt-bob-123',
      });
      assert.equal(capturedAuthHeader, 'Bearer jwt-bob-123');
      assert.equal(res.success, false);
      assert.match(res.error ?? '', /different Vanguard account/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
