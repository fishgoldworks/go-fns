'use strict';
const assert = require('node:assert/strict');
const { once } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');
suite('once', function () {
  for (const [label, value] of values) {
    test(`caches successful ${label}`, () => {
      let calls = 0;
      const run = once(() => {
        calls++;
        return value;
      });
      assert.equal(run(), value);
      assert.equal(run(), value);
      assert.equal(calls, 1);
    });
    test(`caches thrown ${label} including falsy failures`, () => {
      let calls = 0;
      const run = once(() => {
        calls++;
        throw value;
      });
      for (let i = 0; i < 3; i++) assert.throws(run, (e) => Object.is(e, value));
      assert.equal(calls, 1);
    });
  }
  for (const receiver of [undefined, null, {}, false, 0, 'x', Symbol('this')]) {
    test(`uses first ${typeof receiver} receiver and arguments only`, () => {
      let calls = 0;
      const token = {};
      const callback = new Proxy(
        function (a, b) {
          calls++;
          assert.equal(this, receiver);
          assert.deepEqual([...arguments], [token, undefined]);
          return token;
        },
        {
          get() {
            throw Error('property access');
          }
        }
      );
      const run = once(callback);
      assert.equal(run.call(receiver, token, undefined), token);
      assert.equal(run.call({}, 'ignored'), token);
      assert.equal(calls, 1);
    });
  }
  test('is lazy and each wrapper has independent state', () => {
    let calls = 0;
    const callback = () => ++calls;
    const a = once(callback),
      b = once(callback);
    assert.equal(calls, 0);
    assert.notEqual(a, b);
    assert.equal(a(), 1);
    assert.equal(a(), 1);
    assert.equal(b(), 2);
  });
  test('preserves bound callback receiver', () => {
    const context = {};
    assert.equal(
      once(
        function () {
          return this;
        }.bind(context)
      ).call({}),
      context
    );
  });
  test('caches the exact pending and resolved promise', async () => {
    let calls = 0,
      resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    const run = once(() => {
      calls++;
      return promise;
    });
    assert.equal(run(), promise);
    assert.equal(run(), promise);
    resolve(2);
    await promise;
    assert.equal(run(), promise);
    assert.equal(calls, 1);
  });
  test('does not retry or replace a rejected promise', async () => {
    const error = {};
    let calls = 0;
    const run = once(() => {
      calls++;
      return Promise.reject(error);
    });
    const promise = run();
    await assert.rejects(promise, (e) => e === error);
    assert.equal(run(), promise);
    assert.equal(calls, 1);
  });
  test('never inspects a returned thenable', () => {
    const value = Object.defineProperty({}, 'then', {
      get() {
        throw Error('do not await');
      }
    });
    const run = once(() => value);
    assert.equal(run(), value);
    assert.equal(run(), value);
  });
  test('uncaught reentrancy error is cached as the first invocation failure', () => {
    let calls = 0;
    const run = once(() => {
      calls++;
      return run();
    });
    let error;
    try {
      run();
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof Error);
    assert.match(error.message, /reentran/i);
    assert.throws(run, (e) => e === error);
    assert.equal(calls, 1);
  });
  test('callback can catch reentrancy and complete successfully', () => {
    const run = once(() => {
      assert.throws(run, /reentran/i);
      return 7;
    });
    assert.equal(run(), 7);
    assert.equal(run(), 7);
  });
  test('cached invocation no longer touches revoked callback', () => {
    const { proxy, revoke } = Proxy.revocable(() => 3, {});
    const run = once(proxy);
    assert.equal(run(), 3);
    revoke();
    assert.equal(run(), 3);
  });
  test('class invocation failure is cached', () => {
    const run = once(class Example {});
    let error;
    try {
      run();
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof TypeError);
    assert.throws(run, (e) => e === error);
  });
});
