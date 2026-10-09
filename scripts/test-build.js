'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('./build.js');
const project = path.resolve(__dirname, '..');
const name = require('../package.json').name;
async function fixture(action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name + '-build-'));
  try {
    for (const file of [
      'index.js',
      'index.d.ts',
      'src',
      'package.json',
      'README.md',
      'docs/API.md',
      'LICENSE.md',
      'CHANGELOG.md'
    ])
      fs.cpSync(path.join(project, file), path.join(root, file), { recursive: true });
    fs.mkdirSync(path.join(root, 'package'));
    fs.writeFileSync(path.join(root, 'package/previous.txt'), 'previous valid release');
    await action(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function previous(root) {
  assert.equal(fs.readFileSync(path.join(root, 'package/previous.txt'), 'utf8'), 'previous valid release');
}
test('complete build creates executable bundles and a map of the readable bundle', () =>
  fixture(async (root) => {
    await build({ root });
    assert.deepEqual(
      fs.readdirSync(path.join(root, 'package/dist')).sort(),
      [name + '.js', name + '.min.js', name + '.min.js.map'].sort()
    );
    const source = require(path.join(root, 'index.js'));
    for (const suffix of ['.js', '.min.js']) {
      const api = require(path.join(root, 'package/dist', name + suffix));
      assert.equal(typeof api, typeof source);
      assert.deepEqual(Object.keys(api), Object.keys(source));
    }
    const readable = fs.readFileSync(path.join(root, 'package/dist', name + '.js'), 'utf8');
    const map = JSON.parse(fs.readFileSync(path.join(root, 'package/dist', name + '.min.js.map'), 'utf8'));
    assert.ok(map.sourcesContent.includes(readable));
    assert.equal(map.file, name + '.min.js');
  }));
test('bundle failure preserves the previous release and stops minification', () =>
  fixture(async (root) => {
    fs.writeFileSync(path.join(root, 'index.js'), 'invalid syntax !!!!');
    let minified = false;
    await assert.rejects(
      build({
        root,
        minify() {
          minified = true;
        }
      })
    );
    assert.equal(minified, false);
    previous(root);
  }));
test('minifier failure preserves the previous release', () =>
  fixture(async (root) => {
    await assert.rejects(
      build({
        root,
        minify() {
          throw Error('minifier fault');
        }
      }),
      /minifier fault/
    );
    previous(root);
  }));
test('invalid minified output is rejected before replacement', () =>
  fixture(async (root) => {
    await assert.rejects(
      build({
        root,
        minify() {
          return { code: '!@broken', map: '{}' };
        }
      })
    );
    previous(root);
  }));
test('replacement failure restores the previous release', () =>
  fixture(async (root) => {
    const ops = {
      ...fs,
      renameSync(from, to) {
        if (path.basename(from) === 'output') throw Error('replacement fault');
        return fs.renameSync(from, to);
      }
    };
    await assert.rejects(build({ root, fs: ops }), /replacement fault/);
    previous(root);
  }));
test('rollback failure retains and reports the old release', () =>
  fixture(async (root) => {
    const ops = {
      ...fs,
      renameSync(from, to) {
        if (['output', 'previous-package'].includes(path.basename(from))) throw Error('rename fault');
        return fs.renameSync(from, to);
      }
    };
    await assert.rejects(build({ root, fs: ops }), (error) => {
      assert.match(error.message, /previous package is preserved at/);
      const stage = fs.readdirSync(root).find((file) => file.startsWith('.build-'));
      assert.equal(
        fs.readFileSync(path.join(root, stage, 'previous-package/previous.txt'), 'utf8'),
        'previous valid release'
      );
      return true;
    });
  }));
test('cleanup failure preserves the original build error and reports the staging path', () =>
  fixture(async (root) => {
    const ops = {
      ...fs,
      rmSync() {
        throw Error('cleanup fault');
      }
    };
    await assert.rejects(
      build({
        root,
        fs: ops,
        minify() {
          throw Error('minifier fault');
        }
      }),
      (error) => {
        assert.match(error.message, /minifier fault/);
        assert.match(error.message, /cleanup fault/);
        assert.match(error.message, /\.build-/);
        return true;
      }
    );
    previous(root);
  }));
test('failed first build leaves no partial package', () =>
  fixture(async (root) => {
    fs.rmSync(path.join(root, 'package'), { recursive: true });
    await assert.rejects(
      build({
        root,
        minify() {
          throw Error('minifier fault');
        }
      })
    );
    assert.equal(fs.existsSync(path.join(root, 'package')), false);
  }));

for (const [label, code] of [
  ['runtime error', 'throw Error("staged runtime failure");'],
  ['missing public API', 'module.exports = {};']
]) {
  test('syntax-valid ' + label + ' preserves the previous release', () =>
    fixture(async (root) => {
      await assert.rejects(
        build({
          root,
          async minify(input, options) {
            const result = await require('terser').minify(input, options);
            result.code = code + '\n//# sourceMappingURL=' + name + '.min.js.map';
            return result;
          }
        })
      );
      previous(root);
    })
  );
}

test('complete distribution preserves public reflection and license metadata', () =>
  fixture(async (root) => {
    await build({ root });
    const expected = require(path.join(root, 'index.js'));
    for (const suffix of ['.js', '.min.js']) {
      const filename = path.join(root, 'package/dist', name + suffix);
      const api = require(filename);
      for (const key of Object.keys(expected)) {
        assert.equal(api[key].name, expected[key].name, key + ' function name in ' + suffix);
        assert.equal(api[key].length, expected[key].length, key + ' arity in ' + suffix);
      }
      const code = fs.readFileSync(filename, 'utf8');
      assert.ok(code.includes(require('../package.json').license), 'Missing license banner in ' + suffix);
      assert.ok(code.includes('go-fns v' + require('../package.json').version));
    }
    assert.ok(
      fs.statSync(path.join(root, 'package/dist', name + '.min.js')).size <
        fs.statSync(path.join(root, 'package/dist', name + '.js')).size * 0.6,
      'Minified JavaScript must be substantially smaller than the readable bundle'
    );
  }));

test('complete package removes stale files and keeps consumer metadata separate', () =>
  fixture(async (root) => {
    await build({ root });
    const directory = path.join(root, 'package');
    assert.equal(fs.existsSync(path.join(directory, 'previous.txt')), false);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(metadata.private, undefined);
    assert.equal(metadata.scripts, undefined);
    assert.equal(metadata.devDependencies, undefined);
    assert.equal(metadata.version, require('../package.json').version);
    assert.ok(fs.existsSync(path.join(directory, metadata.types)));
    const api = require(path.join(directory, 'index.js'));
    assert.equal(api.pipe((value) => value + 1)(2), 3);
    assert.equal(require(path.join(directory, 'src/pipe')), api.pipe);
    function snapshot(relative = '') {
      return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(relative, entry.name);
        return entry.isDirectory() ? snapshot(file) : [[file, fs.readFileSync(path.join(directory, file), 'utf8')]];
      });
    }
    const before = snapshot();
    await build({ root });
    assert.deepEqual(snapshot(), before, 'Repeated builds must produce the same consumer files');
  }));
