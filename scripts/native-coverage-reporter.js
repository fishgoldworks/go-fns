'use strict';
const path = require('node:path');
const { measured } = require('./check-coverage-inventory');

// Run beside the caller's reporters. Consume Node's objective coverage summary
// without parsing their text or writing disposable reports into the checkout.
module.exports = async function* nativeCoverageReporter(events) {
  let summary;
  for await (const event of events) {
    if (event.type === 'test:coverage') summary = event.data.summary;
  }
  measured(path.resolve(__dirname, '..'), summary);
  yield '';
};
