'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'verify.js'), 'utf8');
// Replace only external command/build boundaries; execute the actual verifier.
async function verify(native, failAt, failure = 'exit') {
  const steps = [];
  const diagnostics = [];
  const commands = [];
  const messages = [];
  const processFixture = {
    versions: process.versions,
    execPath: process.execPath,
    env: { GO_FNS_NODE8: 'node8', npm_execpath: 'npm-cli', GO_FNS_TEST_TARBALL: 'stale.tgz' }
  };
  vm.runInNewContext(source, {
    process: processFixture,
    console: {
      log(message) {
        messages.push(message);
      },
      error(error) {
        diagnostics.push(error.message);
      }
    },
    require(name) {
      if (name === 'node:fs') return { existsSync: () => true };
      if (name === 'node:child_process')
        return {
          spawnSync(executable, args, options) {
            if (executable === 'node8') return { status: 0, stdout: 'v8.0.0' };
            const step = args[2];
            steps.push(step);
            commands.push({ executable, args, env: options.env });
            if (step === failAt && failure === 'spawn') return { error: new Error('spawn sentinel') };
            if (step === failAt && failure === 'signal') return { status: null, signal: 'SIGTERM' };
            return { status: step === failAt ? 17 : 0 };
          }
        };
      if (name === 'node:util') return { parseArgs: () => ({ values: { native } }) };
      if (name === './package-layout') return { root: __dirname };
      if (name === './check-dev-node') return () => {};
      if (name === './pack-package')
        return {
          async packPackage() {
            steps.push('pack');
            if (failAt === 'pack') throw new Error('pack sentinel');
            return 'candidate.tgz';
          }
        };
      throw Error('Unexpected dependency: ' + name);
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { steps, diagnostics, commands, messages, exitCode: processFixture.exitCode };
}
for (const native of [false, true]) {
  for (const failAt of ['lint', 'format:check']) {
    test((native ? 'native' : 'standard') + ' verification rejects ' + failAt + ' failure before packing', async () => {
      const result = await verify(native, failAt);
      assert.equal(result.exitCode, 1);
      assert.deepEqual(result.steps, failAt === 'lint' ? ['lint'] : ['lint', 'format:check']);
      assert.match(result.diagnostics.join('\n'), /failed with exit 17/);
    });
  }
  test(
    (native ? 'native' : 'standard') + ' verification retains its coverage mode and checks one candidate',
    async () => {
      const result = await verify(native);
      assert.equal(result.exitCode, undefined, result.diagnostics.join('\n'));
      assert.deepEqual(result.steps.slice(0, 3), ['lint', 'format:check', 'pack']);
      assert.equal(result.steps.filter((step) => step === 'pack').length, 1);
      assert.ok(result.steps.includes(native ? 'coverage:native' : 'coverage'));
      assert.equal(result.steps.at(-1), 'test:package');
    }
  );
}

for (const native of [false, true]) {
  const ordered = [
    'lint',
    'format:check',
    'pack',
    'test:docs',
    native ? 'coverage:native' : 'coverage',
    'test:types',
    'test:build',
    'test:tooling',
    'test:release',
    'test:artifacts',
    'test:package'
  ];
  for (const step of ordered.slice(2)) {
    test(`${native ? 'native' : 'standard'} verifier stops at ${step} and never announces success`, async () => {
      const result = await verify(native, step);
      assert.equal(result.exitCode, 1);
      assert.deepEqual(result.steps, ordered.slice(0, ordered.indexOf(step) + 1));
      assert.equal(result.messages.length, 0);
      assert.match(result.diagnostics.join('\n'), step === 'pack' ? /pack sentinel/ : /failed with exit 17/);
    });
  }
  test(`${native ? 'native' : 'standard'} verifier passes the exact packed candidate and runtime to consumers`, async () => {
    const result = await verify(native);
    assert.equal(result.exitCode, undefined);
    assert.deepEqual(Array.from(result.commands.at(-1).args), [
      'npm-cli',
      'run',
      'test:package',
      '--',
      '--tarball',
      'candidate.tgz',
      '--node',
      'node8'
    ]);
    assert.deepEqual(result.messages, ['Verified release candidate: candidate.tgz']);
  });
  for (const failure of ['spawn', 'signal']) {
    test(`${native ? 'native' : 'standard'} verifier does not hide ${failure} failures`, async () => {
      const result = await verify(native, 'test:types', failure);
      assert.equal(result.exitCode, 1);
      assert.equal(result.steps.at(-1), 'test:types');
      assert.equal(result.messages.length, 0);
      assert.match(result.diagnostics.join('\n'), failure === 'spawn' ? /spawn sentinel/ : /failed/);
    });
  }
}

for (const native of [false, true]) {
  test(`${native ? 'native' : 'standard'} verifier selects the packed archive for candidate-dependent regressions`, async () => {
    const result = await verify(native);
    assert.equal(result.exitCode, undefined);
    for (const script of ['test:tooling', 'test:release']) {
      const command = result.commands.find((command) => command.args[2] === script);
      assert.equal(command.env?.GO_FNS_TEST_TARBALL, 'candidate.tgz');
      assert.equal(command.env.npm_execpath, 'npm-cli');
    }
  });
}
