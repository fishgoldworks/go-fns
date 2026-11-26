'use strict';

var expectFunction = require('./util/expectFunction');

/**
 * Creates a wrapper that lets a callback take an array-like argument list in place of separate arguments.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Arrays, typed arrays and array-like objects work; `null` or `undefined` supplies
 * no arguments. Iterability alone does not expand a collection.
 * @param {Function} fn Required callback.
 * @returns {Function} A wrapper returning the callback result after expanding its argument
 * list.
 * @throws {TypeError} If `fn` is not a function, or a later argument list is primitive and
 * non-nullish. Argument-list getter and callback errors propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#spreadfn | Full API documentation}
 * @example
 * const sum = spread((a, b) => a + b);
 * sum([1, 2]);                     // => 3
 * sum({ 0: 4, 1: 5, length: 2 });  // => 9
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function spread(fn) {
  expectFunction(fn);

  return function (args) {
    return Reflect.apply(fn, this, args === null || args === undefined ? [] : args);
  };
}

module.exports = spread;
