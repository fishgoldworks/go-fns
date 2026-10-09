'use strict';
var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);
/**
 * Creates a function that calls an observer with one value and returns that value unchanged.
 * The observer receives the caller's `this`. Its return value is ignored without awaiting.
 * Object identity is preserved, and mutations made by the observer remain visible.
 * @param {Function} observer Observer receiving exactly one input value.
 * @returns {Function} A wrapper returning the exact input value or object reference after the
 * observer returns.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapobserver | Full API documentation}
 * @example
 * const seen = [];
 * const observe = tap(value => seen.push(value));
 * observe(12.5);                 // => 12.5
 * seen;                          // => [12.5]
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function tap(observer) {
  expectFunction(observer);
  return function (value) {
    call(observer, this, value);
    return value;
  };
}
module.exports = tap;
/**
 * Creates a function that awaits an observer before returning its input value. Alias of
 * `tapAsync`.
 * The observer receives exactly one input and the caller's `this`. A promise input reaches
 * the observer unchanged, but the returned promise resolves to its awaited value.
 * @param {Function} observer Synchronous or asynchronous observer receiving one input.
 * @returns {Function} An async wrapper resolving to the input after the observer succeeds;
 * promise inputs are unwrapped. Observer failures reject the wrapper promise.
 * @throws {TypeError} If `observer` is not a function. Later observer throws or rejections
 * reject the wrapper promise.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapasyncobserver | Full API documentation}
 */
module.exports.async = require('./tapAsync');
