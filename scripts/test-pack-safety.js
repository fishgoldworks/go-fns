'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'pack-package.js'), 'utf8');

async function fixture(action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-pack-safety-'));
  try {
    const packageRoot = path.join(root, 'package');
    const destination = path.join(root, 'artifacts');
    fs.mkdirSync(packageRoot);
    fs.mkdirSync(destination);
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: 'go-fns',
        version: '2.0.0',
        main: 'index.js',
        files: ['index.js']
      })
    );
    fs.writeFileSync(path.join(packageRoot, 'index.js'), 'module.exports = "new";\n');
    const tarball = path.join(destination, 'go-fns-2.0.0.tgz');
    const previous = Buffer.from('previous candidate must survive a failed pack');
    const checksum = 'previous checksum\n';
    fs.writeFileSync(tarball, previous);
    fs.writeFileSync(tarball + '.sha256', checksum);
    await action({ root, packageRoot, destination, tarball, previous, checksum });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
// Only replace the expensive, independently tested build and external host boundaries.
// Packer control flow and filesystem operations are the actual implementation.
function loadPacker(state, options = {}) {
  const loaded = { exports: {} };
  const logs = [];
  const env = { ...process.env, ...options.env };
  assert.ok(env.npm_execpath, 'Run through npm run test:release.');
  const commands = [];
  let builds = 0;
  const context = {
    module: loaded,
    exports: loaded.exports,
    process: { ...process, env },
    console: { log: (message) => logs.push(message) },
    require(name) {
      if (name === './build')
        return {
          async build() {
            builds++;
            if (options.build) await options.build();
          }
        };
      if (name === './package-layout')
        return {
          root: state.root,
          packageRoot: state.packageRoot,
          artifactPath: (directory) => path.join(directory, 'go-fns-2.0.0.tgz')
        };
      if (name === './check-dev-node') return () => {};
      if (name === 'node:fs') return options.fs || fs;
      if (name === 'node:child_process')
        return {
          spawnSync(command, args, settings) {
            commands.push({ command, args: Array.from(args), settings });
            if (options.spawn) return options.spawn(command, args, settings);
            return spawnSync(command, args, { ...settings, env });
          }
        };
      return require(name);
    }
  };
  vm.runInNewContext(source, context, { filename: path.join(project, 'scripts/pack-package.js') });
  return { pack: loaded.exports.packPackage, logs, commands, builds: () => builds };
}
function assertPrevious(state) {
  assert.deepEqual(fs.readFileSync(state.tarball), state.previous);
  assert.equal(fs.readFileSync(state.tarball + '.sha256', 'utf8'), state.checksum);
}
function assertNoStaging(state) {
  assert.deepEqual(fs.readdirSync(state.destination).sort(), ['go-fns-2.0.0.tgz', 'go-fns-2.0.0.tgz.sha256']);
}

test('packer creates new bytes despite inherited npm dry-run configuration', () =>
  fixture(async (state) => {
    const packer = loadPacker(state, { env: { npm_config_dry_run: 'true' } });
    const result = await packer.pack({ destination: state.destination });
    assert.equal(result, state.tarball);
    assert.notDeepEqual(fs.readFileSync(result), state.previous, 'An old candidate was reported as newly packed');
    const extracted = spawnSync('tar', ['-xzOf', result, 'package/index.js'], { encoding: 'utf8' });
    assert.ifError(extracted.error);
    assert.equal(extracted.status, 0, extracted.stderr);
    assert.equal(extracted.stdout, 'module.exports = "new";\n');
    assert.equal(packer.builds(), 1);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(result)).digest('hex');
    assert.equal(fs.readFileSync(result + '.sha256', 'utf8'), digest + '  go-fns-2.0.0.tgz\n');
    assert.equal(JSON.parse(packer.logs[0]).sha256, digest);
    assertNoStaging(state);
  }));

