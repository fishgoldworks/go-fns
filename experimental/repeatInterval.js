var expectFunction = require("./expectFunction");

/**
 * Executes a function for a specified number of times and returns the results in a new array.
 * @param {Function} fn The function to execute.
 * @param {number} [delay=0] The delay (in milliseconds) in between executions.
 * @param {number} [limit=Number.POSITIVE_INFINITY] The maximum number of times to execute.
 * @param {...*} [args] The arguments for the function.
 * @returns {Array} The new array containing the results.
 * @throws {TypeError} if <code>fn</code> is not a function.
 * @example
 * repeat(Math.floor, 3, 1.5); // => [1, 1, 1]
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function repeatInterval(fn, delay, limit, args) {
    expectFunction(fn);

    limit = limit != null ? limit : Number.POSITIVE_INFINITY;
    var count = 0;

    var timer = setInterval(function () {
        fn.apply(fn, Array.prototype.slice.call(arguments, 3));
        if (++count >= limit) {
            clearInterval(timer);
        }
    }, delay);
    return timer;
}

module.exports = repeatInterval;