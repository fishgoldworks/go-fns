'use strict';
var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;
/**
 * Creates a function that evaluates a predicate once and calls the matching branch.
 * All call arguments and the caller's `this` reach the predicate and selected branch. The
 * other branch is not called. Predicate promises are truthy without awaiting; the selected
 * branch result is returned unchanged.
 * @param {Function} predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param {Function} onTrue Branch called for a truthy predicate result.
 * @param {Function} onFalse Branch called for a falsy predicate result.
 * @returns {Function} A wrapper returning the `onTrue` result for a truthy predicate result,
 * or the `onFalse` result otherwise.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelsepredicate-ontrue-onfalse | Full API documentation}
 * @example
 * const describe = ifElse(value => value > 0, () => "positive", () => "not positive");
 * describe(3);                   // => "positive"
 * describe(0);                   // => "not positive"
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function ifElse(predicate, onTrue, onFalse) {
  expectFunction(predicate);
  expectFunction(onTrue);
  expectFunction(onFalse);
  return function () {
    var branch = apply(predicate, this, arguments) ? onTrue : onFalse;
    return apply(branch, this, arguments);
  };
}
module.exports = ifElse;
module.exports.async = require('./ifElseAsync');