test('packer rejects a successful npm report that did not write a new archive', () =>
  fixture(async (state) => {
    const packer = loadPacker(state, {
      spawn: () => ({
        status: 0,
        stdout: JSON.stringify([{ filename: 'go-fns-2.0.0.tgz', files: [{ path: 'index.js' }] }]),
        stderr: ''
      })
    });
    await assert.rejects(packer.pack({ destination: state.destination }));
    assertPrevious(state);
    assert.equal(packer.logs.length, 0);
    assertNoStaging(state);
  }));

for (const failure of ['exit', 'signal', 'spawn', 'malformed', 'empty', 'multiple', 'filename']) {
  test('failed pack preserves the previous candidate and digest: ' + failure, () =>
    fixture(async (state) => {
      const packer = loadPacker(state, {
        spawn(command, args) {
          const destination = args[args.indexOf('--pack-destination') + 1];
          fs.writeFileSync(path.join(destination, 'go-fns-2.0.0.tgz'), 'partial replacement');
          if (failure === 'spawn') return { error: new Error('spawn sentinel') };
          if (failure === 'exit') return { status: 17, stdout: '', stderr: 'pack sentinel' };
          if (failure === 'signal') return { status: null, signal: 'SIGTERM', stdout: '', stderr: '' };
          const report = { filename: 'go-fns-2.0.0.tgz', files: [{ path: 'index.js' }] };
          return {
            status: 0,
            stderr: '',
            stdout:
              failure === 'malformed'
                ? '{'
                : JSON.stringify(
                    failure === 'empty'
                      ? []
                      : failure === 'multiple'
                        ? [report, report]
                        : [{ ...report, filename: 'wrong.tgz' }]
                  )
          };
        }
      });
      await assert.rejects(packer.pack({ destination: state.destination }));
      assertPrevious(state);
      assert.equal(packer.logs.length, 0);
      assertNoStaging(state);
    })
  );
}

for (const operation of ['checksum', 'backup', 'tarball replacement', 'checksum replacement']) {
  test('candidate replacement rolls back when ' + operation + ' fails', () =>
    fixture(async (state) => {
      const failure = new Error('filesystem sentinel: ' + operation);
      const ops = {
        ...fs,
        writeFileSync(file, ...args) {
          if (operation === 'checksum' && file.endsWith('.sha256')) throw failure;
          return fs.writeFileSync(file, ...args);
        },
        renameSync(from, to) {
          if (operation === 'backup' && from === state.tarball + '.sha256') throw failure;
          if (
            operation === 'tarball replacement' &&
            to === state.tarball &&
            from.includes(path.sep + 'output' + path.sep)
          )
            throw failure;
          if (
            operation === 'checksum replacement' &&
            to === state.tarball + '.sha256' &&
            from.includes(path.sep + 'output' + path.sep)
          )
            throw failure;
          return fs.renameSync(from, to);
        }
      };
      const packer = loadPacker(state, { fs: ops });
      await assert.rejects(packer.pack({ destination: state.destination }), (error) => error === failure);
      assertPrevious(state);
      assertNoStaging(state);
      assert.equal(packer.logs.length, 0);
    })
  );
}

test('failed rollback preserves the prior files and reports their recovery directory', () =>
  fixture(async (state) => {
    const packer = loadPacker(state, {
      fs: {
        ...fs,
        renameSync(from, to) {
          if (
            from.includes(path.sep + 'previous' + path.sep) ||
            (from.includes(path.sep + 'output' + path.sep) && to === state.tarball + '.sha256')
          )
            throw new Error('rename sentinel');
          return fs.renameSync(from, to);
        }
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }), /recovery.*\.pack-/i);
    const stage = fs.readdirSync(state.destination).find((name) => name.startsWith('.pack-'));
    assert.ok(stage);
    assert.deepEqual(
      fs.readFileSync(path.join(state.destination, stage, 'previous', path.basename(state.tarball))),
      state.previous
    );
    assert.equal(
      fs.readFileSync(
        path.join(state.destination, stage, 'previous', path.basename(state.tarball) + '.sha256'),
        'utf8'
      ),
      state.checksum
    );
    assert.equal(packer.logs.length, 0);
  }));

