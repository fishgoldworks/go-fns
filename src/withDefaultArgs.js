'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;

/**
 * Creates a wrapper that supplies positional defaults when arguments are omitted or undefined.
 * Use it to adapt an existing function without changing its declaration. Callers can override
 * each default; null and other defined values are preserved. Defaults are captured once and
 * retained by reference, not evaluated as factories or cloned for each call.
 *
 * The wrapper forwards its caller's exact receiver and returns the callback result unchanged.
 * It forwards the greater of the supplied argument count and the default count, including
 * explicit undefined slots. Extra arguments are preserved. There is no constructor adaptation.
 * @param {Function} fn Required callback.
 * @param {...*} defaultArgs Fallback values for consecutive argument positions.
 * @returns {Function} A fresh wrapper that calls the callback with resolved argument values.
 * @throws {TypeError} If the callback is not a function. Errors from later callback calls
 * propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#withdefaultargsfn-defaultargs | Full API documentation}
 * @example
 * const createEntry = (count, level) => ({ count, level });
 * const createEntryWithDefaults = withDefaultArgs(createEntry, 1, 'info');
 * createEntryWithDefaults();                    // => { count: 1, level: 'info' }
 * createEntryWithDefaults(undefined, 'error');  // => { count: 1, level: 'error' }
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function withDefaultArgs(fn, ...defaultArgs) {
  expectFunction(fn);

  return function () {
    var length = arguments.length > defaultArgs.length ? arguments.length : defaultArgs.length;
    var input = new Array(length);

    for (var index = 0; index < length; index++) {
      var value = index < arguments.length ? arguments[index] : undefined;

      input[index] = value === undefined && index < defaultArgs.length ? defaultArgs[index] : value;
    }

    return apply(fn, this, input);
  };
}

module.exports = withDefaultArgs;
