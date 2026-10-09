"use strict";

var normalizeFunctions = require("./util/normalizeFunctions");

/**
 * Creates a function that executes a series of functions in the order provided.
 * First it passes the parameters to the first function and then the output 
 * is used as the input for the next function in the sequence, 
 * and so on until it reaches the end and finally it returns the output of the last function.
 * Null and undefined stages are skipped. An empty pipeline returns undefined.
 * The caller receiver is forwarded unchanged. Promises are ordinary values, not awaited.
 * @param {...Function} fns The functions to execute sequentially.
 * @returns {Function} The new function that sequentially executes the given functions.
 * @throws {TypeError} if any of the given values is not a function, null or undefined.
 * @example
 * pipe(Math.floor)(4.5); // => 4
 * 
 * pipe(Math.floor, Math.sqrt)(4.5); // => 2
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function pipe(fns) {
    var queue = normalizeFunctions(arguments);

    return function () {
        var result = queue.length > 0 ? Reflect.apply(queue[0], this, arguments) : undefined;
        for (var i = 1; i < queue.length; i++) {
            result = Reflect.apply(queue[i], this, [result]);
        }
        return result;
    };
}

module.exports = pipe;
