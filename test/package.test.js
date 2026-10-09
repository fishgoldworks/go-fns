'use strict';
const assert = require('node:assert/strict');

suite('package entry point', function () {
  test('loads every public function through the root entry point', function () {
    const api = require('./helpers/api.js');
    const expected = [
      'and',
      'andAsync',
      'attempt',
      'attemptResult',
      'attemptResultAsync',
      'debounce',
      'delay',
      'ifElse',
      'ifElseAsync',
      'nor',
      'norAsync',
      'not',
      'notAsync',
      'once',
      'or',
      'orAsync',
      'partial',
      'partialRight',
      'pipe',
      'pipeAsync',
      'repeat',
      'repeatAsync',
      'sleep',
      'spread',
      'tap',
      'tapAsync',
      'throttle',
      'unary',
      'when',
      'whenAsync',
      'xor',
      'xorAsync'
    ];
    assert.deepEqual(Object.keys(api).sort(), expected);
    for (const name of expected) assert.equal(typeof api[name], 'function');
  });
});
