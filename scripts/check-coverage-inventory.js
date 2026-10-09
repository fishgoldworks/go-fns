'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runtimeFiles } = require('./package-layout');

// Native V8 coverage includes executed scripts only. Do not load missing modules
// here: their absence must fail the gate rather than manufacture coverage.
module.exports = function checkCoverageInventory(root, cache = require.cache) {
  const files = ['index.js', ...runtimeFiles(root).filter((file) => file.endsWith('.js'))];
  const missing = files.filter((file) => !cache[fs.realpathSync(path.join(root, file))]);
  if (missing.length)
    throw new Error('Unloaded production module(s) excluded from native coverage: ' + missing.join(', '));
};
