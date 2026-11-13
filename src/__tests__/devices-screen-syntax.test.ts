import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

test('DevicesScreen TSX parses with zero syntax diagnostics (SCRUM-170)', () => {
  const filePath = path.resolve(import.meta.dirname, '../screens/devices-screen.tsx');
  const sourceText = fs.readFileSync(filePath, 'utf8');

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
    .parseDiagnostics ?? [];

  assert.equal(
    parseDiagnostics.length,
    0,
    `Expected 0 TSX syntax errors in devices-screen.tsx, found: ${parseDiagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .join('; ')}`
  );
});
