'use strict';

var normalizeFunctions = require('../util/normalizeFunctions');

/**
 * Creates a predicate that awaits results in order and determines whether all are truthy. Stops at the first falsy result. Nullish predicates are skipped; an empty
 * list resolves to `false`. All configuration is validated synchronously without invoking
 * callbacks. Each invocation starts the first callback immediately and awaits its result
 * before calling the next, even when the result is synchronous. Every callback receives
 * all original call arguments and the caller's `this`; input arguments are never awaited.
 * @param {...(Function|null|undefined)} fns Synchronous or asynchronous predicates in call
 * order; `null` and `undefined` entries are skipped.
 * @returns {Function} An async predicate resolving to `true` if at least one predicate
 * remains and every awaited result is truthy; otherwise `false`. Callback throws and
 * rejections stop evaluation and reject with the original value.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated synchronously, including those that would be skipped by short circuit.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
 * @example
 * const isPositiveInteger = andAsync(Number.isInteger, async value => value > 0);
 * await isPositiveInteger(3);    // => true
 * await isPositiveInteger(-3);   // => false
 * await andAsync()();            // => false
 * @since 2.0.0
 * @static
 * @memberof Logic
 */
function andAsync(fns) {
  fns = normalizeFunctions(arguments);

  return async function () {
    for (var i = 0; i < fns.length; i++) {
      if (!(await Reflect.apply(fns[i], this, arguments))) {
        return false;
      }
    }
    return fns.length > 0;
  };
}

module.exports = andAsync;
