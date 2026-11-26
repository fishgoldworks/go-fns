'use strict';

var expectFunction = require('../util/expectFunction');

/**
 * Creates a predicate that awaits its callback result and negates its truthiness.
 * The returned predicate forwards all original call arguments and the caller's `this`.
 * Input arguments are never awaited. Construction validates immediately without invoking
 * the callback; each invocation starts the callback and returns a new promise.
 * @param {Function} fn Required synchronous or asynchronous predicate; missing or nullish
 * values are invalid.
 * @returns {Function} An async predicate resolving to `true` if the awaited callback result
 * is falsy; otherwise `false`. Callback throws and rejections reject with the original value.
 * @throws {TypeError} If the required callback is not a function. Validation is synchronous.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#notasyncfn | Full API documentation}
 * @example
 * const isNotInteger = notAsync(async value => Number.isInteger(value));
 * await isNotInteger(1.5);       // => true
 * await isNotInteger(2);         // => false
 * @since 2.0.0
 * @static
 * @memberof Logic
 */
function notAsync(fn) {
  expectFunction(fn);

  return async function () {
    return !(await Reflect.apply(fn, this, arguments));
  };
}

module.exports = notAsync;
