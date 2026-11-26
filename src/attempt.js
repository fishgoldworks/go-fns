'use strict';

var expectFunction = require('./util/expectFunction');

/**
 * Invokes a callback synchronously and returns its result or the exact value it throws.
 * The callback itself is its receiver; bind it to supply another `this`. Returned and thrown
 * values are indistinguishable. Promises are returned unchanged, and later rejections are not
 * caught.
 * @param {Function} fn Required callback.
 * @param {...*} args Arguments passed to the callback.
 * @returns {*} The callback result or exact thrown value, including `null` or `undefined`.
 * @throws {TypeError} If `fn` is not a function; validation happens outside the catch.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#attemptfn-args | Full API documentation}
 * @example
 * attempt(JSON.parse, "1");                        // => 1
 * attempt(JSON.parse, "") instanceof SyntaxError;  // => true
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function attempt(fn, ...args) {
  expectFunction(fn);

  try {
    return Reflect.apply(fn, fn, args);
  } catch (err) {
    return err;
  }
}

// Retain the established reflected arity while collecting callback arguments natively.
Object.defineProperty(attempt, 'length', { value: 2 });

module.exports = attempt;
