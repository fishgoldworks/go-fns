'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inventory, packageRoot } = require('./package-layout');

function within(parent, filename) {
  const relative = path.relative(parent, filename);

  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

module.exports = function readCandidate(filename, { outsidePackage = false } = {}) {
  const tarball = path.resolve(filename);

  if (!fs.statSync(tarball, { throwIfNoEntry: false })?.isFile()) throw Error('Missing release tarball: ' + tarball);

  if (outsidePackage) {
    const realPackage = fs.existsSync(packageRoot) ? fs.realpathSync(packageRoot) : packageRoot;

    if (within(packageRoot, tarball) || within(realPackage, fs.realpathSync(tarball))) {
      throw Error('Retained tarballs must stay outside package/.');
    }
  }

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');

  if (fs.existsSync(tarball + '.sha256')) {
    assert.equal(
      fs
        .readFileSync(tarball + '.sha256', 'utf8')
        .trim()
        .split(/\s+/)[0],
      sha256,
      'Release tarball SHA256 mismatch.'
    );
  }

  const listing = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8', timeout: 30000 });

  if (listing.error) throw listing.error;
  if (listing.status !== 0) throw Error('Invalid release tarball: ' + tarball + '\n' + listing.stderr);
  const files = listing.stdout
    .trim()
    .split(/\r?\n/)
    .filter((file) => !file.endsWith('/'))
    .map((file) => {
      assert.ok(file.startsWith('package/'), 'Unexpected tarball path: ' + file);

      return file.slice('package/'.length);
    })
    .sort();

  assert.deepEqual(files, inventory(), 'Unexpected release tarball inventory.');

  return { tarball, sha256, files };
};
