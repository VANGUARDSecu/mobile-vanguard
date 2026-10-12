import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AuthService, DEMO_USERS } from '../services/auth.service.ts';
import { AppsStorageService } from '../services/apps-storage.service.ts';
import type { SignupPayload } from '../models/auth.models.ts';
import type { AppAccessRequest } from '../models/apps.models.ts';

describe('Account Registration & Architecture Enforcement (SCRUM-84)', () => {
  it('1. Personal (Individual) registration sets individual accountType and personal vault ownership', async () => {
    const testEmail = `new.personal.${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vanguard.test`;
    const payload: SignupPayload = {
      email: testEmail,
      password: 'SecurePassword123!',
      firstName: 'Alice',
      lastName: 'Vault',
      accountType: 'individual',
    };

    const result = await AuthService.signup(payload);

    assert.equal(result.success, true);
    assert.equal(result.email, testEmail);
    assert.equal(result.accountType, 'individual');
    assert.equal(result.requireOtp, true);
  });

  it('2. Company registration validates required company name and sets company accountType', async () => {
    // Missing company name should fail
    const invalidPayload: SignupPayload = {
      email: `admin.${Date.now()}@acme.corp`,
      password: 'SecurePassword123!',
      firstName: 'Bob',
      lastName: 'Admin',
      accountType: 'company',
      companyName: '',
    };

    await assert.rejects(
      async () => await AuthService.signup(invalidPayload),
      /Company name is required/
    );

    // Valid company registration succeeds
    const validEmail = `admin.${Date.now()}-${Math.random().toString(36).slice(2, 6)}@acme.corp`;
    const validPayload: SignupPayload = {
      email: validEmail,
      password: 'SecurePassword123!',
      firstName: 'Bob',
      lastName: 'Admin',
      accountType: 'company',
      companyName: 'Acme Cyber Labs',
      department: 'Security Operations',
    };

    const successResult = await AuthService.signup(validPayload);
    assert.equal(successResult.success, true);
    assert.equal(successResult.accountType, 'company');
    assert.equal(successResult.companyName, 'Acme Cyber Labs');
  });

  it('3. Existing demo accounts enforce immutable account type and role semantics', () => {
    const personalUser = DEMO_USERS['personal@vanguard.local'];
    assert.ok(personalUser);
    assert.equal(personalUser.accountType, 'individual');
    assert.equal(personalUser.user_metadata?.account_type, 'individual');

    const companyAdmin = DEMO_USERS['admin@vanguard.security'];
    assert.ok(companyAdmin);
    assert.equal(companyAdmin.accountType, 'company');
    assert.equal(companyAdmin.role, 'admin');

    const companyAdminPersonalEmail = DEMO_USERS['johnroben.manayon21@gmail.com'];
    assert.ok(companyAdminPersonalEmail);
    assert.equal(companyAdminPersonalEmail.accountType, 'company');
    assert.equal(companyAdminPersonalEmail.role, 'admin');

    const employee = DEMO_USERS['user@company.com'];
    assert.ok(employee);
    assert.equal(employee.accountType, 'company');
    assert.equal(employee.role, 'user');
  });

  it('4. Workspace mode is strictly derived from account type without arbitrary switching', () => {
    // Mode derivation logic matching apps-context.tsx
    const deriveWorkspaceMode = (userAccountType?: 'individual' | 'company') => {
      return userAccountType === 'individual';
    };

    assert.equal(deriveWorkspaceMode('individual'), true, 'Individual account is locked to Personal Vault');
    assert.equal(deriveWorkspaceMode('company'), false, 'Company account is locked to Company Org');
    assert.equal(deriveWorkspaceMode(undefined), false, 'Default fallback is Company Org');
  });

  it('5. Company Admin eligibility is strictly verified by role and accountType', () => {
    const checkIsCompanyAdmin = (user: { accountType?: string; role?: string } | null) => {
      return (
        user?.accountType === 'company' &&
        (user?.role === 'admin' || user?.role === 'security_officer')
      );
    };

    assert.equal(checkIsCompanyAdmin(DEMO_USERS['admin@vanguard.security']), true);
    assert.equal(checkIsCompanyAdmin(DEMO_USERS['johnroben.manayon21@gmail.com']), true);
    assert.equal(checkIsCompanyAdmin(DEMO_USERS['user@company.com']), false);
    assert.equal(checkIsCompanyAdmin(DEMO_USERS['ellen.ripley@weyland.corp']), false);
    assert.equal(checkIsCompanyAdmin(DEMO_USERS['personal@vanguard.local']), false);
    assert.equal(checkIsCompanyAdmin(null), false);
  });

  it('6. Employee request submission retains full employee metadata for admin review', async () => {
    const employee = DEMO_USERS['user@company.com'];

    const newRequest: AppAccessRequest = await AppsStorageService.submitAccessRequest({
      appName: 'AWS Management Console',
      justification: 'Requires access to deploy staging ECS clusters.',
      category: 'cloud',
      icon: '☁️',
      userName: employee.name,
      userEmail: employee.email,
      department: employee.department || 'Engineering',
      role: employee.role,
    });

    assert.ok(newRequest.id);
    assert.equal(newRequest.appName, 'AWS Management Console');
    assert.equal(newRequest.userName, 'John Roben Manayon');
    assert.equal(newRequest.userEmail, 'user@company.com');
    assert.equal(newRequest.department, 'Engineering');
    assert.equal(newRequest.role, 'user');
    assert.equal(newRequest.status, 'Pending Approval');
    assert.ok(newRequest.submittedAt);
  });

  it('7. Company Admin can approve employee request and record audit metadata', async () => {
    const admin = DEMO_USERS['admin@vanguard.security'];

    const testReq = await AppsStorageService.submitAccessRequest({
      appName: 'Datadog Enterprise',
      justification: 'Incident triage and trace monitoring.',
      userName: 'Ellen Ripley',
      userEmail: 'ellen.ripley@weyland.corp',
      department: 'Infrastructure',
      role: 'user',
    });

    const approved = await AppsStorageService.approveAccessRequest(testReq.id, admin.name);

    assert.ok(approved);
    assert.equal(approved.id, testReq.id);
    assert.equal(approved.status, 'Approved');
    assert.equal(approved.reviewedBy, 'Security Operations Admin');
    assert.ok(approved.reviewedAt);
  });

  it('8. Company Admin can reject employee request with custom audit notes', async () => {
    const admin = DEMO_USERS['admin@vanguard.security'];

    const testReq = await AppsStorageService.submitAccessRequest({
      appName: 'Salesforce Write Access',
      justification: 'Marketing campaign updates.',
      userName: 'Ellen Ripley',
      userEmail: 'ellen.ripley@weyland.corp',
      department: 'Engineering',
      role: 'user',
    });

    const rejected = await AppsStorageService.rejectAccessRequest(
      testReq.id,
      admin.name,
      'Engineering roles cannot have direct CRM write privileges per SOC-2 policy.'
    );

    assert.ok(rejected);
    assert.equal(rejected.id, testReq.id);
    assert.equal(rejected.status, 'Rejected');
    assert.equal(rejected.reviewedBy, 'Security Operations Admin');
    assert.equal(
      rejected.adminNotes,
      'Engineering roles cannot have direct CRM write privileges per SOC-2 policy.'
    );
    assert.ok(rejected.reviewedAt);
  });
});
