'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api.js');
const { invalidFunctions } = require('./helpers/values.js');

suite('public argument validation', function () {
  for (const name of ['attempt', 'delay', 'repeat', 'spread', 'not']) {
    for (const [label, value] of invalidFunctions) {
      test(`${name} rejects ${label} as a callback without coercion`, function () {
        assert.throws(
          () => api[name](value),
          (error) => error instanceof TypeError && /function/i.test(error.message)
        );
      });
    }
  }
  for (const name of ['pipe', 'and', 'or', 'nor', 'xor']) {
    for (const [label, value] of invalidFunctions.filter(([, value]) => value != null)) {
      for (const position of [0, 1, 2]) {
        test(`${name} validates ${label} at position ${position} before any execution`, function () {
          let called = 0;
          const args = [() => ++called, () => ++called, () => ++called];
          args[position] = value;
          assert.throws(
            () => api[name](...args),
            (error) => error instanceof TypeError && /function/i.test(error.message)
          );
          assert.equal(called, 0);
        });
      }
    }
  }
  test('invalid callbacks remain configuration errors even with zero repetitions', function () {
    assert.throws(() => api.repeat(null, 0), TypeError);
  });
  test('a revoked callable proxy is validated by type; invocation errors are not hidden', function () {
    const { proxy, revoke } = Proxy.revocable(function () {}, {});
    const piped = api.pipe(proxy);
    revoke();
    assert.throws(piped, TypeError);
    assert.ok(api.attempt(proxy) instanceof TypeError);
  });
  test('class invocation fails at execution rather than being silently ignored', function () {
    class Example {}
    const piped = api.pipe(Example);
    assert.throws(piped, TypeError);
    assert.ok(api.attempt(Example) instanceof TypeError);
  });
});
