'use strict';

var normalizeFunctions = require('./util/normalizeFunctions');
var call = Function.prototype.call.bind(Function.prototype.call);

/**
 * Creates a reusable pipeline that awaits each stage's result before passing it onward.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param {...(Function|null|undefined)} fns Functions in call order; `null` and `undefined`
 * entries are skipped.
 * @returns {Function} A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 * @example
 * const doubleSum = pipeAsync(async (a, b) => a + b, value => value * 2);
 * await doubleSum(2, 3);         // => 10
 * await pipeAsync()(42);         // => undefined
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function pipeAsync(fns) {
  var queue = normalizeFunctions(arguments);

  return async function () {
    var result = queue.length > 0 ? await Reflect.apply(queue[0], this, arguments) : undefined;

    for (var i = 1; i < queue.length; i++) {
      result = await call(queue[i], this, result);
    }

    return result;
  };
}

module.exports = pipeAsync;
