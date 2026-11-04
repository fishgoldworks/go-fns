'use strict';

var normalizeFunctions = require('./util/normalizeFunctions');
// Call unary stages without allocating argument arrays or reading callback properties.
var call = Function.prototype.call.bind(Function.prototype.call);

/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param {...(Function|null|undefined)} fns Functions in call order; `null` and `undefined`
 * entries are skipped.
 * @returns {Function} A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 * @example
 * const doubleSum = pipe((a, b) => a + b, value => value * 2);
 * doubleSum(2, 3);               // => 10
 * pipe()(42);                    // => undefined
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function pipe(fns) {
  var queue = normalizeFunctions(arguments);

  return function () {
    var result = queue.length > 0 ? Reflect.apply(queue[0], this, arguments) : undefined;
    for (var i = 1; i < queue.length; i++) {
      result = call(queue[i], this, result);
    }
    return result;
  };
}

module.exports = pipe;
