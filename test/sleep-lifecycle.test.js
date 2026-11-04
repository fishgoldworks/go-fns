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
  test('a suppressed native abort rejects at timer completion and releases only its own listener', async () => {
    const { getEventListeners } = require('node:events');
    const clock = host(),
      controller = new AbortController(),
      reason = {};
    const block = (event) => event.stopImmediatePropagation();
    controller.signal.addEventListener('abort', block);
    try {
      const pending = sleep(2, { signal: controller.signal });
      controller.abort(reason);
      [...clock.jobs.values()][0]();
      await assert.rejects(pending, (e) => e === reason);
      assert.equal(clock.jobs.size, 0);
      assert.deepEqual(getEventListeners(controller.signal, 'abort'), [block]);
    } finally {
      controller.signal.removeEventListener('abort', block);
      clock.restore();
    }
  });
  for (const trigger of ['timeout', 'abort']) {
    test(`reentrant ${trigger} settlement stops reading signal properties after cleanup`, async () => {
      const clock = host(),
        reason = {};
      let listener,
        aborted = false,
        dispatch = false,
        cleaned = false,
        reasonReads = 0,
        readsAfterCleanup = 0;
      const signal = {
        get aborted() {
          if (cleaned) readsAfterCleanup++;
          if (dispatch) {
            dispatch = false;
            listener();
          }
          return aborted;
        },
        get reason() {
          if (cleaned) readsAfterCleanup++;
          reasonReads++;
          return reason;
        },
        addEventListener(type, fn) {
          listener = fn;
        },
        removeEventListener() {
          cleaned = true;
        }
      };
      try {
        const pending = sleep(2, { signal });
        const timeout = [...clock.jobs.values()][0];
        aborted = dispatch = true;
        if (trigger === 'timeout') timeout();
        else listener();
        await assert.rejects(pending, (e) => e === reason);
        assert.equal(reasonReads, 1);
        assert.equal(cleaned, true);
        assert.equal(clock.jobs.size, 0);
        // Already queued callbacks must not inspect the signal again.
        listener();
        timeout();
        assert.equal(reasonReads, 1);
        assert.equal(readsAfterCleanup, 0);
      } finally {
        clock.restore();
      }
    });
  }
  for (const field of ['aborted', 'reason']) {
    test(`${field} getter failure at timer completion rejects and releases resources`, async () => {
      const clock = host(),
        error = {};
      let removed = 0,
        fired = false;
      const signal = {
        get aborted() {
          if (fired && field === 'aborted') throw error;
          return fired;
        },
        get reason() {
          throw error;
        },
        addEventListener() {},
        removeEventListener() {
          removed++;
        }
      };
      try {
        const pending = sleep(2, { signal });
        fired = true;
        [...clock.jobs.values()][0]();
        await assert.rejects(pending, (e) => e === error);
        assert.equal(clock.jobs.size, 0);
        assert.equal(removed, 1);
      } finally {
        clock.restore();
      }
    });
  }
  test('a queued timeout after settlement does not read signal getters again', async () => {
    const clock = host(),
      controller = new AbortController();
    let reads = 0;
    const signal = {
      get aborted() {
        reads++;
        return controller.signal.aborted;
      },
      get reason() {
        return controller.signal.reason;
      },
      addEventListener(type, fn) {
        controller.signal.addEventListener(type, fn);
      },
      removeEventListener(type, fn) {
        controller.signal.removeEventListener(type, fn);
      }
    };
    try {
      const pending = sleep(2, { signal });
      const callback = [...clock.jobs.values()][0];
      controller.abort('cancel');
      await assert.rejects(pending, (e) => e === 'cancel');
      const settledReads = reads;
      callback();
      assert.equal(reads, settledReads);
    } finally {
      clock.restore();
    }
  });
});
