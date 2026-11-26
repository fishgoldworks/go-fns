'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

test('a supplied missing tarball fails instead of building or packing', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-missing-'));

  try {
    const result = spawnSync(
      process.execPath,
      ['scripts/test-package.js', '--tarball', path.join(temporary, 'missing.tgz')],
      { cwd: root, encoding: 'utf8' }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing release tarball/);
    assert.deepEqual(fs.readdirSync(temporary), []);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('ordinary root npm pack and prepublish hooks reject the private development root', () => {
  assert.ok(process.env.npm_execpath, 'Run through npm run test:release.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-guard-'));

  try {
    for (const args of [
      ['pack', '--dry-run', '--pack-destination', temporary],
      ['run', 'prepublishOnly']
    ]) {
      const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000
      });

      if (result.error) throw result.error;
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /development root is private/);
    }

    assert.deepEqual(fs.readdirSync(temporary), []);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('modified candidate bytes fail their recorded digest before installation', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-digest-'));

  try {
    const tarball = path.join(temporary, 'candidate.tgz');

    fs.writeFileSync(tarball, 'corrupted candidate');
    fs.writeFileSync(tarball + '.sha256', '0'.repeat(64) + '  candidate.tgz\n');
    const result = spawnSync(process.execPath, ['scripts/test-package.js', '--tarball', tarball], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SHA256 mismatch/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

for (const relative of ['src/pipe.js', 'src/whenAsync.d.ts', 'CHANGELOG.md', 'package/dist/go-fns.min.js']) {
  test('installed candidate must contain the reviewed bytes of ' + relative, () => {
    assert.ok(process.env.npm_execpath, 'Run through npm run test:release.');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-stale-package-'));
    const copy = path.join(temporary, 'project');

    try {
      fs.cpSync(root, copy, {
        recursive: true,
        filter: (file) => !['node_modules', '.git', '__pycache__', '.test-results'].includes(path.basename(file))
      });
      fs.appendFileSync(path.join(copy, relative), '\n/* review probe: current source is newer than the tarball */\n');
      const env = { ...process.env, NODE_OPTIONS: '' };

      delete env.NODE_TEST_CONTEXT;
      const tarball = path.resolve(
        process.env.GO_FNS_TEST_TARBALL || require('../../scripts/package-layout').artifactPath()
      );
      const built = relative.startsWith('package/');
      const flags = built ? ['--compare-package'] : [];
      const result = spawnSync(process.execPath, ['scripts/test-package.js', '--tarball', tarball, ...flags], {
        cwd: copy,
        env,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024
      });

      assert.ifError(result.error);
      assert.notEqual(result.status, 0, 'Stale packaged source was accepted: ' + relative);
      const diagnostic = built
        ? 'Packaged file differs from the checked build: ' + relative.slice('package/'.length)
        : 'Packaged source differs: ' + relative;

      assert.ok(result.stderr.includes(diagnostic), result.stderr);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
}

for (const defaultCandidate of ['missing', 'stale']) {
  test(`candidate-dependent checks use the selected archive with a ${defaultCandidate} default`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-selected-candidate-'));
    const copy = path.join(temporary, 'project');

    try {
      fs.cpSync(root, copy, {
        recursive: true,
        filter: (file) =>
          !['node_modules', '.git', '__pycache__', '.test-results', 'coverage', 'artifacts'].includes(
            path.basename(file)
          )
      });
      if (defaultCandidate === 'stale') {
        fs.mkdirSync(path.join(copy, 'artifacts'));
        fs.writeFileSync(path.join(copy, 'artifacts/go-fns-2.0.0.tgz'), 'obsolete default archive');
      }

      const env = {
        ...process.env,
        NODE_OPTIONS: '',
        GO_FNS_TEST_TARBALL: path.resolve(
          process.env.GO_FNS_TEST_TARBALL || require('../../scripts/package-layout').artifactPath()
        )
      };

      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(
        process.execPath,
        [
          '--test',
          '--test-reporter=tap',
          '--test-name-pattern=^installed',
          'test/package/release.test.js',
          'test/tooling/check-test-output.test.js'
        ],
        { cwd: copy, env, encoding: 'utf8', timeout: 40000, maxBuffer: 2 * 1024 * 1024 }
      );

      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(require('../../scripts/check-test-output').tapSummary(result.stdout), 5);
      const defaultPath = path.join(copy, 'artifacts/go-fns-2.0.0.tgz');

      if (defaultCandidate === 'stale') assert.equal(fs.readFileSync(defaultPath, 'utf8'), 'obsolete default archive');
      else assert.equal(fs.existsSync(defaultPath), false);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
}
