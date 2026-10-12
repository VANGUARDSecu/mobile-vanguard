import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService, DEMO_USERS } from '../services/auth.service.ts';

test('Mobile User Metadata & Full Name Alignment with Frontend (SCRUM-82)', async (t) => {
  await t.test('DEMO_USERS have complete user_metadata matching frontend-vanguard standard', () => {
    for (const [email, user] of Object.entries(DEMO_USERS)) {
      assert.ok(user.name, `User ${email} must have a name`);
      assert.ok(user.firstName, `User ${email} must have a firstName`);
      assert.ok(user.lastName, `User ${email} must have a lastName`);
      assert.ok(user.user_metadata, `User ${email} must have user_metadata`);
      assert.equal(user.user_metadata?.first_name, user.firstName);
      assert.equal(user.user_metadata?.last_name, user.lastName);
      assert.equal(user.user_metadata?.name, user.name);
      assert.ok(user.user_metadata?.role);
      assert.ok(user.user_metadata?.department);
    }
  });

  await t.test('synthesizeUser constructs user_metadata with full name, department, role, and company', () => {
    const user = AuthService.synthesizeUser('jane.doe@example.com');
    assert.equal(user.name, 'Jane Doe');
    assert.equal(user.firstName, 'Jane');
    assert.equal(user.lastName, 'Doe');
    assert.ok(user.user_metadata);
    assert.equal(user.user_metadata.first_name, 'Jane');
    assert.equal(user.user_metadata.last_name, 'Doe');
    assert.equal(user.user_metadata.name, 'Jane Doe');
    assert.equal(user.user_metadata.role, 'user');
    assert.equal(user.user_metadata.department, 'Engineering');
    assert.equal(user.user_metadata.company_name, 'Vanguard Security Inc.');
  });

  await t.test('normalizeUser resolves full name from user_metadata first_name and last_name', () => {
    const rawUser = {
      id: 'usr_remote_999',
      email: 'alex.security@vanguard.corp',
      user_metadata: {
        first_name: 'Alexander',
        last_name: 'Pierce',
        department: 'Executive Security',
        role: 'admin',
        company_name: 'Vanguard Security Inc.',
      },
    };

    const normalized = AuthService.normalizeUser(rawUser, rawUser.email);
    assert.equal(normalized.id, 'usr_remote_999');
    assert.equal(normalized.email, 'alex.security@vanguard.corp');
    assert.equal(normalized.name, 'Alexander Pierce');
    assert.equal(normalized.firstName, 'Alexander');
    assert.equal(normalized.lastName, 'Pierce');
    assert.equal(normalized.role, 'admin');
    assert.equal(normalized.department, 'Executive Security');
    assert.equal(normalized.user_metadata?.first_name, 'Alexander');
    assert.equal(normalized.user_metadata?.last_name, 'Pierce');
    assert.equal(normalized.user_metadata?.name, 'Alexander Pierce');
  });

  await t.test('normalizeUser prefers full name over email username fallback', () => {
    const rawUser = {
      id: 'usr_dir_123',
      email: 'johndoe@external.org',
      name: 'Johnathan Doe',
      user_metadata: {
        firstName: 'Johnathan',
        lastName: 'Doe',
        department: 'Operations',
      },
    };

    const normalized = AuthService.normalizeUser(rawUser, rawUser.email);
    assert.equal(normalized.name, 'Johnathan Doe');
    assert.notEqual(normalized.name, 'johndoe');
    assert.equal(normalized.user_metadata?.name, 'Johnathan Doe');
  });

  await t.test('signInWithSSO returns user with rich user_metadata and matching name', async () => {
    const ssoUser = await AuthService.signInWithSSO('ellen.ripley@weyland.corp');
    assert.equal(ssoUser.name, 'Ellen Ripley');
    assert.equal(ssoUser.firstName, 'Ellen');
    assert.equal(ssoUser.lastName, 'Ripley');
    assert.ok(ssoUser.user_metadata);
    assert.equal(ssoUser.user_metadata.first_name, 'Ellen');
    assert.equal(ssoUser.user_metadata.last_name, 'Ripley');
    assert.equal(ssoUser.user_metadata.name, 'Ellen Ripley');
    assert.equal(ssoUser.companyName, 'Weyland-Yutani Corp');
  });

  await t.test('session storage persists and restores complete user_metadata', async () => {
    const customUser = AuthService.synthesizeUser('sarah.connor@cyberdyne.org', 'security_officer', {
      first_name: 'Sarah',
      last_name: 'Connor',
      name: 'Sarah Connor',
      department: 'Tactical Defense',
    });

    await AuthService.saveSession(customUser, customUser.accessToken);
    const loaded = await AuthService.getCurrentUser();

    assert.ok(loaded);
    assert.equal(loaded.email, 'sarah.connor@cyberdyne.org');
    assert.equal(loaded.name, 'Sarah Connor');
    assert.equal(loaded.firstName, 'Sarah');
    assert.equal(loaded.lastName, 'Connor');
    assert.equal(loaded.role, 'security_officer');
    assert.equal(loaded.department, 'Tactical Defense');
    assert.ok(loaded.user_metadata);
    assert.equal(loaded.user_metadata.name, 'Sarah Connor');
    assert.equal(loaded.user_metadata.department, 'Tactical Defense');
  });
});
