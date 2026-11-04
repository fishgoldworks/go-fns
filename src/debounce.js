'use strict';
var expectFunction = require('./util/expectFunction');
var scheduleOptions = require('./util/scheduleOptions');
var createScheduler = require('./util/createScheduler');
/**
 * Creates a function that combines a burst of calls using the latest arguments and receiver.
 * Defaults to trailing execution after calls stop. Optional `maxWait` limits postponement
 * while calls continue, subject to host timer scheduling. Construction does not invoke the
 * callback. `cancel()`, `flush()` and `pending()` manage scheduled calls; started
 * asynchronous work continues.
 * @param {Function} fn Required callback.
 * @param {number} [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param {Object} [options] Optional non-null, non-array options object.
 * @param {boolean} [options.leading] Whether to invoke at the start of a burst; defaults to
 * `false`.
 * @param {boolean} [options.trailing] Whether to invoke after calls stop; defaults to `true`.
 * @param {number} [options.maxWait] Optional finite duration in the supported range, at least
 * `milliseconds`, that caps postponement.
 * @returns {Function} A scheduled wrapper returning the most recent callback return value, including a pending promise, or
 * `undefined` until the first successful return. Returned promises are not awaited.
 * @throws {TypeError} If callback, duration or option types are invalid.
 * @throws {RangeError} If a duration is outside its supported range. Immediate callback
 * errors propagate; timer callback errors go to the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncefn-milliseconds-options | Full API documentation}
 * @example
 * const update = debounce(value => value, 100);
 * update("first");
 * update("latest");
 * update.pending();              // => true
 * update.flush();                // => "latest"
 * update.cancel();
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function debounce(fn, milliseconds, options) {
  expectFunction(fn);
  return createScheduler(fn, scheduleOptions(milliseconds, options, false, true));
}
module.exports = debounce;
