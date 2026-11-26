'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const cleanup = require('../../scripts/cleanup');

test('successful cleanup attempts every action in order', () => {
  const events = [];

  assert.equal(cleanup([() => events.push(1), () => events.push(2)], undefined, 'cleanup'), undefined);
  assert.deepEqual(events, [1, 2]);
});

test('successful cleanup preserves the exact primary failure, including falsy values', () => {
  for (const primary of [new Error('primary'), undefined, null, false, 0, '']) {
    const events = [];

    assert.throws(
      () => cleanup([() => events.push('cleaned')], { error: primary }, 'cleanup'),
      (error) => error === primary
    );
    assert.deepEqual(events, ['cleaned']);
  }
});

test('cleanup-only failure retains its identity and recovery context', () => {
  const error = new Error('cleanup');

  assert.throws(
    () =>
      cleanup(
        [
          () => {
            throw error;
          }
        ],
        undefined,
        'Cleanup failed at /owned/consumer'
      ),
    (failure) => {
      assert.ok(failure instanceof AggregateError);
      assert.equal(failure.errors.length, 1);
      assert.equal(failure.errors[0], error);
      assert.equal(failure.message, 'Cleanup failed at /owned/consumer');

      return true;
    }
  );
});

test('combined failure retains the primary error followed by the cleanup error', () => {
  const primary = new Error('primary');
  const secondary = new Error('cleanup');

  assert.throws(
    () =>
      cleanup(
        [
          () => {
            throw secondary;
          }
        ],
        { error: primary },
        'consumer cleanup'
      ),
    (failure) => {
      assert.ok(failure instanceof AggregateError);
      assert.equal(failure.errors.length, 2);
      assert.equal(failure.errors[0], primary);
      assert.equal(failure.errors[1], secondary);

      return true;
    }
  );
});

test('failed cleanup still attempts later actions and retains every failure in order', () => {
  const primary = new Error('primary');
  const first = new Error('first cleanup');
  const last = new Error('last cleanup');
  const events = [];

  assert.throws(
    () =>
      cleanup(
        [
          () => {
            events.push(1);
            throw first;
          },
          () => events.push(2),
          () => {
            events.push(3);
            throw last;
          }
        ],
        { error: primary },
        'consumer cleanup'
      ),
    (failure) => {
      assert.equal(failure.errors[0], primary);
      assert.equal(failure.errors[1], first);
      assert.equal(failure.errors[2], last);
      assert.deepEqual(events, [1, 2, 3]);

      return true;
    }
  );
});
