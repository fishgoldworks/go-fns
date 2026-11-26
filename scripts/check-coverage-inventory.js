'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runtimeFiles } = require('./package-layout');

// Native V8 coverage includes executed scripts only. Do not load missing modules
// here: their absence must fail the gate rather than manufacture coverage.
function productionFiles(root) {
  return ['index.js', ...runtimeFiles(root).filter((file) => file.endsWith('.js'))];
}

module.exports = function checkCoverageInventory(root, cache = require.cache) {
  const files = productionFiles(root);
  const missing = files.filter((file) => !cache[fs.realpathSync(path.join(root, file))]);

  if (missing.length)
    throw new Error('Unloaded production module(s) excluded from native coverage: ' + missing.join(', '));
};

// Loading alone is insufficient: V8's include/exclude globs can discard loaded
// files. Check the actual built-in report rather than its rounded percentages.
module.exports.measured = function checkMeasuredInventory(root, summary) {
  if (!summary || !Array.isArray(summary.files)) throw new Error('Native coverage report is missing or incomplete.');
  const measured = new Set(summary.files.map((file) => fs.realpathSync(file.path)));
  const missing = productionFiles(root).filter((file) => !measured.has(fs.realpathSync(path.join(root, file))));

  if (missing.length)
    throw new Error('Unmeasured production module(s) excluded from native coverage: ' + missing.join(', '));
};
