'use strict';

// Resolve lazily so importing never reads a timer or clock capability.
function getGlobal() {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }

  if (typeof self !== 'undefined') {
    return self;
  }

  if (typeof global !== 'undefined') {
    return global;
  }

  if (typeof window !== 'undefined') {
    return window;
  }

  throw new Error('No supported host global is available for timer functions.');
}

module.exports = getGlobal;
