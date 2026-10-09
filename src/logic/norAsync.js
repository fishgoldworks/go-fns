'use strict';

var normalizeFunctions = require('../util/normalizeFunctions');
var apply = Reflect.apply;

/**
 * Creates an async predicate that awaits each callback in order and requires all results
 * to be falsy. Stops at the first truthy result. Nullish predicates are skipped; an empty
 * list resolves to `false`. All configuration is validated synchronously without invoking
 * callbacks. Each invocation starts the first callback immediately and awaits its result
 * before calling the next, even when the result is synchronous. Every callback receives
 * all original call arguments and the caller's `this`; input arguments are never awaited.
 * @param {...(Function|null|undefined)} fns Synchronous or asynchronous predicates in call
 * order; `null` and `undefined` entries are skipped.
 * @returns {Function} An async predicate resolving to `true` if at least one predicate
 * remains and every awaited result is falsy; otherwise `false`. Callback throws and
 * rejections stop evaluation and reject with the original value.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated synchronously, including those that would be skipped by short circuit.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norasyncfns | Full API documentation}
 * @example
 * const isNeitherZeroNorPositive = norAsync(value => value === 0, async value => value > 0);
 * await isNeitherZeroNorPositive(-3); // => true
 * await isNeitherZeroNorPositive(3);  // => false
 * await norAsync()();            // => false
 * @since 2.0.0
 * @static
 * @memberof Logic
 */
function norAsync(fns) {
  fns = normalizeFunctions(arguments);

  return async function () {
    for (var i = 0; i < fns.length; i++) {
      if (await apply(fns[i], this, arguments)) {
        return false;
      }
    }
    return fns.length > 0;
  };
}

module.exports = norAsync;
