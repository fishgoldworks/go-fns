'use strict';

const assert = require('node:assert/strict');
const api = require('./helpers/api.js');
const clock = require('./helpers/clock.js');

suite('monotonic scheduling', function () {
  for (const direction of [-1, 1]) {
    for (const name of ['debounce', 'throttle']) {
      test(`${name} ignores a ${direction > 0 ? 'forward' : 'backward'} wall clock jump`, () =>
        clock((c) => {
          const seen = [];
          const f = api[name]((x) => seen.push([c.now(), x]), 100, { leading: true, trailing: true });

          f('first');
          c.tick(1);
          c.wallJump(direction * 3600000);
          f('last');
          assert.deepEqual(seen, [[1000, 'first']]);
          c.tick(99);
          if (name === 'debounce') {
            assert.equal(seen.length, 1);
            c.tick(1);
          }

          assert.deepEqual(seen, [
            [1000, 'first'],
            [name === 'debounce' ? 1101 : 1100, 'last']
          ]);
          assert.equal(c.tasks.size, 0);
        }));
    }

    test(`maxWait uses elapsed time despite wall clock jump ${direction}`, () =>
      clock((c) => {
        const seen = [],
          f = api.debounce(() => seen.push(c.now()), 10, { maxWait: 25 });

        f();
        c.tick(5);
        c.wallJump(direction * 3600000);
        for (let i = 0; i < 4; i++) {
          f();
          c.tick(5);
        }

        assert.deepEqual(seen, [1025]);
        c.tick(10);
        assert.equal(seen.length, 1);
      }));
  }

  test('clock is captured per wrapper and host receiver is retained', () =>
    clock((c) => {
      const host = {
        now() {
          assert.equal(this, host);

          return c.now();
        }
      };

      Object.defineProperty(globalThis, 'performance', { configurable: true, value: host });
      let calls = 0;
      const f = api.throttle(() => ++calls, 10);

      f();
      c.tick(1);
      Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => 1e9 } });
      f();
      assert.equal(calls, 1);
      c.tick(9);
      assert.equal(calls, 2);
    }));

  for (const missing of [undefined, null, {}, { now: 1 }]) {
    test(`fallback clock works without performance.now (${String(missing)})`, () =>
      clock((c) => {
        Object.defineProperty(globalThis, 'performance', { configurable: true, value: missing });
        let calls = 0;
        const f = api.debounce(() => ++calls, 10);

        f();
        c.tick(10);
        assert.equal(calls, 1);
        assert.equal(c.tasks.size, 0);
      }));
  }
});

suite('clock selection and adapter isolation', function () {
  for (const name of ['debounce', 'throttle']) {
    test(`${name} snapshots a clock accessor exactly once`, () =>
      clock((c) => {
        let reads = 0,
          calls = 0;
        const host = {
          get now() {
            reads++;

            return function () {
              assert.equal(this, host);

              return c.now();
            };
          }
        };

        Object.defineProperty(globalThis, 'performance', { configurable: true, value: host });
        const f = api[name](() => ++calls, 10, { leading: false });

        assert.equal(reads, 1);
        f();
        c.tick(10);
        assert.equal(calls, 1);
        assert.equal(reads, 1);
      }));

    test(`${name} uses the intrinsic bind rather than a clock function's property`, () =>
      clock((c) => {
        function now() {
          return c.now();
        }

        Object.defineProperty(now, 'bind', {
          get() {
            throw new Error('Unexpected property access');
          }
        });
        Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now } });
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: false });

        f();
        c.tick(10);
        assert.equal(calls, 1);
      }));
  }

  for (const name of ['partial', 'partialRight']) {
    const values = [undefined, null, false, 0, -0, NaN, 1n, Symbol('value'), {}, [], function callback() {}];

    for (const fixed of [0, 1, 3, 7])
      for (const count of [0, 1, 8, 32]) {
        test(`${name} mixed values preserve identity: saved ${fixed}, supplied ${count}`, () => {
          const saved = Array.from({ length: fixed }, (_, i) => values[i % values.length]);
          const supplied = Array.from({ length: count }, (_, i) => values[(i + 3) % values.length]);
          const receiver = {};
          const seen = [];
          const proxy = new Proxy(function () {}, {
            apply(target, thisArg, args) {
              assert.equal(thisArg, receiver);
              const expected = name === 'partial' ? [...saved, ...supplied] : [...supplied, ...saved];

              assert.equal(args.length, expected.length);
              for (let i = 0; i < args.length; i++) assert.ok(Object.is(args[i], expected[i]));
              seen.push(args);
              args.length = 0;

              return receiver;
            }
          });
          const wrapper = api[name](proxy, ...saved);

          assert.equal(Reflect.apply(wrapper, receiver, supplied), receiver);
          assert.equal(Reflect.apply(wrapper, receiver, supplied), receiver);
          assert.notEqual(seen[0], seen[1]);
        });
      }
  }
});

