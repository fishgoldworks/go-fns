'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;

/**
 * Creates a specialised function with leading arguments supplied in advance, without binding its receiver.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Saved values are retained by reference. There are no placeholders or constructor
 * adaptations.
 * @param {Function} fn Required callback.
 * @param {...*} saved Arguments saved before the arguments supplied on each later call.
 * @returns {Function} A wrapper returning the callback result after prepending the saved
 * arguments.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#partialfn-args | Full API documentation}
 * @example
 * const addTen = partial((a, b) => a + b, 10);
 * addTen(2);                     // => 12
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function partial(fn, ...saved) {
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

    for (var i = 0; i < saved.length; i++) input[i] = saved[i];
    for (var j = 0; j < arguments.length; j++) input[saved.length + j] = arguments[j];

    return apply(fn, this, input);
  };
}

module.exports = partial;
