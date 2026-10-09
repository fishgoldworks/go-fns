"use strict";
var expectFunction = require("./util/expectFunction");
var apply = Reflect.apply;
/**
 * Prepends saved arguments to each call without binding the callback receiver.
 * Saved values are retained by reference; no placeholders are interpreted.
 * @param {Function} fn Callback to specialize.
 * @param {...*} args Leading arguments.
 * @returns {Function} A wrapper forwarding its caller's receiver and result.
 * @since 2.2.0
 * @static
 * @memberof Utility
 */
function partial(fn, ...args) {
    expectFunction(fn);
    return function (...input) {
        return apply(fn, this, args.concat(input));
    };
}
module.exports = partial;
module.exports.right = require("./partialRight");
