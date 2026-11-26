'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;

/**
 * Creates a reusable function that awaits a predicate, then runs and awaits the selected branch.
 * Construction validates all three callbacks synchronously without invoking them. Each call
 * starts the predicate immediately and awaits its result before invoking the selected branch,
 * even when the predicate result is synchronous. Every callback receives all original call
 * arguments and the caller's `this`; input arguments are never awaited before the callbacks.
 * @param {Function} predicate Required synchronous or asynchronous condition.
 * @param {Function} onTrue Required branch called for a truthy awaited predicate result.
 * @param {Function} onFalse Required branch called for a falsy awaited predicate result.
 * @returns {Function} An async wrapper resolving to the awaited result of the selected branch.
 * Callback throws and rejections stop evaluation and reject with the original value.
 * @throws {TypeError} If any required callback is not a function. Validation is synchronous,
 * including the branch that would not be selected.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
 * @example
 * const describe = ifElseAsync(async value => value > 0, () => "positive", async () => "not positive");
 * await describe(3);             // => "positive"
 * await describe(0);             // => "not positive"
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function ifElseAsync(predicate, onTrue, onFalse) {
  expectFunction(predicate);
  expectFunction(onTrue);
  expectFunction(onFalse);

  return async function () {
    var branch = (await apply(predicate, this, arguments)) ? onTrue : onFalse;

    return apply(branch, this, arguments);
  };
}

module.exports = ifElseAsync;
