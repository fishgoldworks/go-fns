'use strict';

var normalizeFunctions = require('../util/normalizeFunctions');

/**
 * Creates a predicate that determines whether all supplied predicates return truthy values.
 * Stops at the first falsy result. The returned predicate forwards all call arguments and the
 * caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are
 * skipped; an empty list returns `false` when called.
 * @param {...(Function|null|undefined)} fns Functions in call order; `null` and `undefined`
 * entries are skipped.
 * @returns {Function} A predicate returning `true` if at least one predicate remains and all
 * results are truthy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andfns | Full API documentation}
 * @example
 * const predicate = and(value => typeof value === 'number', value => value > 0);
 * predicate(3);                  // => true
 * predicate(-3);                 // => false
 * and()();                       // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function and(fns) {
  fns = normalizeFunctions(arguments);

  return function () {
    for (var i = 0; i < fns.length; i++) {
      if (!Reflect.apply(fns[i], this, arguments)) {
        return false;
      }
    }
    return fns.length > 0;
  };
}

module.exports = and;
/**
 * Creates an async predicate that awaits callbacks sequentially and requires all results
 * to be truthy. Alias of `andAsync`. Stops at the first falsy result. Every callback receives
 * all original call arguments and the caller's `this`; input arguments are never awaited.
 * Construction validates all entries synchronously without invoking callbacks.
 * @param {...(Function|null|undefined)} fns Synchronous or asynchronous predicates in call
 * order; `null` and `undefined` entries are skipped.
 * @returns {Function} An async predicate resolving to `true` if at least one predicate
 * remains and all awaited results are truthy; otherwise `false`. Callback throws and
 * rejections stop evaluation and reject with the original value.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
 * @since 2.0.0
 */
module.exports.async = require('./andAsync');
