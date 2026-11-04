'use strict';
var expectFunction = require('./util/expectFunction');
/**
 * Invokes a callback synchronously and reports success or failure in a result object.
 * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
 * receiver. Promises are successful values without awaiting; later rejections are not caught.
 * @param {Function} fn Required callback.
 * @param {...*} args Arguments passed to the callback.
 * @returns {Object} A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
 * }` with the exact thrown value.
 * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
 * a failure result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
 * @example
 * attemptResult(JSON.parse, '{"theme":"dark"}');   // => { ok: true, value: { theme: "dark" } }
 * attemptResult(() => { throw undefined; });       // => { ok: false, error: undefined }
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function attemptResult(fn, ...args) {
  expectFunction(fn);
  try {
    return { ok: true, value: Reflect.apply(fn, fn, args) };
  } catch (error) {
    return { ok: false, error: error };
  }
}
module.exports = attemptResult;
