'use strict';

var expectFunction = require('./util/expectFunction');

/**
 * Invokes a callback a specified number of times synchronously and collects its results.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. Promises are collected without awaiting. Large counts
 * still require practical memory limits.
 * @param {Function} fn Required callback.
 * @param {number|null} [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Array} A fresh array of callback results in invocation order; an empty array for
 * a zero or nullish count.
 * @throws {TypeError} If `fn` is not a function or `count` is non-nullish and not a number.
 * @throws {RangeError} If `count` is not an integer in the supported range. Callback errors
 * stop further calls and propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatfn-count-args | Full API documentation}
 * @example
 * repeat(Math.floor, 3, 1.5);    // => [1, 1, 1]
 * repeat(Math.floor);            // => []
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function repeat(fn, count, ...args) {
  expectFunction(fn);

  count = count === null || count === undefined ? 0 : count;
  if (typeof count !== 'number') {
    throw new TypeError('Expected count to be a number.');
  }
  // Every result must fit in an actual array; reject coercion and unbounded loops.
  if (!Number.isInteger(count) || count < 0 || count > 4294967295) {
    throw new RangeError('Expected count to be an integer between 0 and 4294967295.');
  }

  var results = [];

  for (var i = 0; i < count; i++) {
    results[i] = Reflect.apply(fn, fn, args);
  }
  return results;
}

// Preserve reflected arity for consumers inspecting this variadic function.
Object.defineProperty(repeat, 'length', { value: 3 });

module.exports = repeat;
