'use strict';
const assert = require('node:assert/strict');
const { attempt } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');
suite('attempt', function () {
  for (const [label, value] of values) {
    test(`returns a successful ${label} result unchanged`, function () {
      assert.equal(
        attempt(() => value),
        value
      );
    });
    test(`returns a thrown ${label} unchanged`, function () {
      assert.equal(
        attempt(() => {
          throw value;
        }),
        value
      );
    });
  }
  test('catches parsing failures', function () {
    assert.equal(attempt(JSON.parse, '1'), 1);
    assert.ok(attempt(JSON.parse, '') instanceof SyntaxError);
  });
  test('invokes the function exactly once with all supplied arguments', function () {
    const token = {};
    let calls = 0;
    assert.deepEqual(
      attempt(
        function () {
          calls++;
          return Array.from(arguments);
        },
        1,
        token,
        undefined
      ),
      [1, token, undefined]
    );
    assert.equal(calls, 1);
  });
  test('supplies no arguments when none are passed', function () {
    assert.equal(
      attempt(function () {
        return arguments.length;
      }),
      0
    );
  });
  test('preserves the legacy callback-as-receiver contract', function () {
    function receiver() {
      return this;
    }
    assert.equal(attempt.call({}, receiver), receiver);
  });
  test('honors explicitly bound callbacks', function () {
    const receiver = {};
    assert.equal(
      attempt(
        function () {
          return this;
        }.bind(receiver)
      ),
      receiver
    );
  });
  test('does not distinguish returned Error objects from thrown Error objects', function () {
    const error = new Error('same');
    assert.equal(
      attempt(() => error),
      error
    );
    assert.equal(
      attempt(() => {
        throw error;
      }),
      error
    );
  });
  test('returns a promise unchanged and does not catch its later rejection', async function () {
    const error = new Error('async');
    const promise = Promise.reject(error);
    const result = attempt(() => promise);
    assert.equal(result, promise);
    await assert.rejects(result, (actual) => actual === error);
  });
  test('supports an overridden apply property', function () {
    function callback(value) {
      return value;
    }
    callback.apply = null;
    assert.equal(attempt(callback, 7), 7);
  });
});
