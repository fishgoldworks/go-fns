'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '../..');
const implementation = 'module.exports = {pipe: (...fns) => value => fns.reduce((result, fn) => fn(result), value)};\n';

function fixture(action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-tooling-'));

  try {
    action(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, filename, content) {
  const target = path.join(root, filename);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);

  return target;
}

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 20000 });

  assert.ifError(result.error);

  return result;
}

function compare(root, candidate, extra = [], script = path.join(project, 'scripts/benchmark.js')) {
  const baseline = write(root, 'baseline.cjs', implementation);

  return run(
    script,
    [
      '--baseline',
      baseline,
      '--candidate',
      candidate,
      '--rounds',
      '1',
      '--samples',
      '1',
      '--warmup-ms',
      '1',
      '--target-ms',
      '1',
      '--filter',
      'pipe/integer/1',
      '--output',
      path.join(root, 'result.json'),
      ...extra
    ],
    root
  );
}

for (const layout of ['declared-main', 'index-fallback', 'explicit-file']) {
  test('benchmark loads and fingerprints the selected ' + layout + ' entry', () =>
    fixture((root) => {
      let input, entry;

      if (layout === 'explicit-file') input = entry = write(root, 'api.cjs', implementation);
      else {
        // These sibling files must not shadow an explicitly selected directory.
        write(root, 'package.json', '{}');
        if (layout === 'index-fallback') write(root, 'package.js', 'throw Error("wrong sibling loaded");');
        input = path.join(root, 'package');
        if (layout === 'declared-main') {
          write(root, 'package/package.json', '{"main":"lib/main.cjs"}');
          entry = write(root, 'package/lib/main.cjs', implementation);
        } else entry = write(root, 'package/index.js', implementation);
      }

      const result = compare(root, input);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8'));

      assert.equal(report.entries.candidate, entry);
      assert.equal(
        report.artifacts.candidate[path.basename(entry)],
        crypto.createHash('sha256').update(implementation).digest('hex')
      );
      assert.ok(report.cases.length > 0);
      assert.ok(report.harness, 'Missing benchmark harness fingerprints');
      assert.equal(
        report.harness.workload.sha256,
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(path.join(project, 'benchmarks/scenarios.js')))
          .digest('hex')
      );
    })
  );
}

test('benchmark propagates a throwing worker and preserves its diagnostic', () =>
  fixture((root) => {
    const entry = write(root, 'bad.cjs', 'throw Error("benchmark worker sentinel");');
    const result = compare(root, entry);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /benchmark worker sentinel/);
    assert.equal(fs.existsSync(path.join(root, 'result.json')), false);
  }));

test('benchmark reports the exit status of a worker that exits without diagnostics', () =>
  fixture((root) => {
    const entry = write(root, 'exit.cjs', 'process.exit(7);');
    const result = compare(root, entry);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate.*(?:status|exit).*7/);
    assert.equal(fs.existsSync(path.join(root, 'result.json')), false);
  }));
function copyCommand(root, name) {
  write(root, 'scripts/' + name, fs.readFileSync(path.join(project, 'scripts', name)));
  const resolver = path.join(project, 'scripts/resolve-entry.js');

  if (fs.existsSync(resolver)) write(root, 'scripts/resolve-entry.js', fs.readFileSync(resolver));
  const inputs = path.join(project, 'scripts/benchmark-inputs.js');

  if (fs.existsSync(inputs)) write(root, 'scripts/benchmark-inputs.js', fs.readFileSync(inputs));
}

