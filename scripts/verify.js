'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { root } = require('./package-layout');
const readCandidate = require('./release-candidate');

async function main() {
  require('./check-dev-node')(process.versions.node);
  const { values } = parseArgs({
    options: {
      browser: { type: 'boolean' },
      native: { type: 'boolean' },
      destination: { type: 'string' },
      tarball: { type: 'string' },
      node8: { type: 'string' }
    }
  });

  if (values.tarball !== undefined && values.destination !== undefined) {
    throw Error('--tarball cannot be combined with --destination.');
  }

  // Validate a supplied archive before running any build or verification command.
  const retained = values.tarball === undefined ? null : readCandidate(values.tarball, { outsidePackage: true });
  const node8 = values.node8 || process.env.GO_FNS_NODE8;

  if (!node8 || !fs.existsSync(node8))
    throw Error('Set GO_FNS_NODE8 or --node8 to the Node.js 8.0.0 executable for the minimum-runtime consumer check.');
  const version = spawnSync(node8, ['--version'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });

  if (version.error) throw version.error;
  if (version.status !== 0 || version.stdout.trim() !== 'v8.0.0')
    throw Error('The minimum-runtime check requires exactly Node.js 8.0.0.');
  function npm(script, args = [], env = process.env) {
    const result = spawnSync(
      process.execPath,
      [process.env.npm_execpath, 'run', script, ...(args.length ? ['--', ...args] : [])],
      { cwd: root, stdio: 'inherit', env }
    );

    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(script + ' failed with exit ' + result.status);
  }

  npm('lint');
  npm('format:check');
  if (retained) npm('build');
  const candidate =
    retained || readCandidate(await require('./pack-package').packPackage({ destination: values.destination }));
  const { tarball, sha256 } = candidate;
  // Nested failure regressions must inspect this candidate, including custom destinations.
  const candidateEnv = { ...process.env, GO_FNS_TEST_TARBALL: tarball };

  for (const script of [
    'test:docs',
    values.native ? 'coverage:native' : 'coverage',
    'test:types',
    'test:build',
    'test:tooling',
    'test:release',
    'test:artifacts'
  ])
    npm(script, [], candidateEnv);
  npm(
    'test:package',
    ['--tarball', tarball, '--node', node8, '--compare-package', ...(values.browser ? ['--browser'] : [])],
    candidateEnv
  );
  if (readCandidate(tarball).sha256 !== sha256) throw Error('Candidate changed during verification: ' + tarball);
  console.log('Verified release candidate: ' + tarball + '\nSHA-256: ' + sha256);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
