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
