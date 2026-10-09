"use strict";

var expectFunction = require("./util/expectFunction");

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
