'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api.js');
const { delay } = api;
suite('delay', function () {
  for (const [label, invoke] of [
    ['namespace call', (...args) => api.delay(...args)],
    ['detached call', (...args) => delay(...args)],
    ['explicit object receiver', (...args) => delay.call({}, ...args)],
    ['explicit null receiver', (...args) => delay.call(null, ...args)],
    ['explicit primitive receiver', (...args) => delay.call(17, ...args)]
  ]) {
    test(`${label} invokes the timer host with its own global receiver`, function () {
      const original = globalThis.setTimeout,
        handle = {},
        token = {};
      let seen;
      globalThis.setTimeout = function () {
        assert.equal(this, globalThis);
        seen = Array.from(arguments);
        return handle;
      };
      try {
        const callback = () => {};
        assert.equal(invoke(callback, 15, token, undefined), handle);
        assert.deepEqual(seen, [callback, 15, token, undefined]);
      } finally {
        globalThis.setTimeout = original;
      }
    });
  }
  test('returns numeric host handles unchanged', function () {
    const original = globalThis.setTimeout;
    globalThis.setTimeout = () => 123;
    try {
      assert.equal(
        delay(() => {}),
        123
      );
    } finally {
      globalThis.setTimeout = original;
    }
  });
  test('validates the callback before touching the timer host', function () {
    const original = globalThis.setTimeout;
    let touched = false;
    globalThis.setTimeout = () => {
      touched = true;
    };
    try {
      assert.throws(() => delay(null), TypeError);
      assert.equal(touched, false);
    } finally {
      globalThis.setTimeout = original;
    }
  });
  test('propagates scheduler errors', function () {
    const original = globalThis.setTimeout,
      error = {};
    globalThis.setTimeout = () => {
      throw error;
    };
    try {
      assert.throws(
        () => delay(() => {}),
        (actual) => actual === error
      );
    } finally {
      globalThis.setTimeout = original;
    }
  });
  for (const [label, duration] of [
    ['undefined', undefined],
    ['null', null],
    ['zero', 0],
    ['positive delay', 2]
  ]) {
    test(`executes asynchronously with ${label}, forwarding arguments and the native callback receiver`, async function () {
      let synchronous = true,
        handle;
      const token = {};
      const result = new Promise((resolve, reject) => {
        handle = api.delay(
          function (first, second) {
            try {
              assert.equal(synchronous, false);
              assert.equal(this, handle);
              assert.equal(first, token);
              assert.equal(second, undefined);
              assert.equal(arguments.length, 2);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          duration,
          token,
          undefined
        );
      });
      assert.equal(typeof handle, 'object');
      assert.equal(typeof handle.ref, 'function');
      synchronous = false;
      await result;
    });
  }
  test('supports an omitted duration and no callback arguments', async function () {
    await new Promise((resolve, reject) =>
      delay(function () {
        try {
          assert.equal(arguments.length, 0);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
    );
  });
  test('supports cancellation through clearTimeout', async function () {
    let calls = 0;
    const handle = api.delay(() => {
      calls++;
    }, 2);
    clearTimeout(handle);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(calls, 0);
  });
  test('executes a scheduled callback once', async function () {
    let calls = 0;
    await new Promise((resolve) =>
      delay(() => {
        calls++;
        resolve();
      }, 0)
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(calls, 1);
  });
  test('preserves an explicitly bound callback receiver', async function () {
    const receiver = {};
    const seen = await new Promise((resolve) =>
      delay(
        function () {
          resolve(this);
        }.bind(receiver),
        0
      )
    );
    assert.equal(seen, receiver);
  });
});
