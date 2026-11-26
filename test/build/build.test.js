'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { SourceMap } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { build } = require('../../scripts/build.js');
const project = path.resolve(__dirname, '../..');
const name = require('../../package.json').name;

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
      'scripts/README.template.md',
      'scripts/API.template.md',
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

test('both executable bundles map the generated pipe function to the packaged source', () =>
  fixture(async (root) => {
    await build({ root });
    assert.deepEqual(
      fs.readdirSync(path.join(root, 'package/dist')).sort(),
      [name + '.js', name + '.js.map', name + '.min.js', name + '.min.js.map'].sort()
    );
    const source = require(path.join(root, 'index.js'));
    const original = fs.readFileSync(path.join(root, 'package/src/pipe.js'), 'utf8').split(/\r?\n/);

    for (const suffix of ['.js', '.min.js']) {
      const bundle = path.join(root, 'package/dist', name + suffix);
      const api = require(bundle);

      assert.equal(typeof api, typeof source);
      assert.deepEqual(Object.keys(api), Object.keys(source));

      const code = fs.readFileSync(bundle, 'utf8');
      const declaration = 'function pipe(';
      const start = code.indexOf(declaration);

      assert.notEqual(start, -1);
      const lines = code.slice(0, start + 'function '.length).split('\n');
      const map = new SourceMap(JSON.parse(fs.readFileSync(bundle + '.map', 'utf8')));
      const entry = map.findEntry(lines.length - 1, lines.at(-1).length);

      assert.match(entry.originalSource, /\/src\/pipe\.js$/);
      assert.ok(original[entry.originalLine].startsWith(declaration));
    }
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

      assert.ok(code.includes(require('../../package.json').license), 'Missing license banner in ' + suffix);
      assert.ok(code.includes('go-fns v' + require('../../package.json').version));
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
    assert.equal(metadata.version, require('../../package.json').version);
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

test('a minified map without Webpack composition rejects the package before replacement', () =>
  fixture(async (root) => {
    await assert.rejects(
      build({
        root,
        minify(input, options) {
          return require('terser').minify(input, {
            ...options,
            sourceMap: { ...options.sourceMap, content: undefined }
          });
        }
      }),
      /Invalid source map entry.*go-fns\.min\.js\.map/
    );
    previous(root);
  }));

test('a broken readable map reference rejects the package before replacement', () =>
  fixture(async (root) => {
    const ops = {
      ...fs,
      readFileSync(file, encoding) {
        const content = fs.readFileSync(file, encoding);

        return path.basename(file) === name + '.js' && path.basename(path.dirname(file)) === 'dist'
          ? content.replace('sourceMappingURL=' + name + '.js.map', 'sourceMappingURL=missing.map')
          : content;
      }
    };

    await assert.rejects(build({ root, fs: ops }), /Invalid source map or bundle reference: go-fns\.js\.map/);
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
  const filename = path.join(project, 'scripts/build.js');
  const actualRequire = require('node:module').createRequire(filename);
  const mockedWebpack = Object.assign(() => compiler, { BannerPlugin: class {} });
  const context = {
    module: { exports: {} },
    __dirname: path.dirname(filename),
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
          if (!closeFails) {
            return error === null;
          }

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

test('build excludes reserved experiment directories and preserves their contents', () =>
  fixture(async (root) => {
    const experiments = [
      'src/temp/private.js',
      'src/.tmp/private.d.ts',
      'src/util/temp/private.d.ts',
      'src/util/.tmp/private.js'
    ];

    for (const file of experiments) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), 'unpublished experiment');
    }

    await build({ root });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package/package.json'), 'utf8'));

    for (const file of experiments) {
      assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'unpublished experiment');
      assert.equal(fs.existsSync(path.join(root, 'package', file)), false, file + ' must not ship');
      assert.equal(manifest.files.includes(file), false);
      assert.equal(Object.hasOwn(manifest.exports, './' + file), false);
    }

    assert.equal(typeof require(path.join(root, 'package/src/pipe.js')), 'function');
    assert.ok(manifest.files.includes('src/pipe.js'));
  }));

test('complete build regenerates consumer documentation from canonical templates', () =>
  fixture(async (root) => {
    const expected = ['README.md', 'docs/API.md'].map((file) => fs.readFileSync(path.join(project, file), 'utf8'));

    for (const file of ['README.md', 'docs/API.md']) fs.writeFileSync(path.join(root, file), 'stale draft');
    await build({ root });
    for (const [index, file] of ['README.md', 'docs/API.md'].entries()) {
      assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), expected[index]);
      assert.equal(fs.readFileSync(path.join(root, 'package', file), 'utf8'), expected[index]);
    }
  }));

test('build supplies isolated callable entries for every public function', () =>
  fixture(async (root) => {
    await build({ root });
    const directory = path.join(root, 'package');
    const api = require(path.join(directory, 'index.js'));

    for (const name of Object.keys(api)) {
      const focused = require(path.join(directory, name + '.js'));

      assert.equal(focused, api[name], name + ' identity');
      assert.equal(Object.hasOwn(focused, name), false, 'No named property added to the callable');
      const result = require('node:child_process').spawnSync(
        process.execPath,
        [
          '-e',
          "require(process.argv[1]);if(require.cache[require('node:path').join(process.argv[2],'index.js')])process.exit(1);",
          path.join(directory, name + '.js'),
          directory
        ],
        { encoding: 'utf8' }
      );

      assert.equal(result.status, 0, name + ' must load without the root aggregator: ' + result.stderr);
    }

    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));

    for (const name of Object.keys(api)) assert.ok(metadata.exports['./' + name]);
  }));
