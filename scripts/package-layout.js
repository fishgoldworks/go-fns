'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const consumerEngines = { node: '>=8.0.0' };
const consumerFiles = ['index.js', 'index.d.ts', 'README.md', 'docs/API.md', 'CHANGELOG.md', 'LICENSE.md'];
const bundles = ['dist/go-fns.js', 'dist/go-fns.js.map', 'dist/go-fns.min.js', 'dist/go-fns.min.js.map'];

function runtimeFiles(directory = root) {
  function walk(relative) {
    return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === 'temp' || entry.name === '.tmp') {
        return [];
      }

      const file = relative + '/' + entry.name;

      if (entry.isSymbolicLink()) throw Error('Runtime source must not be a symbolic link: ' + file);

      return entry.isDirectory() ? walk(file) : /\.(?:js|d\.ts)$/.test(file) ? [file] : [];
    });
  }

  return walk('src').sort();
}

function functionEntries(directory = root) {
  const api = require(path.join(directory, 'index.js'));
  const sources = runtimeFiles(directory).filter((file) => file.endsWith('.js'));

  return Object.entries(api)
    .filter(([, value]) => typeof value === 'function')
    .map(([name, value]) => {
      const source = sources.find(
        (file) => path.basename(file) === name + '.js' && require(path.join(directory, file)) === value
      );

      if (!source) throw Error('Missing public function implementation: ' + name);

      return { name, source };
    });
}

function functionFiles(directory = root) {
  return functionEntries(directory).flatMap(({ name }) =>
    ['.js', '.mjs', '.d.ts', '.d.cts', '.d.mts'].map((ext) => name + ext)
  );
}

function functionContents(directory = root) {
  return Object.fromEntries(
    functionEntries(directory).flatMap(({ name, source }) => {
      const common = 'declare const ' + name + ": typeof import('./index')." + name + ';\nexport = ' + name + ';\n';

      return [
        [name + '.js', "'use strict';\nmodule.exports = require('./" + source + "');\n"],
        [
          name + '.mjs',
          'import ' + name + " from './" + name + ".js';\nexport { " + name + ' };\nexport default ' + name + ';\n'
        ],
        [name + '.d.ts', common],
        [name + '.d.cts', common],
        [
          name + '.d.mts',
          'import { ' + name + " } from './index.js';\nexport { " + name + ' };\nexport default ' + name + ';\n'
        ]
      ];
    })
  );
}

function writeFunctionEntries(directory, sourceRoot = root, fsOps = fs) {
  for (const [file, content] of Object.entries(functionContents(sourceRoot)))
    fsOps.writeFileSync(path.join(directory, file), content);
}

function functionTarget(name) {
  return [
    {
      types: { import: './' + name + '.d.mts', require: './' + name + '.d.cts', default: './' + name + '.d.ts' },
      import: './' + name + '.mjs',
      default: './' + name + '.js'
    },
    './' + name + '.js'
  ];
}

function inventory(directory = root) {
  return [...consumerFiles, ...runtimeFiles(directory), ...functionFiles(directory), ...bundles, 'package.json'].sort();
}

function consumerManifest(directory = root) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const manifest = {};

  for (const field of [
    'name',
    'version',
    'description',
    'author',
    'email',
    'license',
    'keywords',
    'homepage',
    'repository',
    'bugs',
    'funding',
    'dependencies',
    'peerDependencies',
    'optionalDependencies'
  ]) {
    if (metadata[field] !== undefined) manifest[field] = metadata[field];
  }

  const files = inventory(directory);
  // Early export-map implementations need a literal fallback after modern conditions.
  const entry = [{ types: './index.d.ts', default: './index.js' }, './index.js'];
  const exports = { '.': entry, './index': entry, './index.js': entry };

  for (const file of files) {
    if (file === 'index.js') continue;
    const target = './' + file;

    if (file.endsWith('.js') && files.includes(file.slice(0, -3) + '.d.ts')) {
      const value = [{ types: target.slice(0, -3) + '.d.ts', default: target }, target];

      exports[target] = value;
      exports[target.slice(0, -3)] = value;
    } else {
      exports[target] = target;
      if (file.endsWith('.js')) exports[target.slice(0, -3)] = target;
    }
  }

  for (const { name } of functionEntries(directory)) exports['./' + name] = functionTarget(name);
  Object.assign(manifest, {
    engines: consumerEngines,
    type: 'commonjs',
    main: './index.js',
    types: './index.d.ts',
    unpkg: './dist/go-fns.min.js',
    jsdelivr: './dist/go-fns.min.js',
    exports,
    files: files.filter((file) => file !== 'package.json')
  });
  // Sort only manifest fields; nested export conditions and fallback arrays retain precedence.
  const fields = [
    'name',
    'version',
    'private',
    'description',
    'license',
    'author',
    'contributors',
    'email',
    'keywords',
    'homepage',
    'repository',
    'bugs',
    'funding',
    'type',
    'engines',
    'devEngines',
    'packageManager',
    'main',
    'module',
    'browser',
    'types',
    'typesVersions',
    'exports',
    'imports',
    'bin',
    'unpkg',
    'jsdelivr',
    'files',
    'sideEffects',
    'publishConfig',
    'scripts',
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'devDependencies',
    'overrides',
    'resolutions'
  ];

  return Object.fromEntries(
    fields.filter((field) => Object.hasOwn(manifest, field)).map((field) => [field, manifest[field]])
  );
}

function artifactPath(directory = path.join(root, 'artifacts')) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  return path.join(directory, metadata.name + '-' + metadata.version + '.tgz');
}

module.exports = {
  root,
  packageRoot: path.join(root, 'package'),
  consumerFiles,
  bundles,
  runtimeFiles,
  inventory,
  functionEntries,
  functionFiles,
  functionContents,
  writeFunctionEntries,
  consumerEngines,
  consumerManifest,
  artifactPath
};
