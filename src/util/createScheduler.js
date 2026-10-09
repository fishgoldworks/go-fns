'use strict';
var apply = Reflect.apply;
var createClock = require('./createClock');
/**
 * One-timer scheduler shared by debounce and throttle. All state is per wrapper.
 * Call arguments are cleared before callback invocation, so reentrant calls may
 * schedule fresh work safely. Results are updated only on successful completion.
 */
function createScheduler(fn, config) {
  var clock = createClock();
  var wait = config.milliseconds;
  var leading = config.leading;
  var trailing = config.trailing;
  var maxWait = config.maxWait;
  var fixedInterval = config.fixedInterval;
  var timer;
  var lastArgs;
  var lastThis;
  var lastCall;
  var lastInvoke = 0;
  var result;

  function reset() {
    timer = lastArgs = lastThis = lastCall = undefined;
    lastInvoke = 0;
  }
  function clearTimer() {
    var task = timer;
    // Keep a distinct owner while cleanup enters host instrumentation. Reentry
    // may share this pending call or supersede it through cancellation.
    var clearing = {};
    timer = clearing;
    try {
      if (task !== undefined && task.handle !== undefined) clearTimeout(task.handle);
    } catch (error) {
      if (timer === clearing) reset();
      throw error;
    }
    if (timer !== clearing) return false;
    timer = undefined;
    return true;
  }
  function arm(delay) {
    // Reserve ownership before entering the host: timer registration can run
    // user code through instrumentation, including cancellation or reentry.
    var task = {};
    timer = task;
    try {
      task.handle = setTimeout(function () {
        if (timer === task) expire();
      }, delay);
    } catch (error) {
      // A failed outer registration must not erase newer reentrant work.
      if (timer === task) reset();
      throw error;
    }
    if (timer !== task) {
      clearTimeout(task.handle);
      return false;
    }
    return true;
  }
  function invoke(now) {
    var args = lastArgs;
    var receiver = lastThis;
    lastArgs = lastThis = undefined;
    lastInvoke = now;
    result = apply(fn, receiver, args);
    return result;
  }
  function due(now) {
    if (lastCall === undefined || now < lastCall) return true;
    // Throttle measures spacing from actual invocation, not the last input.
    if (fixedInterval) return now - lastInvoke >= wait;
    return now - lastCall >= wait || (maxWait !== undefined && now - lastInvoke >= maxWait);
  }
  function finish(now) {
    timer = undefined;
    if (trailing && lastArgs !== undefined) return invoke(now);
    lastArgs = lastThis = undefined;
    return result;
  }
  // Expired or cleared timers must release their state on clock failure, but
  // clock instrumentation may already have cancelled or replaced that work.
  function readCompletionClock(task) {
    try {
      return clock();
    } catch (error) {
      if (timer === task) reset();
      throw error;
    }
  }
  function expire() {
    var task = timer;
    var now = readCompletionClock(task);
    if (timer !== task) return;
    if (due(now)) return finish(now);
    var remaining = wait - (now - (fixedInterval ? lastInvoke : lastCall));
    if (maxWait !== undefined) remaining = Math.min(remaining, maxWait - (now - lastInvoke));
    // The previous timer has fired; only the replacement is now active.
    timer = undefined;
    arm(remaining);
  }
  function scheduled() {
    if (!leading && !trailing) return result;
    var now = clock();
    var ready = due(now);
    lastArgs = arguments;
    lastThis = this;
    lastCall = now;
    if (ready && timer === undefined) {
      lastInvoke = now;
      // Arm before calling user code so recursion/cancellation sees real state.
      if (!arm(wait)) return result;
      return leading ? invoke(now) : result;
    }
    if (ready && maxWait !== undefined) {
      // A blocked event loop must not indefinitely postpone throttled work.
      if (!clearTimer()) return result;
      if (!arm(wait)) return result;
      return invoke(now);
    }
    if (timer === undefined) arm(fixedInterval ? Math.max(0, wait - (now - lastInvoke)) : wait);
    // A leading-only suppressed call has no future consumer for its inputs.
    // Registration may still be on the stack and use the latest call for its
    // leading invocation; keep that handoff intact until its handle arrives.
    if (!trailing && timer !== undefined && timer.handle !== undefined) lastArgs = lastThis = undefined;
    return result;
  }
  /**
   * Discards pending calls and resets scheduling, retaining the last completed result.
   * @returns {undefined} `undefined` after discarding scheduled work. Work already started continues.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncecancel | Full API documentation}
   */
  scheduled.cancel = function () {
    var task = timer;
    reset();
    if (task !== undefined && task.handle !== undefined) clearTimeout(task.handle);
  };
  /**
   * Determines whether a callback invocation is scheduled.
   * @returns {boolean} `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncepending | Full API documentation}
   */
  function pending() {
    // A leading-only cooldown or an in-flight promise is not pending work.
    return trailing && timer !== undefined && lastArgs !== undefined;
  }
  scheduled.pending = pending;
  /**
   * Invokes eligible pending work immediately, or returns the last completed result.
   * @returns {*} The callback result when pending work runs, or the previous result otherwise; `undefined` before any successful completion.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debounceflush | Full API documentation}
   */
  scheduled.flush = function () {
    if (!pending()) return result;
    if (!clearTimer()) return result;
    var now = readCompletionClock(undefined);
    if (timer !== undefined) return result;
    return finish(now);
  };
  return scheduled;
}
module.exports = createScheduler;
