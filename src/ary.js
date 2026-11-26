'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;
var slice = Function.prototype.call.bind(Array.prototype.slice);

/**
 * Creates a wrapper that forwards at most the specified number of arguments.
 * The wrapper forwards the caller's receiver and returns the callback result unchanged.
 * Missing inputs stay omitted; extra inputs are discarded from the end.
 * @param {Function} fn Required callback.
 * @param {number} count Maximum argument count, from 0 through 4294967295.
 * @returns {Function} A wrapper that calls the callback with the capped argument list.
 * @throws {TypeError} If the callback is not a function or the cap is not a number.
 * @throws {RangeError} If the cap is not an integer in the supported range.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#aryfn-count | Full API documentation}
 * @example
 * const firstTwo = ary((...values) => values, 2);
 * firstTwo('a', 'b', 'c');       // => ['a', 'b']
 * firstTwo('a');                 // => ['a']
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function ary(fn, count) {
  expectFunction(fn);
  if (typeof count !== 'number') throw new TypeError('Argument cap must be a number.');
  if (!Number.isInteger(count) || count < 0 || count > 4294967295) {
    throw new RangeError('Argument cap must be an integer from 0 through 4294967295.');
  }

  return function () {
    var input = arguments.length <= count ? arguments : slice(arguments, 0, count);

    return apply(fn, this, input);
  };
}

module.exports = ary;
