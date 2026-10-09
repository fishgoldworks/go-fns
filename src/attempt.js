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
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptfn-args | Full API documentation}
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
/**
 * Invokes a callback synchronously and reports success or failure in a result object. Alias
 * of `attemptResult`.
 * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
 * receiver. Promises are successful values without awaiting; later rejections are not caught.
 * @param {Function} fn Required callback.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Object} A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
 * }` with the exact thrown value.
 * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
 * a failure result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
 */
module.exports.result = require('./attemptResult');
/**
 * Invokes a callback, awaits its result and reports success or failure in a result object.
 * Alias of `attemptResultAsync`.
 * The callback itself is its receiver. Callback throws, promise rejections and failures while
 * awaiting thenables are captured without replacing the original failure. Invalid callbacks
 * reject instead of producing a failure result.
 * Rejects with `TypeError` if `fn` is not a function.
 * @param {Function} fn Required callback.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Promise<Object>} A promise resolving to a fresh `{ ok: true, value }` object with
 * the awaited value, or `{ ok: false, error }` with the exact failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
 */
module.exports.resultAsync = require('./attemptResultAsync');
