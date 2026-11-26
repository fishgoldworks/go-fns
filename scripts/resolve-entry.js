'use strict';

const fs = require('node:fs');
const path = require('node:path');

// A directory must bypass Node's file-first lookup (e.g. package.json beside
// package/), while retaining native package.main and index fallback semantics.
function resolveEntry(input) {
  const absolute = path.resolve(input);

  // Node recognises a final forward slash as directory-only, even on Windows.
  return require.resolve(fs.statSync(absolute).isDirectory() ? absolute + '/' : absolute);
}

module.exports = resolveEntry;
