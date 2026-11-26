'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');

// Validate npm's complete staged payload before the retained pair can be moved.
module.exports = function validatePackedArchive(filename, report, expected) {
  let tar;

  try {
    tar = zlib.gunzipSync(fs.readFileSync(filename));
  } catch (error) {
    throw new Error('Packed archive is not valid gzip: ' + filename, { cause: error });
  }

  function invalid(reason) {
    throw new Error('Packed archive is not a valid npm tarball: ' + reason);
  }

  function octal(header, offset, length) {
    const text = header
      .subarray(offset, offset + length)
      .toString('ascii')
      .replace(/\0.*$/, '')
      .trim();

    if (!/^[0-7]+$/.test(text)) invalid('invalid numeric header');
    const value = Number.parseInt(text, 8);

    if (!Number.isSafeInteger(value)) invalid('oversized entry');

    return value;
  }

  if (tar.length < 1024 || tar.length % 512 !== 0) invalid('incomplete blocks');
  const files = new Set();
  let manifest;
  let ended = false;

  for (let offset = 0; offset < tar.length;) {
    const header = tar.subarray(offset, offset + 512);

    if (header.every((byte) => byte === 0)) {
      if (tar.length - offset < 1024 || !tar.subarray(offset).every((byte) => byte === 0))
        invalid('invalid end blocks');
      ended = true;
      break;
    }

    let checksum = 0;

    for (let index = 0; index < 512; index++) {
      checksum += index >= 148 && index < 156 ? 32 : header[index];
    }

    if (checksum !== octal(header, 148, 8)) invalid('header checksum mismatch');
    const size = octal(header, 124, 12);
    const data = offset + 512;
    const next = data + Math.ceil(size / 512) * 512;

    if (!Number.isSafeInteger(next) || next > tar.length) invalid('truncated entry');
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/, '');
    const prefix = text(345, 155);
    const name = (prefix ? prefix + '/' : '') + text(0, 100);
    const directory = header[156] === 53;
    const canonical = directory ? name.replace(/\/$/, '') : name;

    if (
      (!directory && header[156] !== 0 && header[156] !== 48) ||
      (directory && size !== 0) ||
      (!canonical.startsWith('package/') && canonical !== 'package')
    )
      invalid('unsupported entry: ' + name);
    if (canonical.includes('\\') || canonical.split('/').some((part) => !part || part === '.' || part === '..'))
      invalid('invalid path: ' + name);
    if (!directory) {
      const relative = canonical.slice('package/'.length);

      if (!relative || files.has(relative)) invalid('duplicate or empty file path');
      files.add(relative);
      if (relative === 'package.json') {
        manifest = JSON.parse(tar.subarray(data, data + size).toString('utf8'));
      }
    }

    offset = next;
  }

  if (!ended) invalid('missing end blocks');
  if (!manifest || manifest.name !== expected.manifest.name || manifest.version !== expected.manifest.version)
    invalid('package identity mismatch');
  const reported = report.files.map((entry) => entry?.path);

  if (reported.some((name) => typeof name !== 'string') || new Set(reported).size !== reported.length)
    invalid('invalid reported inventory');
  const actual = [...files].sort();

  assert.deepEqual(actual, [...reported].sort(), 'Packed archive inventory differs from npm report.');
  assert.deepEqual(actual, [...expected.files].sort(), 'Packed archive inventory differs from built package.');
};
