'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function capture(entries, harness) {
  const artifacts = Object.fromEntries(
    Object.entries(entries).map(([kind, entry]) => {
      const directory = path.dirname(entry);

      function walk(dir) {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
          const filename = path.join(dir, item.name);

          return item.isDirectory() ? walk(filename) : [filename];
        });
      }

      const files = [
        entry,
        ...(fs.existsSync(path.join(directory, 'src')) ? walk(path.join(directory, 'src')) : [])
      ].sort();

      return [kind, Object.fromEntries(files.map((file) => [path.relative(directory, file), sha256(file)]))];
    })
  );

  return {
    artifacts,
    harness: Object.fromEntries(
      Object.entries(harness).map(([kind, filename]) => [kind, { path: filename, sha256: sha256(filename) }])
    )
  };
}

function assertUnchanged(before, entries, harness) {
  assert.deepEqual(capture(entries, harness), before, 'Benchmark inputs changed during measurement.');
}

module.exports = { capture, assertUnchanged };
