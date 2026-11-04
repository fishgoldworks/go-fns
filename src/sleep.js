'use strict';
var getGlobal = require('./util/getGlobal');
/**
 * Creates a promise that resolves after a cancellable pause.
 * The host timer may run late. An already-aborted signal rejects without scheduling a timer.
 * Later cancellation clears the timer; listener cleanup runs on success, cancellation or
 * scheduling failure. A suppressed abort event is detected when the timer fires.
 * Rejects with `TypeError` for invalid argument types or `RangeError` for unsupported
 * durations. Signal and host-timer errors also reject the promise.
 * @param {number} [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param {Object} [options] Optional non-null, non-array options object.
 * @param {Object} [options.signal] Optional AbortSignal-compatible object with `aborted`,
 * `reason`, `addEventListener` and `removeEventListener`.
 * @returns {Promise<void>} A promise resolving to `undefined` after the timer, or rejecting
 * with the exact `signal.reason` when aborted.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#sleepmilliseconds-options | Full API documentation}
 * @example
 * await sleep(1);                // => undefined
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function sleep(milliseconds, options) {
  return new Promise(function (resolve, reject) {
    milliseconds = milliseconds === undefined ? 0 : milliseconds;
    if (typeof milliseconds !== 'number') throw new TypeError('Expected milliseconds to be a number.');
    if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 2147483647) {
      throw new RangeError('Expected milliseconds between 0 and 2147483647.');
    }
    if (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options))) {
      throw new TypeError('Expected an options object.');
    }
    var signal = options === undefined ? undefined : options.signal;
    var add, remove;
    if (signal !== undefined) {
      if (signal === null || typeof signal !== 'object' || typeof signal.aborted !== 'boolean') {
        throw new TypeError('Expected an AbortSignal-compatible signal.');
      }
      add = signal.addEventListener;
      remove = signal.removeEventListener;
      if (typeof add !== 'function' || typeof remove !== 'function') {
        throw new TypeError('Expected an AbortSignal-compatible signal.');
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
    }
    var timer,
      listening = false,
      settled = false;
    function finish(failed, value) {
      if (settled) return;
      settled = true;
      // Always try both cleanup operations. Preserve an existing failure/reason.
      try {
        if (timer !== undefined) getGlobal().clearTimeout(timer);
      } catch (error) {
        if (!failed) {
          failed = true;
          value = error;
        }
      }
      try {
        if (listening) {
          listening = false;
          Reflect.apply(remove, signal, ['abort', onAbort]);
        }
      } catch (error) {
        if (!failed) {
          failed = true;
          value = error;
        }
      }
      if (failed) reject(value);
      else resolve();
    }
    function onAbort() {
      if (settled) return;
      try {
        // dispatchEvent(new Event('abort')) does not actually abort a signal.
        var aborted = signal.aborted;
        if (!settled && aborted) finish(true, signal.reason);
      } catch (error) {
        finish(true, error);
      }
    }
    function onTimeout() {
      if (settled) return;
      try {
        // An earlier listener can suppress our abort event; recheck before resolving.
        var aborted = signal !== undefined && signal.aborted;
        // Structural signals may settle the wait from an effectful getter.
        if (settled) return;
        if (aborted) finish(true, signal.reason);
        else finish(false);
      } catch (error) {
        finish(true, error);
      }
    }
    try {
      if (signal !== undefined) {
        listening = true;
        // Not once:true: ignore synthetic events without losing real cancellation.
        Reflect.apply(add, signal, ['abort', onAbort]);
        if (!settled && signal.aborted) onAbort();
      }
      if (!settled) {
        timer = getGlobal().setTimeout(onTimeout, milliseconds);
        // Registration can run user code (for example Node async hooks). If it
        // settled the wait before returning its handle, finish could not own
        // that handle yet. Release it now without changing the chosen outcome.
        if (settled) getGlobal().clearTimeout(timer);
      }
    } catch (error) {
      finish(true, error);
    }
  });
}
module.exports = sleep;
