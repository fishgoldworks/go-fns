'use strict';

const assert = require('node:assert/strict');
const { spread } = require('./helpers/api.js');

suite('spread', function () {
  for (const [label, input, output] of [
    ['array', [1, 2], [1, 2]],
    ['empty array', [], []],
    ['missing argument', undefined, []],
    ['null', null, []],
    ['array-like', { 0: 'a', 1: 'b', length: 2 }, ['a', 'b']],
    ['typed array', new Uint8Array([1, 2]), [1, 2]],
    ['sparse array', Array(2), [undefined, undefined]],
    ['ordinary object', {}, []],
    ['negative length', { 0: 1, length: -1 }, []],
    ['fractional length', { 0: 'a', 1: 'b', length: 1.9 }, ['a']],
    ['coercible length', { 0: 1, length: '1' }, [1]],
    ['NaN length', { length: NaN }, []],
    ['boxed string', new String('ab'), ['a', 'b']],
    ['iterable without length', new Set([1, 2]), []]
  ]) {
    test(`uses native apply semantics for ${label}`, function () {
      assert.deepEqual(
        spread(function () {
          return Array.from(arguments);
        })(input),
        output
      );
    });
  }

  test('accepts an arguments object', function () {
    const args = (function () {
      return arguments;
    })(1, 2);

    assert.equal(spread((a, b) => a + b)(args), 3);
  });

  for (const value of ['ab', 1, false, Symbol('x'), 1n]) {
    test(`rejects a primitive ${typeof value} argument list`, function () {
      assert.throws(() => spread(() => {})(value), TypeError);
    });
  }

  test('does not mutate frozen input arrays', function () {
    const values = Object.freeze([1, 2]);

    assert.equal(spread((a, b) => a + b)(values), 3);
  });

  for (const property of ['length', '0']) {
    test(`propagates errors reading array-like ${property}`, function () {
      const error = {},
        input = { length: 1 };
      let called = false;

      Object.defineProperty(input, property, {
        get() {
          throw error;
        }
      });
      assert.throws(
        () =>
          spread(() => {
            called = true;
          })(input),
        (actual) => actual === error
      );
      assert.equal(called, false);
    });
  }

  for (const receiver of [undefined, null, {}, 0, 'x']) {
    test(`forwards receiver of type ${typeof receiver}`, function () {
      assert.equal(
        spread(function () {
          return this;
        }).call(receiver, []),
        receiver
      );
    });
  }

  test('honors bound receivers', function () {
    const receiver = {};

    assert.equal(
      spread(
        function () {
          return this;
        }.bind(receiver)
      ).call({}, []),
      receiver
    );
  });

  test('invokes the callback once and returns its result by identity', function () {
    const result = {};
    let calls = 0;

    assert.equal(
      spread(() => {
        calls++;

        return result;
      })([]),
      result
    );
    assert.equal(calls, 1);
  });

  test('does not await promises', async function () {
    const value = Promise.resolve(1);

    assert.equal(spread(() => value)([]), value);
  });

  test('propagates callback exceptions unchanged', function () {
    const error = {};

    assert.throws(
      () =>
        spread(() => {
          throw error;
        })([]),
      (value) => value === error
    );
  });

  test('supports an overridden apply property', function () {
    function sum(a, b) {
      return a + b;
    }

    sum.apply = null;
    assert.equal(spread(sum)([1, 2]), 3);
  });
});
