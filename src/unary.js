'use strict';

var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);

/**
 * Creates a wrapper that forwards exactly one argument, so extra arguments from callers such as `map` stay
 * out of the callback.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. An omitted input becomes one explicit `undefined`; additional arguments are
 * ignored.
 * @param {Function} fn Required callback.
 * @returns {Function} A wrapper returning the callback result after passing exactly one
 * argument.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#unaryfn | Full API documentation}
 * @example
 * const parseDecimal = unary(parseInt);
 * ['10', '20', '30'].map(parseDecimal);  // => [10, 20, 30]
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function unary(fn) {
  expectFunction(fn);

  return function (value) {
    return call(fn, this, value);
  };
}

module.exports = unary;
