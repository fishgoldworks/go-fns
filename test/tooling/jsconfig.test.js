'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

test('editor discovery includes maintained package fixtures and excludes generated output and experiments', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-editor-'));

  try {
    fs.copyFileSync(path.resolve(__dirname, '../../jsconfig.json'), path.join(root, 'jsconfig.json'));
    for (const file of [
      'src/owned.js',
      'src/package/owned.js',
      'scripts/owned.js',
      'test/package/consumer.cjs',
      'test/package/nested/owned.js',
      'package/index.js',
      'artifacts/report.js',
      'coverage/report.js',
      '.build-probe/output/index.js',
      'temp/probe.js',
      'src/temp/probe.js',
      'src/.tmp/probe.js',
      'test/package/.tmp/probe.js',
      'node_modules/dependency/index.js'
    ]) {
      const filename = path.join(root, file);

      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, 'module.exports = 1;\n');
    }

    const parsed = ts.getParsedCommandLineOfConfigFile(
      path.join(root, 'jsconfig.json'),
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic(diagnostic) {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
      }
    );

    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.options.allowJs, true);
    assert.equal(parsed.options.baseUrl, path.join(root, 'src').replaceAll(path.sep, '/'));
    assert.deepEqual(parsed.fileNames.map((file) => path.relative(root, file).split(path.sep).join('/')).sort(), [
      'scripts/owned.js',
      'src/owned.js',
      'src/package/owned.js',
      'test/package/consumer.cjs',
      'test/package/nested/owned.js'
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
