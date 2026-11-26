'use strict';

var expectFunction = require('./util/expectFunction');
var call = Function.prototype.call.bind(Function.prototype.call);

/**
 * Applies a transformation immediately when a boolean flag is `true` or a predicate returns a truthy
 * value. Otherwise, returns the original input.
 * The condition and transform are validated before callbacks run. A predicate and the selected
 * transform each receive one value and the caller's exact this receiver. Predicate
 * promises are truthy without awaiting; transform results are returned unchanged.
 * @param {*} value Input passed to the predicate and transformation.
 * @param {boolean|Function} condition Required boolean or predicate.
 * @param {Function} transform Required transformation, called only for a truthy decision.
 * @returns {*} The transformation result or original input, preserving identity.
 * @throws {TypeError} If condition is neither a boolean nor function, or transform is not a function.
 * Callback errors propagate unchanged.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#applyifvalue-condition-transform | Full API documentation}
 * @example
 * applyIf('42', true, Number);                    // => 42
 * applyIf('42', false, Number);                   // => '42'
 * applyIf('42', value => value.length, Number);   // => 42
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function applyIf(value, condition, transform) {
  if (typeof condition !== 'boolean' && typeof condition !== 'function')
    throw new TypeError('Expected a boolean condition or predicate.');
  expectFunction(transform);
  var decision = typeof condition === 'function' ? call(condition, this, value) : condition;

  return decision ? call(transform, this, value) : value;
}

module.exports = applyIf;
