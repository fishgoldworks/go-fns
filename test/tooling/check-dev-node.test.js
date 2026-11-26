'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('release development runtime', function () {
  test('release development runtime is explicitly pinned', () => {
    const pin = fs.readFileSync(path.join(__dirname, '../../.nvmrc'), 'utf8').trim();

    assert.match(pin, /^\d+\.\d+\.\d+$/);
    assert.doesNotThrow(() => require('../../scripts/check-dev-node.js')(pin));
    assert.match(require('../../package.json').scripts.verify, /^node scripts\/check-dev-node\.js && /);
  });

  for (const version of ['18.20.0', '20.11.0', '22.15.9', '23.0.0', '23.11.1'])
    test(`maintainer guard rejects ${version} with an actionable error`, () => {
      const check = require('../../scripts/check-dev-node.js');

      assert.throws(() => check(version), /22\.16.*runtime.*8\.0\.0/);
    });

  for (const version of ['22.16.0', '22.17.0', '24.0.0', '24.20.0'])
    test(`maintainer guard accepts ${version}`, () => {
      const check = require('../../scripts/check-dev-node.js');

      assert.doesNotThrow(() => check(version));
    });
});
