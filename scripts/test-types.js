'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const metadata = require('../package.json');
const name = metadata.name;
let compiler = require.resolve('typescript/lib/tsc.js');
let directory = metadata.private ? path.join(root, 'package') : root;
const args = process.argv.slice(2);
while (args.length) {
  const flag = args.shift();
  if (!['--compiler', '--package'].includes(flag) || !args.length)
    throw Error('Usage: npm run test:types -- [--compiler path/to/tsc.js] [--package installed-package]');
  const value = path.resolve(args.shift());
  if (flag === '--compiler') compiler = value;
  else directory = value;
}
const ts = require(path.join(path.dirname(compiler), 'typescript.js'));
const [major, minor] = ts.version.split('.').map(Number);
const atLeast = (a, b) => major > a || (major === a && minor >= b);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), name + '-types-'));
const packageRoot = path.join(temporary, 'node_modules', name);
const fixtureRoot = path.join(temporary, 'test/types');
function run(arguments_, options = {}) {
  return execFileSync(process.execPath, arguments_, { cwd: temporary, stdio: 'inherit', ...options });
}
function fixtureName(file) {
  return atLeast(4, 7) ? file : file.replace(/\.cts$/, '.cjs.ts').replace(/\.mts$/, '.esm.ts');
}
function readConfiguration(file) {
  const own = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parent = own.extends ? readConfiguration(path.resolve(path.dirname(file), own.extends)) : {};
  return { ...parent, ...own, compilerOptions: { ...parent.compilerOptions, ...own.compilerOptions } };
}
function compile(label, config, overrides = {}) {
  const options = { ...config.compilerOptions, ...overrides, skipLibCheck: false, types: [] };
  if (!atLeast(4, 7)) {
    if (['Node16', 'NodeNext'].includes(options.module)) options.module = 'CommonJS';
    if (['Node16', 'NodeNext'].includes(options.moduleResolution)) options.moduleResolution = 'node';
    delete options.moduleDetection;
  }
  if (!atLeast(4, 4)) delete options.exactOptionalPropertyTypes;
  if (!atLeast(4, 1)) delete options.noUncheckedIndexedAccess;
  if (!atLeast(3, 8)) {
    options.target = 'ES2017';
    options.lib = ['ES2017', 'DOM'];
  }
  const files = [
    ...config.files,
    'function-subpaths.ts',
    ...(config.compilerOptions.moduleResolution === 'NodeNext' ? ['function-subpaths.mts'] : [])
  ]
    .filter((file) => !file.includes('inferred-guards') || atLeast(5, 5))
    .map(fixtureName);
  const json = { compilerOptions: options, files };
  const configFile = path.join(fixtureRoot, 'check.json');
  fs.writeFileSync(configFile, JSON.stringify(json));
  run([compiler, '-p', configFile]);
  console.log('PASS ' + label);
}
try {
  // A real package copy prevents checkout aliases or JavaScript inference from
  // making a missing distributed declaration look valid.
  fs.cpSync(directory, packageRoot, {
    recursive: true,
    filter: (file) => !['node_modules', '.git', 'test', 'scripts', 'reviews', 'artifacts'].includes(path.basename(file))
  });
  fs.mkdirSync(fixtureRoot, { recursive: true });
  fs.writeFileSync(path.join(temporary, 'package.json'), '{"private":true}');
  for (const file of fs.readdirSync(path.join(root, 'test/types'))) {
    if (!/\.(?:ts|cts|mts)$/.test(file)) continue;
    let source = fs
      .readFileSync(path.join(root, 'test/types', file), 'utf8')
      .replace(/(['"])\.\.\/\.\.\/index\.d\.ts\1/g, '$1../../node_modules/' + name + '/index.d.ts$1')
      .replace(/(['"])\.\.\/\.\.\/index\.mjs\1/g, '$1../../node_modules/' + name + '/index.mjs$1')
      .replace(/(['"])\.\.\/\.\.(?:\/index(?:\.js)?)?\1/g, '$1' + name + '$1')
      .replace(/(['"])\.\.\/\.\.\/src\//g, '$1' + name + '/src/');
    if (!atLeast(4, 5))
      source = source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, (statement) =>
        statement.replace(/\btype /g, '')
      );
    fs.writeFileSync(path.join(fixtureRoot, fixtureName(file)), source);
  }
  const publicNames = require('./package-layout')
    .functionEntries(root)
    .map(({ name }) => name);
  const subpaths = publicNames.flatMap((entry) => [
    `import ${entry} from '${name}/${entry}';`,
    `const ${entry}Typed: typeof import('${name}').${entry} = ${entry};`
  ]);
  fs.writeFileSync(path.join(fixtureRoot, 'function-subpaths.ts'), subpaths.join('\n'));
  const esmSubpaths = publicNames.flatMap((entry) => [
    `import ${entry}, { ${entry} as ${entry}Named } from '${name}/${entry}';`,
    `const ${entry}Typed: typeof import('${name}').${entry} = ${entry};`,
    `const ${entry}NamedTyped: typeof ${entry} = ${entry}Named;`
  ]);
  fs.writeFileSync(path.join(fixtureRoot, 'function-subpaths.mts'), esmSubpaths.join('\n'));
  console.log('TypeScript ' + ts.version + '; package ' + directory);
  {
    const configurations = ['tsconfig.json', 'tsconfig.browser.json', 'tsconfig.nodenext.json'];
    for (const file of configurations) {
      if (file.includes('bundler') && !atLeast(5, 0)) continue;
      if (file.includes('exact-optional') && !atLeast(4, 4)) continue;
      compile(file, readConfiguration(path.join(root, 'test/types', file)));
    }
    compile(
      'function subpaths: Bundler',
      { ...readConfiguration(path.join(root, 'test/types/tsconfig.json')), files: ['function-subpaths.mts'] },
      { module: 'ESNext', moduleResolution: 'Bundler', verbatimModuleSyntax: true }
    );
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
