"use strict";

var normalizeFunctions = require("../util/normalizeFunctions");

/**
 * Creates a function that tests if any of the given functions return a truthy value.
 * The parameters you pass when invoking the created function will be passed down to the given functions 
 * with the receiver of the returned wrapper. Bound functions keep their bound receiver.
 * Predicate results are coerced to booleans and are never awaited.
 * Null and undefined predicates are skipped. An empty predicate list returns false.
 * @param {...Function} fns The functions to test.
 * @returns {Function} The new function that tests if any of the functions return a truthy value.
 * @throws {TypeError} if any of the given values is not a function, null or undefined.
 * @example
 * or(isString, isNumber)("abc"); // => true
 * 
 * or(isString, isNumber)(true); // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function or(fns) {
    fns = normalizeFunctions(arguments);

    return function () {
        for (var i = 0; i < fns.length; i++) {
            if (Reflect.apply(fns[i], this, arguments)) {
                return true;
            }
        }
        return false;
    };
}

module.exports = or;
