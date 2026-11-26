'use strict';

const assert = require('node:assert/strict');
const { ary, unary } = require('./helpers/api');

suite('ary', function () {
  test('caps the actual argument list without padding missing inputs', () => {
    const collect = (...args) => args;

    assert.deepEqual(ary(collect, 2)(1, undefined, 3), [1, undefined]);
    assert.deepEqual(ary(collect, 2)(1, 2), [1, 2]);
    assert.deepEqual(ary(collect, 2)(1), [1]);
    assert.deepEqual(ary(collect, 0)(1), []);
    assert.deepEqual(ary(collect, 1)(), []);
    assert.deepEqual(unary(collect)(), [undefined]);
  });

  test('preserves the receiver, result and thrown value when truncating', () => {
    const receiver = {};
    const result = Promise.resolve(1);
    const wrapped = ary(function (value) {
      assert.equal(this, receiver);
      assert.equal(value, result);

      return value;
    }, 1);

    assert.equal(wrapped.call(receiver, result, 'ignored'), result);
    assert.throws(
      () =>
        ary(() => {
          throw receiver;
        }, 0)(1),
      (error) => error === receiver
    );
  });

  test('validates the callback and explicit integer cap without coercion', () => {
    assert.throws(() => ary(null, 1), TypeError);
    for (const count of [undefined, null, '2', {}]) assert.throws(() => ary(() => {}, count), TypeError);
    for (const count of [-1, 1.5, NaN, Infinity, 4294967296]) assert.throws(() => ary(() => {}, count), RangeError);
    assert.equal(ary(() => 1, 4294967295)(), 1);
  });
});
