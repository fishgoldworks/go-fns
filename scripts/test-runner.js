'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');

function fixture(files, action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-runner-'));
  try {
    fs.cpSync(path.join(project, 'scripts'), path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'test'));
    for (const [file, source] of Object.entries(files)) {
      const filename = path.join(root, file);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, source);
    }
    return action(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function run(root, flags = [], runner = 'scripts/test.js') {
  const env = { ...process.env, NODE_OPTIONS: '', GO_FNS_TEST_ENTRY: '' };
  // Each fixture is a fresh test command, not this parent node:test worker.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ['--test-reporter=tap', runner, ...(runner === 'scripts/test.js' ? ['--test-reporter=tap'] : []), ...flags],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env
    }
  );
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
}
for (const [name, files] of [
  ['an empty test directory', {}],
  ['a file registering no tests', { 'test/empty.test.js': '' }],
  ['an early zero exit during registration', { 'test/early.test.js': 'process.exit(0);' }],
  [
    'an early zero exit in a test',
    { 'test/early.test.js': "test('early',()=>process.exit(0)); test('unreached',()=>{throw Error('must run');});" }
  ],
  ['a missing test body', { 'test/empty.test.js': "test('accidentally missing callback');" }]
]) {
  test('runtime runner rejects ' + name, () =>
    fixture(files, (root) => {
      const result = run(root);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /incomplete|No .*tests|callback.*function/i);
    })
  );
}
test('filter matching no cases is not a successful test run', () =>
  fixture(
    {
      'test/test.test.js': "test('known',()=>{});"
    },
    (root) => {
      const result = run(root, ['--test-name-pattern=does-not-exist']);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /No .*tests|incomplete/i);
    }
  ));
test('runtime runner discovers nested tests and excludes helpers', () =>
  fixture(
    {
      'test/first.test.js': "test('first',()=>{});",
      'test/logic/deep.test.js': "suite('nested',()=>{test('second',async()=>{await Promise.resolve();});});",
      'test/helpers/unselected.js': "throw Error('a fixture is not a test');"
    },
    (root) => {
      const result = run(root);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /# tests 2\b/);
    }
  ));
test('a valid filter still works', () =>
  fixture(
    {
      'test/example.test.js': "test('selected',()=>{});test('excluded',()=>{throw Error('must not run');});"
    },
    (root) => {
      const result = run(root, ['--test-name-pattern=^selected$']);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /# tests 1\b/);
    }
  ));
for (const [name, body, diagnostic] of [
  ['sync assertion', "throw Error('sync sentinel');", /sync sentinel/],
  ['async rejection', "return Promise.reject(Error('async sentinel'));", /async sentinel/],
  ['late asynchronous failure', "setImmediate(()=>{throw Error('late sentinel');});", /late sentinel/],
  ['uncaught registration failure', null, /registration sentinel/],
  ['nonzero process exit', 'process.exit(7);', /exitCode: 7|incomplete/],
  ['unsettled async test', 'return new Promise(()=>{});', /pending|cancelled|incomplete|timed out/]
]) {
  test('runtime runner propagates ' + name, () =>
    fixture(
      {
        'test/example.test.js': body === null ? "throw Error('registration sentinel');" : `test('case',()=>{${body}});`
      },
      (root) => {
        const result = run(root);
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, diagnostic);
      }
    )
  );
}
test('explicit-file mode executes only the selected file', () =>
  fixture(
    {
      'test/selected.test.js': "test('selected',()=>{});",
      'test/not-selected.test.js': "throw Error('not selected');"
    },
    (root) => {
      const result = run(root, ['test/selected.test.js'], 'scripts/run-tests.js');
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /# tests 1\b/);
    }
  ));
for (const missing of ['index.js', 'src/unused.js']) {
  test('native coverage rejects unloaded production file ' + missing, () =>
    fixture(
      {
        'index.js': 'module.exports = {};',
        'src/unused.js': 'module.exports = function untested(flag) { return flag ? 1 : 2; };',
        'test/covered.test.js':
          missing === 'index.js' ? "test('unrelated',()=>{});" : "test('root',()=>require('../index'));"
      },
      (root) => {
        const result = run(root, ['--experimental-test-coverage']);
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /Unloaded production module/);
      }
    )
  );
}
test('native coverage accepts a fully loaded source inventory', () =>
  fixture(
    {
      'index.js': "module.exports = require('./src/value');",
      'src/value.js': 'module.exports = 42;',
      'test/source.test.js': "test('source',()=>require('node:assert/strict').equal(require('../index'),42));"
    },
    (root) => {
      const result = run(root, ['--experimental-test-coverage']);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /# end of coverage report/);
    }
  ));
