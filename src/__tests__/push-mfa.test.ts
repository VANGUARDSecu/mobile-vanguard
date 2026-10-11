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

  await t.test('2. Notifies reactive subscribers on request trigger and resolution', () => {
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
    service.approveRequest(req.id, { biometricVerified: true });
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

  await t.test('4. Approves standard biometric request and records in audit history', () => {
    initService();
    const req = service.triggerMockPush({
      appName: 'Production Vault Portal',
      validitySeconds: 60,
    });

    const result = service.approveRequest(req.id, { biometricVerified: true });
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
    () => {
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
      const failResult = service.approveRequest(req.id, {
        biometricVerified: true,
        selectedCode: 28,
      });
      assert.equal(failResult.success, false);
      assert.equal(failResult.numberMatched, false);
      assert.equal(failResult.error?.includes('Number mismatch'), true);

      // Request is still active and pending
      assert.equal(service.getActiveRequest()?.id, req.id);

      // 2. Attempt approval with missing code
      const missingResult = service.approveRequest(req.id, {
        biometricVerified: true,
      });
      assert.equal(missingResult.success, false);
      assert.equal(missingResult.numberMatched, false);

      // 3. Attempt approval with correct code
      const successResult = service.approveRequest(req.id, {
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

  await t.test('8. Expiration window rejects timed-out requests', () => {
    initService();
    // Create an already-expired request
    const expiredReq = service.triggerMockPush({
      appName: 'Stale Login Attempt',
      validitySeconds: -10, // in the past
    });

    const result = service.approveRequest(expiredReq.id, {
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
});
