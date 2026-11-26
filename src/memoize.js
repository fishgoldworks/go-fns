'use strict';

var expectFunction = require('./util/expectFunction');
var apply = Reflect.apply;
var slice = Function.prototype.call.bind(Array.prototype.slice);
var defaultSize = 128;

function cacheSize(options) {
  if (options === undefined) {
    return defaultSize;
  }

  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Memoize options must be an object.');
  }

  var size = options.maxSize;

  if (size === undefined) {
    return defaultSize;
  }

  if (typeof size !== 'number') throw new TypeError('Cache size must be a number.');
  if (!Number.isInteger(size) || size < 1 || size > 4294967295) {
    throw new RangeError('Cache size must be an integer from 1 through 4294967295.');
  }

  return size;
}

function sameValue(left, right) {
  if (left === right) {
    return left !== 0 || 1 / left === 1 / right;
  }

  return left !== left && right !== right;
}

function findEntry(entries, receiver, input) {
  for (var index = entries.length - 1; index >= 0; index--) {
    var entry = entries[index];

    if (!sameValue(entry.receiver, receiver) || entry.input.length !== input.length) continue;
    var argument = 0;

    while (argument < input.length && sameValue(entry.input[argument], input[argument])) argument++;
    if (argument === input.length) {
      return index;
    }
  }

  return -1;
}

/**
 * Reuses callback results for matching receivers and complete argument lists.
 * The per-wrapper cache matches objects by identity and evicts the least recently used entry
 * when full. Synchronous throws are retried. Returned values and promises are cached unchanged.
 * @param {Function} fn Required callback.
 * @param {object} [options] Cache options.
 * @param {number} [options.maxSize=128] Maximum number of cached calls.
 * @returns {Function} A wrapper with a `clear()` method that discards its cache.
 * @throws {TypeError} If the callback or option types are invalid.
 * @throws {RangeError} If the size is not an integer in the supported range.
 * @see {@link https://github.com/fishgoldworks/go-fns/blob/master/docs/API.md#memoizefn-options | Full API documentation}
 * @example
 * const makeRange = memoize((start, end) => ({ start, end }));
 * const first = makeRange(1, 3);
 * makeRange(1, 3) === first;     // => true
 * makeRange(1, 4) === first;     // => false
 * @since 2.0.0
 * @static
 * @memberof Utility
 */
function memoize(fn, options) {
  expectFunction(fn);
  var maxSize = cacheSize(options);
  var entries = [];

  function memoized() {
    var cache = entries;
    var index = findEntry(cache, this, arguments);

    if (index !== -1) {
      var entry = cache.splice(index, 1)[0];

      cache.push(entry);

      return entry.value;
    }

    var value = apply(fn, this, arguments);

    // A clear during the call invalidates its pending cache write.
    if (cache === entries) {
      index = findEntry(cache, this, arguments);
      if (index !== -1) cache.splice(index, 1);
      else if (cache.length === maxSize) cache.shift();
      cache.push({ receiver: this, input: slice(arguments), value: value });
    }

    return value;
  }

  memoized.clear = function () {
    entries = [];
  };

  return memoized;
}

module.exports = memoize;
