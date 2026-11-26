'use strict';

const assert = require('node:assert/strict');
const api = require('./helpers/api');
const withClock = require('./helpers/clock');

// Observable contracts for releasing unused scheduler inputs, without GC deadlines
// or speed thresholds. The opt-in weak-reference diagnostic is kept separately.
suite('scheduler retained-input compatibility', function () {
  for (const name of ['debounce', 'throttle']) {
    test(`${name} leading-only suppression preserves cooldown, receiver and cached object result`, () =>
      withClock((clock) => {
        const calls = [],
          result = {},
          firstThis = {},
          nextThis = {};
        const fn = api[name](
          function (value) {
            calls.push([this, value]);

            return result;
          },
          10,
          { leading: true, trailing: false }
        );

        assert.equal(fn.call(firstThis, 'first'), result);
        for (let i = 0; i < 9; i++) {
          clock.tick(1);
          assert.equal(fn.call({ discarded: i }, { discarded: i }), result);
          assert.equal(fn.pending(), false);
          assert.equal(fn.flush(), result);
        }

        assert.equal(calls.length, 1);
        clock.tick(20);
        assert.equal(clock.tasks.size, 0);
        assert.equal(fn.call(nextThis, 'next'), result);
        assert.deepEqual(calls, [
          [firstThis, 'first'],
          [nextThis, 'next']
        ]);
        fn.cancel();
      }));

    for (const handleKind of ['zero', 'object']) {
      test(`${name} keeps reentrant leading arguments until ${handleKind} timer registration completes`, () =>
        withClock((clock) => {
          const register = globalThis.setTimeout,
            clear = globalThis.clearTimeout;
          const replacement = {},
            received = [],
            handles = new Map();
          let reentered = false;
          const fn = api[name](
            function () {
              received.push([this, ...arguments]);

              return arguments[0];
            },
            10,
            { leading: true, trailing: false }
          );

          globalThis.setTimeout = (callback, delay) => {
            if (!reentered) {
              reentered = true;
              assert.equal(fn.call(replacement, 'latest', undefined), undefined);
            }

            const id = register(callback, delay);

            if (handleKind === 'zero') {
              return id;
            }

            const handle = { id };

            handles.set(handle, id);

            return handle;
          };

          globalThis.clearTimeout = (handle) => clear(handleKind === 'zero' ? handle : handles.get(handle));
          assert.equal(fn('original'), 'latest');
          assert.deepEqual(received, [[replacement, 'latest', undefined]]);
          assert.equal(fn.pending(), false);
          clock.tick(10);
          assert.equal(received.length, 1);
          assert.equal(clock.tasks.size, 0);
        }));
    }

    test(`${name} recursive suppression from its callback does not become later work`, () =>
      withClock((clock) => {
        const seen = [];
        let fn;

        fn = api[name](
          (value) => {
            seen.push(value);
            if (value === 'outer') assert.equal(fn('suppressed'), undefined);

            return value;
          },
          10,
          { leading: true, trailing: false }
        );
        assert.equal(fn('outer'), 'outer');
        assert.equal(fn.flush(), 'outer');
        assert.equal(fn.pending(), false);
        clock.tick(20);
        assert.deepEqual(seen, ['outer']);
        assert.equal(fn('new'), 'new');
        fn.cancel();
      }));

    test(`${name} cancelled leading-only calls cannot suppress fresh replacement work`, () =>
      withClock((clock) => {
        const calls = [];
        const fn = api[name](
          (value) => {
            calls.push(value);

            return value;
          },
          10,
          { leading: true, trailing: false }
        );

        assert.equal(fn('first'), 'first');
        fn('discarded');
        const { cancel, pending, flush } = fn;

        cancel();
        assert.equal(pending(), false);
        assert.equal(flush(), 'first');
        assert.equal(fn('replacement'), 'replacement');
        clock.tick(20);
        assert.deepEqual(calls, ['first', 'replacement']);
      }));

    test(`${name} trailing inputs stay available after suppression and preserve the latest receiver`, () =>
      withClock((clock) => {
        const token = {},
          receiver = {},
          calls = [];
        const fn = api[name](
          function (value) {
            calls.push([this, value]);

            return value;
          },
          10,
          { leading: true, trailing: true }
        );

        assert.equal(fn('first'), 'first');
        fn.call(receiver, token);
        assert.equal(fn.pending(), true);
        assert.equal(fn.flush(), token);
        assert.deepEqual(calls, [
          [undefined, 'first'],
          [receiver, token]
        ]);
        assert.equal(clock.tasks.size, 0);
        assert.equal(fn.pending(), false);
      }));

    test(`${name} callback failure keeps the previous successful result and cooldown`, () =>
      withClock((clock) => {
        const failure = {},
          seen = [];
        const fn = api[name](
          (value) => {
            seen.push(value);

            if (value === 'fail') throw failure;

            return value;
          },
          10,
          { leading: true, trailing: false }
        );

        assert.equal(fn(false), false);
        clock.tick(10);
        assert.throws(
          () => fn('fail'),
          (error) => error === failure
        );
        assert.equal(fn('ignored'), false);
        assert.equal(fn.flush(), false);
        clock.tick(20);
        assert.deepEqual(seen, [false, 'fail']);
      }));
  }

  test('leading-only debounce maxWait invokes the newest call even after suppressed inputs were released', () =>
    withClock((clock) => {
      const seen = [];
      const fn = api.debounce(
        (value) => {
          seen.push(value);

          return value;
        },
        10,
        {
          leading: true,
          trailing: false,
          maxWait: 25
        }
      );

      assert.equal(fn('first'), 'first');
      for (let i = 1; i <= 5; i++) {
        clock.jump(5);
        fn(i);
      }

      assert.deepEqual(seen, ['first', 5]);
      assert.equal(fn.pending(), false);
      clock.tick(20);
      assert.deepEqual(seen, ['first', 5]);
    }));

  test('leading-only debounce retains latest input during maxWait replacement registration', () =>
    withClock((clock) => {
      const register = globalThis.setTimeout,
        seen = [];
      const fn = api.debounce(
        (value) => {
          seen.push(value);

          return value;
        },
        10,
        {
          leading: true,
          trailing: false,
          maxWait: 25
        }
      );

      fn('first');
      for (let i = 0; i < 4; i++) {
        clock.jump(5);
        fn('discarded');
      }

      let entered = false;

      globalThis.setTimeout = (callback, wait) => {
        if (!entered) {
          entered = true;
          fn('replacement');
        }

        return register(callback, wait);
      };

      clock.jump(5);
      assert.equal(fn('outer'), 'replacement');
      assert.deepEqual(seen, ['first', 'replacement']);
      clock.tick(20);
      assert.equal(clock.tasks.size, 0);
    }));
});
