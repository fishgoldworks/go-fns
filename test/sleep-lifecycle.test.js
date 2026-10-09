'use strict';
const assert = require('node:assert/strict');
const { sleep } = require('./helpers/api.js');
function host() {
  const set = globalThis.setTimeout,
    clear = globalThis.clearTimeout;
  const jobs = new Map();
  let id = 0;
  globalThis.setTimeout = (fn) => {
    const key = ++id;
    jobs.set(key, fn);
    return key;
  };
  globalThis.clearTimeout = (key) => jobs.delete(key);
  return {
    jobs,
    restore() {
      globalThis.setTimeout = set;
      globalThis.clearTimeout = clear;
    }
  };
}
suite('sleep settlement and cleanup races', function () {
  test('rejects a missing removeEventListener', async () => {
    await assert.rejects(sleep(0, { signal: { aborted: false, addEventListener() {} } }), TypeError);
  });
  test('ignores a queued timeout callback after abort has settled the wait', async () => {
    const clock = host(),
      controller = new AbortController();
    try {
      const result = sleep(2, { signal: controller.signal });
      const timeout = [...clock.jobs.values()][0];
      controller.abort('cancelled');
      timeout();
      await assert.rejects(result, (e) => e === 'cancelled');
      assert.equal(clock.jobs.size, 0);
    } finally {
      clock.restore();
    }
  });
  for (const failed of [false, true]) {
    test(`clearTimeout failure ${failed ? 'preserves abort reason' : 'rejects completion'} and still removes the listener`, async () => {
      const clock = host(),
        reason = {},
        cleanupError = {};
      let listener,
        removed = 0;
      const signal = {
        aborted: false,
        reason,
        addEventListener(type, fn) {
          listener = fn;
        },
        removeEventListener() {
          removed++;
        }
      };
      try {
        const result = sleep(2, { signal });
        const callback = [...clock.jobs.values()][0];
        globalThis.clearTimeout = (id) => {
          clock.jobs.delete(id);
          throw cleanupError;
        };
        if (failed) {
          signal.aborted = true;
          listener();
        } else callback();
        await assert.rejects(result, (e) => e === (failed ? reason : cleanupError));
        assert.equal(removed, 1);
        assert.equal(clock.jobs.size, 0);
      } finally {
        clock.restore();
      }
    });
  }
  test('removeEventListener failure cannot replace an abort reason', async () => {
    const clock = host(),
      reason = {};
    let listener;
    const signal = {
      aborted: false,
      reason,
      addEventListener(type, fn) {
        listener = fn;
      },
      removeEventListener() {
        throw Error('cleanup');
      }
    };
    try {
      const result = sleep(1, { signal });
      signal.aborted = true;
      listener();
      await assert.rejects(result, (e) => e === reason);
      assert.equal(clock.jobs.size, 0);
    } finally {
      clock.restore();
    }
  });
  test('reason getter failure still rejects and releases resources', async () => {
    const clock = host(),
      error = {};
    let listener,
      removed = 0;
    const signal = {
      aborted: false,
      get reason() {
        throw error;
      },
      addEventListener(type, fn) {
        listener = fn;
      },
      removeEventListener() {
        removed++;
      }
    };
    try {
      const result = sleep(1, { signal });
      signal.aborted = true;
      listener();
      await assert.rejects(result, (e) => e === error);
      assert.equal(clock.jobs.size, 0);
      assert.equal(removed, 1);
    } finally {
      clock.restore();
    }
  });
  test('a signal aborted during registration starts no timer', async () => {
    const clock = host();
    let removed = 0;
    const signal = {
      aborted: false,
      reason: 'cancelled',
      addEventListener(type, fn) {
        this.aborted = true;
        fn();
      },
      removeEventListener() {
        removed++;
      }
    };
    try {
      await assert.rejects(sleep(2, { signal }), (e) => e === 'cancelled');
      assert.equal(clock.jobs.size, 0);
      assert.equal(removed, 1);
    } finally {
      clock.restore();
    }
  });
  test('an abort between the first check and registration is detected even without an event', async () => {
    const clock = host();
    let removed = 0;
    const signal = {
      aborted: false,
      reason: 'cancelled',
      addEventListener() {
        this.aborted = true;
      },
      removeEventListener() {
        removed++;
      }
    };
    try {
      await assert.rejects(sleep(2, { signal }), (e) => e === 'cancelled');
      assert.equal(clock.jobs.size, 0);
      assert.equal(removed, 1);
    } finally {
      clock.restore();
    }
  });
  test('hostile event method call/apply properties are not accessed', async () => {
    const clock = host();
    let removed = false;
    const method = (fn) =>
      new Proxy(fn, {
        get() {
          throw Error('property');
        }
      });
    const signal = {
      aborted: false,
      reason: undefined,
      addEventListener: method(function () {
        assert.equal(this, signal);
      }),
      removeEventListener: method(function () {
        assert.equal(this, signal);
        removed = true;
      })
    };
    try {
      const result = sleep(2, { signal });
      [...clock.jobs.values()][0]();
      await result;
      assert.equal(removed, true);
    } finally {
      clock.restore();
    }
  });
});
