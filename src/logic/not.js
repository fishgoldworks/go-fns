'use strict';

var expectFunction = require('../util/expectFunction');

/**
 * Creates a predicate that negates its callback's truthiness.
 * Unlike the multi-predicate helpers, a missing or nullish callback is invalid. The returned
 * predicate forwards all call arguments and the caller's `this`. Promise results are truthy
 * and are never awaited.
 * @param {Function} fn Required predicate; missing or nullish values are invalid.
 * @returns {Function} A predicate returning `true` if the callback result is falsy; otherwise
 * `false`.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#notfn | Full API documentation}
 * @example
 * const isNotInteger = not(Number.isInteger);
 * isNotInteger(1.5);             // => true
 * isNotInteger(2);               // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function not(fn) {
  expectFunction(fn);

  return function () {
    return !Reflect.apply(fn, this, arguments);
  };
}

module.exports = not;
