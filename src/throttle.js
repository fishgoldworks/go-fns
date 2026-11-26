'use strict';

var expectFunction = require('./util/expectFunction');
var scheduleOptions = require('./util/scheduleOptions');
var createScheduler = require('./util/createScheduler');

/**
 * Creates a function that limits how often repeated calls start work while calls continue.
 * Defaults to leading and trailing execution; a lone leading call is not repeated. Uses the
 * latest arguments and receiver. `flush()` and `cancel()` can override ordinary spacing.
 * Invocation starts are limited; asynchronous work is not serialised or cancelled.
 * @param {Function} fn Required callback.
 * @param {number} [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param {Object} [options] Optional non-null, non-array options object.
 * @param {boolean} [options.leading] Whether to invoke at the start of an interval; defaults
 * to `true`.
 * @param {boolean} [options.trailing] Whether to invoke the latest pending call at the end;
 * defaults to `true`.
 * @returns {Function} A scheduled wrapper returning the most recent callback return value, including a pending promise, or
 * `undefined` until the first successful return. Returned promises are not awaited.
 * @throws {TypeError} If callback, duration or option types are invalid.
 * @throws {RangeError} If the duration is outside its supported range. Immediate callback
 * errors propagate; timer callback errors go to the host.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#throttlefn-milliseconds-options | Full API documentation}
 * @example
 * const update = throttle(value => value, 100);
 * update("first");               // => "first"
 * update("latest");              // => "first"
 * update.flush();                // => "latest"
 * update.cancel();
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function throttle(fn, milliseconds, options) {
  expectFunction(fn);

  return createScheduler(fn, scheduleOptions(milliseconds, options, true, false));
}

module.exports = throttle;
