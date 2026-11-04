'use strict';
const nativeFs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const webpack = require('webpack');
const { minify: minifyJavaScript } = require('terser');
const NAME = 'go-fns';
const { consumerFiles, runtimeFiles, consumerManifest, writeFunctionEntries } = require('./package-layout');
const checkSourceMap = require('./check-source-map');
const { generate } = require('./docs');
function banner(root) {
  const pkg = JSON.parse(nativeFs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return (
    '/*! ' +
    pkg.name +
    ' v' +
    pkg.version +
    ' | ' +
    pkg.license +
    '\n' +
    nativeFs.readFileSync(path.join(root, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n').trim() +
    '\n*/'
  );
}

async function bundle(root, output) {
  const compiler = webpack({
    mode: 'none',
    context: root,
    entry: './index.js',
    target: ['web', 'es2017'],
    output: {
      path: output,
      filename: NAME + '.js',
      library: { name: 'Functions', type: 'umd' },
      globalObject: 'typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this'
    },
    plugins: [new webpack.BannerPlugin({ banner: banner(root), raw: true })]
  });
  let failure;
  let failed = false;
  try {
    await new Promise((resolve, reject) =>
      compiler.run((error, stats) => {
        if (error) reject(error);
        else if (stats.hasErrors()) reject(Error(stats.toString({ all: false, errors: true })));
        else resolve();
      })
    );
  } catch (error) {
    failure = error;
    failed = true;
  }
  try {
    await new Promise((resolve, reject) => compiler.close((error) => (error ? reject(error) : resolve())));
  } catch (error) {
    failure = failed
      ? new AggregateError(
          [failure, error],
          (failure?.message ?? String(failure)) + '; compiler cleanup failed: ' + (error?.message ?? String(error))
        )
      : error;
    failed = true;
  }
  if (failed) throw failure;
}
async function minify(root, output, fs, minifier) {
  const readable = fs.readFileSync(path.join(output, NAME + '.js'), 'utf8');
  const result = await minifier(
    { [NAME + '.js']: readable },
    {
      ecma: 2017,
      // Preserve reflected names, accessor effects and strict document.all checks.
      compress: { comparisons: false, typeofs: false, pure_getters: false },
      mangle: { properties: false },
      keep_fnames: true,
      keep_classnames: true,
      format: { comments: false, preamble: banner(root) },
      sourceMap: { filename: NAME + '.min.js', url: NAME + '.min.js.map', includeSources: true }
    }
  );
  if (result.error) throw result.error;
  fs.writeFileSync(path.join(output, NAME + '.min.js'), result.code);
  fs.writeFileSync(path.join(output, NAME + '.min.js.map'), result.map);
}
function validateApi(api, expected, filename, mode) {
  if (
    typeof api !== typeof expected ||
    !api ||
    JSON.stringify(Object.keys(api).sort()) !== JSON.stringify(Object.keys(expected).sort())
  )
    throw Error(`${filename} (${mode}) has an incomplete public API.`);
  for (const key of Object.keys(expected)) {
    if (typeof api[key] !== typeof expected[key]) throw Error(`${filename} (${mode}) has an invalid export: ${key}`);
  }
  if (
    api.pipe(
      (value) => value + 1,
      (value) => value * 2
    )(2) !== 6 ||
    api.partial((a, b) => a + b, 2)(3) !== 5 ||
    api.not(Boolean)(false) !== true
  )
    throw Error(`${filename} (${mode}) failed the function-composition contract.`);
  const result = api.attemptResult(() => 42);
  if (result.ok !== true || result.value !== 42) throw Error(`${filename} (${mode}) failed result API checks.`);
  for (const name of Object.keys(api)) {
    for (const property of ['async', 'result', 'resultAsync', 'right']) {
      if (Object.prototype.hasOwnProperty.call(api[name], property))
        throw Error(`${filename} (${mode}) retained a removed attachment: ${name}.${property}`);
    }
  }
}
function validate(root, output, fs) {
  const expected = require(path.join(root, 'index.js'));
  for (const suffix of ['.js', '.min.js']) {
    const filename = NAME + suffix;
    const code = fs.readFileSync(path.join(output, filename), 'utf8');
    const script = new vm.Script(code, { filename });
    for (const mode of ['commonjs', 'global', 'worker-global', 'amd', 'exports-only']) {
      let amd;
      const sandbox = {};
      if (mode === 'commonjs') {
        sandbox.module = { exports: {} };
        sandbox.exports = sandbox.module.exports;
      }
      if (mode === 'exports-only') sandbox.exports = {};
      if (mode === 'worker-global') sandbox.self = sandbox;
      if (mode === 'amd') {
        sandbox.define = (dependencies, factory) => {
          amd = factory();
        };
        sandbox.define.amd = true;
      }
      script.runInNewContext(sandbox, { timeout: 5000 });
      const api =
        mode === 'commonjs'
          ? sandbox.module.exports
          : mode === 'amd'
            ? amd
            : mode === 'exports-only'
              ? sandbox.exports.Functions
              : sandbox.Functions;
      validateApi(api, expected, filename, mode);
    }
  }
  checkSourceMap(output, fs);
}
async function build({
  root = path.resolve(__dirname, '..'),
  fs = nativeFs,
  minify: minifier = minifyJavaScript
} = {}) {
  generate({ root });
  const dist = path.join(root, 'package');
  const stage = fs.mkdtempSync(path.join(root, '.build-'));
  const output = path.join(stage, 'output');
  const backup = path.join(stage, 'previous-package');
  let keepRecoveryFiles = false;
  let failure;
  let failed = false;
  try {
    fs.mkdirSync(output);
    for (const file of [...consumerFiles, ...runtimeFiles(root)]) {
      fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(output, file));
    }
    writeFunctionEntries(output, root, fs);
    const manifest = consumerManifest(root);
    fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    const bundles = path.join(output, 'dist');
    fs.mkdirSync(bundles);
    await bundle(output, bundles);
    await minify(output, bundles, fs, minifier);
    validate(root, bundles, fs);
    validateApi(require(path.join(output, 'index.js')), require(path.join(root, 'index.js')), 'index.js', 'CommonJS');
    function validateTargets(value) {
      if (typeof value === 'string') {
        const resolved = path.resolve(output, value);
        if (!resolved.startsWith(output + path.sep) || !fs.statSync(resolved).isFile())
          throw Error('Invalid package target: ' + value);
      } else Object.values(value).forEach(validateTargets);
    }
    validateTargets(manifest.exports);
    let hadPrevious = false;
    try {
      fs.renameSync(dist, backup);
      hadPrevious = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    try {
      fs.renameSync(output, dist);
    } catch (error) {
      if (hadPrevious) {
        try {
          fs.renameSync(backup, dist);
        } catch (rollbackError) {
          keepRecoveryFiles = true;
          // eslint-disable-next-line preserve-caught-error -- AggregateError.errors retains the original and recovery failures.
          throw new AggregateError(
            [error, rollbackError],
            `Build failed; previous package is preserved at ${backup}: ${error?.message ?? String(error)}; rollback failed: ${rollbackError?.message ?? String(rollbackError)}`
          );
        }
      }
      throw error;
    }
  } catch (error) {
    failure = error;
    failed = true;
  }
  if (!keepRecoveryFiles) {
    try {
      fs.rmSync(stage, { recursive: true, force: true });
    } catch (error) {
      const message = `Staging cleanup failed at ${stage}: ${error?.message ?? String(error)}`;
      failure = failed
        ? new AggregateError([failure, error], (failure?.message ?? String(failure)) + '; ' + message)
        : Error(message, { cause: error });
      failed = true;
    }
  }
  if (failed) throw failure;
}
module.exports = { build };
if (require.main === module) {
  if (process.argv.length > 2) throw Error('Usage: node scripts/build.js');
  build()
    .then(() => console.log('Built and validated ' + NAME + ' consumer package, readable/minified UMD and source map.'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
