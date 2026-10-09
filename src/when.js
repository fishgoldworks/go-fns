'use strict';
var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);
/**
 * Creates a function that transforms one value when a predicate is truthy and otherwise
 * returns it unchanged.
 * When called, the wrapper evaluates the predicate once. Both callbacks receive exactly one
 * input and the caller's `this`. Predicate promises are truthy without awaiting; a transform
 * result or promise is returned unchanged.
 * @param {Function} predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param {Function} transform Transformation called only when the predicate result is truthy.
 * @returns {Function} A wrapper returning the transform result for a truthy predicate result;
 * otherwise the exact input value or object reference.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenpredicate-transform | Full API documentation}
 * @example
 * const makePositive = when(value => value < 0, value => -value);
 * makePositive(-3);              // => 3
 * makePositive(2);               // => 2
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function when(predicate, transform) {
  expectFunction(predicate);
  expectFunction(transform);
  return function (value) {
    return call(predicate, this, value) ? call(transform, this, value) : value;
  };
}
module.exports = when;
module.exports.async = require('./whenAsync');
