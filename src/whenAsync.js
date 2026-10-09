'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;

/**
 * Creates an async function that transforms one value when the awaited predicate is truthy.
 * Construction validates both callbacks synchronously without invoking them. Each call
 * starts the predicate immediately and awaits it once before invoking the transform, even
 * for a synchronous predicate result. Both callbacks receive exactly one original input
 * and the caller's `this`; omitted input is passed as `undefined`, and extra arguments are
 * ignored. Input promises are not awaited before either callback.
 * @param {Function} predicate Required synchronous or asynchronous condition.
 * @param {Function} transform Required transformation, called only for a truthy awaited
 * predicate result with the same original input.
 * @returns {Function} An async wrapper resolving to the awaited transform result when the
 * predicate is truthy, or the awaited original input otherwise. On the false path, promise
 * and thenable inputs are unwrapped in the returned result. Callback throws and rejections
 * stop evaluation and reject with the original value.
 * @throws {TypeError} If either required callback is not a function. Validation is synchronous.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
 * @example
 * const makePositive = whenAsync(async value => value < 0, async value => -value);
 * await makePositive(-3);        // => 3
 * await makePositive(2);         // => 2
 * await whenAsync(() => false, value => value)(Promise.resolve(4)); // => 4
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function whenAsync(predicate, transform) {
  expectFunction(predicate);
  expectFunction(transform);

  return async function (value) {
    return (await apply(predicate, this, [value])) ? apply(transform, this, [value]) : value;
  };
}

module.exports = whenAsync;