test('corrupt embedded source rejects the package before replacement', () =>
  fixture(async (root) => {
    await assert.rejects(
      build({
        root,
        async minify(input, options) {
          const result = await require('terser').minify(input, options);
          const map = JSON.parse(result.map);
          map.sourcesContent[0] += '\n// corrupt embedded source';
          result.map = JSON.stringify(map);
          return result;
        }
      }),
      /source map/i
    );
    previous(root);
  }));
test('source map content comparison accepts equivalent line endings', () =>
  fixture(async (root) => {
    await build({
      root,
      async minify(input, options) {
        const result = await require('terser').minify(input, options);
        const map = JSON.parse(result.map);
        map.sourcesContent = map.sourcesContent.map((source) => source.replace(/\r?\n/g, '\r\n'));
        result.map = JSON.stringify(map);
        return result;
      }
    });
    assert.ok(fs.existsSync(path.join(root, 'package/index.js')));
  }));

for (const failure of [undefined, null, false, 0, '']) {
  test('falsy minifier failure ' + String(failure) + ' cannot report a successful build', () =>
    fixture(async (root) => {
      await assert.rejects(
        build({
          root,
          minify() {
            throw failure;
          }
        }),
        (error) => error === failure
      );
      previous(root);
      assert.deepEqual(
        fs.readdirSync(root).filter((file) => file.startsWith('.build-')),
        []
      );
    })
  );
}

test('cleanup retains a null minifier failure together with the cleanup error', () =>
  fixture(async (root) => {
    const cleanupError = new Error('cleanup denied');
    const ops = {
      ...fs,
      rmSync() {
        throw cleanupError;
      }
    };
    await assert.rejects(
      build({
        root,
        fs: ops,
        minify() {
          throw null;
        }
      }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [null, cleanupError]);
        return true;
      }
    );
    previous(root);
  }));

function withCompiler(compiler) {
  const filename = path.join(__dirname, 'build.js');
  const actualRequire = require('node:module').createRequire(filename);
  const mockedWebpack = Object.assign(() => compiler, { BannerPlugin: class {} });
  const context = {
    module: { exports: {} },
    __dirname,
    process,
    console,
    AggregateError,
    require(name) {
      return name === 'webpack' ? mockedWebpack : actualRequire(name);
    }
  };
  require('node:vm').runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports.build;
}

for (const closeFails of [false, true]) {
  test('a synchronous null compiler failure survives cleanup: ' + closeFails, () =>
    fixture(async (root) => {
      const cleanupError = new Error('compiler close denied');
      let closed = false;
      const runBuild = withCompiler({
        run() {
          throw null;
        },
        close(done) {
          closed = true;
          done(closeFails ? cleanupError : undefined);
        }
      });
      let minified = false;
      await assert.rejects(
        runBuild({
          root,
          minify() {
            minified = true;
          }
        }),
        (error) => {
          if (!closeFails) return error === null;
          assert.ok(error instanceof AggregateError);
          assert.deepEqual(Array.from(error.errors), [null, cleanupError]);
          return true;
        }
      );
      assert.equal(closed, true);
      assert.equal(minified, false);
      previous(root);
    })
  );
}
