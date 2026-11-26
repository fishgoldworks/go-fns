'use strict';

/**
 * Attempts every synchronous cleanup, retaining the original thrown values.
 * A failure object distinguishes a thrown `undefined` from a successful check.
 */
function cleanup(actions, failure, message) {
  const errors = [];

  for (const action of actions) {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length) {
    if (failure !== undefined) errors.unshift(failure.error);
    throw new AggregateError(errors, message);
  }

  if (failure !== undefined) throw failure.error;
}

module.exports = cleanup;
