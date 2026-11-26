'use strict';

// Copied beside an offline-installed consumer: resolve real public specifiers.
var assert = require('assert');
var run = require(process.argv[2]);
var complete = false;

process.once('exit', function () {
  if (!complete) {
    console.error('Capability consumer did not finish');
    process.exitCode = 1;
  }
});
async function main() {
  var results = [];

  for (var name of ['go-fns', 'go-fns/dist/go-fns.js', 'go-fns/dist/go-fns.min.js']) {
    var report = await run(require.resolve(name), function (relative) {
      return require.resolve('go-fns/' + relative.replace(/^\.\//, ''));
    });

    assert.ok(report.cases > 0);
    results.push({ entry: name, cases: report.cases, scenarios: report.scenarios, imports: report.imports });
  }

  complete = true;
  console.log(JSON.stringify({ runtime: process.version, capabilities: results }));
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
