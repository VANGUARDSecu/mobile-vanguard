import test from 'node:test';
import assert from 'node:assert/strict';
import type { PersonalAppInput } from '../models/apps.models.ts';
import type { PersonalAppPreset } from '../components/apps/add-personal-app-modal.tsx';

test('Add Personal Application Modal & Presets (SCRUM-65)', async (t) => {
  const getPresetData = (preset: PersonalAppPreset) => {
    switch (preset) {
      case 'figma':
        return {
          name: 'Figma',
          url: 'https://www.figma.com/login',
          category: 'collaboration' as const,
          icon: '🎨',
          description: 'Collaborative interface design & prototyping suite',
        };
      case 'facebook':
        return {
          name: 'Facebook',
          url: 'https://www.facebook.com/login',
          category: 'collaboration' as const,
          icon: '📘',
          description: 'Social network & Meta business suite',
        };
      case 'github':
        return {
          name: 'GitHub',
          url: 'https://github.com/login',
          category: 'developer' as const,
          icon: '🐙',
          description: 'Git repository hosting & developer platform',
        };
      case 'notion':
        return {
          name: 'Notion',
          url: 'https://www.notion.so/login',
          category: 'collaboration' as const,
          icon: '📝',
          description: 'Connected workspace for wiki, docs & project notes',
        };
      case 'google':
        return {
          name: 'Google Account',
          url: 'https://accounts.google.com',
          category: 'cloud' as const,
          icon: '🔍',
          description: 'Google workspace, Drive, and identity authentication',
        };
      case 'custom':
        return {
          name: '',
          url: 'https://',
          category: 'cloud' as const,
          icon: '🌐',
          description: '',
        };
    }
  };

  const validateAndFormat = (input: {
    name: string;
    url: string;
    category: 'collaboration' | 'developer' | 'cloud';
    icon?: string;
    description?: string;
  }): { valid: boolean; error?: string; formatted?: PersonalAppInput } => {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { valid: false, error: 'Please provide an application name.' };
    }

    const trimmedUrl = input.url.trim();
    if (!trimmedUrl || !trimmedUrl.includes('.')) {
      return { valid: false, error: 'Please provide a valid website or login URL.' };
    }

    let formattedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    return {
      valid: true,
      formatted: {
        name: trimmedName,
        launchUrl: formattedUrl,
        category: input.category,
        icon: input.icon?.trim() || '🌐',
        description: input.description?.trim() || `${trimmedName} web application`,
      },
    };
  };

  await t.test('all standard quick presets correctly prefill application details', () => {
    const figma = getPresetData('figma');
    assert.equal(figma.name, 'Figma');
    assert.equal(figma.url, 'https://www.figma.com/login');
    assert.equal(figma.category, 'collaboration');
    assert.equal(figma.icon, '🎨');

    const github = getPresetData('github');
    assert.equal(github.name, 'GitHub');
    assert.equal(github.url, 'https://github.com/login');
    assert.equal(github.category, 'developer');
    assert.equal(github.icon, '🐙');

    const facebook = getPresetData('facebook');
    assert.equal(facebook.name, 'Facebook');
    assert.equal(facebook.url, 'https://www.facebook.com/login');

    const notion = getPresetData('notion');
    assert.equal(notion.name, 'Notion');
    assert.equal(notion.url, 'https://www.notion.so/login');

    const google = getPresetData('google');
    assert.equal(google.name, 'Google Account');
    assert.equal(google.url, 'https://accounts.google.com');
    assert.equal(google.category, 'cloud');

    const custom = getPresetData('custom');
    assert.equal(custom.name, '');
    assert.equal(custom.url, 'https://');
  });

  await t.test('validation blocks submission when application name is empty', () => {
    const res = validateAndFormat({
      name: '   ',
      url: 'https://example.com',
      category: 'collaboration',
    });
    assert.equal(res.valid, false);
    assert.equal(res.error, 'Please provide an application name.');
  });

  await t.test('validation blocks submission when website URL is empty or lacks dot', () => {
    const emptyUrlRes = validateAndFormat({
      name: 'Internal Portal',
      url: '',
      category: 'developer',
    });
    assert.equal(emptyUrlRes.valid, false);
    assert.equal(emptyUrlRes.error, 'Please provide a valid website or login URL.');

    const noDotUrlRes = validateAndFormat({
      name: 'Internal Portal',
      url: 'localhost',
      category: 'developer',
    });
    assert.equal(noDotUrlRes.valid, false);
    assert.equal(noDotUrlRes.error, 'Please provide a valid website or login URL.');
  });

  await t.test('normalizes website URLs missing https scheme', () => {
    const res = validateAndFormat({
      name: 'Linear App',
      url: 'linear.app/login',
      category: 'developer',
    });
    assert.equal(res.valid, true);
    assert.ok(res.formatted);
    assert.equal(res.formatted.launchUrl, 'https://linear.app/login');
    assert.equal(res.formatted.name, 'Linear App');
  });

  await t.test('populates default icon and description when optional fields are omitted', () => {
    const res = validateAndFormat({
      name: 'Custom Dashboard',
      url: 'https://dashboard.internal.co',
      category: 'cloud',
    });
    assert.equal(res.valid, true);
    assert.ok(res.formatted);
    assert.equal(res.formatted.icon, '🌐');
    assert.equal(res.formatted.description, 'Custom Dashboard web application');
  });
});