test('benchmark defaults to the generated package instead of the source root', () =>
  fixture((root) => {
    copyCommand(root, 'benchmark.js');
    write(root, 'benchmarks/scenarios.js', fs.readFileSync(path.join(project, 'benchmarks/scenarios.js')));
    write(root, 'benchmarks/baseline-2.0.0/index.js', implementation);
    write(root, 'package.json', '{"version":"9.0.0"}');
    write(root, 'index.js', 'throw Error("source root loaded");');
    const entry = write(root, 'package/index.js', implementation);
    const result = run(
      path.join(root, 'scripts/benchmark.js'),
      [
        '--rounds',
        '1',
        '--samples',
        '1',
        '--warmup-ms',
        '1',
        '--target-ms',
        '1',
        '--filter',
        'pipe/integer/1',
        '--output',
        path.join(root, 'result.json')
      ],
      root
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8')).entries.candidate, entry);
  }));

test('adapter command selects the generated entry and retains its positional output argument', () =>
  fixture((root) => {
    copyCommand(root, 'benchmark-adapters.js');
    // Replace only costly measurements; command path resolution and output stay real.
    write(
      root,
      'benchmarks/adapters/measure.js',
      'module.exports = (before, after) => ({selected: [before.marker, after.marker]});'
    );
    write(root, 'benchmarks/baseline-2.2.0/index.js', 'module.exports = {marker:"baseline"};');
    write(root, 'package.json', '{"version":"9.0.0"}');
    write(root, 'index.js', 'throw Error("source root loaded");');
    write(root, 'package/package.json', '{"main":"entry.cjs"}');
    write(root, 'package/entry.cjs', 'module.exports = {marker:"generated"};');
    const output = path.join(root, 'adapters.json');
    const result = run(path.join(root, 'scripts/benchmark-adapters.js'), [output], root);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.deepEqual(report.selected, ['baseline', 'generated']);
    assert.equal(report.candidate, '9.0.0');
    assert.ok(report.artifacts, 'Missing adapter artifact fingerprints');
    assert.ok(report.harness, 'Missing adapter harness fingerprints');
    assert.equal(
      report.artifacts.candidate['entry.cjs'],
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(root, 'package/entry.cjs')))
        .digest('hex')
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), report);
  }));

for (const adapter of [false, true]) {
  test((adapter ? 'adapter' : 'comparison') + ' benchmark rejects changed inputs and preserves prior output', () =>
    fixture((root) => {
      const replacement = implementation + '// replacement after loading\n';
      const mutating =
        "require('node:fs').writeFileSync(__filename," + JSON.stringify(replacement) + ');\n' + implementation;
      const output = write(root, 'result.json', '{"previous":true}\n');
      let result;

      if (adapter) {
        copyCommand(root, 'benchmark-adapters.js');
        write(root, 'package.json', '{"version":"2.0.0"}');
        write(root, 'benchmarks/baseline-2.2.0/index.js', implementation);
        write(root, 'benchmarks/adapters/measure.js', 'module.exports = () => ({results: []});');
        write(root, 'package/index.js', mutating);
        result = run(path.join(root, 'scripts/benchmark-adapters.js'), [output], root);
      } else {
        const candidate = write(root, 'candidate.cjs', mutating);

        result = compare(root, candidate);
      }

      assert.notEqual(result.status, 0, 'Changed benchmark input was accepted');
      assert.match(result.stderr, /Benchmark inputs changed during measurement/);
      assert.equal(fs.readFileSync(output, 'utf8'), '{"previous":true}\n');
    })
  );
}

test('comparison benchmark rejects a changed workload and preserves prior output', () =>
  fixture((root) => {
    copyCommand(root, 'benchmark.js');
    const workload = write(
      root,
      'benchmarks/scenarios.js',
      fs.readFileSync(path.join(project, 'benchmarks/scenarios.js'))
    );
    const mutating =
      "require('node:fs').appendFileSync(" +
      JSON.stringify(workload) +
      ",'\\n// workload changed\\n');\n" +
      implementation;
    const candidate = write(root, 'candidate.cjs', mutating);
    const output = write(root, 'result.json', '{"previous":true}\n');
    const result = compare(root, candidate, [], path.join(root, 'scripts/benchmark.js'));

    assert.notEqual(result.status, 0, 'Changed workload was accepted');
    assert.match(result.stderr, /Benchmark inputs changed during measurement/);
    assert.equal(fs.readFileSync(output, 'utf8'), '{"previous":true}\n');
  }));
