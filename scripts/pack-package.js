'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { root, packageRoot, artifactPath } = require('./package-layout');
const { build } = require('./build');
function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return !relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
function physicalPath(value) {
  try {
    return fs.realpathSync(value);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    // New output directories are valid. Resolve their nearest existing ancestor,
    // but never treat an existing, broken link as an ordinary missing directory.
    try {
      fs.lstatSync(value);
    } catch (missing) {
      if (missing?.code !== 'ENOENT') throw missing;
      const parent = path.dirname(value);
      if (parent !== value) return path.join(physicalPath(parent), path.basename(value));
    }
    throw error;
  }
}
async function packPackage({ destination = path.join(root, 'artifacts') } = {}) {
  require('./check-dev-node')(process.versions.node);
  if (!process.env.npm_execpath) throw Error('Run this command through npm run pack:package or npm run verify.');
  destination = path.resolve(destination);
  if (isWithin(packageRoot, destination) || isWithin(physicalPath(packageRoot), physicalPath(destination)))
    throw Error('Tarballs must stay outside package/.');
  await build();
  fs.mkdirSync(destination, { recursive: true });

  // Never ask npm to overwrite the last candidate directly. A dry run, truncated
  // pack or interrupted write must not be mistaken for a fresh, successful archive.
  const stage = fs.mkdtempSync(path.join(destination, '.pack-'));
  const output = path.join(stage, 'output');
  const backup = path.join(stage, 'previous');
  const tarball = artifactPath(destination);
  const filename = path.basename(tarball);
  const saved = [];
  const installed = [];
  let keepRecoveryFiles = false;
  let failed = false;
  let failure;
  let summary;
  try {
    fs.mkdirSync(output);
    fs.mkdirSync(backup);
    const result = spawnSync(
      process.execPath,
      [
        process.env.npm_execpath,
        'pack',
        packageRoot,
        '--ignore-scripts',
        '--dry-run=false',
        '--json',
        '--pack-destination',
        output
      ],
      { cwd: root, encoding: 'utf8', timeout: 120000 }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('npm pack failed:\n' + result.stdout + result.stderr);
    const reports = JSON.parse(result.stdout);
    if (
      !Array.isArray(reports) ||
      reports.length !== 1 ||
      reports[0]?.filename !== filename ||
      !Array.isArray(reports[0].files) ||
      reports[0].files.length === 0 ||
      !fs.lstatSync(path.join(output, filename)).isFile()
    )
      throw Error('Unexpected npm tarball output.');
    const sha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(output, filename)))
      .digest('hex');
    fs.writeFileSync(path.join(output, filename + '.sha256'), sha256 + '  ' + filename + '\n');

    // Back up the pair before replacement. These are two filesystem operations,
    // not an atomic pair: on an ordinary failure restore both prior files.
    const names = [filename, filename + '.sha256'];
    for (const name of names) {
      const target = path.join(destination, name);
      let stat;
      try {
        stat = fs.lstatSync(target);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      if (stat) {
        if (!stat.isFile()) throw Error('Candidate target is not a regular file: ' + target);
        fs.renameSync(target, path.join(backup, name));
        saved.push(name);
      }
    }
    for (const name of names) {
      fs.renameSync(path.join(output, name), path.join(destination, name));
      installed.push(name);
    }
    summary = { tarball, sha256, files: reports[0].files.length };
  } catch (error) {
    failed = true;
    failure = error;
    const recoveryErrors = [];
    for (const name of installed.reverse()) {
      try {
        fs.unlinkSync(path.join(destination, name));
      } catch (rollbackError) {
        recoveryErrors.push(rollbackError);
      }
    }
    for (const name of saved.reverse()) {
      try {
        fs.renameSync(path.join(backup, name), path.join(destination, name));
      } catch (rollbackError) {
        recoveryErrors.push(rollbackError);
      }
    }
    if (recoveryErrors.length) {
      keepRecoveryFiles = true;
      failure = new AggregateError(
        [error, ...recoveryErrors],
        'Candidate replacement failed; recovery files retained at ' + stage
      );
    }
  }
  if (!keepRecoveryFiles) {
    try {
      fs.rmSync(stage, { recursive: true, force: true });
    } catch (error) {
      failure = failed
        ? new AggregateError([failure, error], 'Packing and staging cleanup failed at ' + stage)
        : new Error('Packing staging cleanup failed at ' + stage, { cause: error });
      failed = true;
    }
  }
  if (failed) throw failure;
  console.log(JSON.stringify(summary, null, 2));
  return tarball;
}
module.exports = { packPackage };
if (require.main === module) {
  const { values } = parseArgs({ options: { destination: { type: 'string' } } });
  packPackage(values).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
