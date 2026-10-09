"use strict";

var expectFunction = require("./util/expectFunction");

/**
 * Executes a function for a specified number of times and returns the results in a new array.
 * Runs synchronously; promises are collected without awaiting. The callback is its own receiver,
 * unless already bound. Null or undefined count means zero. Large counts still consume memory.
 * @param {Function} fn The function to execute.
 * @param {number} [count=0] An integer from 0 through 4294967295; null or undefined means zero.
 * @param {...*} [args] The arguments for the function.
 * @returns {Array} The new array containing the results.
 * @throws {TypeError} if fn is not a function or count is non-nullish and not a number.
 * @throws {RangeError} if count is not an integer in the supported range.
 * @example
 * repeat(Math.floor, 3, 1.5); // => [1, 1, 1]
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function repeat(fn, count, args) {
    expectFunction(fn);

    count = count === null || count === undefined ? 0 : count;
    if (typeof count !== "number") {
        throw new TypeError("Expected count to be a number.");
    }
    // Every result must fit in an actual array; reject coercion and unbounded loops.
    if (!Number.isInteger(count) || count < 0 || count > 4294967295) {
        throw new RangeError("Expected count to be an integer between 0 and 4294967295.");
    }

    var results = [];
    // The argument list is constant across iterations, so copy it only once.
    var callArgs = Array.prototype.slice.call(arguments, 2);

    for (var i = 0; i < count; i++) {
        results[i] = Reflect.apply(fn, fn, callArgs);
    }
    return results;
}

module.exports = repeat;
