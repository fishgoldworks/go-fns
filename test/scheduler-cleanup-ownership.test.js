'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api');
const withClock = require('./helpers/clock');

suite('scheduler cleanup ownership regressions', function () {
  for (const name of ['debounce', 'throttle']) {
    for (const mode of ['flush', 'maxWait']) {
      for (const action of ['call', 'cancel', 'cancel-replace', 'flush', 'stale', 'replace-throw']) {
        test(`${name} ${mode} preserves ownership when timer cleanup performs ${action}`, () =>
          withClock((clock) => {
            const seen = [],
              failure = {},
              receiver = {};
            const f = api[name](
              function (value) {
                seen.push([this, value]);
                return value;
              },
              10,
              { leading: false, ...(name === 'debounce' ? { maxWait: 20 } : {}) }
            );
            f('first');
            const stale = [...clock.tasks.values()][0].fn;
            const originalClear = globalThis.clearTimeout;
            let entered = false;
            globalThis.clearTimeout = (handle) => {
              originalClear(handle);
              if (entered) return;
              entered = true;
              if (action === 'call') f.call(receiver, 'replacement');
              if (action === 'cancel') f.cancel();
              if (action === 'cancel-replace' || action === 'replace-throw') {
                f.cancel();
                f.call(receiver, 'replacement');
              }
              if (action === 'flush') f.flush();
              if (action === 'stale') stale();
              if (action === 'replace-throw') throw failure;
            };
            let returned;
            function perform() {
              if (mode === 'flush') return f.flush();
              clock.jump(25);
              return f('latest');
            }
            if (action === 'replace-throw') assert.throws(perform, (error) => error === failure);
            else returned = perform();
            if (action === 'cancel' || action === 'cancel-replace' || action === 'replace-throw') {
              assert.deepEqual(seen, []);
              assert.equal(returned, undefined);
            } else {
              const expected = action === 'call' ? 'replacement' : mode === 'flush' ? 'first' : 'latest';
              assert.deepEqual(seen, [[action === 'call' ? receiver : undefined, expected]]);
              assert.equal(returned, expected);
            }
            const replacementPending = action === 'cancel-replace' || action === 'replace-throw';
            const cooldown = mode === 'maxWait' && (action === 'call' || action === 'stale');
            assert.equal(clock.tasks.size, replacementPending || cooldown ? 1 : 0);
            assert.equal(f.pending(), replacementPending);
            stale();
            assert.equal(clock.tasks.size, replacementPending || cooldown ? 1 : 0);
            clock.tick(50);
            if (replacementPending) assert.deepEqual(seen, [[receiver, 'replacement']]);
            assert.equal(clock.tasks.size, 0);
            assert.equal(f.pending(), false);
            f.cancel();
          }));
      }
    }

    test(`${name} a throwing clear without replacement releases state and preserves cached result`, () =>
      withClock((clock) => {
        const result = {},
          failure = {},
          calls = [];
        const f = api[name](
          (value) => {
            calls.push(value);
            return result;
          },
          10,
          { leading: false }
        );
        f('completed');
        assert.equal(f.flush(), result);
        f('discarded');
        const clear = globalThis.clearTimeout;
        globalThis.clearTimeout = (handle) => {
          clear(handle);
          throw failure;
        };
        assert.throws(
          () => f.flush(),
          (error) => error === failure
        );
        assert.equal(f.pending(), false);
        assert.equal(f.flush(), result);
        assert.equal(clock.tasks.size, 0);
        globalThis.clearTimeout = clear;
        assert.equal(f('replacement'), result);
        clock.tick(10);
        assert.deepEqual(calls, ['completed', 'replacement']);
      }));
  }
});
