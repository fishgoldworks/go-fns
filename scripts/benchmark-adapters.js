'use strict';

const fs = require('node:fs'),
  path = require('node:path');
const inputs = require('./benchmark-inputs');
const os = require('node:os');
const resolveEntry = require('./resolve-entry');
const root = path.resolve(__dirname, '..');
const entries = {
  baseline: resolveEntry(path.join(root, 'benchmarks/baseline-2.2.0')),
  candidate: resolveEntry(path.join(root, 'package'))
};
const harness = { driver: __filename, workload: path.join(root, 'benchmarks/adapters/measure.js') };
const identity = inputs.capture(entries, harness);
const measure = require(harness.workload);
const measurement = measure(require(entries.baseline), require(entries.candidate));

inputs.assertUnchanged(identity, entries, harness);
const result = {
  runtime: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()[0]?.model,
  baseline: '2.2.0',
  candidate: require('../package.json').version,
  ...measurement,
  entries,
  ...identity
};
const json = JSON.stringify(result, null, 2) + '\n';

if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), json);
console.log(json);
