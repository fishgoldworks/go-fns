"use strict";

var normalizeFunctions = require("../util/normalizeFunctions");

/**
 * Creates a function that tests if all the given functions return a truthy value. 
 * The parameters you pass when invoking the created function will be passed down to the given functions 
 * with the receiver of the returned wrapper. Bound functions keep their bound receiver.
 * Predicate results are coerced to booleans and are never awaited.
 * Null and undefined predicates are skipped. An empty predicate list returns false.
 * @param {...Function} fns The functions to test.
 * @returns {Function} The new function that tests if all the given functions return a truthy value.
 * @throws {TypeError} if any of the given values is not a function, null or undefined.
 * @example
 * and(isString, isPrimitive)("abc"); // => true
 *
 * and(isString, isPrimitive)(new String("abc")); // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function and(fns) {
    fns = normalizeFunctions(arguments);
    
    return function () {
        for (var i = 0; i < fns.length; i++) {
            if (!Reflect.apply(fns[i], this, arguments)) {
                return false;
            }
        }
        return fns.length > 0;
    };
}

module.exports = and;
