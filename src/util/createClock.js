'use strict';

var apply = Reflect.apply;
var bind = Function.prototype.bind;
var getGlobal = require('./getGlobal');

/**
 * Capture one clock per scheduler so elapsed-time origins never change mid-flight.
 * Use monotonic performance.now when the host supplies it. Older Node runtimes
 * and minimal hosts fall back to Date.now and remain affected by clock changes.
 * Selection is lazy: merely importing the library requires no timer or clock host.
 */
function createClock() {
  var clock = getGlobal().performance;

  if (clock !== null && clock !== undefined) {
    var now = clock.now;

    if (typeof now === 'function') {
      return apply(bind, now, [clock]);
    }
  }

  return Date.now;
}

module.exports = createClock;
