'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const check = () => require('./check-test-output');
function tap(overrides = {}) {
  const counts = { tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0, ...overrides };
  return (
    'TAP version 13\n' +
    Object.entries(counts)
      .map(([key, value]) => `# ${key} ${value}`)
      .join('\n') +
    '\n'
  );
}
test('accepts a complete passing TAP summary', () => assert.equal(check().tapSummary(tap()), 2));
for (const [name, output] of [
  ['empty output', ''],
  ['empty run', tap({ tests: 0, pass: 0 })],
  ['all skipped', tap({ pass: 0, skipped: 2 })],
  ['one skipped', tap({ pass: 1, skipped: 1 })],
  ['todo failure', tap({ pass: 1, todo: 1 })],
  ['cancelled', tap({ pass: 1, cancelled: 1 })],
  ['failed', tap({ pass: 1, fail: 1 })],
  ['inconsistent', tap({ pass: 1 })],
  ['truncated', tap().replace('# todo 0\n', '')],
  ['duplicated', tap() + tap()],
  ['log line impersonating a summary', '# ' + tap().replace(/\n/g, '\n# ')]
])
  test('rejects TAP ' + name, () => assert.throws(() => check().tapSummary(output), /test report/i));
test('accepts CRLF TAP without confusing nested diagnostics with the summary', () =>
  assert.equal(check().tapSummary('    # tests 900\r\n' + tap().replace(/\n/g, '\r\n')), 2));
function consumer(overrides = {}) {
  const formats = ['commonjs', 'readable bundle', 'minified bundle'].map((format) => ({ format, apis: 32, checks: 3 }));
  return (
    [...formats, { node: 'v22.16.0', formats: 3, checks: 9, status: 'passed', ...overrides }]
      .map((value) => JSON.stringify(value))
      .join('\n') + '\n'
  );
}
test('accepts the complete multi-format runtime consumer report', () =>
  assert.equal(check().consumerSummary(consumer(), 'v22.16.0').checks, 9));
for (const [name, output] of [
  ['empty', ''],
  ['missing final report', consumer().split('\n').slice(0, 3).join('\n')],
  ['no completed formats', consumer({ formats: 0 })],
  ['wrong totals', consumer({ checks: 8 })],
  ['wrong runtime', consumer({ node: 'v0.0.0' })],
  ['failure', consumer({ status: 'failed' })],
  ['duplicate format', consumer().replace('readable bundle', 'commonjs')],
  ['no checks in one format', consumer().replace('"checks":3', '"checks":0')]
])
  test('rejects consumer report ' + name, () =>
    assert.throws(() => check().consumerSummary(output, 'v22.16.0'), /consumer report/i)
  );
test('completion marker is required exactly once for import smoke checks', () => {
  const { completion, completionMarker } = check();
  assert.doesNotThrow(() => completion('log\n' + completionMarker + '\n'));
  for (const text of ['', 'ordinary output', completionMarker + '\n' + completionMarker])
    assert.throws(() => completion(text), /consumer.*complete/i);
});
test('a genuinely pending async consumer is rejected despite a zero process exit', () => {
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-pending-consumer-'));
  try {
    const preload = path.join(temporary, 'pending.cjs');
    fs.writeFileSync(
      preload,
      `const api = require(${JSON.stringify(root)}); api.notAsync = api.not.async = function () { return () => new Promise(() => {}); };`
    );
    const env = { ...process.env, NODE_OPTIONS: '' };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ['--require', preload, path.join(root, 'test/package/consumer.cjs'), root],
      { env, encoding: 'utf8', timeout: 5000 }
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.throws(() => check().consumerSummary(result.stdout, process.version), /consumer report/i);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
test('installed-package gate rejects a real consumer that abandons pending async checks', () => {
  assert.ok(process.env.npm_execpath, 'Run through npm run test:tooling.');
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-package-gate-'));
  try {
    const pending = path.join(temporary, 'pending.cjs');
    const instrument = path.join(temporary, 'instrument.cjs');
    fs.writeFileSync(
      pending,
      `
      const api = require(require.resolve('go-fns', {paths:[require('node:path').dirname(process.argv[1])]}));
      api.notAsync = api.not.async = function () { return () => new Promise(() => {}); };
    `
    );
    // Only augment the selected consumer launch. npm install, package loading,
    // async execution and the gate's result validation remain real.
    fs.writeFileSync(
      instrument,
      `
      const child = require('node:child_process');
      const spawn = child.spawnSync;
      child.spawnSync = function (command, args, options) {
        if (args[0] && require('node:path').basename(args[0]) === 'consumer.cjs')
          args = ['--require', ${JSON.stringify(pending)}, ...args];
        return spawn(command, args, options);
      };
    `
    );
    const env = { ...process.env, NODE_OPTIONS: '' };
    delete env.NODE_TEST_CONTEXT;
    const tarball = path.resolve(process.env.GO_FNS_TEST_TARBALL || require('./package-layout').artifactPath());
    const result = spawnSync(
      process.execPath,
      ['--require', instrument, 'scripts/test-package.js', '--tarball', tarball],
      {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 20000,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /Incomplete consumer report/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
