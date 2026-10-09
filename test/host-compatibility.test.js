'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const entry = process.env.GO_FNS_TEST_ENTRY
  ? path.resolve(process.env.GO_FNS_TEST_ENTRY)
  : path.resolve(__dirname, '..');

suite('timer host compatibility', function () {
  for (const alias of ['globalThis', 'self', 'global', 'window']) {
    test(`timer APIs work with only the ${alias} host alias and read capabilities lazily`, () => {
      const run = spawnSync(
        process.execPath,
        [
          '-e',
          `
                'use strict';
                const assert = require('node:assert/strict');
                const host = global;
                const alias = process.argv[1];
                for (const name of ['globalThis', 'self', 'global', 'window']) delete host[name];
                host[alias] = host;
                let importing = true, clockReads = 0, callback, receiver;
                Object.defineProperty(host, 'performance', {configurable: true, get() {
                    assert.equal(importing, false, 'Import read the clock host');
                    clockReads++;
                    return undefined;
                }});
                Object.defineProperty(host, 'setTimeout', {configurable: true, get() {
                    assert.equal(importing, false, 'Import read the timer host');
                    return function (fn, duration) { receiver = this; callback = fn; return 23; };
                }});
                host.clearTimeout = function (handle) { assert.equal(handle, 23); };
                const api = require(process.argv[2]);
                importing = false;
                assert.equal(api.delay(function () {}, 5), 23);
                assert.equal(receiver, host);
                assert.equal(clockReads, 0);
                const waiting = api.sleep(5);
                assert.equal(receiver, host);
                callback();
                for (const name of ['debounce', 'throttle']) {
                    let seen;
                    const context = {};
                    const scheduled = api[name](function (value) { seen = [this, value]; return value; }, 5, {leading: false});
                    assert.equal(clockReads, name === 'debounce' ? 1 : 2);
                    scheduled.call(context, 'value');
                    assert.equal(scheduled.pending(), true);
                    assert.equal(scheduled.flush(), 'value');
                    assert.deepEqual(seen, [context, 'value']);
                    assert.equal(scheduled.pending(), false);
                }
                waiting.then(value => { assert.equal(value, undefined); console.log('host contract checked'); }).catch(error => {
                    console.error(error); process.exitCode = 1;
                });
            `,
          alias,
          entry
        ],
        { encoding: 'utf8', timeout: 10000 }
      );
      assert.ifError(run.error);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      assert.match(run.stdout, /host contract checked/);
    });
  }
});

// No named host is an unsupported embedding; fail at the requested operation.
// Bundlers can provide their own global resolver, so this checks source directly.
test('a source consumer without any host alias gets a clear lazy failure', () => {
  const run = spawnSync(
    process.execPath,
    [
      '-e',
      `
    const assert = require('assert');
    const host = global;
    for (const name of ['globalThis', 'self', 'global', 'window']) delete host[name];
    const api = require(process.argv[1]);
    assert.strictEqual(api.pipe(x => x + 1)(1), 2);
    const expected = /No supported host global/;
    assert.throws(() => api.delay(() => {}), expected);
    assert.throws(() => api.debounce(() => {}), expected);
    assert.throws(() => api.throttle(() => {}), expected);
    api.sleep(1).then(() => { throw Error('Expected rejection'); }, error => {
      assert.match(error.message, expected);
      console.log('unsupported host checked');
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `,
      path.resolve(__dirname, '..')
    ],
    { encoding: 'utf8', timeout: 10000 }
  );
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /unsupported host checked/);
});
