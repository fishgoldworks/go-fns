'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const expected = [
  'and',
  'andAsync',
  'applyIf',
  'attempt',
  'attemptResult',
  'attemptResultAsync',
  'debounce',
  'delay',
  'ifElse',
  'ifElseAsync',
  'nor',
  'norAsync',
  'not',
  'notAsync',
  'once',
  'or',
  'orAsync',
  'partial',
  'partialRight',
  'pipe',
  'pipeAsync',
  'repeat',
  'repeatAsync',
  'result',
  'sleep',
  'spread',
  'tap',
  'tapAsync',
  'throttle',
  'unary',
  'when',
  'whenAsync',
  'xor',
  'xorAsync'
];
const results = [];
for (const name of ['go-fns.js', 'go-fns.min.js']) {
  const filename = path.join(root, 'package/dist', name);
  const source = fs.readFileSync(filename, 'utf8');
  assert.ok(source.includes('go-fns v' + require('../package.json').version + ' |'));
  assert.ok(source.includes(require('../package.json').license));
  const readableApi = require('..');
  const bundledApi = require(filename);
  for (const key of expected) {
    assert.equal(bundledApi[key].name, readableApi[key].name);
    assert.equal(bundledApi[key].length, readableApi[key].length);
  }
  for (const mode of ['global', 'worker-global', 'amd', 'commonjs', 'exports-only']) {
    let amd;
    const sandbox = {};
    // Lazy clock selection must not make import depend on a host clock.
    Object.defineProperty(sandbox, 'performance', {
      get() {
        throw new Error('Clock read during import');
      }
    });
    if (mode === 'worker-global') sandbox.self = sandbox;
    if (mode === 'amd') {
      sandbox.define = (dependencies, factory) => {
        assert.equal(dependencies.length, 0);
        amd = factory();
      };
      sandbox.define.amd = true;
    }
    if (mode === 'commonjs') {
      sandbox.module = { exports: {} };
      sandbox.exports = sandbox.module.exports;
    }
    if (mode === 'exports-only') sandbox.exports = {};
    vm.runInNewContext(source, sandbox, { filename, timeout: 1000 });
    const api =
      amd ||
      (sandbox.module && sandbox.module.exports) ||
      (sandbox.exports && sandbox.exports.Functions) ||
      sandbox.Functions;
    assert.deepEqual(Object.keys(api).sort(), expected);
    for (const name of expected)
      for (const property of ['async', 'result', 'resultAsync', 'right'])
        assert.equal(Object.hasOwn(api[name], property), false, name + '.' + property);
    assert.equal(api.pipe(null, (value) => value + 1, undefined)(2), 3);
    assert.equal(
      api
        .and(function () {
          return this.ok;
        })
        .call({ ok: true }),
      true
    );
    assert.equal(
      api.xor(
        () => true,
        () => true,
        () => true
      )(),
      false
    );
    assert.throws(
      () => api.repeat(() => {}, Infinity),
      (error) => error.name === 'RangeError'
    );
    // Importing/composing does not require a timer or a DOM.
    if (mode !== 'global' && mode !== 'worker-global') assert.equal(sandbox.Functions, undefined);
  }
  const run = spawnSync(process.execPath, ['scripts/test.js', '--test-reporter=tap', '--test-timeout=30000'], {
    cwd: root,
    env: { ...process.env, GO_FNS_TEST_ENTRY: filename },
    encoding: 'utf8',
    timeout: 40000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(run.stdout + run.stderr);
  const count = require('./check-test-output').tapSummary(run.stdout);
  if (process.env.GO_FNS_EVIDENCE_DIR)
    fs.writeFileSync(path.join(process.env.GO_FNS_EVIDENCE_DIR, name + '.tap'), run.stdout + run.stderr);
  results.push({ bundle: name, tests: count, loaderModes: 5, status: 'passed' });
}
require('./check-source-map')(path.join(root, 'package/dist'));
assert.ok(
  fs.statSync(path.join(root, 'package/dist/go-fns.min.js')).size <
    fs.statSync(path.join(root, 'package/dist/go-fns.js')).size * 0.6,
  'Minification must reduce the bundle substantially.'
);
console.log(JSON.stringify({ distributions: results, sourceMap: 'passed' }, null, 2));