test('a first-time pack produces both files and no private staging files', () =>
  fixture(async (state) => {
    fs.unlinkSync(state.tarball);
    fs.unlinkSync(state.tarball + '.sha256');
    const packer = loadPacker(state);
    assert.equal(await packer.pack({ destination: state.destination }), state.tarball);
    assert.equal(fs.readFileSync(state.tarball).subarray(0, 2).toString('hex'), '1f8b');
    assertNoStaging(state);
  }));

test('failed first-time pack leaves no release files', () =>
  fixture(async (state) => {
    fs.unlinkSync(state.tarball);
    fs.unlinkSync(state.tarball + '.sha256');
    const packer = loadPacker(state, {
      spawn(command, args) {
        fs.writeFileSync(path.join(args[args.indexOf('--pack-destination') + 1], 'go-fns-2.0.0.tgz'), 'partial');
        return { status: 1, stdout: '', stderr: 'failed' };
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }));
    assert.deepEqual(fs.readdirSync(state.destination), []);
  }));

for (const failure of ['no report files', 'empty report files', 'no filename']) {
  test('rejects malformed npm metadata: ' + failure, () =>
    fixture(async (state) => {
      const packer = loadPacker(state, {
        spawn(command, args) {
          const report = { filename: 'go-fns-2.0.0.tgz', files: [{ path: 'index.js' }] };
          if (failure === 'no report files') delete report.files;
          if (failure === 'empty report files') report.files = [];
          if (failure === 'no filename') delete report.filename;
          fs.writeFileSync(path.join(args[args.indexOf('--pack-destination') + 1], 'go-fns-2.0.0.tgz'), 'candidate');
          return { status: 0, stdout: JSON.stringify([report]), stderr: '' };
        }
      });
      await assert.rejects(packer.pack({ destination: state.destination }), /Unexpected npm tarball output/);
      assertPrevious(state);
      assertNoStaging(state);
      assert.equal(packer.logs.length, 0);
    })
  );
}

test('missing original checksum remains missing after replacement rollback', () =>
  fixture(async (state) => {
    fs.unlinkSync(state.tarball + '.sha256');
    const packer = loadPacker(state, {
      fs: {
        ...fs,
        renameSync(from, to) {
          if (from.includes(path.sep + 'output' + path.sep) && to === state.tarball + '.sha256')
            throw new Error('digest replacement failed');
          return fs.renameSync(from, to);
        }
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }), /digest replacement failed/);
    assert.deepEqual(fs.readFileSync(state.tarball), state.previous);
    assert.deepEqual(fs.readdirSync(state.destination), ['go-fns-2.0.0.tgz']);
  }));

test('cleanup failure is reported instead of announcing a successful pack', () =>
  fixture(async (state) => {
    const packer = loadPacker(state, {
      fs: {
        ...fs,
        rmSync() {
          throw new Error('cleanup sentinel');
        }
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }), (error) => {
      assert.match(error.message, /cleanup failed.*\.pack-/);
      assert.equal(error.cause.message, 'cleanup sentinel');
      return true;
    });
    assert.equal(packer.logs.length, 0);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(state.tarball)).digest('hex');
    assert.equal(fs.readFileSync(state.tarball + '.sha256', 'utf8').split(/\s/)[0], digest);
  }));

test('packing and cleanup failures preserve both error causes', () =>
  fixture(async (state) => {
    const original = new Error('spawn sentinel');
    const cleanup = new Error('cleanup sentinel');
    const packer = loadPacker(state, {
      spawn: () => ({ error: original }),
      fs: {
        ...fs,
        rmSync() {
          throw cleanup;
        }
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }), (error) => {
      assert.equal(error.errors[0], original);
      assert.equal(error.errors[1], cleanup);
      return true;
    });
    assertPrevious(state);
  }));

test('packer refuses to replace a directory masquerading as a candidate file', () =>
  fixture(async (state) => {
    fs.unlinkSync(state.tarball + '.sha256');
    fs.mkdirSync(state.tarball + '.sha256');
    const packer = loadPacker(state);
    await assert.rejects(packer.pack({ destination: state.destination }), /not a regular file/);
    assert.deepEqual(fs.readFileSync(state.tarball), state.previous);
    assert.ok(fs.statSync(state.tarball + '.sha256').isDirectory());
    assertNoStaging(state);
  }));

