'use strict';
var expectFunction = require('./util/expectFunction');
/**
 * Creates a function that invokes its callback at most once and caches the first outcome.
 * The first call supplies the arguments and `this`; later calls ignore their inputs. Exact
 * returned values, promise identity and thrown values are cached. Failures are not retried,
 * and creating the wrapper does not invoke the callback.
 * @param {Function} fn Required callback.
 * @returns {Function} A wrapper reusing the first returned value or promise, or rethrowing
 * the first thrown value unchanged.
 * @throws {TypeError} If `fn` is not a function.
 * @throws {Error} If the wrapper is called recursively before its first callback returns. An
 * uncaught recursive-call error becomes the cached failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#oncefn | Full API documentation}
 * @example
 * let calls = 0;
 * const readOnce = once(() => ++calls);
 * readOnce();                    // => 1
 * readOnce();                    // => 1
 * calls;                         // => 1
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function once(fn) {
  expectFunction(fn);
  // 0 = not invoked, 1 = invoking, 2 = returned, 3 = threw.
  var state = 0;
  var result;
  return function () {
    if (state === 2) return result;
    if (state === 3) throw result;
    if (state === 1) throw new Error('Reentrant invocation of a once wrapper.');
    state = 1;
    try {
      result = Reflect.apply(fn, this, arguments);
      state = 2;
    } catch (error) {
      result = error;
      state = 3;
    } finally {
      // Do not retain an otherwise unreachable callback after its sole invocation.
      fn = null;
    }
    if (state === 3) throw result;
    return result;
  };
}
module.exports = once;
