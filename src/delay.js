'use strict';

var expectFunction = require('./util/expectFunction');
var getGlobal = require('./util/getGlobal');

/**
 * Schedules a callback through the host's `setTimeout` and returns its timer handle.
 * Duration coercion, scheduling and the callback receiver follow the host timer. Use
 * `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback
 * synchronously.
 * @param {Function} fn Required callback.
 * @param {number|null} [delay] Delay passed unchanged to the host timer; host defaults and
 * coercion apply.
 * @param {...*} args Arguments passed to the callback.
 * @returns {number|Object} The native timer handle: a browser number or a Node.js `Timeout`
 * object.
 * @throws {TypeError} If `fn` is not a function. Scheduling errors propagate; later callback
 * errors are reported by the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#delayfn-milliseconds-args | Full API documentation}
 * @example
 * const timer = delay(console.log, 100, "hello");
 * clearTimeout(timer); // Cancel the pending callback.
 * @since 1.0.0
 * @static
 * @memberof Utility
 */
function delay(fn, delay, args) {
  expectFunction(fn);

  // Native browser timers require the host global, not the library namespace.
  // Leave duration coercion, callback binding and handle types to the host.
  return Reflect.apply(setTimeout, getGlobal(), arguments);
}

module.exports = delay;
