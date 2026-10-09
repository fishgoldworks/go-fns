'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api.js');
const { invalidFunctions } = require('./helpers/values.js');
suite('2.1 API and aliases', function () {
  for (const name of ['pipeAsync', 'attemptResult', 'attemptResultAsync', 'tap', 'tapAsync', 'sleep', 'once']) {
    test(`${name} is exported`, () => assert.equal(typeof api[name], 'function'));
  }
  for (const [parent, key, name] of [
    ['pipe', 'async', 'pipeAsync'],
    ['attempt', 'result', 'attemptResult'],
    ['attempt', 'resultAsync', 'attemptResultAsync'],
    ['attemptResult', 'async', 'attemptResultAsync'],
    ['tap', 'async', 'tapAsync']
  ]) {
    test(`${parent}.${key} is the named export, not a wrapper`, () => {
      assert.equal(typeof api[name], 'function');
      assert.equal(api[parent][key], api[name]);
    });
  }
  for (const [label, value] of invalidFunctions) {
    for (const name of ['attemptResult', 'tap', 'tapAsync', 'once']) {
      test(`${name} rejects ${label} without invoking it or coercing it`, () =>
        assert.throws(() => api[name](value), TypeError));
    }
    test(`attemptResultAsync rejects invalid ${label} through a promise`, async () => {
      const result = api.attemptResultAsync(value);
      assert.ok(result instanceof Promise);
      await assert.rejects(result, TypeError);
    });
    if (value !== null && value !== undefined) {
      test(`pipeAsync validates ${label} before constructing a pipeline`, () => {
        let called = false;
        assert.throws(
          () =>
            api.pipeAsync(() => {
              called = true;
            }, value),
          TypeError
        );
        assert.equal(called, false);
      });
    }
  }
});
