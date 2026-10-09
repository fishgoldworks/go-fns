'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const consumerFiles = ['index.js', 'index.d.ts', 'README.md', 'docs/API.md', 'CHANGELOG.md', 'LICENSE.md'];
const bundles = ['dist/go-fns.js', 'dist/go-fns.min.js', 'dist/go-fns.min.js.map'];
function runtimeFiles(directory = root) {
  function walk(relative) {
    return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
      const file = relative + '/' + entry.name;
      if (entry.isSymbolicLink()) throw Error('Runtime source must not be a symbolic link: ' + file);
      return entry.isDirectory() ? walk(file) : /\.(?:js|d\.ts)$/.test(file) ? [file] : [];
    });
  }
  return walk('src').sort();
}
function inventory(directory = root) {
  return [...consumerFiles, ...runtimeFiles(directory), ...bundles, 'package.json'].sort();
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
    'engines',
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
  Object.assign(manifest, {
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
  consumerManifest,
  artifactPath
};
