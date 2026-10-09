'use strict';
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const { sleep } = require('./helpers/api.js');
const { values, invalidFunctions } = require('./helpers/values.js');
function timers() {
  const set = globalThis.setTimeout,
    clear = globalThis.clearTimeout;
  const jobs = new Map();
  let id = 0,
    lastDuration;
  globalThis.setTimeout = function (fn, ms) {
    assert.equal(this, globalThis);
    const key = ++id;
    jobs.set(key, fn);
    lastDuration = ms;
    return key;
  };
  globalThis.clearTimeout = function (key) {
    jobs.delete(key);
  };
  return {
    jobs,
    get duration() {
      return lastDuration;
    },
    fire() {
      const entry = jobs.entries().next().value;
      assert.ok(entry);
      jobs.delete(entry[0]);
      entry[1]();
    },
    restore() {
      globalThis.setTimeout = set;
      globalThis.clearTimeout = clear;
    }
  };
}
suite('sleep', function () {
  for (const duration of [undefined, 0, -0, 0.5, 1, 25, 2147483647]) {
    test(`schedules supported duration ${String(duration)} and resolves undefined`, async () => {
      const clock = timers();
      try {
        const result = sleep(duration);
        assert.ok(result instanceof Promise);
        assert.equal(clock.jobs.size, 1);
        assert.equal(clock.duration, duration === undefined ? 0 : duration);
        clock.fire();
        assert.equal(await result, undefined);
        assert.equal(clock.jobs.size, 0);
      } finally {
        clock.restore();
      }
    });
  }
  for (const [label, value] of invalidFunctions.filter(([, v]) => v !== undefined && typeof v !== 'number')) {
    test(`rejects ${label} duration without coercion or scheduling`, async () => {
      const clock = timers();
      try {
        const pending = sleep(value);
        assert.ok(pending instanceof Promise);
        await assert.rejects(pending, TypeError);
        assert.equal(clock.jobs.size, 0);
      } finally {
        clock.restore();
      }
    });
  }
  for (const duration of [-1, NaN, Infinity, -Infinity, 2147483648, Number.MAX_VALUE]) {
    test(`rejects out-of-range duration ${duration}`, async () => {
      const clock = timers();
      try {
        await assert.rejects(sleep(duration), RangeError);
        assert.equal(clock.jobs.size, 0);
      } finally {
        clock.restore();
      }
    });
  }
  for (const options of [null, 0, false, 'x', () => {}, [], Symbol('options')]) {
    test(`rejects invalid ${typeof options} options`, async () => await assert.rejects(sleep(0, options), TypeError));
  }
  for (const signal of [
    null,
    0,
    false,
    'x',
    {},
    { aborted: false },
    { aborted: 'false', addEventListener() {}, removeEventListener() {} },
    { aborted: false, addEventListener: 3, removeEventListener() {} }
  ]) {
    test(`rejects incompatible ${String(typeof signal)} signal`, async () =>
      await assert.rejects(sleep(0, { signal }), TypeError));
  }
  test('an omitted signal is supported', async () => {
    await sleep(0, {});
    await sleep(0, { signal: undefined });
  });
  for (const [label, reason] of values) {
    test(`already aborted ${label} reason rejects exactly and starts no timer`, async () => {
      const clock = timers();
      const controller = new AbortController();
      controller.abort(reason);
      try {
        await assert.rejects(sleep(1, { signal: controller.signal }), (e) => Object.is(e, controller.signal.reason));
        assert.equal(clock.jobs.size, 0);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      } finally {
        clock.restore();
      }
    });
    test(`later ${label} abort releases timer/listener and preserves reason`, async () => {
      const clock = timers();
      const controller = new AbortController();
      try {
        const result = sleep(1, { signal: controller.signal });
        assert.equal(clock.jobs.size, 1);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
        controller.abort(reason);
        await assert.rejects(result, (e) => Object.is(e, controller.signal.reason));
        assert.equal(clock.jobs.size, 0);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      } finally {
        clock.restore();
      }
    });
  }
  test('timer completion removes abort listener and later abort has no effect', async () => {
    const clock = timers();
    const controller = new AbortController();
    try {
      const result = sleep(1, { signal: controller.signal });
      assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
      clock.fire();
      assert.equal(await result, undefined);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      controller.abort();
      assert.equal(await result, undefined);
    } finally {
      clock.restore();
    }
  });
  test('synthetic abort event on a live signal is ignored', async () => {
    const clock = timers();
    const controller = new AbortController();
    try {
      const result = sleep(1, { signal: controller.signal });
      controller.signal.dispatchEvent(new Event('abort'));
      assert.equal(clock.jobs.size, 1);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
      controller.abort('real');
      await assert.rejects(result, (e) => e === 'real');
      assert.equal(clock.jobs.size, 0);
    } finally {
      clock.restore();
    }
  });
  test('each concurrent sleep has independent resources', async () => {
    const clock = timers();
    const a = new AbortController(),
      b = new AbortController();
    try {
      const x = sleep(1, { signal: a.signal }),
        y = sleep(1, { signal: b.signal });
      a.abort('a');
      await assert.rejects(x, (e) => e === 'a');
      assert.equal(clock.jobs.size, 1);
      clock.fire();
      await y;
      assert.equal(getEventListeners(a.signal, 'abort').length, 0);
      assert.equal(getEventListeners(b.signal, 'abort').length, 0);
    } finally {
      clock.restore();
    }
  });
  test('scheduler failure rejects and removes installed listener', async () => {
    const clock = timers(),
      controller = new AbortController(),
      error = {};
    globalThis.setTimeout = () => {
      throw error;
    };
    try {
      await assert.rejects(sleep(0, { signal: controller.signal }), (e) => e === error);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    } finally {
      clock.restore();
    }
  });
  test('invalid duration is validated before accessing options', async () => {
    let read = false;
    const options = {
      get signal() {
        read = true;
        throw Error();
      }
    };
    await assert.rejects(sleep(-1, options), RangeError);
    assert.equal(read, false);
  });
  test('throwing options getter rejects without synchronous throw', async () => {
    const error = {};
    let result;
    assert.doesNotThrow(() => {
      result = sleep(1, {
        get signal() {
          throw error;
        }
      });
    });
    await assert.rejects(result, (e) => e === error);
  });
  test('throwing signal getter rejects through the promise', async () => {
    const error = {};
    await assert.rejects(
      sleep(0, {
        signal: {
          get aborted() {
            throw error;
          }
        }
      }),
      (e) => e === error
    );
  });
  test('listener registration failure rejects and clears any timer', async () => {
    const clock = timers(),
      error = {};
    const signal = {
      aborted: false,
      reason: undefined,
      addEventListener() {
        throw error;
      },
      removeEventListener() {}
    };
    try {
      await assert.rejects(sleep(0, { signal }), (e) => e === error);
      assert.equal(clock.jobs.size, 0);
    } finally {
      clock.restore();
    }
  });
  test('cleanup failure still settles the promise', async () => {
    const clock = timers(),
      error = {};
    const signal = {
      aborted: false,
      reason: undefined,
      addEventListener() {},
      removeEventListener() {
        throw error;
      }
    };
    try {
      const pending = sleep(0, { signal });
      clock.fire();
      await assert.rejects(pending, (e) => e === error);
      assert.equal(clock.jobs.size, 0);
    } finally {
      clock.restore();
    }
  });
  test('real timer resolves on a later turn', async () => {
    let done = false;
    const pending = sleep().then(() => {
      done = true;
    });
    assert.equal(done, false);
    await Promise.resolve();
    assert.equal(done, false);
    await pending;
    assert.equal(done, true);
  });
  test('namespace, detached and bound calls work', async () => {
    const api = require('./helpers/api.js');
    await api.sleep(0);
    await sleep(0);
    await sleep.call({}, 0);
  });
});
