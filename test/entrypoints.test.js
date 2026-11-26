'use strict';

const assert = require('node:assert/strict');

suite('package entry point', function () {
  test('loads every public function through the root entry point', function () {
    const api = require('./helpers/api.js');
    const expected = [
      'and',
      'andAsync',
      'applyIf',
      'ary',
      'attempt',
      'attemptResult',
      'attemptResultAsync',
      'debounce',
      'delay',
      'ifElse',
      'ifElseAsync',
      'memoize',
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
      'result',
      'sleep',
      'spread',
      'tap',
      'tapAsync',
      'throttle',
      'unary',
      'when',
      'whenAsync',
      'withDefaultArgs',
      'xor',
      'xorAsync'
    ];

    assert.deepEqual(Object.keys(api).sort(), expected);
    for (const name of expected) assert.equal(typeof api[name], 'function');
  });
});
