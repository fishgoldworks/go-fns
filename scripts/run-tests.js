'use strict';

// Load the shared behavioral suite serially: clock fixtures replace host globals.
const fs = require('node:fs');
const path = require('node:path');
const native = require('node:test');
let registered = 0;
let started = 0;
let completed = false;

// A zero exit is not proof that registered asynchronous tests finished. This
// also catches process.exit(0) during loading or inside a test callback.
process.once('exit', () => {
  if (!completed) {
    console.error('Runtime test execution incomplete: the suite did not finish.');
    if (!process.exitCode) process.exitCode = 1;
  }
});
global.suite = native.describe;
global.test = (name, run) => {
  if (typeof run !== 'function') throw new TypeError('A test callback must be a function: ' + name);

  registered++;

  return native.it(name, { timeout: 10000 }, run);
};

native.beforeEach(() => {
  started++;
});
const testRoot = path.join(__dirname, '../test');
const dedicatedSuites = new Set(['build', 'docs', 'package', 'tooling']);

function collect(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      if (entry.name === 'temp' || entry.name === '.tmp') {
        return [];
      }

      if (directory === testRoot && dedicatedSuites.has(entry.name)) {
        return [];
      }

      const full = path.join(directory, entry.name);

      return entry.isDirectory() ? collect(full) : /\.test\.js$/.test(entry.name) ? [full] : [];
    });
}

const files = process.argv.slice(2);

for (const file of files.length ? files.map((file) => path.resolve(file)) : collect(testRoot)) require(file);
// Register completion last so pending, throwing or exiting root cleanup hooks
// cannot make an unfinished suite look successful.
native.after(() => {
  if (!registered || !started) throw new Error('No runtime tests executed; check discovery and name filters.');

  if (process.env.GO_FNS_CHECK_NATIVE_COVERAGE === '1')
    require('./check-coverage-inventory')(path.resolve(__dirname, '..'));
  completed = true;
});
