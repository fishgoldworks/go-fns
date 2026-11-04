'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { result } = require('./helpers/api.js');
const { values, invalidFunctions } = require('./helpers/values.js');
suite('result value or function evaluation', function () {
  test('exports a value-or-function evaluator', () => assert.equal(typeof result, 'function'));
  for (const [label, value] of invalidFunctions.concat([['negative zero', -0]])) {
    test(`preserves non-function ${label} without inspecting it`, () => {
      assert.ok(Object.is(result(value, 1, {}), value));
    });
  }
  for (const [label, value] of values) {
    test(`preserves returned ${label} without further evaluation`, () => {
      assert.ok(
        Object.is(
          result(() => value),
          value
        )
      );
    });
    test(`propagates thrown ${label} unchanged`, () => {
      assert.throws(
        () =>
          result(() => {
            throw value;
          }),
        (error) => Object.is(error, value)
      );
    });
  }
  test('invokes once with exact raw arguments and no caller receiver', () => {
    const input = {},
      receiver = {},
      promise = Promise.resolve(2);
    let calls = 0;
    const output = result.call(
      receiver,
      function () {
        calls++;
        assert.equal(this, undefined);
        assert.equal(arguments.length, 3);
        return Array.from(arguments);
      },
      input,
      undefined,
      promise
    );
    assert.deepEqual(output, [input, undefined, promise]);
    assert.equal(calls, 1);
  });
  test('preserves bound receivers and foreign callbacks', () => {
    const receiver = { value: 7 };
    function method(n) {
      return this.value + n;
    }
    assert.equal(result(method.bind(receiver), 2), 9);
    assert.equal(result(vm.runInNewContext('(function (n) { return n + 1; })'), 2), 3);
  });
  test('does not read callback call or apply properties', () => {
    const fn = new Proxy((n) => n + 1, {
      get() {
        throw Error('property read');
      }
    });
    assert.equal(result(fn, 2), 3);
  });
  test('passes an undefined receiver and exact arguments to callable proxies', () => {
    let calls = 0;
    const fn = new Proxy(() => {}, {
      apply(target, receiver, args) {
        calls++;
        assert.equal(receiver, undefined);
        assert.deepEqual(args, [2, 3]);
        return 5;
      }
    });
    assert.equal(result(fn, 2, 3), 5);
    assert.equal(calls, 1);
  });
  test('preserves direct and returned promises and never reads thenables', async () => {
    const promise = Promise.resolve(2);
    const thenable = Object.defineProperty({}, 'then', {
      get() {
        throw Error('assimilation');
      }
    });
    for (const value of [promise, thenable]) {
      assert.equal(result(value), value);
      assert.equal(
        result(() => value),
        value
      );
    }
    const error = {},
      rejected = Promise.reject(error);
    const handled = assert.rejects(rejected, (e) => e === error);
    assert.equal(result(rejected), rejected);
    assert.equal(
      result(() => rejected),
      rejected
    );
    await handled;
  });
  test('does not recursively invoke a returned function', () => {
    const inner = () => assert.fail('recursive invocation');
    assert.equal(
      result(() => inner),
      inner
    );
  });
  test('class constructors and revoked callable proxies fail on invocation', () => {
    assert.throws(() => result(class {}), TypeError);
    const revocable = Proxy.revocable(() => {}, {});
    revocable.revoke();
    assert.throws(() => result(revocable.proxy), TypeError);
  });
  test('allows reentrant evaluation without retaining invocation arguments', () => {
    assert.equal(
      result((n) => n + result((x) => x * 2, 3), 4),
      10
    );
    assert.equal(result(), undefined);
  });
});
