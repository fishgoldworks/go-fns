'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;

/**
 * Creates a specialised function that appends saved arguments to each call without binding its receiver.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Saved values are retained by reference. Omitted inputs are not padded; supply
 * optional prefix positions explicitly when needed to keep saved arguments in place.
 * @param {Function} fn Required callback.
 * @param {...*} saved Arguments saved after the arguments supplied on each later call.
 * @returns {Function} A wrapper returning the callback result after appending the saved
 * arguments.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#partialrightfn-args | Full API documentation}
 * @example
 * const divideByTwo = partialRight((value, divisor) => value / divisor, 2);
 * divideByTwo(10);               // => 5
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function partialRight(fn, ...saved) {
  expectFunction(fn);

  // Still return a fresh forwarding wrapper when no arguments are saved.
  if (saved.length === 0) {
    return function () {
      return apply(fn, this, arguments);
    };
  }

  return function () {
    if (arguments.length === 0) {
      return apply(fn, this, saved);
    }

    // One combined array instead of a rest array plus concat on every call.
    var input = new Array(saved.length + arguments.length);

    for (var i = 0; i < arguments.length; i++) input[i] = arguments[i];
    for (var j = 0; j < saved.length; j++) input[arguments.length + j] = saved[j];

    return apply(fn, this, input);
  };
}

module.exports = partialRight;
