'use strict';

const assert = require('node:assert/strict');
const completionMarker = 'go-fns:consumer-complete';

// These checks supplement process status; they never turn a failed process green.
function tapSummary(output) {
  const counts = {};

  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...output.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))];

    assert.equal(matches.length, 1, 'Incomplete or duplicate test report: ' + key);
    counts[key] = Number(matches[0][1]);
    assert.ok(Number.isSafeInteger(counts[key]), 'Invalid test report: ' + key);
  }

  assert.ok(counts.tests > 0 && counts.pass === counts.tests, 'Incomplete test report: not all cases passed.');
  for (const key of ['fail', 'cancelled', 'skipped', 'todo'])
    assert.equal(counts[key], 0, 'Incomplete test report: ' + key + ' cases remain.');

  return counts.tests;
}

function consumerSummary(output, version) {
  let records;

  try {
    records = output
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error('Incomplete consumer report: expected completed-format records and a final summary.', {
      cause: error
    });
  }

  assert.equal(records.length, 4, 'Incomplete consumer report: expected all three formats and a summary.');
  const report = records[3];

  assert.ok(
    report && report.status === 'passed' && report.formats === 3 && report.node === version,
    'Incomplete consumer report: success, format count or runtime identity is missing.'
  );
  const formats = ['commonjs', 'readable bundle', 'minified bundle'];

  records.slice(0, 3).forEach((record, index) => {
    assert.ok(
      record && record.format === formats[index] && Number.isSafeInteger(record.checks) && record.checks > 0,
      'Incomplete consumer report: missing checks for ' + formats[index]
    );
  });
  assert.equal(
    report.checks,
    records.slice(0, 3).reduce((sum, record) => sum + record.checks, 0),
    'Inconsistent consumer report: completed-check total.'
  );

  return report;
}

function completion(output) {
  assert.equal(
    output.split(/\r?\n/).filter((line) => line === completionMarker).length,
    1,
    'Import consumer did not complete exactly once.'
  );
}

module.exports = { tapSummary, consumerSummary, completion, completionMarker };
