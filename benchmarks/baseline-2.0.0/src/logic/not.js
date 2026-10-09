"use strict";

var expectFunction = require("../util/expectFunction");

/**
 * Creates a function that negates the result of the given function.
 * The parameters you pass when invoking the created function will be passed down to the given function 
 * with the receiver of the returned wrapper. Bound functions keep their bound receiver.
 * Predicate results are coerced to booleans and are never awaited.
 * @param {Function} fn The function to negate.
 * @returns {Function} The new function that negates the result of the given function.
 * @throws {TypeError} if the given value is not a function.
 * @example
 * not(isString)(1); // => true
 * 
 * not(isString)("abc"); // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function not(fn) {
    expectFunction(fn);

    return function () {
        return !Reflect.apply(fn, this, arguments);
    };
}

module.exports = not;
