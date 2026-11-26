'use strict';

const assert = require('node:assert/strict');
const { repeat } = require('./helpers/api.js');

suite('repeat', function () {
  for (const [label, count] of [
    ['omitted', undefined],
    ['null', null],
    ['zero', 0],
    ['negative zero', -0]
  ]) {
    test(`returns an empty array without execution for ${label}`, function () {
      assert.deepEqual(
        repeat(() => {
          throw new Error('must not run');
        }, count),
        []
      );
    });
  }

  for (const count of [1, 2, 10, 1000]) {
    test(`executes exactly ${count} times in order`, function () {
      let calls = 0;

      assert.deepEqual(
        repeat(() => ++calls, count),
        Array.from({ length: count }, (_, i) => i + 1)
      );
      assert.equal(calls, count);
    });
  }

  for (const [label, count] of [
    ['NaN', NaN],
    ['positive infinity', Infinity],
    ['negative infinity', -Infinity],
    ['negative integer', -1],
    ['negative fraction', -0.5],
    ['fraction', 2.1],
    ['above array limit', 2 ** 32],
    ['unsafe integer', 2 ** 53],
    ['largest finite number', Number.MAX_VALUE]
  ]) {
    test(`rejects ${label} before callback execution`, function () {
      let called = false;

      assert.throws(
        () =>
          repeat(() => {
            called = true;
            throw new Error('count was not validated');
          }, count),
        RangeError
      );
      assert.equal(called, false);
    });
  }

  for (const [label, count] of [
    ['numeric string', '2'],
    ['empty string', ''],
    ['true', true],
    ['false', false],
    ['object', {}],
    ['boxed number', new Number(2)],
    ['array', []],
    ['bigint', 2n],
    ['symbol', Symbol('count')],
    [
      'coercion trap',
      {
        valueOf() {
          throw new Error('must not coerce');
        }
      }
    ]
  ]) {
    test(`rejects ${label} count without coercion or callback execution`, function () {
      assert.throws(
        () =>
          repeat(() => {
            throw new Error('must not execute');
          }, count),
        TypeError
      );
    });
  }

  test('accepts the maximum representable array length without eager allocation', function () {
    const sentinel = {};
    let calls = 0;

    assert.throws(
      () =>
        repeat(
          () => {
            calls++;
            throw sentinel;
          },
          2 ** 32 - 1
        ),
      (error) => error === sentinel
    );
    assert.equal(calls, 1);
  });

  test('forwards all arguments each time and preserves object identity', function () {
    const token = {};
    let calls = 0;
    const result = repeat(
      function () {
        calls++;
        assert.deepEqual(Array.from(arguments), [1, token, undefined]);

        return token;
      },
      3,
      1,
      token,
      undefined
    );

    assert.equal(calls, 3);
    assert.equal(result.length, 3);
    for (const item of result) assert.equal(item, token);
  });

  test('passes no implicit index or arguments', function () {
    assert.deepEqual(
      repeat(function () {
        return arguments.length;
      }, 2),
      [0, 0]
    );
  });

  test('preserves the legacy callback-as-receiver contract', function () {
    function callback() {
      return this;
    }

    const result = repeat.call({}, callback, 2);

    assert.equal(result[0], callback);
    assert.equal(result[1], callback);
  });

  test('honors bound callback receivers', function () {
    const receiver = {};

    assert.equal(
      repeat(
        function () {
          return this;
        }.bind(receiver),
        1
      )[0],
      receiver
    );
  });

  test('allocates a fresh result array per invocation including empty results', function () {
    assert.notEqual(
      repeat(() => 1, 1),
      repeat(() => 1, 1)
    );
    assert.notEqual(
      repeat(() => 1),
      repeat(() => 1)
    );
  });

  for (const position of [0, 1, 2]) {
    test(`stops immediately on an exception in repetition ${position}`, function () {
      const error = {};
      let calls = 0;

      assert.throws(
        () =>
          repeat(() => {
            if (calls++ === position) throw error;
          }, 4),
        (actual) => actual === error
      );
      assert.equal(calls, position + 1);
    });
  }

  test('is reentrant', function () {
    assert.deepEqual(
      repeat(() => repeat(() => 1, 2), 2),
      [
        [1, 1],
        [1, 1]
      ]
    );
  });

  test('collects promise objects without awaiting', async function () {
    const result = repeat(async (value) => value, 2, 5);

    assert.ok(result.every((value) => value instanceof Promise));
    assert.deepEqual(await Promise.all(result), [5, 5]);
  });

  test('supports an overridden apply property', function () {
    function callback(value) {
      return value;
    }

    callback.apply = null;
    assert.deepEqual(repeat(callback, 2, 7), [7, 7]);
  });
});
