'use strict';
/**
 * Calls a function once with the supplied arguments, or returns a non-function value unchanged.
 * No caller receiver is forwarded; bind methods that need one. Extra arguments are ignored for
 * non-function values. Returned promises are not awaited and returned functions are not called again.
 * @param {*} value A callback to invoke once, or a non-function value to return unchanged.
 * @param {...*} args Raw positional arguments passed to the callback.
 * @returns {*} The callback result or original value, preserving object, promise and function identity.
 * @throws {*} The exact value thrown by the callback. Constructor-only functions fail on invocation.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#resultvalue-args | Full API documentation}
 * @example
 * result(7);                      // => 7
 * result((a, b) => a + b, 2, 3);  // => 5
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function result(value, ...args) {
  return typeof value === 'function' ? value(...args) : value;
}
module.exports = result;
