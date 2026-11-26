'use strict';

const assert = require('node:assert/strict');
const { memoize } = require('./helpers/api');

suite('memoize', function () {
  test('matches receiver, argument count, order and identity independently', () => {
    const left = { scale: 2 };
    const right = { scale: 2 };
    const value = {};
    const read = memoize(function (...args) {
      return { owner: this, args };
    });
    const first = read.call(left, value, 1);

    assert.equal(read.call(left, value, 1), first);
    assert.notEqual(read.call(right, value, 1), first);
    assert.notEqual(read.call(left, {}, 1), first);
    assert.notEqual(read.call(left, value, 2), first);
    assert.notEqual(read.call(left, 1, value), first);
    assert.notEqual(read.call(left, value, 1, undefined), first);
    assert.notEqual(read.call(left, undefined), read.call(left));
    assert.notEqual(read.call(null, value), read.call(undefined, value));
  });

  test('reuses NaN keys and distinguishes signed zero as input and receiver', () => {
    const record = memoize(function () {
      return {};
    });

    assert.equal(record(NaN), record(NaN));
    assert.notEqual(record(0), record(-0));
    assert.notEqual(record.call(0), record.call(-0));
  });

  test('evicts the least recently used entry and clear releases cached results', () => {
    const read = memoize(() => ({}), { maxSize: 2 });
    const first = read('a');
    const second = read('b');

    assert.equal(read('a'), first);
    read('c');
    assert.equal(read('a'), first);
    assert.notEqual(read('b'), second);
    assert.equal(read.clear(), undefined);
    assert.notEqual(read('a'), first);
  });

  test('bounds the default cache', () => {
    const read = memoize(() => ({}));
    const first = read(0);

    for (let key = 1; key <= 128; key++) read(key);

    assert.notEqual(read(0), first);
  });

  test('retries synchronous throws, caches undefined and keeps exact rejected promises', async () => {
    const reason = {};
    let attempts = 0;
    const read = memoize(() => {
      if (++attempts === 1) throw reason;
    });

    assert.throws(
      () => read(),
      (error) => error === reason
    );
    assert.equal(read(), undefined);
    assert.equal(read(), undefined);
    assert.equal(attempts, 2);

    const rejected = memoize(() => Promise.reject(reason));
    const pending = rejected();

    assert.equal(rejected(), pending);
    await assert.rejects(pending, (error) => error === reason);
    assert.equal(rejected(), pending);
  });

  test('clearing inside a callback prevents that call from repopulating the cache', () => {
    const read = memoize(() => {
      read.clear();

      return {};
    });

    assert.notEqual(read(1), read(1));
  });

  test('same-key reentry does not retain two entries for the same call', () => {
    let inside = false;
    const read = memoize(
      (value) => {
        if (!inside && value === 1) {
          inside = true;
          read(value);
          inside = false;
        }

        return {};
      },
      { maxSize: 2 }
    );
    const retained = read(2);
    const result = read(1);

    assert.equal(read(2), retained);
    assert.equal(read(1), result);
  });

  test('validates cache options and the callback', () => {
    assert.throws(() => memoize(null), TypeError);
    for (const options of [null, 0, [], { maxSize: '2' }]) assert.throws(() => memoize(() => {}, options), TypeError);
    for (const maxSize of [0, -1, Infinity, NaN, 1.5, 4294967296]) {
      assert.throws(() => memoize(() => {}, { maxSize }), RangeError);
    }

    assert.equal(memoize(() => 1, { maxSize: undefined })(), 1);
  });
});
