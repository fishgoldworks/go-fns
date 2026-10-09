'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
suite('release development runtime', function () {
  test('release development runtime is explicitly pinned', () => {
    assert.equal(fs.readFileSync(path.join(__dirname, '../.nvmrc'), 'utf8').trim(), '22.16.0');
    assert.match(require('../package.json').scripts.verify, /^node scripts\/check-dev-node\.js && /);
  });
  for (const version of ['18.20.0', '20.11.0', '22.15.9'])
    test(`maintainer guard rejects ${version} with an actionable error`, () => {
      const check = require('../scripts/check-dev-node.js');
      assert.throws(() => check(version), /22\.16.*runtime.*8\.0\.0/);
    });
  for (const version of ['22.16.0', '22.17.0', '24.0.0'])
    test(`maintainer guard accepts ${version}`, () => {
      const check = require('../scripts/check-dev-node.js');
      assert.doesNotThrow(() => check(version));
    });
});