test('CLI starts a fresh harness even when called from a node:test worker', () =>
  fixture(
    {
      'test/example.test.js': "test('really executed',()=>{});"
    },
    (root) => {
      const result = spawnSync(process.execPath, ['scripts/test.js', '--test-reporter=tap'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, NODE_OPTIONS: '', NODE_TEST_CONTEXT: 'child-v8' }
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /# tests 1\b/);
      assert.doesNotMatch(result.stderr, /recursively/);
    }
  ));
test('a blocked synchronous test fails under a parent-enforced file deadline', () =>
  fixture(
    {
      'test/blocked.test.js': "test('blocked',()=>{while(true) { /* deliberate test fixture */ }});"
    },
    (root) => {
      const result = run(root, ['--test-timeout=250']);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /timed out|testTimeoutFailure/);
    }
  ));

for (const flags of [
  ['--test-timeout', '250'],
  ['--test-timeout=10000', '--test-timeout=250']
]) {
  test('external deadline respects ' + flags.join(' '), () =>
    fixture(
      {
        'test/blocked.test.js': "test('blocked',()=>{while(true) {}});"
      },
      (root) => {
        const start = Date.now();
        const result = run(root, flags);
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /timed out/);
        assert.ok(Date.now() - start < 5000, result.output);
      }
    )
  );
}

test('external deadline terminates the test worker and its descendants', () =>
  fixture(
    {
      'test/blocked.test.js': `test('blocked',()=>{
    const child=require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},30000)'],{stdio:'ignore'});
    require('node:fs').writeFileSync('descendant.pid',String(child.pid));
    while(true) {}
  });`
    },
    (root) => {
      let pid;
      try {
        const result = run(root, ['--test-timeout=1000']);
        pid = Number(fs.readFileSync(path.join(root, 'descendant.pid'), 'utf8'));
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /timed out/);
        assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      } finally {
        const file = path.join(root, 'descendant.pid');
        if (!pid && fs.existsSync(file)) pid = Number(fs.readFileSync(file, 'utf8'));
        if (pid) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch (error) {
            // The supervisor normally already stopped this fixture descendant.
          }
        }
      }
    }
  ));

for (const runner of ['scripts/test.js', 'scripts/run-tests.js']) {
  const flags = runner === 'scripts/run-tests.js' ? ['test/cleanup.test.js'] : [];
  for (const [name, body, diagnostic] of [
    ['pending promise', 'return new Promise(() => {});', /incomplete|cancelled|pending/i],
    ['early zero exit', 'process.exit(0);', /incomplete/i],
    ['throw', "throw Error('cleanup sentinel');", /cleanup sentinel/],
    ['rejection', "return Promise.reject(Error('cleanup sentinel'));", /cleanup sentinel/]
  ]) {
    test(`${runner} rejects root cleanup ${name} after a passing test`, () =>
      fixture(
        {
          'test/cleanup.test.js': `
            const { after } = require('node:test');
            test('valid', () => {});
            after(() => { ${body} });
            after(() => { throw Error('later cleanup must not be hidden'); });
          `
        },
        (root) => {
          const result = run(root, flags, runner);
          assert.notEqual(result.status, 0, result.output);
          assert.match(result.output, diagnostic);
        }
      ));
  }
  test(`${runner} waits for successful root cleanup in registration order`, () =>
    fixture(
      {
        'test/cleanup.test.js': `
          const { after } = require('node:test');
          const events = [];
          test('valid', () => events.push('test'));
          after(async () => {
            await new Promise(resolve => setImmediate(resolve));
            events.push('async cleanup');
          });
          after(() => {
            events.push('later cleanup');
            require('node:fs').writeFileSync('cleanup.json', JSON.stringify(events));
          });
        `
      },
      (root) => {
        const result = run(root, flags, runner);
        assert.equal(result.status, 0, result.output);
        assert.equal(require('./check-test-output').tapSummary(result.stdout), 1);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'cleanup.json'), 'utf8')), [
          'test',
          'async cleanup',
          'later cleanup'
        ]);
      }
    ));
}
