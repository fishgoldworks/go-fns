'use strict';

/** Normalize configuration once, before allocating a wrapper or starting timers. */
function scheduleOptions(milliseconds, options, defaultLeading, supportsMaxWait) {
  milliseconds = milliseconds === undefined ? 0 : milliseconds;
  checkDuration(milliseconds);
  if (options === undefined) options = {};
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected options to be an object.');
  }

  var leading = options.leading;
  var trailing = options.trailing;

  leading = leading === undefined ? defaultLeading : leading;
  trailing = trailing === undefined ? true : trailing;
  if (typeof leading !== 'boolean' || typeof trailing !== 'boolean') {
    throw new TypeError('Expected leading and trailing to be booleans.');
  }

  var maxWait = supportsMaxWait ? options.maxWait : milliseconds;

  if (maxWait !== undefined) {
    checkDuration(maxWait);
    if (maxWait < milliseconds) {
      throw new RangeError('Expected maxWait to be at least milliseconds.');
    }
  }

  return {
    milliseconds: milliseconds,
    leading: leading,
    trailing: trailing,
    maxWait: maxWait,
    fixedInterval: !supportsMaxWait
  };
}

function checkDuration(value) {
  if (typeof value !== 'number') throw new TypeError('Expected milliseconds to be a number.');
  if (!Number.isFinite(value) || value < 0 || value > 2147483647) {
    throw new RangeError('Expected milliseconds between 0 and 2147483647.');
  }
}

module.exports = scheduleOptions;
