'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { withDefaultArgs } = require('./helpers/api');
const { invalidFunctions, values } = require('./helpers/values');

suite('withDefaultArgs', function () {
  test('applies defaults by position only to missing or undefined arguments', () => {
    const wrapped = withDefaultArgs((...args) => args, 1, 'info');

    assert.deepEqual(wrapped(), [1, 'info']);
    assert.deepEqual(wrapped(5), [5, 'info']);
    assert.deepEqual(wrapped(undefined, 'error'), [1, 'error']);
    assert.deepEqual(wrapped(0, null), [0, null]);
    assert.deepEqual(wrapped('error'), ['error', 'info']);
  });

  test('materialises exactly the default positions and preserves extra arguments', () => {
    const capture = function () {
      return { count: arguments.length, args: [...arguments] };
    };

    assert.deepEqual(withDefaultArgs(capture)(), { count: 0, args: [] });
    assert.deepEqual(withDefaultArgs(capture, undefined)(), { count: 1, args: [undefined] });
    assert.deepEqual(withDefaultArgs(capture, 1)(undefined, 'extra', undefined), {
      count: 3,
      args: [1, 'extra', undefined]
    });
    assert.deepEqual(withDefaultArgs(capture)('value', undefined), { count: 2, args: ['value', undefined] });
  });

  test('an undefined default leaves native parameter initialisers available', () => {
    const original = (value = 'native') => value;

    assert.equal(withDefaultArgs(original, 'adapter')(), 'adapter');
    assert.equal(withDefaultArgs(original, undefined)(), 'native');
  });

  for (const [label, value] of values) {
    test('preserves supplied and defaulted ' + label + ' by identity', () => {
      const supplied = withDefaultArgs((input) => input, 'fallback');
      const defaulted = withDefaultArgs((input) => input, value);

      assert.ok(Object.is(supplied(value), value === undefined ? 'fallback' : value));
      assert.ok(Object.is(defaulted(), value));
      assert.ok(Object.is(defaulted(undefined), value));
    });
  }

  for (const [label, value] of invalidFunctions) {
    test('rejects ' + label + ' callback without coercion', () => {
      assert.throws(() => withDefaultArgs(value, 1), TypeError);
    });
  }

  test('captures slots once while retaining mutable default references', () => {
    const options = { level: 'info' };
    const defaults = [options];
    const wrapped = withDefaultArgs((value) => value, ...defaults);

    defaults[0] = { level: 'error' };
    options.level = 'debug';
    assert.equal(wrapped(), options);
    assert.equal(wrapped().level, 'debug');
    assert.equal(withDefaultArgs((value) => value, defaults)(), defaults);
  });

  test('does not invoke callbacks or function defaults or inspect other default values', () => {
    let calls = 0;
    const functionValue = () => {
      throw Error('A function default is a value');
    };

    const hostile = new Proxy(
      {},
      {
        get() {
          throw Error('Do not inspect defaults');
        }
      }
    );
    const wrapped = withDefaultArgs(
      (...args) => {
        calls++;

        return args;
      },
      functionValue,
      hostile
    );

    assert.equal(calls, 0);
    const result = wrapped();

    assert.equal(calls, 1);
    assert.equal(result[0], functionValue);
    assert.equal(result[1], hostile);
  });

  test('forwards exact call-time receivers and ignores callback metadata/call/apply properties', () => {
    function callback(value) {
      return { receiver: this, value };
    }

    for (const name of ['length', 'name', 'call', 'apply']) {
      Object.defineProperty(callback, name, {
        get() {
          throw Error('Do not inspect ' + name);
        }
      });
    }

    const wrapped = withDefaultArgs(callback, 7);

    for (const receiver of [undefined, null, false, 0, 'text', {}]) {
      const result = Reflect.apply(wrapped, receiver, []);

      assert.equal(result.receiver, receiver);
      assert.equal(result.value, 7);
    }
  });

  test('supports bound, arrow, foreign and callable-proxy callbacks', () => {
    const receiver = {};
    const bound = function (value) {
      return [this, value];
    }.bind(receiver);
    const foreign = vm.runInNewContext('(function(value) { return value; })');
    const proxy = new Proxy((value) => value, {});

    assert.deepEqual(withDefaultArgs(bound, 7).call({}, undefined), [receiver, 7]);
    assert.equal(withDefaultArgs((value) => value, 7).call({}, undefined), 7);
    assert.equal(withDefaultArgs(foreign, 7)(), 7);
    assert.equal(withDefaultArgs(proxy, 7)(), 7);
  });

  test('validates function types at creation and lets ordinary invocation failures propagate', () => {
    class Constructor {}
    const revoked = Proxy.revocable(function () {}, {});
    const wrappedClass = withDefaultArgs(Constructor);
    const wrappedProxy = withDefaultArgs(revoked.proxy);

    revoked.revoke();
    assert.throws(() => wrappedClass(), TypeError);
    assert.throws(() => wrappedProxy(), TypeError);
  });

  test('returns exact promises, iterators and hostile thenables without awaiting or consuming', () => {
    const promise = Promise.resolve(7);
    const iterator = [7][Symbol.iterator]();
    const thenable = Object.defineProperty({}, 'then', {
      get() {
        throw Error('Do not assimilate');
      }
    });

    for (const value of [promise, iterator, thenable]) assert.equal(withDefaultArgs(() => value)(), value);
    assert.deepEqual(iterator.next(), { value: 7, done: false });
  });

  test('propagates exact thrown values', () => {
    for (const value of [undefined, null, false, 0, 'error', {}, new Error('failure')]) {
      let caught = false;

      try {
        withDefaultArgs(() => {
          throw value;
        })();
      } catch (error) {
        caught = true;
        assert.ok(Object.is(error, value));
      }

      assert.equal(caught, true);
    }
  });

  test('returns fresh wrappers and keeps reentrant and later calls independent', () => {
    const callback = (value) => value;
    const first = withDefaultArgs(callback);

    assert.notEqual(first, callback);
    assert.notEqual(first, withDefaultArgs(callback));
    const wrapped = withDefaultArgs(
      function (value, level) {
        if (value === 'outer') {
          assert.deepEqual(wrapped(undefined, 'nested'), ['default', 'nested']);
          assert.equal(level, 'info');
        }

        return [value, level];
      },
      'default',
      'info'
    );

    assert.deepEqual(wrapped('outer'), ['outer', 'info']);
    assert.deepEqual(wrapped(), ['default', 'info']);
  });
});
