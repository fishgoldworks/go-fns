'use strict';
var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);
/**
 * Creates a function that awaits an observer before returning its input value.
 * The observer receives exactly one input and the caller's `this`. A promise input reaches
 * the observer unchanged, but the returned promise resolves to its awaited value.
 * @param {Function} observer Synchronous or asynchronous observer receiving one input.
 * @returns {Function} An async wrapper resolving to the input after the observer succeeds;
 * promise inputs are unwrapped. Observer failures reject the wrapper promise.
 * @throws {TypeError} If `observer` is not a function. Later observer throws or rejections
 * reject the wrapper promise.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapasyncobserver | Full API documentation}
 * @example
 * const seen = [];
 * const observe = tapAsync(async value => { seen.push(value); });
 * await observe(12.5);           // => 12.5
 * seen;                          // => [12.5]
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function tapAsync(observer) {
  expectFunction(observer);
  return async function (value) {
    await call(observer, this, value);
    return value;
  };
}
module.exports = tapAsync;
