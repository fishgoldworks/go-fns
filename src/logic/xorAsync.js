'use strict';

var normalizeFunctions = require('../util/normalizeFunctions');
var apply = Reflect.apply;

/**
 * Creates an async predicate that requires exactly one awaited callback result to be truthy.
 * Callbacks are awaited sequentially and evaluation stops at the second truthy result;
 * three truthy results still resolve to `false`, rather than odd-parity XOR. Nullish
 * predicates are skipped; an empty list resolves to `false`. All configuration is validated
 * synchronously without invoking callbacks. Each invocation starts the first callback
 * immediately and awaits its result before calling the next, even when it is synchronous.
 * Every callback receives all original call arguments and the caller's `this`; input
 * arguments are never awaited.
 * @param {...(Function|null|undefined)} fns Synchronous or asynchronous predicates in call
 * order; `null` and `undefined` entries are skipped.
 * @returns {Function} An async predicate resolving to `true` if exactly one awaited result
 * is truthy; otherwise `false`. Callback throws and rejections stop evaluation and reject
 * with the original value.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated synchronously, including those that would be skipped by short circuit.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorasyncfns | Full API documentation}
 * @example
 * const exactlyOne = xorAsync(value => typeof value === 'number', async value => value > 0);
 * await exactlyOne(-3);          // => true
 * await exactlyOne(3);           // => false
 * await xorAsync(() => true, () => true, () => true)(); // => false
 * await xorAsync()();            // => false
 * @since 2.0.0
 * @static
 * @memberof Logic
 */
function xorAsync(fns) {
  fns = normalizeFunctions(arguments);

  return async function () {
    var passed = 0;
    for (var i = 0; i < fns.length; i++) {
      if (await apply(fns[i], this, arguments)) {
        if (++passed > 1) {
          return false;
        }
      }
    }
    return passed === 1;
  };
}

module.exports = xorAsync;