suite('scheduler clock failure recovery', () => {
  for (const clockSource of ['performance', 'Date']) {
    for (const name of ['debounce', 'throttle']) {
      for (const interrupted of [false, true]) {
        test(`${name} releases expired work after a ${clockSource} failure (${interrupted ? 'renewed' : 'due'})`, () =>
          clock((c) => {
            const reason = {},
              receiver = {},
              cached = {},
              discarded = {},
              retry = {};
            let fail = false;
            const now = () => {
              if (fail) throw reason;

              return c.now();
            };

            Object.defineProperty(globalThis, 'performance', {
              configurable: true,
              value: clockSource === 'performance' ? { now } : undefined
            });
            if (clockSource === 'Date') Date.now = now;
            const seen = [];
            const scheduled = api[name](
              function (value) {
                assert.equal(this, receiver);
                seen.push(value);

                return value;
              },
              10,
              { leading: false }
            );

            scheduled.call(receiver, cached);
            c.tick(10);
            assert.equal(scheduled.flush(), cached);
            scheduled.call(receiver, discarded);
            if (interrupted) {
              c.tick(5);
              scheduled.call(receiver, discarded);
            }

            fail = true;
            assert.throws(
              () => c.tick(interrupted ? 5 : 10),
              (error) => error === reason
            );
            fail = false;
            assert.equal(c.tasks.size, 0);
            assert.equal(scheduled.pending(), false);
            assert.equal(scheduled.flush(), cached);
            assert.deepEqual(seen, [cached]);
            scheduled.call(receiver, retry);
            c.tick(10);
            assert.deepEqual(seen, [cached, retry]);
            assert.equal(scheduled.flush(), retry);
            assert.equal(scheduled.pending(), false);
            assert.equal(c.tasks.size, 0);
          }));
      }

      test(`${name} preserves new work created during a failing ${clockSource} read`, () =>
        clock((c) => {
          const reason = {},
            replacement = {},
            receiver = {};
          let fail = false,
            scheduled;
          const now = () => {
            if (fail) {
              fail = false;
              scheduled.cancel();
              scheduled.call(receiver, replacement);
              throw reason;
            }

            return c.now();
          };

          Object.defineProperty(globalThis, 'performance', {
            configurable: true,
            value: clockSource === 'performance' ? { now } : undefined
          });
          if (clockSource === 'Date') Date.now = now;
          const seen = [];

          scheduled = api[name](
            function (value) {
              assert.equal(this, receiver);
              seen.push(value);

              return value;
            },
            10,
            { leading: false }
          );
          scheduled.call(receiver, 'discarded');
          fail = true;
          assert.throws(
            () => c.tick(10),
            (error) => error === reason
          );
          assert.equal(scheduled.pending(), true);
          assert.equal(c.tasks.size, 1);
          assert.equal(seen.length, 0);
          c.tick(10);
          assert.deepEqual(seen, [replacement]);
          assert.equal(scheduled.flush(), replacement);
          assert.equal(c.tasks.size, 0);
        }));
    }
  }
});

suite('clock reentry preserves completion ownership', () => {
  for (const name of ['debounce', 'throttle']) {
    for (const edge of ['expiry', 'flush']) {
      for (const failing of [false, true]) {
        for (const replace of [false, true]) {
          test(`${name} ${edge} preserves clock ${replace ? 'replacement' : 'cancellation'} (${failing ? 'throw' : 'return'})`, () =>
            clock((c) => {
              const reason = {},
                receiver = {},
                cached = {},
                replacement = {};
              let onRead;

              Object.defineProperty(globalThis, 'performance', {
                configurable: true,
                value: {
                  now() {
                    if (onRead) {
                      const run = onRead;

                      onRead = undefined;
                      run();
                    }

                    return c.now();
                  }
                }
              });
              const seen = [];
              const scheduled = api[name](
                function (value) {
                  assert.equal(this, receiver);
                  seen.push(value);

                  return value;
                },
                10,
                { leading: false }
              );

              scheduled.call(receiver, cached);
              assert.equal(scheduled.flush(), cached);
              scheduled.call(receiver, 'discarded');
              onRead = () => {
                scheduled.cancel();
                if (replace) scheduled.call(receiver, replacement);
                if (failing) throw reason;
              };

              const complete = () => (edge === 'expiry' ? c.tick(10) : scheduled.flush());

              if (failing) assert.throws(complete, (error) => error === reason);
              else if (edge === 'flush') assert.equal(complete(), cached);
              else complete();
              assert.deepEqual(seen, [cached]);
              assert.equal(scheduled.pending(), replace);
              assert.equal(c.tasks.size, replace ? 1 : 0);
              c.tick(10);
              assert.deepEqual(seen, replace ? [cached, replacement] : [cached]);
              assert.equal(scheduled.pending(), false);
              assert.equal(c.tasks.size, 0);
            }));
        }
      }
    }
  }
});
