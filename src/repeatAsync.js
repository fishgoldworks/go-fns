'use strict';
var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;
/**
 * Invokes a callback a specified number of times sequentially, awaiting each result.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is
 * not undone.
 * Rejects with `TypeError` for an invalid callback or non-nullish non-number count,
 * `RangeError` for an unsupported count, or the original callback failure.
 * @param {Function} fn Required callback.
 * @param {number|null} [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Promise<Array>} A promise resolving to a fresh array of awaited results in
 * invocation order; an empty array for a zero or nullish count.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatasyncfn-count-args | Full API documentation}
 * @example
 * let page = 0;
 * await repeatAsync(async () => ++page, 3);  // => [1, 2, 3]
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
async function repeatAsync(fn, count, ...args) {
  expectFunction(fn);
  count = count === null || count === undefined ? 0 : count;
  if (typeof count !== 'number') {
    throw new TypeError('Expected count to be a number.');
  }
  if (!Number.isInteger(count) || count < 0 || count > 4294967295) {
    throw new RangeError('Expected count to be an integer between 0 and 4294967295.');
  }
  var results = [];
  for (var i = 0; i < count; i++) {
    results[i] = await apply(fn, fn, args);
  }
  return results;
}
Object.defineProperty(repeatAsync, 'length', { value: 3 });
module.exports = repeatAsync;
