'use strict';
// Separate processes prevent feedback from one implementation contaminating the
// other. Alternate process order across rounds; retain all timing samples.
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { measure, median } = require('../benchmarks/scenarios');
const resolveEntry = require('./resolve-entry');
const root = path.resolve(__dirname, '..');
function parse(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw Error('Expected --option value pairs.');
    args[argv[i].slice(2)] = argv[++i];
  }
  for (const key of Object.keys(args))
    if (
      ![
        'worker',
        'entry',
        'baseline',
        'candidate',
        'rounds',
        'samples',
        'target-ms',
        'warmup-ms',
        'filter',
        'output'
      ].includes(key)
    )
      throw Error('Unknown option: ' + key);
  return args;
}
function positive(args, key, fallback) {
  const value = Number(args[key] || fallback);
  if (!Number.isInteger(value) || value <= 0) throw Error('--' + key + ' must be a positive integer.');
  return value;
}
const args = parse(process.argv.slice(2));
const options = {
  samples: positive(args, 'samples', 9),
  targetMs: positive(args, 'target-ms', 12),
  warmupMs: positive(args, 'warmup-ms', 30),
  filter: args.filter
};
if (args.worker) {
  const api = require(resolveEntry(args.entry));
  process.stdout.write(JSON.stringify(measure(api, options)));
} else {
  const entries = {
    baseline: resolveEntry(args.baseline || path.join(root, 'benchmarks/baseline-2.0.0')),
    candidate: resolveEntry(args.candidate || path.join(root, 'package'))
  };
  const rounds = positive(args, 'rounds', 2),
    runs = { baseline: [], candidate: [] };
  for (let round = 0; round < rounds; round++) {
    for (const kind of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
      process.stderr.write(`Round ${round + 1}/${rounds}: ${kind}\n`);
      const flags = [
        '--worker',
        '1',
        '--entry',
        entries[kind],
        '--samples',
        String(options.samples),
        '--target-ms',
        String(options.targetMs),
        '--warmup-ms',
        String(options.warmupMs)
      ];
      if (options.filter) flags.push('--filter', options.filter);
      const result = spawnSync(process.execPath, [__filename, ...flags], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000
      });
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw Error(
          `Benchmark ${kind} worker exited with ${result.signal ? 'signal ' + result.signal : 'status ' + result.status}:\n${[result.stderr, result.stdout].filter(Boolean).join('\n')}`
        );
      runs[kind].push(JSON.parse(result.stdout));
    }
  }
  const cases = runs.baseline[0].cases.map((sample, index) => {
    const data = {};
    for (const kind of ['baseline', 'candidate']) {
      const all = runs[kind].map((run) => run.cases[index]);
      if (all.some((value) => value.name !== sample.name || value.probe !== sample.probe))
        throw Error('Workload mismatch: ' + sample.name);
      const samples = all.flatMap((value) => value.nsPerOperation);
      const ordered = samples.slice().sort((a, b) => a - b);
      data[kind] = {
        medianNs: median(samples),
        p10Ns: ordered[Math.floor(ordered.length * 0.1)],
        p90Ns: ordered[Math.floor(ordered.length * 0.9)],
        nsPerOperation: samples,
        iterations: all.map((value) => value.iterations)
      };
    }
    return {
      name: sample.name,
      probe: sample.probe,
      ...data,
      speedup: data.baseline.medianNs / data.candidate.medianNs
    };
  });
  if (cases.length === 0) throw Error('No scenarios match the filter.');
  const artifacts = Object.fromEntries(
    Object.entries(entries).map(([kind, entry]) => {
      const main = entry,
        directory = path.dirname(main);
      function walk(dir) {
        return fs
          .readdirSync(dir, { withFileTypes: true })
          .flatMap((item) => (item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]));
      }
      const files = [
        main,
        ...(fs.existsSync(path.join(directory, 'src')) ? walk(path.join(directory, 'src')) : [])
      ].sort();
      const fingerprints = Object.fromEntries(
        files.map((file) => [
          path.relative(directory, file),
          crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
        ])
      );
      return [kind, fingerprints];
    })
  );
  const report = {
    artifacts,
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    rounds,
    options,
    entries,
    cases
  };
  const table = cases.map((value) => ({
    scenario: value.name,
    'before ns/op': value.baseline.medianNs.toFixed(2),
    'after ns/op': value.candidate.medianNs.toFixed(2),
    'before / after': value.speedup.toFixed(2) + 'x'
  }));
  console.table(table);
  if (args.output) {
    const filename = path.resolve(args.output);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
    console.log('Saved ' + filename);
  }
}
