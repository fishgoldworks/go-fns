"use strict";
var expectFunction = require("./util/expectFunction");
var apply = Reflect.apply;
/**
 * Appends saved arguments to each call; does not bind the callback receiver.
 * Saved values are retained by reference. There are no placeholders or padding.
 * @param {Function} fn Callback to specialize.
 * @param {...*} args Trailing arguments.
 * @returns {Function} A wrapper forwarding its caller's receiver and result.
 * @since 2.2.0
 * @static
 * @memberof Utility
 */
function partialRight(fn, ...args) {
    expectFunction(fn);
    return function (...input) {
        return apply(fn, this, input.concat(args));
    };
}
module.exports = partialRight;
