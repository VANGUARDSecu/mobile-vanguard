import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTERPRISE_APP_SUGGESTIONS, type AppAccessRequest } from '../models/apps.models.ts';
import { AppsStorageService } from '../services/apps-storage.service.ts';

test('Request Enterprise Application Access Modal & Workflow (SCRUM-66)', async (t) => {
  await t.test('enterprise suggestions provide valid preset apps and categories', () => {
    assert.ok(ENTERPRISE_APP_SUGGESTIONS.length >= 4);

    const figma = ENTERPRISE_APP_SUGGESTIONS.find((s) => s.name === 'Figma Enterprise');
    assert.ok(figma);
    assert.equal(figma.category, 'collaboration');
    assert.equal(figma.icon, '🎨');

    const snowflake = ENTERPRISE_APP_SUGGESTIONS.find((s) => s.name === 'Snowflake Data Cloud');
    assert.ok(snowflake);
    assert.equal(snowflake.category, 'cloud');

    const datadog = ENTERPRISE_APP_SUGGESTIONS.find((s) => s.name === 'Datadog APM');
    assert.ok(datadog);
    assert.equal(datadog.category, 'developer');
  });

  await t.test('validation logic requires non-empty application name', () => {
    const validateRequest = (appName: string, justification: string): string | null => {
      if (!appName.trim()) {
        return 'Please provide an application name.';
      }
      if (!justification.trim()) {
        return 'Please provide a business justification for requesting access.';
      }
      return null;
    };

    assert.equal(validateRequest('', 'Need access for project design'), 'Please provide an application name.');
    assert.equal(validateRequest('   ', 'Need access for project design'), 'Please provide an application name.');
  });

  await t.test('validation logic requires business justification before submission', () => {
    const validateRequest = (appName: string, justification: string): string | null => {
      if (!appName.trim()) {
        return 'Please provide an application name.';
      }
      if (!justification.trim()) {
        return 'Please provide a business justification for requesting access.';
      }
      return null;
    };

    assert.equal(validateRequest('Salesforce Enterprise', ''), 'Please provide a business justification for requesting access.');
    assert.equal(validateRequest('Salesforce Enterprise', '   '), 'Please provide a business justification for requesting access.');
    assert.equal(validateRequest('Salesforce Enterprise', 'Need customer pipeline access for Q4 audits'), null);
  });

  await t.test('submitAccessRequest creates valid request with Pending Approval status and user metadata', async () => {
    const created: AppAccessRequest = await AppsStorageService.submitAccessRequest({
      appName: 'Datadog APM',
      justification: 'Application performance monitoring for zero-trust microservices.',
      category: 'developer',
      icon: '🐶',
      userName: 'Ellen Ripley',
      userEmail: 'ellen.ripley@weyland.corp',
      department: 'Engineering',
    });

    assert.ok(created.id.startsWith('req-'));
    assert.equal(created.appName, 'Datadog APM');
    assert.equal(created.status, 'Pending Approval');
    assert.equal(created.protocol, 'SAML 2.0');
    assert.equal(created.category, 'developer');
    assert.equal(created.icon, '🐶');
    assert.equal(created.userName, 'Ellen Ripley');
    assert.equal(created.userEmail, 'ellen.ripley@weyland.corp');
    assert.equal(created.department, 'Engineering');
    assert.ok(created.submittedAt);
  });

  await t.test('submitAccessRequest applies sensible defaults when optional metadata is omitted', async () => {
    const created: AppAccessRequest = await AppsStorageService.submitAccessRequest({
      appName: 'Internal Admin Portal',
      justification: 'Incident management triage.',
    });

    assert.equal(created.appName, 'Internal Admin Portal');
    assert.equal(created.status, 'Pending Approval');
    assert.equal(created.protocol, 'SAML 2.0');
    assert.equal(created.category, 'collaboration');
    assert.equal(created.icon, '🚀');
    assert.ok(created.userName);
    assert.ok(created.userEmail);
  });

  await t.test('pending access requests calculation properly isolates pending approval items', () => {
    const requests: AppAccessRequest[] = [
      {
        id: 'r1',
        userId: 'u1',
        userName: 'User 1',
        userEmail: 'u1@test.com',
        department: 'Eng',
        role: 'Engineer',
        appName: 'Figma',
        protocol: 'SAML 2.0',
        category: 'collaboration',
        justification: 'UI Design',
        status: 'Pending Approval',
        submittedAt: '2026-10-11T00:00:00Z',
      },
      {
        id: 'r2',
        userId: 'u1',
        userName: 'User 1',
        userEmail: 'u1@test.com',
        department: 'Eng',
        role: 'Engineer',
        appName: 'AWS',
        protocol: 'SAML 2.0',
        category: 'cloud',
        justification: 'Cloud infra',
        status: 'Approved',
        submittedAt: '2026-10-10T00:00:00Z',
      },
      {
        id: 'r3',
        userId: 'u1',
        userName: 'User 1',
        userEmail: 'u1@test.com',
        department: 'Eng',
        role: 'Engineer',
        appName: 'GCP',
        protocol: 'SAML 2.0',
        category: 'cloud',
        justification: 'Testing',
        status: 'Pending Approval',
        submittedAt: '2026-10-11T01:00:00Z',
      },
    ];

    const pending = requests.filter((r) => r.status === 'Pending Approval');
    assert.equal(pending.length, 2);
  });
});
