'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const measure = require('../benchmarks/adapters/measure.js');
const resolveEntry = require('./resolve-entry');
const root = path.resolve(__dirname, '..');
const result = {
  runtime: process.version,
  baseline: '2.2.0',
  candidate: require('../package.json').version,
  ...measure(
    require(resolveEntry(path.join(root, 'benchmarks/baseline-2.2.0'))),
    require(resolveEntry(path.join(root, 'package')))
  )
};
const json = JSON.stringify(result, null, 2) + '\n';
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), json);
console.log(json);
