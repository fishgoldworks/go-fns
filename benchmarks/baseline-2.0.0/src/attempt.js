"use strict";

var expectFunction = require("./util/expectFunction");

/**
 * Executes a function synchronously and returns its result or the exact thrown value.
 * The callback is its own receiver, unless already bound. Invalid callbacks throw before execution.
 * Returned Error objects and thrown Error objects cannot be distinguished by this API.
 * Promise results are returned unchanged; later rejections are not caught.
 * @param {Function} fn The function to attempt.
 * @param {...*} [args] The arguments for the function.
 * @returns {*} The result, or the exact thrown value (which need not be an Error).
 * @throws {TypeError} if <code>fn</code> is not a function.
 * @example
 * attempt(JSON.parse, "1"); // => 1
 * 
 * attempt(JSON.parse, ""); // => SyntaxError
 * 
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function attempt(fn, args) {
    expectFunction(fn);

    try {
        return Reflect.apply(fn, fn, Array.prototype.slice.call(arguments, 1));
    } catch (err) {
        return err;
    }
}

module.exports = attempt;
