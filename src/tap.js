'use strict';

var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);

/**
 * Creates a function that observes an intermediate value in a pipeline and passes the original input onward.
 * The observer receives the caller's `this`. Its return value is ignored without awaiting.
 * Object identity is preserved, and mutations made by the observer remain visible.
 * @param {Function} observer Observer receiving exactly one input value.
 * @returns {Function} A wrapper returning the exact input value or object reference after the
 * observer returns.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#tapobserver | Full API documentation}
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
