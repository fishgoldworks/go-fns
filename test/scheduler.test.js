'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api.js');
const clock = require('./helpers/clock.js');
const { invalidFunctions, values } = require('./helpers/values.js');

suite('debounce and throttle', function () {
  for (const name of ['debounce', 'throttle']) {
    for (const [label, value] of invalidFunctions)
      test(`${name} rejects ${label} callback`, () => assert.throws(() => api[name](value, 10), TypeError));
    for (const wait of [NaN, Infinity, -Infinity, -1, 2147483648, Number.MAX_VALUE])
      test(`${name} rejects out-of-range ${wait} milliseconds`, () =>
        assert.throws(() => api[name](() => 1, wait), RangeError));
    for (const wait of [null, '1', false, {}, [], 1n, Symbol(), new Number(1)])
      test(`${name} rejects ${typeof wait} milliseconds`, () =>
        assert.throws(() => api[name](() => 1, wait), TypeError));
    for (const options of [null, false, 1, '', [], () => {}, Symbol(), 1n])
      test(`${name} rejects ${typeof options} options`, () =>
        assert.throws(() => api[name](() => 1, 10, options), TypeError));
    for (const key of ['leading', 'trailing'])
      for (const value of [null, 0, 1, 'true', {}, []])
        test(`${name} rejects ${key}=${String(value)}`, () =>
          assert.throws(() => api[name](() => 1, 10, { [key]: value }), TypeError));
    for (const leading of [false, true])
      for (const trailing of [false, true])
        test(`${name} edge combination leading=${leading}, trailing=${trailing}`, () =>
          clock((c) => {
            const seen = [];
            const f = api[name](
              (x) => {
                seen.push(x);
                return x;
              },
              10,
              { leading, trailing }
            );
            assert.equal(f('first'), leading ? 'first' : undefined);
            assert.equal(f.pending(), !leading && trailing);
            c.tick(4);
            assert.equal(f('last'), leading ? 'first' : undefined);
            assert.equal(f.pending(), trailing);
            c.tick(30);
            assert.deepEqual(seen, [...(leading ? ['first'] : []), ...(trailing ? ['last'] : [])]);
            assert.equal(f.pending(), false);
            assert.equal(c.tasks.size, 0);
          }));
    test(`${name} does not repeat a single leading call on the trailing edge`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: true, trailing: true });
        assert.equal(f(), 1);
        assert.equal(f.pending(), false);
        c.tick(10);
        assert.equal(calls, 1);
      }));
    test(`${name} captures latest arguments and receiver`, () =>
      clock((c) => {
        const calls = [];
        function fn() {
          calls.push({ receiver: this, args: [...arguments] });
          return calls.length;
        }
        Object.defineProperties(fn, {
          call: {
            get() {
              throw 1;
            }
          },
          apply: {
            get() {
              throw 2;
            }
          }
        });
        const f = api[name](fn, 10, { leading: false });
        const a = {},
          b = {},
          token = {};
        f.call(a, 1);
        c.tick(1);
        f.call(b, token, undefined);
        c.tick(20);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].receiver, b);
        assert.deepEqual(calls[0].args, [token, undefined]);
      }));
    test(`${name} honors bound callbacks`, () =>
      clock((c) => {
        const receiver = {};
        let seen;
        const f = api[name](
          function () {
            seen = this;
          }.bind(receiver),
          10,
          { leading: false }
        );
        f.call({});
        c.tick(10);
        assert.equal(seen, receiver);
      }));
    test(`${name} is lazy and independent between wrappers`, () =>
      clock((c) => {
        const seen = [];
        const a = api[name]((x) => seen.push(x), 10, { leading: false }),
          b = api[name]((x) => seen.push(x), 10, { leading: false });
        assert.equal(c.tasks.size, 0);
        assert.notEqual(a, b);
        a('a');
        b('b');
        a.cancel();
        c.tick(10);
        assert.deepEqual(seen, ['b']);
      }));
    test(`${name} cancel clears handle zero and is idempotent`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: false });
        f();
        assert.ok(c.tasks.has(0));
        assert.equal(f.cancel(), undefined);
        f.cancel();
        assert.equal(f.pending(), false);
        assert.equal(c.tasks.size, 0);
        c.tick(100);
        assert.equal(calls, 0);
      }));
    test(`${name} cancel resets suppression but retains last completed result`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: true });
        assert.equal(f(), 1);
        f();
        f.cancel();
        assert.equal(f.flush(), 1);
        assert.equal(f(), 2);
        c.tick(20);
        assert.equal(calls, 2);
      }));
    test(`${name} flush runs pending work once and clears the actual timer`, () =>
      clock((c) => {
        const f = api[name]((x) => x * 2, 10, { leading: false });
        assert.equal(f.flush(), undefined);
        f(1);
        f(4);
        assert.equal(f.flush(), 8);
        assert.equal(f.pending(), false);
        assert.equal(c.tasks.size, 0);
        assert.equal(f.flush(), 8);
        c.tick(100);
        assert.equal(f.flush(), 8);
      }));
    test(`${name} flushing pure cooldown does not release leading suppression`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: true, trailing: false });
        f();
        assert.equal(f.pending(), false);
        assert.equal(f.flush(), 1);
        assert.equal(f(), 1);
        assert.equal(calls, 1);
        c.tick(10);
      }));
    test(`${name} methods are safely detachable`, () =>
      clock((c) => {
        const f = api[name]((x) => x, 10, { leading: false });
        const { pending, flush, cancel } = f;
        f(3);
        assert.equal(pending.call({}), true);
        assert.equal(flush.call({}), 3);
        f(4);
        cancel.call({});
        assert.equal(pending(), false);
        c.tick(20);
      }));
    test(`${name} releases captured inputs when both edges are disabled`, () =>
      clock((c) => {
        const f = api[name](
          () => {
            throw 1;
          },
          10,
          { leading: false, trailing: false }
        );
        for (let i = 0; i < 10; i++) assert.equal(f({}), undefined);
        assert.equal(c.tasks.size, 0);
        assert.equal(f.pending(), false);
        assert.equal(f.flush(), undefined);
        f.cancel();
      }));
    test(`${name} snapshots options once, rather than retaining them`, () =>
      clock((c) => {
        let l = 0,
          t = 0;
        const options = {
          get leading() {
            l++;
            return false;
          },
          get trailing() {
            t++;
            return true;
          }
        };
        const f = api[name](() => 1, 10, options);
        assert.equal(l, 1);
        assert.equal(t, 1);
        f();
        f();
        c.tick(10);
        assert.equal(l, 1);
        assert.equal(t, 1);
        const mutable = { leading: false, trailing: true };
        let calls = 0;
        const g = api[name](() => ++calls, 10, mutable);
        mutable.trailing = false;
        g();
        c.tick(10);
        assert.equal(calls, 1);
      }));
    test(`${name} accepts null-prototype options and explicit undefined defaults`, () =>
      clock((c) => {
        const options = Object.assign(Object.create(null), { leading: undefined, trailing: undefined });
        const f = api[name](() => 1, undefined, options);
        f();
        c.tick(1);
        f.cancel();
      }));
    test(`${name} propagates configuration getter failures`, () => {
      const error = {};
      assert.throws(
        () =>
          api[name](() => 1, 10, {
            get leading() {
              throw error;
            }
          }),
        (e) => e === error
      );
    });
    test(`${name} does not coerce invalid duration objects`, () => {
      assert.throws(
        () =>
          api[name](() => 1, {
            [Symbol.toPrimitive]() {
              throw new Error('coerced');
            }
          }),
        TypeError
      );
    });
    for (const wait of [0, -0, 0.5, 1, 2147483647])
      test(`${name} accepts bounded milliseconds ${wait}`, () =>
        clock((c) => {
          let calls = 0;
          const f = api[name](() => ++calls, wait, { leading: false });
          f();
          assert.equal(calls, 0);
          c.tick(wait);
          assert.equal(calls, 1);
          assert.equal(c.tasks.size, 0);
        }));
    test(`${name} defaults to zero without invoking a trailing call synchronously`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, undefined, { leading: false });
        f();
        assert.equal(calls, 0);
        c.tick(0);
        assert.equal(calls, 1);
      }));
    test(`${name} clears pending state before invoking a callback`, () =>
      clock((c) => {
        let inside;
        const f = api[name](
          () => {
            inside = f.pending();
          },
          10,
          { leading: false }
        );
        f();
        c.tick(10);
        assert.equal(inside, false);
      }));
    for (const phase of ['leading', 'flush', 'timer'])
      test(`${name} ${phase} callback throw leaves reusable state`, () =>
        clock((c) => {
          let calls = 0;
          const error = {};
          const f = api[name](
            () => {
              if (++calls === 1) throw error;
              return calls;
            },
            10,
            { leading: phase === 'leading' }
          );
          if (phase === 'leading')
            assert.throws(
              () => f(),
              (e) => e === error
            );
          else {
            f();
            assert.throws(
              () => (phase === 'flush' ? f.flush() : c.tick(10)),
              (e) => e === error
            );
          }
          f.cancel();
          f();
          if (phase !== 'leading') c.tick(10);
          assert.equal(calls, 2);
          f.cancel();
        }));
    test(`${name} exceptions do not overwrite previous successful result`, () =>
      clock((c) => {
        let fail = false;
        const error = {};
        const f = api[name](
          () => {
            if (fail) throw error;
            return 7;
          },
          10,
          { leading: false }
        );
        f();
        assert.equal(f.flush(), 7);
        fail = true;
        f();
        assert.throws(
          () => f.flush(),
          (e) => e === error
        );
        assert.equal(f.flush(), 7);
        assert.equal(c.tasks.size, 0);
      }));
    test(`${name} returns promises unchanged; pending is not in-flight state`, async () => {
      const p = Promise.resolve(5);
      clock((c) => {
        const f = api[name](() => p, 10, { leading: false });
        assert.equal(f(), undefined);
        assert.equal(f.flush(), p);
        assert.equal(f.pending(), false);
        assert.equal(c.tasks.size, 0);
      });
      await p;
    });
    test(`${name} callback may recursively schedule another trailing call`, () =>
      clock((c) => {
        const seen = [];
        const f = api[name](
          (value) => {
            seen.push(value);
            if (value === 1) f(2);
          },
          10,
          { leading: false }
        );
        f(1);
        c.tick(10);
        assert.deepEqual(seen, [1]);
        assert.equal(f.pending(), true);
        c.tick(10);
        assert.deepEqual(seen, [1, 2]);
        assert.equal(c.tasks.size, 0);
      }));
    test(`${name} flush preserves a timer created by reentrant scheduling`, () =>
      clock((c) => {
        const seen = [];
        const f = api[name](
          (value) => {
            seen.push(value);
            if (value === 1) f(2);
          },
          10,
          { leading: false }
        );
        f(1);
        f.flush();
        assert.equal(f.pending(), true);
        assert.equal(c.tasks.size, 1);
        c.tick(10);
        assert.deepEqual(seen, [1, 2]);
      }));
    test(`${name} cancellation from inside the callback is respected`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](
          () => {
            calls++;
            f.cancel();
          },
          10,
          { leading: true }
        );
        f();
        assert.equal(c.tasks.size, 0);
        c.tick(20);
        assert.equal(calls, 1);
      }));
    test(`${name} reentrant leading call retains newer trailing arguments`, () =>
      clock((c) => {
        const seen = [];
        const f = api[name](
          (value) => {
            seen.push(value);
            if (value === 1) f(2);
          },
          10,
          { leading: true }
        );
        f(1);
        c.tick(10);
        assert.deepEqual(seen, [1, 2]);
      }));
    test(`${name} rearming does not duplicate timers`, () =>
      clock((c) => {
        const f = api[name](() => 1, 10, { leading: false });
        for (let i = 0; i < 50; i++) {
          f();
          assert.equal(c.tasks.size, 1);
          c.tick(1);
        }
        c.tick(20);
        assert.equal(c.tasks.size, 0);
      }));
    test(`${name} timer creation failures do not leave pending work`, () =>
      clock((c) => {
        const set = global.setTimeout,
          error = {};
        const f = api[name](() => 1, 10, { leading: false });
        global.setTimeout = () => {
          throw error;
        };
        assert.throws(
          () => f(),
          (e) => e === error
        );
        assert.equal(f.pending(), false);
        global.setTimeout = set;
        f();
        c.tick(10);
        assert.equal(f.flush(), 1);
      }));
    test(`${name} wall-clock rollback cannot postpone a due timer forever`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: false });
        f();
        const oldNow = Date.now;
        Date.now = () => -100;
        c.tick(10);
        Date.now = oldNow;
        assert.equal(calls, 1);
        assert.equal(c.tasks.size, 0);
      }));
    test(`${name} due work after blocked event loop uses latest call`, () =>
      clock((c) => {
        const calls = [];
        const f = api[name]((x) => calls.push(x), 10, { leading: false });
        f(1);
        c.jump(50);
        f(2);
        c.tick(20);
        assert.deepEqual(calls, [2]);
      }));
    for (const [label, value] of values)
      test(`${name} preserves result ${label}`, () =>
        clock((c) => {
          const f = api[name](() => value, 10, { leading: false });
          f();
          assert.equal(f.flush(), value);
          assert.equal(f.flush(), value);
          f.cancel();
        }));
  }
  test('debounce waits for silence and keeps only the latest call', () =>
    clock((c) => {
      const seen = [];
      const f = api.debounce((x) => seen.push([c.now(), x]), 10);
      f('a');
      c.tick(9);
      f('b');
      c.tick(9);
      assert.deepEqual(seen, []);
      c.tick(1);
      assert.deepEqual(seen, [[1019, 'b']]);
    }));
  test('throttle defaults to leading and trailing executions during activity', () =>
    clock((c) => {
      const seen = [];
      const f = api.throttle((x) => seen.push([c.now(), x]), 10);
      f('a');
      c.tick(4);
      f('b');
      c.tick(4);
      f('c');
      c.tick(2);
      assert.deepEqual(seen, [
        [1000, 'a'],
        [1010, 'c']
      ]);
      c.tick(20);
      assert.equal(seen.length, 2);
    }));
  test('throttle long continuous stream remains bounded by wait', () =>
    clock((c) => {
      const times = [];
      const f = api.throttle(() => times.push(c.now()), 10);
      for (let i = 0; i < 100; i++) {
        f();
        c.tick(1);
      }
      c.tick(20);
      assert.equal(times.length, 11);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 10);
    }));
  for (const leading of [false, true])
    test(`debounce maxWait forces progress leading=${leading}`, () =>
      clock((c) => {
        const seen = [];
        const f = api.debounce((x) => seen.push([c.now(), x]), 10, { leading, maxWait: 25 });
        for (let i = 0; i < 7; i++) {
          f(i);
          c.tick(4);
        }
        assert.ok(seen.some(([time]) => time === 1025));
        c.tick(20);
        assert.deepEqual(
          seen,
          leading
            ? [
                [1000, 0],
                [1025, 6]
              ]
            : [[1025, 6]]
        );
      }));
  test('debounce maxWait is measured from window start, not epoch', () =>
    clock((c) => {
      const seen = [];
      const f = api.debounce(() => seen.push(c.now()), 10, { maxWait: 20 });
      c.jump(1000000);
      f();
      c.tick(9);
      f();
      c.tick(9);
      f();
      c.tick(2);
      assert.deepEqual(seen, [1001020]);
    }));
  test('debounce maxWait honors the next call when timer dispatch is delayed', () =>
    clock((c) => {
      const seen = [];
      const f = api.debounce((x) => seen.push(x), 10, { maxWait: 20 });
      f(1);
      c.jump(30);
      f(2);
      assert.deepEqual(seen, [2]);
      assert.equal(c.tasks.size, 1);
      c.tick(20);
      assert.deepEqual(seen, [2]);
    }));
  for (const value of [null, '20', true, {}, [], 1n, Symbol()])
    test(`debounce rejects ${typeof value} maxWait`, () =>
      assert.throws(() => api.debounce(() => 1, 10, { maxWait: value }), TypeError));
  for (const value of [NaN, Infinity, -Infinity, -1, 9, 2147483648])
    test(`debounce rejects invalid maxWait ${value}`, () =>
      assert.throws(() => api.debounce(() => 1, 10, { maxWait: value }), RangeError));
  test('debounce reads maxWait once', () =>
    clock((c) => {
      let reads = 0;
      const f = api.debounce(() => 1, 10, {
        get maxWait() {
          reads++;
          return 20;
        }
      });
      f();
      c.tick(10);
      assert.equal(reads, 1);
    }));
  test('debounce maxWait zero defers its first trailing call', () =>
    clock((c) => {
      let calls = 0;
      const f = api.debounce(() => ++calls, 0, { maxWait: 0 });
      f();
      assert.equal(calls, 0);
      c.tick(0);
      assert.equal(calls, 1);
    }));
  test('debounce ignores maxWait only when omitted or explicitly undefined', () =>
    clock((c) => {
      const f = api.debounce(() => 1, 10, { maxWait: undefined });
      f();
      c.tick(10);
      assert.equal(f.flush(), 1);
    }));
  test('throttle does not accidentally read a debounce-only maxWait option', () =>
    clock((c) => {
      const f = api.throttle(() => 1, 10, {
        get maxWait() {
          throw 1;
        }
      });
      f();
      c.tick(10);
    }));
  for (const name of ['debounce', 'throttle'])
    test(`${name} also executes correctly on real native timers`, async () => {
      const seen = [];
      const f = api[name]((x) => seen.push(x), 5, { leading: false });
      f(1);
      f(2);
      await new Promise((resolve) => setTimeout(resolve, 25));
      assert.deepEqual(seen, [2]);
      assert.equal(f.pending(), false);
      f.cancel();
    });
});
suite('throttle spacing regression', function () {
  test('a trailing invocation starts a fresh minimum-spacing interval', () =>
    clock((c) => {
      const seen = [];
      const f = api.throttle((x) => seen.push([c.now(), x]), 10);
      f('leading');
      c.tick(1);
      f('trailing');
      c.tick(9);
      c.tick(1);
      f('next');
      assert.deepEqual(seen, [
        [1000, 'leading'],
        [1010, 'trailing']
      ]);
      c.tick(8);
      assert.equal(seen.length, 2);
      c.tick(1);
      assert.deepEqual(seen, [
        [1000, 'leading'],
        [1010, 'trailing'],
        [1020, 'next']
      ]);
    }));
});
suite('scheduler encapsulation', function () {
  for (const name of ['debounce', 'throttle'])
    test(`${name} flush does not depend on an overwritten public pending method`, () =>
      clock((c) => {
        let calls = 0;
        const f = api[name](() => ++calls, 10, { leading: false });
        f();
        f.pending = () => false;
        assert.equal(f.flush(), 1);
        assert.equal(c.tasks.size, 0);
      }));
});
suite('scheduler early-dispatch and model checks', function () {
  for (const name of ['debounce', 'throttle'])
    test(`${name} rearms an early host timer without executing early`, () =>
      clock((c) => {
        const calls = [];
        const f = api[name](() => calls.push(c.now()), 10, { leading: false });
        f();
        const [id, task] = [...c.tasks][0];
        c.tasks.delete(id);
        c.jump(3);
        task.fn();
        assert.deepEqual(calls, []);
        assert.equal(c.tasks.size, 1);
        c.tick(7);
        assert.deepEqual(calls, [1010]);
        assert.equal(c.tasks.size, 0);
      }));
  for (const name of ['debounce', 'throttle'])
    test(`${name} drops pending work when timer rearming fails`, () =>
      clock((c) => {
        const f = api[name](() => 1, 10, { leading: false });
        f();
        const [id, task] = [...c.tasks][0];
        c.tasks.delete(id);
        c.jump(3);
        const set = global.setTimeout,
          error = {};
        global.setTimeout = () => {
          throw error;
        };
        assert.throws(
          () => task.fn(),
          (e) => e === error
        );
        assert.equal(f.pending(), false);
        assert.equal(c.tasks.size, 0);
        global.setTimeout = set;
        f();
        c.tick(10);
        assert.equal(f.flush(), 1);
      }));
  for (let seed = 1; seed <= 16; seed++)
    test(`debounce trailing matches an independent burst model, seed ${seed}`, () =>
      clock((c) => {
        let state = seed;
        const expected = [],
          actual = [];
        let pending, time;
        const f = api.debounce((value) => actual.push([c.now(), value]), 10);
        for (let i = 0; i < 100; i++) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          const step = state % 17;
          const next = c.now() + step;
          if (pending !== undefined && time + 10 <= next) {
            expected.push([time + 10, pending]);
          }
          c.tick(step);
          f(i);
          pending = i;
          time = c.now();
        }
        if (pending !== undefined) expected.push([time + 10, pending]);
        c.tick(10);
        assert.deepEqual(actual, expected);
        assert.equal(c.tasks.size, 0);
      }));
  for (let seed = 1; seed <= 16; seed++)
    test(`throttle maintains ordinary spacing and latest final value, seed ${seed}`, () =>
      clock((c) => {
        let state = seed;
        const actual = [];
        const f = api.throttle((value) => actual.push([c.now(), value]), 10);
        for (let i = 0; i < 100; i++) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          c.tick(state % 17);
          f(i);
        }
        c.tick(20);
        for (let i = 1; i < actual.length; i++) assert.ok(actual[i][0] - actual[i - 1][0] >= 10);
        assert.equal(actual.at(-1)[1], 99);
        assert.equal(f.pending(), false);
        assert.equal(c.tasks.size, 0);
      }));
});
