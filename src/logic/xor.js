'use strict';

var normalizeFunctions = require('../util/normalizeFunctions');

/**
 * Creates a predicate that determines whether exactly one supplied predicate returns a truthy
 * value.
 * Stops at the second truthy result. Three truthy results still produce `false`; this is not
 * odd-parity XOR. The returned predicate forwards all call arguments and the caller's `this`.
 * Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty
 * list returns `false` when called.
 * @param {...(Function|null|undefined)} fns Functions in call order; `null` and `undefined`
 * entries are skipped.
 * @returns {Function} A predicate returning `true` if exactly one result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorfns | Full API documentation}
 * @example
 * const predicate = xor(value => typeof value === 'number', value => value > 0);
 * predicate(3);                  // => false
 * predicate(-3);                 // => true
 * xor()();                       // => false
 * @since 1.0.0
 * @static
 * @memberof Logic
 */
function xor(fns) {
  fns = normalizeFunctions(arguments);

  return function () {
    var passed = 0;
    for (var i = 0; i < fns.length; i++) {
      if (Reflect.apply(fns[i], this, arguments)) {
        if (++passed > 1) {
          return false;
        }
      }
    }
    return passed === 1;
  };
}

module.exports = xor;
module.exports.async = require('./xorAsync');
