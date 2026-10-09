"use strict";

var expectFunction = require("./util/expectFunction");

/**
 * Creates a function that takes an array of values and passes the values to the given function as individual parameters.
 * Uses native apply array-like semantics; null or undefined supplies no arguments.
 * The caller receiver is forwarded unchanged. Results are not awaited.
 * @param {Function} fn The function to execute with individual parameters.
 * @returns {Function} The new function that passes an array of values to the given function as individual parameters.
 * @throws {TypeError} if <code>fn</code> is not a function.
 * @example
 * function sum(a, b) {
 *    return a + b;
 * }
 * 
 * spread(sum)([1, 2]); // => 3
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax|Spread operator}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply|Function.prototype.apply}
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
