'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { ESLint } = require('eslint');

const eslint = new ESLint({ cwd: path.resolve(__dirname, '../..') });

for (const filePath of [
  'src/once.js',
  'scripts/package-layout.js',
  'test/once.test.js',
  'test/types/contracts.ts',
  'test/types/imports.mts'
]) {
  const typed = /\.(?:ts|mts)$/.test(filePath);
  const definition = typed ? 'export function check(value: boolean): number' : 'module.exports = function (value)';

  test(filePath + ' rejects unbraced conditional returns in both branches', async () => {
    const [result] = await eslint.lintText(
      definition + ' { if (value) return 1; else return 0; }' + (typed ? '' : ';'),
      { filePath }
    );

    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax').length, 2);
  });

  test(filePath + ' accepts braced conditional returns', async () => {
    const [result] = await eslint.lintText(
      definition + ' { if (value) { return 1; } else { return 0; } }' + (typed ? '' : ';'),
      {
        filePath
      }
    );

    assert.deepEqual(result.messages, []);
  });
}

for (const filePath of [
  'esm/owned.js',
  'es/owned.js',
  'vendor/owned.js',
  '.package-probe/owned.js',
  'dist/owned.js',
  'dist/nested/owned.js',
  'src/owned.js',
  'scripts/owned.js',
  'test/package/consumer.cjs'
]) {
  test(filePath + ' remains in the maintained lint scope', async () => {
    const [result] = await eslint.lintText('module.exports = missingScopeProbe;', { filePath });

    assert.ok(
      result.messages.some(({ ruleId }) => ruleId === 'no-undef'),
      JSON.stringify(result.messages)
    );

    const [valid] = await eslint.lintText('module.exports = 42;', { filePath });

    assert.deepEqual(valid.messages, []);
  });
}

for (const filePath of [
  'package/index.js',
  'package/dist/go-fns.js',
  'artifacts/owned.js',
  'coverage/report.js',
  '.build-probe/output/index.js',
  '.build-probe/output/dist/go-fns.js',
  'dist/temp/nested/experiment.js',
  'dist/.tmp/nested/experiment.js',
  'src/temp/experiment.js',
  'test/package/.tmp/experiment.js',
  'benchmarks/baseline-2.2.0/index.js',
  'benchmarks/results/report.js',
  'benchmarks/adapters/results/report.js',
  'experimental/prototype.js'
]) {
  test(filePath + ' stays outside the maintained lint scope', async () => {
    assert.equal(await eslint.isPathIgnored(filePath), true);
  });
}
