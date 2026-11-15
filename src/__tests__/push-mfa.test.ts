import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PushMfaService,
  PUSH_HARNESS_PRESETS,
} from '../services/push-mfa.service.ts';
import type { PushApprovalRequest } from '../models/push-mfa.models.ts';

test('Out-of-Band Push Notification MFA Approval UI (SCRUM-21)', async (t) => {
  let service: PushMfaService;

  const initService = () => {
    service = new PushMfaService();
  };

  await t.test('1. Triggers mock push challenge with rich contextual metadata', () => {
    initService();
    const req = service.triggerMockPush({
      appName: 'AWS Management Console',
      appIcon: '☁️',
      category: 'Cloud Infrastructure',
      ipAddress: '54.240.198.42',
      location: {
        city: 'San Francisco',
        region: 'CA',
        country: 'United States',
        flagEmoji: '🇺🇸',
      },
      device: 'Chrome 128 on macOS Sequoia',
      validitySeconds: 60,
    });

    assert.equal(req.id.startsWith('push-'), true);
    assert.equal(req.appName, 'AWS Management Console');
    assert.equal(req.category, 'Cloud Infrastructure');
    assert.equal(req.ipAddress, '54.240.198.42');
    assert.equal(req.location.city, 'San Francisco');
    assert.equal(req.location.country, 'United States');
    assert.equal(req.location.flagEmoji, '🇺🇸');
    assert.equal(req.device, 'Chrome 128 on macOS Sequoia');
    assert.equal(req.validitySeconds, 60);
    assert.equal(req.status, 'pending');

    const active = service.getActiveRequest();
    assert.equal(active?.id, req.id);
  });

  await t.test('2. Notifies reactive subscribers on request trigger and resolution', async () => {
    initService();
    const updates: (PushApprovalRequest | null)[] = [];
    const unsubscribe = service.subscribe((req) => {
      updates.push(req);
    });

    // Initial subscribe gives current (null)
    assert.equal(updates.length, 1);
    assert.equal(updates[0], null);

    // Trigger push
    const req = service.triggerMockPush({ appName: 'GitHub Enterprise' });
    assert.equal(updates.length, 2);
    assert.equal(updates[1]?.id, req.id);

    // Approve push
    await service.approveRequest(req.id, { biometricVerified: true });
    assert.equal(updates.length, 3);
    assert.equal(updates[2], null);

    unsubscribe();
  });

  await t.test('3. Pre-configured presets include AWS, VPN gateway, and fraud scenario', () => {
    initService();
    assert.equal(PUSH_HARNESS_PRESETS.length >= 4, true);

    const aws = PUSH_HARNESS_PRESETS.find((p) => p.id === 'preset-aws-console');
    assert.equal(Boolean(aws), true);
    assert.equal(aws?.badge, 'BIOMETRIC');

    const vpn = PUSH_HARNESS_PRESETS.find((p) => p.id === 'preset-vpn-gateway');
    assert.equal(Boolean(vpn), true);
    assert.equal(vpn?.badge, 'NUMBER MATCH');
    assert.equal(vpn?.request.numberMatchingChallenge?.enabled, true);
    assert.equal(vpn?.request.numberMatchingChallenge?.correctCode, 74);

    const suspicious = PUSH_HARNESS_PRESETS.find((p) => p.id === 'preset-suspicious-foreign');
    assert.equal(Boolean(suspicious), true);
    assert.equal(suspicious?.badge, 'SUSPICIOUS');

    // Triggering preset should populate service
    const triggered = service.triggerPreset('preset-vpn-gateway');
    assert.equal(triggered.appName, 'Corporate Zero-Trust Gateway');
    assert.equal(triggered.numberMatchingChallenge?.enabled, true);
    assert.equal(triggered.numberMatchingChallenge?.correctCode, 74);
  });

  await t.test('4. Approves standard biometric request and records in audit history', async () => {
    initService();
    const req = service.triggerMockPush({
      appName: 'Production Vault Portal',
      validitySeconds: 60,
    });

    const result = await service.approveRequest(req.id, { biometricVerified: true });
    assert.equal(result.success, true);
    assert.equal(result.action, 'approved');
    assert.equal(result.biometricVerified, true);

    // Active request should be cleared
    assert.equal(service.getActiveRequest(), null);

    // History should contain approved item
    const history = service.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].id, req.id);
    assert.equal(history[0].status, 'approved');
    assert.equal(Boolean(history[0].resolvedAt), true);
  });

  await t.test(
    '5. Number matching challenge verifies correct 2-digit code to prevent MFA fatigue',
    async () => {
      initService();
      const req = service.triggerMockPush({
        appName: 'Corporate VPN Gateway',
        numberMatchingChallenge: {
          enabled: true,
          correctCode: 74,
          options: [28, 74, 91],
        },
      });

      // 1. Attempt approval with wrong number
      const failResult = await service.approveRequest(req.id, {
        biometricVerified: true,
        selectedCode: 28,
      });
      assert.equal(failResult.success, false);
      assert.equal(failResult.numberMatched, false);
      assert.equal(failResult.error?.includes('Number mismatch'), true);

      // Request is still active and pending
      assert.equal(service.getActiveRequest()?.id, req.id);

      // 2. Attempt approval with missing code
      const missingResult = await service.approveRequest(req.id, {
        biometricVerified: true,
      });
      assert.equal(missingResult.success, false);
      assert.equal(missingResult.numberMatched, false);

      // 3. Attempt approval with correct code
      const successResult = await service.approveRequest(req.id, {
        biometricVerified: true,
        selectedCode: 74,
      });
      assert.equal(successResult.success, true);
      assert.equal(successResult.action, 'approved');
      assert.equal(successResult.numberMatched, true);
      assert.equal(service.getActiveRequest(), null);
    }
  );

  await t.test('6. Deny and report fraud flags request as security compromise', () => {
    initService();
    const req = service.triggerMockPush({
      appName: 'GitHub Enterprise',
      ipAddress: '185.220.101.5',
    });

    const result = service.denyRequest(req.id, true);
    assert.equal(result.success, true);
    assert.equal(result.action, 'fraud_reported');

    const history = service.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'fraud_reported');
    assert.equal(
      history[0].resolutionReason?.includes('Fraudulent Compromise'),
      true
    );
  });

  await t.test('7. Standard deny records refusal without fraud alert', () => {
    initService();
    const req = service.triggerMockPush({ appName: 'Intranet Portal' });

    const result = service.denyRequest(req.id, false);
    assert.equal(result.success, true);
    assert.equal(result.action, 'denied');

    const history = service.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'denied');
  });

  await t.test('8. Expiration window rejects timed-out requests', async () => {
    initService();
    // Create an already-expired request
    const expiredReq = service.triggerMockPush({
      appName: 'Stale Login Attempt',
      validitySeconds: -10, // in the past
    });

    const result = await service.approveRequest(expiredReq.id, {
      biometricVerified: true,
    });
    assert.equal(result.success, false);
    assert.equal(result.action, 'expired');

    const history = service.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'expired');
  });

  await t.test('9. Dismissal and history clearing', () => {
    initService();
    const req = service.triggerMockPush();
    assert.equal(Boolean(service.getActiveRequest()), true);

    service.dismissRequest(req.id);
    assert.equal(service.getActiveRequest(), null);
    assert.equal(service.getHistory().length, 0);

    service.triggerMockPush();
    service.denyRequest(service.getActiveRequest()!.id);
    assert.equal(service.getHistory().length, 1);

    service.clearHistory();
    assert.equal(service.getHistory().length, 0);
  });

  await t.test(
    '10. fetchPendingPush retrieves active backend challenge and notifies subscribers (SCRUM-85)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;
      const mockRequest: PushApprovalRequest = {
        id: 'push_mfa_test_backend_101',
        appName: 'Dummy Mobile App',
        appIcon: '📱',
        category: 'Mobile Client',
        ipAddress: '192.168.1.50',
        location: { city: 'Singapore', country: 'Singapore', flagEmoji: '🇸🇬' },
        device: 'iPhone 15 Pro on iOS 18',
        timestamp: new Date().toISOString(),
        validitySeconds: 60,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        numberMatchingChallenge: {
          enabled: true,
          correctCode: 42,
          options: [18, 42, 73],
        },
        status: 'pending',
      };

      let receivedUrl = '';
      globalThis.fetch = (async (url: string | URL | Request) => {
        receivedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({
            success: true,
            challenges: [mockRequest],
            activeRequest: mockRequest,
          }),
        } as any;
      }) as any;

      try {
        let notifiedReq: PushApprovalRequest | null = null;
        service.subscribe((req) => {
          notifiedReq = req;
        });

        const res = await service.fetchPendingPush('ellen.ripley@weyland.corp');
        assert.equal(res?.id, 'push_mfa_test_backend_101');
        assert.equal(res?.appName, 'Dummy Mobile App');
        assert.equal(res?.numberMatchingChallenge?.correctCode, 42);
        assert.equal((notifiedReq as any)?.id, 'push_mfa_test_backend_101');
        assert.equal(
          receivedUrl.includes('email=ellen.ripley%40weyland.corp'),
          true
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '11. syncPreference transmits user opt-in status to backend (SCRUM-85)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;
      let postedBody: any = null;

      globalThis.fetch = (async (
        url: string | URL | Request,
        init?: RequestInit
      ) => {
        if (init?.body) {
          postedBody = JSON.parse(init.body as string);
        }
        return { ok: true } as any;
      }) as any;

      try {
        const ok = await service.syncPreference('user@example.com', true);
        assert.equal(ok, true);
        assert.equal(postedBody?.email, 'user@example.com');
        assert.equal(postedBody?.enabled, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '12. approveRequest and denyRequest dispatch live responses to backend (SCRUM-85)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;
      const dispatchedCalls: any[] = [];

      globalThis.fetch = (async (
        url: string | URL | Request,
        init?: RequestInit
      ) => {
        if (init?.body) {
          dispatchedCalls.push(JSON.parse(init.body as string));
        }
        return { ok: true } as any;
      }) as any;

      try {
        // Simulate active live challenge
        const mockChallenge: PushApprovalRequest = {
          id: 'push_mfa_live_challenge_999',
          appName: 'Acme Dummy Web',
          appIcon: '🌐',
          category: 'Enterprise Web Application',
          ipAddress: '127.0.0.1',
          location: { city: 'Local', country: 'Dev', flagEmoji: '🛡️' },
          device: 'Chrome on macOS',
          timestamp: new Date().toISOString(),
          validitySeconds: 60,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          numberMatchingChallenge: {
            enabled: true,
            options: [31, 88, 92],
          },
          status: 'pending',
        };

        (service as any).activeRequest = mockChallenge;

        // 1. Approve
        const approveRes = await service.approveRequest(
          'push_mfa_live_challenge_999',
          {
            selectedCode: 88,
            biometricVerified: true,
          }
        );
        assert.equal(approveRes.success, true);
        assert.equal(dispatchedCalls.length, 1);
        assert.equal(
          dispatchedCalls[0].challengeId,
          'push_mfa_live_challenge_999'
        );
        assert.equal(dispatchedCalls[0].action, 'approved');
        assert.equal(dispatchedCalls[0].selectedCode, 88);

        // 2. Deny with fraud
        const mockFraudChallenge: PushApprovalRequest = {
          ...mockChallenge,
          id: 'push_mfa_fraud_challenge_123',
        };
        (service as any).activeRequest = mockFraudChallenge;

        const denyRes = service.denyRequest(
          'push_mfa_fraud_challenge_123',
          true
        );
        assert.equal(denyRes.success, true);
        await new Promise((resolve) => setTimeout(resolve, 15));
        assert.equal(dispatchedCalls.length, 2);
        assert.equal(
          dispatchedCalls[1].challengeId,
          'push_mfa_fraud_challenge_123'
        );
        assert.equal(dispatchedCalls[1].action, 'fraud_reported');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '14. A live approval the backend rejects is not recorded as approved (SCRUM-135 number matching)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        return {
          ok: false,
          status: 400,
          json: async () => ({
            statusCode: 400,
            message: 'Number mismatch. Please select the correct 2-digit number shown on screen.',
          }),
        } as any;
      }) as any;

      try {
        const liveChallenge: PushApprovalRequest = {
          id: 'push_mfa_live_reject_1',
          appName: 'Acme Dummy Web',
          appIcon: '🌐',
          category: 'Enterprise Web Application',
          ipAddress: '127.0.0.1',
          location: { city: 'Local', country: 'Dev', flagEmoji: '🛡️' },
          device: 'Chrome on Windows',
          timestamp: new Date().toISOString(),
          validitySeconds: 60,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          numberMatchingChallenge: { enabled: true, options: [20, 47, 75] },
          status: 'pending',
        };
        (service as any).activeRequest = liveChallenge;

        // The app no longer compares locally: a wrong pick must reach the backend.
        const result = await service.approveRequest(liveChallenge.id, {
          biometricVerified: true,
          selectedCode: 47,
        });
        assert.equal(calls, 1);
        assert.equal(result.success, false);
        assert.match(result.error ?? '', /Number mismatch/);
        // The request stays on screen so the user can retry, and nothing is recorded as approved.
        assert.equal(service.getActiveRequest()?.id, liveChallenge.id);
        assert.equal(service.getHistory().length, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '13. startPolling and stopPolling manage lifecycle without leaks (SCRUM-85)',
    async () => {
      initService();
      let pollCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        pollCount++;
        return {
          ok: true,
          json: async () => ({ activeRequest: null }),
        } as any;
      }) as any;

      try {
        service.startPolling('test@vanguard.security', 5000);
        assert.equal(Boolean((service as any).pollInterval), true);
        await new Promise((resolve) => setTimeout(resolve, 15));
        assert.equal(pollCount, 1); // Immediate fetch

        service.stopPolling();
        assert.equal((service as any).pollInterval, null);
      } finally {
        service.stopPolling();
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '14. pairDevice, listPairedDevices, triggerDeviceTestPush, and unlinkPairedDevice call real backend endpoints (SCRUM-183)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;
      const calls: { url: string; method: string; body?: any }[] = [];

      globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        const method = options?.method || 'GET';
        const body = options?.body ? JSON.parse(options.body as string) : undefined;
        calls.push({ url: urlStr, method, body });

        if (urlStr.includes('/oauth/devices/pair')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              pairedEmail: 'emp@company.com',
              device: { id: 'dev-mob-1', name: 'Pixel 9', pairingKey: body.pairingKey },
            }),
          } as any;
        }
        if (urlStr.endsWith('/oauth/mfa/push/test')) {
          return {
            ok: true,
            json: async () => ({ success: true, challengeId: 'push_test_99' }),
          } as any;
        }
        if (urlStr.includes('/oauth/devices/dev-mob-1')) {
          return { ok: true, json: async () => ({ success: true }) } as any;
        }
        if (urlStr.includes('/oauth/devices?')) {
          return {
            ok: true,
            json: async () => ({ success: true, devices: [{ id: 'dev-mob-1', name: 'Pixel 9' }] }),
          } as any;
        }
        return { ok: false, json: async () => ({}) } as any;
      }) as any;

      try {
        const pairRes = await service.pairDevice({
          pairingKey: 'VG-1111-2222',
          deviceName: 'Pixel 9',
          email: 'emp@company.com',
        });
        assert.equal(pairRes.success, true);
        assert.equal(pairRes.device?.id, 'dev-mob-1');

        const listRes = await service.listPairedDevices('emp@company.com');
        assert.equal(listRes.ok, true);
        assert.equal(listRes.devices.length, 1);

        const pushRes = await service.triggerDeviceTestPush({
          email: 'emp@company.com',
          deviceId: 'dev-mob-1',
        });
        assert.equal(pushRes.success, true);
        assert.equal(pushRes.challengeId, 'push_test_99');

        const unlinkRes = await service.unlinkPairedDevice('dev-mob-1', 'emp@company.com');
        assert.equal(unlinkRes, true);
        assert.equal(calls.length, 4);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await t.test(
    '16. approveRequest forwards redirectUrl and awaitingAdminApproval from live push respond API (SCRUM-205)',
    async () => {
      initService();
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async () => {
        return {
          ok: true,
          json: async () => ({
            success: true,
            action: 'approved',
            awaitingAdminApproval: false,
            code: 'vg_code_mob_205',
            redirectUrl: 'exp://192.168.1.25:8081/--/oauth/callback?code=vg_code_mob_205&state=st_205',
          }),
        } as any;
      }) as any;

      try {
        (service as any).activeRequest = {
          id: 'push_mfa_mob_205',
          appName: 'Dummy Mobile App',
          appIcon: '📱',
          category: 'Mobile App',
          ipAddress: '127.0.0.1',
          location: { city: 'Local', country: 'Dev', flagEmoji: '🛡️' },
          device: 'Expo Go on Android',
          timestamp: new Date().toISOString(),
          validitySeconds: 60,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          numberMatchingChallenge: { enabled: true, options: [12, 45, 78] },
          status: 'pending',
        };

        const approveRes = await service.approveRequest('push_mfa_mob_205', {
          selectedCode: 45,
          biometricVerified: true,
        });

        assert.equal(approveRes.success, true);
        assert.equal(
          approveRes.redirectUrl,
          'exp://192.168.1.25:8081/--/oauth/callback?code=vg_code_mob_205&state=st_205'
        );
        assert.equal(approveRes.awaitingAdminApproval, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
