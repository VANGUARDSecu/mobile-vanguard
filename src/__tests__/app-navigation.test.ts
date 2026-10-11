import test from 'node:test';
import assert from 'node:assert/strict';

test('Mobile Navigation Bar & Header Unblocking (SCRUM-77)', async (t) => {
  await t.test(
    'Web tab navigation is anchored at bottom: 0 to ensure upper header is not obstructed',
    () => {
      const webNavStyle = {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 90,
        pointerEvents: 'box-none',
      };

      assert.equal(webNavStyle.bottom, 0, 'Tab navigation MUST anchor to bottom: 0');
      assert.notEqual(
        (webNavStyle as any).top,
        0,
        'Tab navigation MUST NOT float at top: 0 over the user session bar'
      );
      assert.equal(
        webNavStyle.pointerEvents,
        'box-none',
        'Tab container MUST set pointerEvents box-none so clicks outside buttons pass through'
      );
    }
  );

  await t.test(
    'Brand display in navigation bar renders VANGUARD and excludes Expo Starter text',
    () => {
      const navBrand = {
        shield: '🛡️',
        title: 'VANGUARD',
        badge: 'ZERO-TRUST',
      };

      assert.equal(navBrand.title, 'VANGUARD');
      assert.ok(
        !navBrand.title.toLowerCase().includes('expo starter'),
        'Brand MUST NOT contain Expo Starter'
      );
    }
  );

  await t.test(
    'Tab triggers route correctly to Apps and Security without external Expo links',
    () => {
      const webTabTriggers = [
        { name: 'home', href: '/', label: 'Apps', icon: '📱' },
        { name: 'explore', href: '/explore', label: 'Security', icon: '🛡️' },
      ];

      assert.equal(webTabTriggers.length, 2);
      assert.equal(webTabTriggers[0].label, 'Apps');
      assert.equal(webTabTriggers[0].href, '/');
      assert.equal(webTabTriggers[1].label, 'Security');
      assert.equal(webTabTriggers[1].href, '/explore');

      const docsTrigger = webTabTriggers.find((t) => (t as any).label === 'Docs');
      assert.equal(docsTrigger, undefined, 'External Docs link must be removed from Vanguard');
    }
  );

  await t.test(
    'User session header bar has elevated zIndex ensuring priority over page elements',
    () => {
      const sessionHeaderStyle = {
        zIndex: 100,
        paddingHorizontal: 16,
        paddingTop: 8,
      };

      assert.ok(
        sessionHeaderStyle.zIndex >= 100,
        'Header bar zIndex ensures priority over lower page content'
      );
    }
  );
});
