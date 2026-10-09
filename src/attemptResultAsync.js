'use strict';
var expectFunction = require('./util/expectFunction');
/**
 * Invokes a callback, awaits its result and reports success or failure in a result object.
 * The callback itself is its receiver. Callback throws, promise rejections and failures while
 * awaiting thenables are captured without replacing the original failure. Invalid callbacks
 * reject instead of producing a failure result.
 * Rejects with `TypeError` if `fn` is not a function.
 * @param {Function} fn Required callback.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Promise<Object>} A promise resolving to a fresh `{ ok: true, value }` object with
 * the awaited value, or `{ ok: false, error }` with the exact failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
 * @example
 * await attemptResultAsync(async () => "dark");              // => { ok: true, value: "dark" }
 * await attemptResultAsync(() => Promise.reject("failed"));  // => { ok: false, error: "failed" }
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
async function attemptResultAsync(fn, ...args) {
  expectFunction(fn);
  try {
    return { ok: true, value: await Reflect.apply(fn, fn, args) };
  } catch (error) {
    return { ok: false, error: error };
  }
}
module.exports = attemptResultAsync;