test('build failure leaves the previous candidate untouched and never starts npm pack', () =>
  fixture(async (state) => {
    const packer = loadPacker(state, {
      build: () => {
        throw new Error('build sentinel');
      }
    });
    await assert.rejects(packer.pack({ destination: state.destination }), /build sentinel/);
    assert.equal(packer.commands.length, 0);
    assert.equal(packer.logs.length, 0);
    assertPrevious(state);
    assertNoStaging(state);
  }));

if (process.platform === 'win32') {
  for (const nested of [false, true]) {
    test('packer rejects case-varied package destination' + (nested ? ' descendant' : ''), () =>
      fixture(async (state) => {
        const destination = nested
          ? path.join(state.packageRoot.toUpperCase(), 'candidates')
          : state.packageRoot.toUpperCase();
        const packer = loadPacker(state);
        await assert.rejects(packer.pack({ destination }), /Tarballs must stay outside package/);
        assert.equal(packer.builds(), 0, 'Invalid destinations must be rejected before building');
        assert.equal(packer.commands.length, 0);
        assertPrevious(state);
        assertNoStaging(state);
      })
    );
  }
}

for (const throughParent of [false, true]) {
  for (const nested of [false, true]) {
    test(
      'packer rejects a filesystem alias into package/' +
        (throughParent ? ' through a parent' : '') +
        (nested ? ' with new descendants' : ''),
      () =>
        fixture(async (state) => {
          const alias = path.join(state.root, 'candidate-alias');
          fs.symlinkSync(
            throughParent ? state.root : state.packageRoot,
            alias,
            process.platform === 'win32' ? 'junction' : 'dir'
          );
          let destination = throughParent ? path.join(alias, 'package') : alias;
          if (nested) destination = path.join(destination, 'new', 'candidates');
          const packer = loadPacker(state);
          await assert.rejects(packer.pack({ destination }), /Tarballs must stay outside package/);
          assert.equal(packer.builds(), 0, 'Reject unsafe aliases before replacing the package');
          assert.equal(packer.commands.length, 0);
          assertPrevious(state);
          assertNoStaging(state);
        })
    );
  }
}

test('packer refuses an unresolved filesystem alias before building', () =>
  fixture(async (state) => {
    const alias = path.join(state.root, 'missing-alias');
    fs.symlinkSync(path.join(state.packageRoot, 'future'), alias, process.platform === 'win32' ? 'junction' : 'dir');
    const packer = loadPacker(state);
    await assert.rejects(packer.pack({ destination: path.join(alias, 'new') }));
    assert.equal(packer.builds(), 0);
    assert.equal(packer.commands.length, 0);
    assertPrevious(state);
    assertNoStaging(state);
  }));

for (const nested of [false, true]) {
  test('packer accepts an alias outside package/' + (nested ? ' with new descendants' : ''), () =>
    fixture(async (state) => {
      const alias = path.join(state.root, 'safe-alias');
      fs.symlinkSync(state.destination, alias, process.platform === 'win32' ? 'junction' : 'dir');
      const destination = nested ? path.join(alias, 'new', 'candidates') : alias;
      const packer = loadPacker(state);
      const result = await packer.pack({ destination });
      const physical = path.join(
        nested ? path.join(state.destination, 'new', 'candidates') : state.destination,
        path.basename(state.tarball)
      );
      assert.equal(fs.realpathSync(result), fs.realpathSync(physical));
      assert.notDeepEqual(fs.readFileSync(result), state.previous);
      assert.equal(packer.builds(), 1);
      const digest = crypto.createHash('sha256').update(fs.readFileSync(result)).digest('hex');
      assert.equal(fs.readFileSync(result + '.sha256', 'utf8'), digest + '  ' + path.basename(result) + '\n');
      assert.deepEqual(fs.readdirSync(destination).sort(), [path.basename(result), path.basename(result) + '.sha256']);
    })
  );
}
