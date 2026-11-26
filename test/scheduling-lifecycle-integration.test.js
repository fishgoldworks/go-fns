'use strict';

const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const api = require('./helpers/api');
const withClock = require('./helpers/clock');

suite('sleep registration ownership regressions', function () {
  for (const handle of [0, 17, { timer: 'native-like' }]) {
    for (const trigger of ['getter', 'before-allocation', 'after-allocation']) {
      test(`abort during ${trigger} releases returned ${typeof handle} timer handle`, async () => {
        const originalSet = Object.getOwnPropertyDescriptor(globalThis, 'setTimeout');
        const originalClear = globalThis.clearTimeout;
        const controller = new AbortController();
        const reason = {};
        const jobs = new Map();
        const cleared = [];
        let staleCallback;

        function register(fn) {
          assert.equal(this, globalThis);
          if (trigger === 'before-allocation') controller.abort(reason);
          staleCallback = fn;
          jobs.set(handle, fn);
          if (trigger === 'after-allocation') controller.abort(reason);

          return handle;
        }

        Object.defineProperty(globalThis, 'setTimeout', {
          configurable: true,
          get() {
            if (trigger === 'getter') controller.abort(reason);

            return register;
          }
        });
        globalThis.clearTimeout = (id) => {
          cleared.push(id);
          jobs.delete(id);
        };

        try {
          const waiting = api.sleep(60_000, { signal: controller.signal });

          await assert.rejects(waiting, (error) => error === reason);
          assert.equal(jobs.size, 0, 'settlement must not leave a newly registered timer alive');
          assert.deepEqual(cleared, [handle]);
          assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
          staleCallback();
          assert.deepEqual(cleared, [handle], 'a stale callback cannot clean up twice');
        } finally {
          Object.defineProperty(globalThis, 'setTimeout', originalSet);
          globalThis.clearTimeout = originalClear;
        }
      });
    }
  }

  test('late timer cleanup failure does not replace the already chosen abort reason', async () => {
    const originalSet = globalThis.setTimeout;
    const originalClear = globalThis.clearTimeout;
    const controller = new AbortController();
    const reason = {};
    const cleanupError = {};
    let cleared = 0;

    globalThis.setTimeout = () => {
      controller.abort(reason);

      return 0;
    };

    globalThis.clearTimeout = (handle) => {
      assert.equal(handle, 0);
      cleared++;
      throw cleanupError;
    };

    try {
      await assert.rejects(api.sleep(10, { signal: controller.signal }), (error) => error === reason);
      assert.equal(cleared, 1, 'cleanup of the late handle must still be attempted');
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally {
      globalThis.setTimeout = originalSet;
      globalThis.clearTimeout = originalClear;
    }
  });

  test('a host callback delivered during registration does not leave its returned handle alive', async () => {
    const originalSet = globalThis.setTimeout;
    const originalClear = globalThis.clearTimeout;
    const controller = new AbortController();
    const cleared = [];

    globalThis.setTimeout = (fn) => {
      fn();

      return 0;
    };

    globalThis.clearTimeout = (handle) => cleared.push(handle);
    try {
      assert.equal(await api.sleep(10, { signal: controller.signal }), undefined);
      assert.deepEqual(cleared, [0]);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally {
      globalThis.setTimeout = originalSet;
      globalThis.clearTimeout = originalClear;
    }
  });
});

suite('scheduler registration ownership regressions', function () {
  for (const name of ['debounce', 'throttle']) {
    for (const leading of [false, true]) {
      test(`${name} cancels during timer registration, leading=${leading}`, () =>
        withClock((clock) => {
          const originalSet = globalThis.setTimeout;
          let first = true;
          const calls = [];
          const f = api[name](
            (value) => {
              calls.push(value);

              return value;
            },
            10,
            { leading }
          );

          globalThis.setTimeout = function (fn, duration) {
            if (first) {
              first = false;
              f.cancel();
            }

            return originalSet(fn, duration);
          };

          let returned;

          assert.doesNotThrow(() => {
            returned = f('cancelled');
          });
          assert.equal(returned, undefined);
          assert.equal(f.pending(), false);
          assert.equal(clock.tasks.size, 0, 'a cancelled registration must release its late handle');
          assert.deepEqual(calls, []);
          f('new');
          clock.tick(10);
          assert.deepEqual(calls, ['new']);
          assert.equal(clock.tasks.size, 0);
        }));

      test(`${name} a call during timer registration shares the same timer, leading=${leading}`, () =>
        withClock((clock) => {
          const originalSet = globalThis.setTimeout;
          let first = true;
          const calls = [];
          const f = api[name]((value) => calls.push(value), 10, { leading });

          globalThis.setTimeout = function (fn, duration) {
            if (first) {
              first = false;
              f('latest');
            }

            return originalSet(fn, duration);
          };

          f('first');
          assert.equal(clock.tasks.size, 1, 'registration must already own the scheduling slot');
          clock.tick(10);
          assert.deepEqual(calls, ['latest']);
          assert.equal(clock.tasks.size, 0);
        }));

      test(`${name} preserves replacement work created during registration, leading=${leading}`, () =>
        withClock((clock) => {
          const originalSet = globalThis.setTimeout;
          let first = true;
          const calls = [];
          const f = api[name]((value) => calls.push(value), 10, { leading });

          globalThis.setTimeout = function (fn, duration) {
            if (first) {
              first = false;
              f.cancel();
              f('replacement');
            }

            return originalSet(fn, duration);
          };

          f('cancelled');
          assert.equal(clock.tasks.size, 1);
          clock.tick(10);
          assert.deepEqual(calls, ['replacement']);
          assert.equal(clock.tasks.size, 0);
        }));
    }

    test(`${name} flush during registration consumes the call and clears the late handle`, () =>
      withClock((clock) => {
        const originalSet = globalThis.setTimeout;
        let first = true;
        const calls = [];
        const f = api[name](
          (value) => {
            calls.push(value);

            return value;
          },
          10,
          { leading: false }
        );

        globalThis.setTimeout = function (fn, duration) {
          if (first) {
            first = false;
            assert.equal(f.pending(), true);
            assert.equal(f.flush(), 'pending');
          }

          return originalSet(fn, duration);
        };

        assert.equal(f('pending'), 'pending');
        assert.equal(clock.tasks.size, 0);
        assert.equal(f.pending(), false);
        clock.tick(20);
        assert.deepEqual(calls, ['pending']);
      }));

    test(`${name} registration failure does not erase replacement work`, () =>
      withClock((clock) => {
        const originalSet = globalThis.setTimeout;
        const error = {};
        let first = true;
        const calls = [];
        const f = api[name]((value) => calls.push(value), 10, { leading: false });

        globalThis.setTimeout = function (fn, duration) {
          if (first) {
            first = false;
            f.cancel();
            f('replacement');
            throw error;
          }

          return originalSet(fn, duration);
        };

        assert.throws(
          () => f('cancelled'),
          (e) => e === error
        );
        assert.equal(f.pending(), true);
        assert.equal(clock.tasks.size, 1);
        clock.tick(10);
        assert.deepEqual(calls, ['replacement']);
        assert.equal(clock.tasks.size, 0);
      }));
  }
});

suite('scheduler lifecycle integration', function () {
  for (const name of ['debounce', 'throttle']) {
    test(`${name} a stale cancelled callback cannot consume replacement work`, () =>
      withClock((clock) => {
        const seen = [];
        const f = api[name]((value) => seen.push([clock.now(), value]), 10, { leading: false });

        f('old');
        const expiredOwner = [...clock.tasks.values()][0].fn;

        f.cancel();
        clock.tick(3);
        f('new');
        const count = clock.tasks.size;

        expiredOwner();
        assert.equal(clock.tasks.size, count);
        assert.equal(f.pending(), true);
        assert.deepEqual(seen, []);
        clock.tick(10);
        assert.deepEqual(seen, [[1013, 'new']]);
        assert.equal(clock.tasks.size, 0);
      }));

    test(`${name} a replaced early timer cannot steal its successor's inputs`, () =>
      withClock((clock) => {
        const seen = [];
        const f = api[name]((value) => seen.push(value), 10, { leading: false });

        f('first');
        const [id, task] = [...clock.tasks][0];

        clock.tasks.delete(id);
        clock.jump(2);
        task.fn();
        assert.equal(clock.tasks.size, 1);
        f('latest');
        task.fn();
        assert.equal(clock.tasks.size, 1);
        clock.tick(20);
        assert.deepEqual(seen, ['latest']);
        assert.equal(clock.tasks.size, 0);
      }));

    for (const mode of ['cancel', 'flush']) {
      test(`${name} ${mode} and replacement inside a throwing callback retain the new task`, () =>
        withClock((clock) => {
          const seen = [];
          const error = {};
          const f = api[name](
            (value) => {
              seen.push(value);
              if (value === 'first') {
                if (mode === 'cancel') f.cancel();
                else assert.equal(f.flush(), undefined);
                f('replacement');
                throw error;
              }

              return value;
            },
            10,
            { leading: false }
          );

          f('first');
          assert.throws(
            () => clock.tick(10),
            (e) => e === error
          );
          assert.equal(f.pending(), true);
          assert.equal(clock.tasks.size, 1);
          clock.tick(10);
          assert.deepEqual(seen, ['first', 'replacement']);
          assert.equal(f.flush(), 'replacement');
          assert.equal(clock.tasks.size, 0);
        }));
    }

    for (const value of [undefined, null, false, 0, '']) {
      test(`${name} keeps a completed ${String(value)} result after cancellation during the next registration`, () =>
        withClock((clock) => {
          let calls = 0;
          const f = api[name](
            () => {
              calls++;

              return value;
            },
            10,
            { leading: false }
          );

          f();
          assert.equal(f.flush(), value);
          f.cancel();
          const originalSet = globalThis.setTimeout;

          globalThis.setTimeout = (fn, ms) => {
            f.cancel();

            return originalSet(fn, ms);
          };

          assert.equal(f(), value);
          assert.equal(f.flush(), value);
          assert.equal(f.pending(), false);
          assert.equal(clock.tasks.size, 0);
          assert.equal(calls, 1);
        }));
    }

    test(`${name} a failing late-handle clear preserves replacement state`, () =>
      withClock((clock) => {
        const originalSet = globalThis.setTimeout;
        const originalClear = globalThis.clearTimeout;
        const error = {};
        let first = true;
        let lateHandle;
        const seen = [];
        const f = api[name]((value) => seen.push(value), 10, { leading: false });

        globalThis.setTimeout = function (fn, duration) {
          if (first) {
            first = false;
            f.cancel();
            f('replacement');
            lateHandle = originalSet(fn, duration);

            return lateHandle;
          }

          return originalSet(fn, duration);
        };

        globalThis.clearTimeout = (id) => {
          originalClear(id);
          if (id === lateHandle) throw error;
        };

        assert.throws(
          () => f('cancelled'),
          (e) => e === error
        );
        assert.equal(f.pending(), true);
        assert.equal(clock.tasks.size, 1);
        clock.tick(10);
        assert.deepEqual(seen, ['replacement']);
      }));

    for (const useMaxWait of [false, true]) {
      test(`${name} cancellation during ${useMaxWait ? 'maxWait' : 'early-expiry'} rearming drops only pending work`, () =>
        withClock((clock) => {
          const originalSet = globalThis.setTimeout;
          const seen = [];
          const f = api[name]((value) => seen.push(value), 10, {
            leading: false,
            ...(name === 'debounce' && useMaxWait ? { maxWait: 20 } : {})
          });

          f('first');
          globalThis.setTimeout = (fn, duration) => {
            f.cancel();

            return originalSet(fn, duration);
          };

          if (useMaxWait) {
            clock.jump(25);
            f('latest');
          } else {
            const [id, task] = [...clock.tasks][0];

            clock.tasks.delete(id);
            clock.jump(1);
            task.fn();
          }

          assert.deepEqual(seen, []);
          assert.equal(f.pending(), false);
          assert.equal(clock.tasks.size, 0);
          clock.tick(50);
          assert.deepEqual(seen, []);
        }));
    }
  }
});

suite('sleep and delay lifecycle integration', function () {
  test('sleep cancellation cleanup may start an independent replacement wait', async () => {
    const originalSet = globalThis.setTimeout;
    const originalClear = globalThis.clearTimeout;
    const jobs = new Map();
    const controller = new AbortController();
    let nextId = 0;
    let replacement;

    globalThis.setTimeout = (fn) => {
      const id = nextId++;

      jobs.set(id, fn);

      return id;
    };

    globalThis.clearTimeout = (id) => {
      jobs.delete(id);
      if (id === 0) replacement = api.sleep(20);
    };

    try {
      const waiting = api.sleep(10, { signal: controller.signal });

      controller.abort('cancelled');
      await assert.rejects(waiting, (e) => e === 'cancelled');
      assert.equal(jobs.size, 1);
      assert.ok(replacement instanceof Promise);
      jobs.get(1)();
      await replacement;
      assert.equal(jobs.size, 0);
    } finally {
      globalThis.setTimeout = originalSet;
      globalThis.clearTimeout = originalClear;
    }
  });

  test('delay passes duration coercion and arguments to the host without pre-reading them', () => {
    const originalSet = globalThis.setTimeout;
    let reads = 0;
    const duration = {
      valueOf() {
        reads++;

        return 5;
      }
    };
    const payload = {};
    const callback = () => {};

    globalThis.setTimeout = function (fn, ms, value) {
      assert.equal(this, globalThis);
      assert.equal(fn, callback);
      assert.equal(ms, duration);
      assert.equal(value, payload);
      assert.equal(reads, 0);
      assert.equal(Number(ms), 5);

      return 0;
    };

    try {
      assert.equal(api.delay(callback, duration, payload), 0);
      assert.equal(reads, 1);
    } finally {
      globalThis.setTimeout = originalSet;
    }
  });
});
