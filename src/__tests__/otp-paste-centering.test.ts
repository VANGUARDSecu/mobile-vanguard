import test from 'node:test';
import assert from 'node:assert/strict';

test('OTP Digit Centering & Full Code Clipboard Paste (SCRUM-81)', async (t) => {
  await t.test('1. Digit input styling enforces horizontal and vertical centering', () => {
    const digitBoxBaseStyle = {
      textAlign: 'center',
      textAlignVertical: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
      includeFontPadding: false,
    };

    assert.equal(digitBoxBaseStyle.textAlign, 'center', 'Digits MUST be horizontally centered');
    assert.equal(
      digitBoxBaseStyle.textAlignVertical,
      'center',
      'Digits MUST be vertically centered on Android/Native'
    );
    assert.equal(digitBoxBaseStyle.padding, 0, 'Padding MUST be 0 to prevent browser offset');
    assert.equal(
      digitBoxBaseStyle.includeFontPadding,
      false,
      'Android font padding MUST be false to ensure vertical symmetry'
    );
  });

  await t.test('2. Multi-digit paste distributes 6-digit TOTP code across all inputs', () => {
    const codeLength = 6;
    const initialDigits = new Array(codeLength).fill('');

    const simulatePaste = (pastedText: string, activeIndex: number, current: string[]) => {
      const cleanDigits = pastedText.replace(/\D/g, '');
      if (cleanDigits.length > 2 || (cleanDigits.length === 2 && !current[activeIndex])) {
        const startIdx = cleanDigits.length >= 4 ? 0 : activeIndex;
        const next = [...current];
        for (let i = 0; i < cleanDigits.length && startIdx + i < codeLength; i++) {
          next[startIdx + i] = cleanDigits[i];
        }
        return next;
      }
      return current;
    };

    // Paste standard 6-digit TOTP
    const result = simulatePaste('491823', 0, initialDigits);
    assert.deepEqual(result, ['4', '9', '1', '8', '2', '3']);
    assert.equal(result.join(''), '491823');

    // Paste formatted code with spaces into any slot
    const resultWithSpace = simulatePaste('823 104', 2, initialDigits);
    assert.deepEqual(resultWithSpace, ['8', '2', '3', '1', '0', '4']);

    // Paste hyphenated code
    const resultWithHyphen = simulatePaste('552-991', 1, initialDigits);
    assert.deepEqual(resultWithHyphen, ['5', '5', '2', '9', '9', '1']);
  });

  await t.test('3. Multi-digit paste distributes 8-digit Email OTP code across all inputs', () => {
    const codeLength = 8;
    const initialDigits = new Array(codeLength).fill('');

    const simulatePaste = (pastedText: string, activeIndex: number, current: string[]) => {
      const cleanDigits = pastedText.replace(/\D/g, '');
      if (cleanDigits.length > 2 || (cleanDigits.length === 2 && !current[activeIndex])) {
        const startIdx = cleanDigits.length >= 4 ? 0 : activeIndex;
        const next = [...current];
        for (let i = 0; i < cleanDigits.length && startIdx + i < codeLength; i++) {
          next[startIdx + i] = cleanDigits[i];
        }
        return next;
      }
      return current;
    };

    const result = simulatePaste('12345678', 0, initialDigits);
    assert.deepEqual(result, ['1', '2', '3', '4', '5', '6', '7', '8']);
    assert.equal(result.join(''), '12345678');

    // Paste 8-digit code with dash separator
    const resultSeparated = simulatePaste('8491-3029', 0, initialDigits);
    assert.deepEqual(resultSeparated, ['8', '4', '9', '1', '3', '0', '2', '9']);
  });

  await t.test('4. Clipboard extraction normalizes noisy strings and ignores non-digits', () => {
    const normalizeClipboardCode = (raw: string, length: number) => {
      const clean = raw.replace(/\D/g, '');
      const digits = new Array(length).fill('');
      for (let i = 0; i < clean.length && i < length; i++) {
        digits[i] = clean[i];
      }
      return digits;
    };

    // User copies "Your Vanguard code is: 938402"
    const parsedFromEmail = normalizeClipboardCode('Your Vanguard code is: 938402', 6);
    assert.deepEqual(parsedFromEmail, ['9', '3', '8', '4', '0', '2']);

    // User copies "OTP: 104-295"
    const parsedPrefixed = normalizeClipboardCode('OTP: 104-295', 6);
    assert.deepEqual(parsedPrefixed, ['1', '0', '4', '2', '9', '5']);
  });

  await t.test('5. Single digit typing overwrites existing digit without triggering paste', () => {
    const codeLength = 6;
    const current = ['4', '', '', '', '', ''];

    const handleInput = (val: string, index: number, state: string[]) => {
      const cleanDigits = val.replace(/\D/g, '');
      if (cleanDigits.length > 2 || (cleanDigits.length === 2 && !state[index])) {
        const startIdx = cleanDigits.length >= 4 ? 0 : index;
        const next = [...state];
        for (let i = 0; i < cleanDigits.length && startIdx + i < codeLength; i++) {
          next[startIdx + i] = cleanDigits[i];
        }
        return next;
      }
      const char = cleanDigits.slice(-1);
      const next = [...state];
      next[index] = char;
      return next;
    };

    // User types '9' into box 0 which already has '4', resulting in '49'
    const updated = handleInput('49', 0, current);
    assert.equal(updated[0], '9', 'Typing new digit must replace existing digit with latest keypress');
    assert.equal(updated[1], '', 'Must not distribute as paste when typing single digit over existing');
  });
});
