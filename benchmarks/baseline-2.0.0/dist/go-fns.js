/*! go-fns v2.0.0 | LGPL-3.0-only */
(function(root, factory) {
    if (typeof exports === "object" && typeof module === "object") module.exports = factory();
    else if (typeof define === "function" && define.amd) define([], factory);
    else if (typeof exports === "object") exports.Functions = factory();
    else root.Functions = factory();
})(globalThis, function() {
    "use strict";
    var modules = {
"index.js": function(module, exports, require) {
"use strict";

/** 
* @namespace Utility 
*/
/**
* Propositional logic connectives
* @namespace Logic 
*/
module.exports.pipe = require("src/pipe.js");
module.exports.spread = require("src/spread.js");
module.exports.attempt = require("src/attempt.js");
module.exports.repeat = require("src/repeat.js");
module.exports.delay = require("src/delay.js");

module.exports.and = require("src/logic/and.js");
module.exports.or = require("src/logic/or.js");
module.exports.xor = require("src/logic/xor.js");
module.exports.nor = require("src/logic/nor.js");
module.exports.not = require("src/logic/not.js");

},
"src/pipe.js": function(module, exports, require) {
"use strict";

var normalizeFunctions = require("src/util/normalizeFunctions.js");

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

},
"src/util/normalizeFunctions.js": function(module, exports, require) {
"use strict";

/** Validate and copy a sequence of functions, ignoring null and undefined. */
function normalizeFunctions(args) {
    var functions = [];
    for (var i = 0; i < args.length; i++) {
        var fn = args[i];
        if (fn === null || fn === undefined) {
            continue;
        }
        if (typeof fn !== "function") {
            throw new TypeError("Expected a function, null or undefined.");
        }
        functions.push(fn);
    }
    return functions;
}

module.exports = normalizeFunctions;

},
"src/spread.js": function(module, exports, require) {
"use strict";

var expectFunction = require("src/util/expectFunction.js");

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

},
"src/util/expectFunction.js": function(module, exports, require) {
"use strict";

function expectFunction(arg) {
    if (typeof arg !== "function") {
        // Do not stringify untrusted values while constructing a validation error.
        throw new TypeError("Expected a function.");
    }
    return arg;
}

module.exports = expectFunction;

},
"src/attempt.js": function(module, exports, require) {
"use strict";

var expectFunction = require("src/util/expectFunction.js");

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

},
"src/repeat.js": function(module, exports, require) {
"use strict";

var expectFunction = require("src/util/expectFunction.js");

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

},
"src/delay.js": function(module, exports, require) {
"use strict";

var expectFunction = require("src/util/expectFunction.js");

/**
 * Executes a function after a specified number of milliseconds with the arguments provided.
 * Duration coercion and callback receiver follow the host setTimeout implementation.
 * Use clearTimeout on the returned handle to cancel. Callback errors are not caught.
 * @param {Function} fn The function to execute after a delay.
 * @param {number} [delay=0] The number of milliseconds to wait before executing the function.
 * @param {...*} [args] The arguments for the function.
 * @returns {(number|Object)} A native timer handle: a number in browsers or a Timeout object in Node.js.
 * @throws {TypeError} if <code>fn</code> is not a function.
 * @example
 * delay(log, 1000, "hi"); // => prints "hi" after 1 second.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/setTimeout|setTimeout}
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function delay(fn, delay, args) {
    expectFunction(fn);

    // Native browser timers require the host global, not the library namespace.
    // Leave duration coercion, callback binding and handle types to the host.
    return Reflect.apply(setTimeout, globalThis, arguments);
}

module.exports = delay;

},
"src/logic/and.js": function(module, exports, require) {
"use strict";

var normalizeFunctions = require("src/util/normalizeFunctions.js");

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

},
"src/logic/or.js": function(module, exports, require) {
"use strict";

var normalizeFunctions = require("src/util/normalizeFunctions.js");

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

},
"src/logic/xor.js": function(module, exports, require) {
"use strict";

var normalizeFunctions = require("src/util/normalizeFunctions.js");

/**
 * Creates a function that tests if exactly one of the given functions returns a truthy value.
 * The parameters you pass when invoking the created function will be passed down to the given functions 
 * with the receiver of the returned wrapper. Bound functions keep their bound receiver.
 * Predicate results are coerced to booleans and are never awaited.
 * Null and undefined predicates are skipped. An empty predicate list returns false.
 * This tests exactly one truthy result, not odd parity, and stops on the second truthy result.
 * @param {...Function} fns The functions to test.
 * @returns {Function} The new function that tests if exactly one of the given functions return a truthy value.
 * @throws {TypeError} if any of the given values is not a function, null or undefined.
 * @example
 * xor(isString, isNumber)("abc"); // => true
 * 
 * xor(isString, isNumber)(1);  // => true
 * 
 * xor(isString, isNumber)(true); // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function xor(fns) {
    fns = normalizeFunctions(arguments);
    
    return function () {
        var passed = 0;
        for (var i = 0; i < fns.length; i++) {
            if (Reflect.apply(fns[i], this, arguments)) {
                if (++passed > 1) {
                    return false;
                }
            }
        }
        return passed === 1;
    };
}

module.exports = xor;

},
"src/logic/nor.js": function(module, exports, require) {
"use strict";

var normalizeFunctions = require("src/util/normalizeFunctions.js");

/**
 * Creates a function that tests if all the given functions return a falsy value.
 * The parameters you pass when invoking the created function will be passed down to the given functions 
 * with the receiver of the returned wrapper. Bound functions keep their bound receiver.
 * Predicate results are coerced to booleans and are never awaited.
 * Null and undefined predicates are skipped. An empty predicate list returns false.
 * @param {...Function} fns The functions to test.
 * @returns {Function} The new function that tests if all the given functions return a falsy value.
 * @throws {TypeError} if any of the given values is not a function, null or undefined.
 * @example
 * nor(isString, isNumber)(true); // => true
 * 
 * nor(isString, isNumber)("abc"); // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function nor(fns) {
    fns = normalizeFunctions(arguments);

    return function () {
        for (var i = 0; i < fns.length; i++) {
            if (Reflect.apply(fns[i], this, arguments)) {
                return false;
            }
        }
        return fns.length > 0;
    };
}

module.exports = nor;

},
"src/logic/not.js": function(module, exports, require) {
"use strict";

var expectFunction = require("src/util/expectFunction.js");

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

}
};
    var cache = Object.create(null);
    function require(id) {
        if (cache[id]) return cache[id].exports;
        var module = {exports: {}};
        cache[id] = module;
        modules[id](module, module.exports, require);
        return module.exports;
    }
    return require("index.js");
});
