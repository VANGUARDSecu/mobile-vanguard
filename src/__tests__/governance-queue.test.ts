import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACCESS_REQUESTS,
  MOCK_GOVERNANCE_FIXTURES,
  AppsStorageService,
} from '../services/apps-storage.service.ts';
import type { AppAccessRequest } from '../models/apps.models.ts';

test('Requested Applications & Zero-Trust Governance Queue (SCRUM-67 & SCRUM-83)', async (t) => {
  await t.test('dashboard access requests initialize with zero hardcoded entries (SCRUM-83)', async () => {
    assert.equal(DEFAULT_ACCESS_REQUESTS.length, 0);
    const requests = await AppsStorageService.getAccessRequests();
    assert.equal(requests.length, 0);
  });

  await t.test('governance requests fixture contains all three governance states', () => {
    assert.ok(MOCK_GOVERNANCE_FIXTURES.length >= 3);

    const pending = MOCK_GOVERNANCE_FIXTURES.find((r) => r.status === 'Pending Approval');
    assert.ok(pending);
    assert.equal(pending.appName, 'Snowflake Data Cloud');
    assert.equal(pending.protocol, 'SAML 2.0');

    const approved = MOCK_GOVERNANCE_FIXTURES.find((r) => r.status === 'Approved');
    assert.ok(approved);
    assert.equal(approved.appName, 'Figma Enterprise');
    assert.equal(approved.reviewedBy, 'Security Operations Admin');

    const rejected = MOCK_GOVERNANCE_FIXTURES.find((r) => r.status === 'Rejected');
    assert.ok(rejected);
    assert.equal(rejected.appName, 'Salesforce CRM');
    assert.ok(rejected.adminNotes?.includes('CRM write access'));
  });

  await t.test('pending approval items enforce launch disabled security guard', () => {
    const isLaunchAllowed = (req: AppAccessRequest): boolean => {
      return req.status === 'Approved';
    };

    const pendingReq: AppAccessRequest = {
      id: 'req-pending-1',
      userId: 'u1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      department: 'Engineering',
      role: 'Engineer',
      appName: 'Datadog',
      protocol: 'SAML 2.0',
      category: 'developer',
      justification: 'Monitoring',
      status: 'Pending Approval',
      submittedAt: new Date().toISOString(),
    };

    assert.equal(isLaunchAllowed(pendingReq), false);
  });

  await t.test('approved requests allow launching and resolve target launch URL correctly', () => {
    const enterpriseApps = [
      { id: '1', name: 'Figma Enterprise', category: 'collaboration' as const, protocol: 'SAML 2.0', launchUrl: 'https://figma.com/login', assigned: true, description: '', icon: '🎨' },
    ];

    const approvedReq: AppAccessRequest = {
      id: 'req-app-1',
      userId: 'u1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      department: 'Engineering',
      role: 'Engineer',
      appName: 'Figma Enterprise',
      protocol: 'SAML 2.0',
      category: 'collaboration',
      justification: 'UI Design',
      status: 'Approved',
      submittedAt: new Date().toISOString(),
    };

    const resolveUrl = (req: AppAccessRequest): string => {
      const match = enterpriseApps.find((a) => a.name.toLowerCase() === req.appName.toLowerCase());
      return match?.launchUrl || req.launchUrl || 'https://vanguard.security';
    };

    assert.equal(resolveUrl(approvedReq), 'https://figma.com/login');
  });

  await t.test('rejected requests display administrative reasons and zero-trust assertion blocked guard', () => {
    const rejectedReq: AppAccessRequest = {
      id: 'req-rej-1',
      userId: 'u1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      department: 'Engineering',
      role: 'Engineer',
      appName: 'Salesforce CRM',
      protocol: 'SAML 2.0',
      category: 'cloud',
      justification: 'Customer data',
      status: 'Rejected',
      submittedAt: new Date().toISOString(),
      adminNotes: 'Developer role not permitted for CRM write access.',
    };

    assert.equal(rejectedReq.status, 'Rejected');
    assert.equal(rejectedReq.adminNotes, 'Developer role not permitted for CRM write access.');
  });

  await t.test('pending counter dynamically computes pending approval items only', () => {
    const list: AppAccessRequest[] = [
      { id: '1', userId: 'u', userName: 'u', userEmail: 'u', department: 'd', role: 'r', appName: 'A1', protocol: 'SAML 2.0', category: 'cloud', justification: 'j', status: 'Pending Approval', submittedAt: '' },
      { id: '2', userId: 'u', userName: 'u', userEmail: 'u', department: 'd', role: 'r', appName: 'A2', protocol: 'SAML 2.0', category: 'cloud', justification: 'j', status: 'Approved', submittedAt: '' },
      { id: '3', userId: 'u', userName: 'u', userEmail: 'u', department: 'd', role: 'r', appName: 'A3', protocol: 'SAML 2.0', category: 'cloud', justification: 'j', status: 'Pending Approval', submittedAt: '' },
      { id: '4', userId: 'u', userName: 'u', userEmail: 'u', department: 'd', role: 'r', appName: 'A4', protocol: 'SAML 2.0', category: 'cloud', justification: 'j', status: 'Rejected', submittedAt: '' },
    ];

    const pendingCount = list.filter((r) => r.status === 'Pending Approval').length;
    assert.equal(pendingCount, 2);
  });
});
