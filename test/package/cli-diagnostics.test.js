'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

for (const command of ['pack-package', 'verify']) {
  test(command + ' CLI retains nested errors, causes and recovery fields', () => {
    const env = { ...process.env, NODE_OPTIONS: '' };

    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ['--require', path.join(__dirname, 'fixtures/cli-diagnostics.cjs'), 'scripts/' + command + '.js'],
      { cwd: root, env, encoding: 'utf8', timeout: 10000 }
    );

    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.stdout, '');

    for (const marker of [
      'PRIMARY_DIAGNOSTIC',
      'CLEANUP_DIAGNOSTIC',
      'CAUSE_DIAGNOSTIC',
      'committed: true',
      'recoveryDirectory: ',
      'RECOVERY_DIRECTORY',
      'tarball: ',
      'RETAINED_TARBALL'
    ]) {
      assert.ok(result.stderr.includes(marker), marker + '\n' + result.stderr);
    }
  });
}
