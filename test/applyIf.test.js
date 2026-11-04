'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { applyIf } = require('./helpers/api');
const { invalidFunctions, values } = require('./helpers/values');

suite('applyIf immediate conditional transformation', function () {
  test('exports an immediate transformation function', () => {
    assert.equal(typeof applyIf, 'function');
  });
  test('applies a transform once with exactly the supplied value', () => {
    let calls = 0;
    const input = { quantity: '12' };
    assert.equal(
      applyIf(input, true, function (value) {
        calls++;
        assert.equal(arguments.length, 1);
        assert.equal(value, input);
        return Number(value.quantity);
      }),
      12
    );
    assert.equal(calls, 1);
  });
  for (const [label, decision, enabled] of [
    ['true', true, true],
    ['false', false, false],
    ['number', 1, true],
    ['zero', 0, false],
    ['negative zero', -0, false],
    ['NaN', NaN, false],
    ['text', 'yes', true],
    ['empty text', '', false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['object', {}, true],
    ['array', [], true],
    ['boxed false', new Boolean(false), true],
    ['zero bigint', 0n, false],
    ['bigint', 1n, true],
    ['symbol', Symbol('decision'), true],
    ['function', function () {}, true],
    ['promise', Promise.resolve(false), true]
  ]) {
    test('uses JavaScript truthiness for a predicate returning ' + label, () => {
      const input = {};
      const output = {};
      let predicates = 0,
        transforms = 0;
      const actual = applyIf(
        input,
        function (value) {
          predicates++;
          assert.equal(value, input);
          assert.equal(arguments.length, 1);
          return decision;
        },
        (value) => {
          transforms++;
          assert.equal(value, input);
          return output;
        }
      );
      assert.equal(actual, enabled ? output : input);
      assert.equal(predicates, 1);
      assert.equal(transforms, enabled ? 1 : 0);
    });
  }
  for (const [label, value] of values) {
    test('preserves skipped ' + label + ' and raw transform results', () => {
      assert.ok(
        Object.is(
          applyIf(value, false, () => assert.fail('Skipped transform ran')),
          value
        )
      );
      assert.ok(
        Object.is(
          applyIf({}, true, () => value),
          value
        )
      );
    });
    test('propagates thrown ' + label + ' from either callback unchanged', () => {
      assert.throws(
        () =>
          applyIf(
            1,
            () => {
              throw value;
            },
            (x) => x
          ),
        (error) => Object.is(error, value)
      );
      assert.throws(
        () =>
          applyIf(1, true, () => {
            throw value;
          }),
        (error) => Object.is(error, value)
      );
    });
  }
  for (const [label, invalid] of invalidFunctions) {
    if (typeof invalid !== 'boolean') {
      test('rejects invalid ' + label + ' conditions before transformation', () => {
        assert.throws(() => applyIf({}, invalid, () => assert.fail('Invalid condition ran')), TypeError);
      });
    }
    test('rejects an invalid ' + label + ' transform before predicate execution', () => {
      let calls = 0;
      assert.throws(
        () =>
          applyIf(
            {},
            () => {
              calls++;
              return false;
            },
            invalid
          ),
        TypeError
      );
      assert.equal(calls, 0);
      assert.throws(() => applyIf({}, false, invalid), TypeError);
    });
  }
  test('requires condition and transform while accepting an explicit undefined input', () => {
    assert.throws(() => applyIf(), TypeError);
    assert.throws(() => applyIf(1), TypeError);
    assert.throws(() => applyIf(1, true), TypeError);
    assert.equal(
      applyIf(undefined, true, function (value) {
        assert.equal(arguments.length, 1);
        assert.equal(value, undefined);
        return 'present';
      }),
      'present'
    );
  });
  test('forwards the exact caller receiver to both callbacks', () => {
    for (const receiver of [undefined, null, 0, false, '', {}]) {
      assert.equal(
        applyIf.call(
          receiver,
          3,
          function (value) {
            assert.equal(this, receiver);
            return value > 0;
          },
          function (value) {
            assert.equal(this, receiver);
            return value * 2;
          }
        ),
        6
      );
    }
  });
  test('skips opaque inputs without reading properties or coercion hooks', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const hostile = new Proxy(
      {},
      {
        get() {
          throw Error('Input inspected');
        }
      }
    );
    for (const value of [revoked.proxy, hostile]) {
      assert.equal(
        applyIf(value, false, () => assert.fail('Skipped transform ran')),
        value
      );
      assert.equal(
        applyIf(
          value,
          () => false,
          () => assert.fail('Skipped transform ran')
        ),
        value
      );
    }
  });
  test('does not inspect predicate results or assimilate returned thenables', () => {
    const opaque = new Proxy(
      {},
      {
        get() {
          throw Error('Unexpected inspection');
        }
      }
    );
    assert.equal(
      applyIf(
        1,
        () => opaque,
        () => opaque
      ),
      opaque
    );
    const returned = () => assert.fail('Returned function invoked');
    assert.equal(
      applyIf(1, true, () => returned),
      returned
    );
    const promise = Promise.resolve(7);
    assert.equal(
      applyIf(1, true, () => promise),
      promise
    );
  });
  test('does not read callback call or apply properties', () => {
    const wrap = (fn) =>
      new Proxy(fn, {
        get() {
          throw Error('Callback property read');
        }
      });
    assert.equal(
      applyIf(
        2,
        wrap((value) => value > 0),
        wrap((value) => value * 3)
      ),
      6
    );
  });
  test('accepts bound and foreign callbacks without replacing their receivers', () => {
    const receiver = { multiplier: 4 };
    const transform = function (value) {
      return value * this.multiplier;
    }.bind(receiver);
    assert.equal(applyIf(2, true, transform), 8);
    assert.equal(
      applyIf(
        2,
        vm.runInNewContext('(function (x) { return x; })'),
        vm.runInNewContext('(function (x) { return x + 1; })')
      ),
      3
    );
  });
  test('preserves predicate mutations and supports reentrant transformations', () => {
    const input = { count: 1 };
    assert.equal(
      applyIf(
        input,
        (value) => {
          value.count++;
          return true;
        },
        (value) => value.count
      ),
      2
    );
    assert.equal(
      applyIf(
        2,
        (value) => applyIf(value, true, (x) => x > 0),
        (value) => applyIf(value, true, (x) => x * 3)
      ),
      6
    );
  });
  test('propagates invocation failures from constructor-only and revoked callbacks', () => {
    class ConstructorOnly {}
    assert.throws(() => applyIf(1, ConstructorOnly, (x) => x), TypeError);
    assert.throws(() => applyIf(1, true, ConstructorOnly), TypeError);
    const revoked = Proxy.revocable(() => true, {});
    revoked.revoke();
    assert.equal(applyIf(1, false, revoked.proxy), 1);
    assert.throws(() => applyIf(1, revoked.proxy, (x) => x), TypeError);
    assert.throws(() => applyIf(1, true, revoked.proxy), TypeError);
  });
});
