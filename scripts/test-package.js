'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const layout = require('./package-layout');
const checks = require('./check-test-output');
const { values: options } = parseArgs({
  options: { tarball: { type: 'string' }, node: { type: 'string' }, browser: { type: 'boolean' } }
});
const tarball = path.resolve(options.tarball || layout.artifactPath());
if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile())
  throw Error('Missing release tarball: ' + tarball + '. Run npm run pack:package first.');
const digest = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
if (fs.existsSync(tarball + '.sha256'))
  assert.equal(
    fs.readFileSync(tarball + '.sha256', 'utf8').split(/\s+/)[0],
    digest,
    'Release tarball SHA256 mismatch.'
  );
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run test:package.');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const field of ['name', 'version']) assert.equal(lock[field], pkg[field]);
for (const field of ['name', 'version', 'license', 'devDependencies'])
  assert.deepEqual(lock.packages[''][field], pkg[field]);
assert.equal(pkg.engine, undefined);
assert.equal(pkg.types, 'index.d.ts');
assert.equal(pkg.private, true);
assert.equal(pkg.exports, undefined);
assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
assert.ok(Object.values(pkg.devDependencies).every((version) => /^\d+\.\d+\.\d+$/.test(version)));
const api = require('..');
const expected = [
  'and',
  'andAsync',
  'applyIf',
  'attempt',
  'attemptResult',
  'attemptResultAsync',
  'debounce',
  'delay',
  'ifElse',
  'ifElseAsync',
  'nor',
  'norAsync',
  'not',
  'notAsync',
  'once',
  'or',
  'orAsync',
  'partial',
  'partialRight',
  'pipe',
  'pipeAsync',
  'repeat',
  'repeatAsync',
  'result',
  'sleep',
  'spread',
  'tap',
  'tapAsync',
  'throttle',
  'unary',
  'when',
  'whenAsync',
  'xor',
  'xorAsync'
];
assert.deepEqual(Object.keys(api).sort(), expected);
// Catch newly added, unreferenced production files instead of quietly excluding them from coverage.
const sourceFiles = layout
  .runtimeFiles(root)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join(root, file));
for (const filename of sourceFiles) assert.ok(require.cache[filename], 'Unloaded production module: ' + filename);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-consumer-'));
try {
  const files = run('tar', ['-tzf', tarball])
    .trim()
    .split(/\r?\n/)
    .filter((file) => !file.endsWith('/'))
    .map((file) => {
      assert.ok(file.startsWith('package/'), 'Unexpected tarball path: ' + file);
      return file.slice('package/'.length);
    })
    .sort();
  assert.deepEqual(files, layout.inventory());
  const consumer = path.join(temporary, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    '{"name":"go-fns-consumer-check","private":true,"version":"1.0.0"}'
  );
  run(
    process.execPath,
    [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', tarball],
    { cwd: consumer }
  );
  const installed = path.join(consumer, 'node_modules/go-fns');
  require('./lib/check-library-readme.cjs').checkPackage(installed);
  const licence = fs.readFileSync(path.join(root, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n').trim();
  for (const file of ['go-fns.js', 'go-fns.min.js']) {
    const bundle = fs.readFileSync(path.join(installed, 'dist', file), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(bundle.slice(0, bundle.indexOf('*/')).includes(licence), file + ' must carry the canonical licence');
  }
  const installedMetadata = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(installedMetadata, layout.consumerManifest());
  assert.equal(installedMetadata.devDependencies, undefined);
  assert.equal(installedMetadata.scripts, undefined);
  assert.equal(installedMetadata.private, undefined);
  assert.deepEqual(
    walk(installed)
      .map((file) => path.relative(installed, file).split(path.sep).join('/'))
      .sort(),
    files
  );
  assert.equal(
    fs.readFileSync(path.join(installed, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n'),
    fs.readFileSync(path.join(root, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n')
  );
  const sourceFilesMatched = require('./check-package-sources')(root, installed);
  require('./check-source-map')(path.join(installed, 'dist'));
  const runtimes = [...new Set([process.execPath, options.node].filter(Boolean))];
  const versions = [];
  const functionNames = layout.functionEntries(root).map(({ name }) => name);
  fs.copyFileSync(path.join(root, 'test/package/function-subpaths.cjs'), path.join(consumer, 'function-subpaths.cjs'));
  function runConsumer(runtime, args, settings = {}) {
    return run(runtime, args, { ...settings, env: { ...process.env, NODE_OPTIONS: '' } });
  }
  const examplePath = path.join(consumer, 'documentation-example.cjs');
  function checkCommonJsExamples(runtime, version) {
    let count = 0;
    for (const file of ['README.md', 'docs/API.md']) {
      const text = fs.readFileSync(path.join(installed, file), 'utf8').replace(/\r\n/g, '\n');
      for (const block of text.matchAll(/```javascript\n([^]*?)\n```/g)) {
        if (!/\brequire\(['"]go-fns/.test(block[1])) continue;
        fs.writeFileSync(examplePath, block[1]);
        try {
          runConsumer(
            runtime,
            [
              '-e',
              "process.on('unhandledRejection', error => { throw error; }); require('./documentation-example.cjs');"
            ],
            { cwd: consumer }
          );
        } catch (error) {
          const line = text.slice(0, block.index).split('\n').length;
          throw new Error(`${file}:${line} failed as CommonJS on ${version}.`, { cause: error });
        }
        count++;
      }
    }
    console.log(`${count} CommonJS documentation examples passed on ${version}.`);
  }
  fs.copyFileSync(path.join(root, 'test/package/consumer.cjs'), path.join(consumer, 'consumer.cjs'));
  fs.copyFileSync(path.join(root, 'test/package/capabilities.cjs'), path.join(consumer, 'capabilities.cjs'));
  for (const runtime of runtimes) {
    const version = runConsumer(runtime, ['--version']).trim();
    versions.push(version);
    checks.completion(
      runConsumer(runtime, [path.join(consumer, 'function-subpaths.cjs'), JSON.stringify(functionNames)], {
        cwd: consumer
      })
    );
    const output = runConsumer(runtime, [path.join(consumer, 'consumer.cjs')], { cwd: consumer });
    checks.consumerSummary(output, version);
    console.log(output.trim());
    const capabilityOutput = runConsumer(
      runtime,
      [path.join(consumer, 'capabilities.cjs'), path.join(root, 'test/helpers/capabilities.js')],
      { cwd: consumer }
    );
    const capabilityReport = JSON.parse(capabilityOutput);
    assert.equal(capabilityReport.runtime, version);
    assert.deepEqual(
      capabilityReport.capabilities.map((result) => result.entry),
      ['go-fns', 'go-fns/dist/go-fns.js', 'go-fns/dist/go-fns.min.js']
    );
    for (const result of capabilityReport.capabilities) {
      assert.ok(result.scenarios > 0 && result.imports.length > 0);
      assert.equal(result.cases, result.scenarios * result.imports.length);
    }
    console.log(capabilityOutput.trim());
    checkCommonJsExamples(runtime, version);
  }
  for (const file of ['README.md', 'docs/API.md']) {
    assert.deepEqual(
      fs.readFileSync(path.join(installed, file)),
      fs.readFileSync(path.join(root, file)),
      'Packaged document differs: ' + file
    );
  }
  require('./documentation-contract')(
    fs.readFileSync(path.join(installed, 'README.md'), 'utf8'),
    fs.readFileSync(path.join(installed, 'docs/API.md'), 'utf8'),
    installed
  );
  const entry = path.join(installed, 'index.js');
  const output = run(process.execPath, ['scripts/test.js', '--test-reporter=tap', '--test-timeout=30000'], {
    timeout: 40000,
    env: { ...process.env, GO_FNS_TEST_ENTRY: entry }
  });
  const count = checks.tapSummary(output);
  if (process.env.GO_FNS_EVIDENCE_DIR)
    fs.writeFileSync(path.join(process.env.GO_FNS_EVIDENCE_DIR, 'packed-consumer.tap'), output);
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';import api,{pipe,not,repeat,delay,and,or,xor,nor,spread,attempt} from 'go-fns';assert.equal(api.pipe,pipe);assert.equal(pipe(null,x=>x+1)(1),2);assert.deepEqual([1,2,3.1].filter(not(Number.isInteger)),[3.1]);for(const fn of [repeat,delay,and,or,xor,nor,spread,attempt])assert.equal(typeof fn,'function');`
    ],
    { cwd: consumer }
  );
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';import api,{pipeAsync,attemptResult,attemptResultAsync,tap,tapAsync,sleep,once} from 'go-fns';assert.equal(api.pipeAsync,pipeAsync);assert.equal(api.attemptResult,attemptResult);assert.equal(api.attemptResultAsync,attemptResultAsync);assert.equal(api.tapAsync,tapAsync);assert.equal(await pipeAsync(async x=>x+1,tapAsync(()=>{}))(2),3);assert.deepEqual(await attemptResultAsync(()=>Promise.resolve(3)),{ok:true,value:3});await sleep(0);const f=once(()=>({}));assert.equal(f(),f());`
    ],
    { cwd: consumer }
  );
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';import api,{debounce,throttle,partial,partialRight,unary,when,ifElse,repeatAsync} from 'go-fns';assert.equal(api.partialRight,partialRight);assert.equal(api.repeatAsync,repeatAsync);assert.equal(partial((a,b)=>a+b,1)(2),3);assert.deepEqual(['10','20'].map(unary(parseInt)),[10,20]);assert.equal(when(x=>x>0,x=>x*2)(3),6);assert.equal(ifElse(x=>x>0,x=>x,()=>0)(3),3);assert.deepEqual(await repeatAsync(()=>1,2),[1,1]);const d=debounce(x=>x,10);d(4);assert.equal(d.flush(),4);d.cancel();const t=throttle(()=>5,10);assert.equal(t(),5);t.cancel();`
    ],
    { cwd: consumer }
  );
  // Compile actual installed package imports, not workspace-relative declarations.
  for (const [name, text] of [
    [
      'consumer.cts',
      `import api = require('go-fns');import pipe = require('go-fns/src/pipeAsync');const p:Promise<number>=api.pipeAsync(async (s:string)=>s.length)('abc');const direct:typeof api.pipeAsync=pipe;// @ts-expect-error incompatible stages\napi.pipe((n:number)=>n,(s:string)=>s);`
    ],
    [
      'consumer.mts',
      `import api,{pipeAsync,attemptResult,sleep} from 'go-fns';const run=pipeAsync(async (s:string)=>s.trim(),s=>s.length);const result:Promise<number>=run(' hi ');const direct:typeof pipeAsync=api.pipeAsync;const parsed=attemptResult((n:number)=>n*2,2);if(parsed.ok){const n:number=parsed.value;}sleep(0);`
    ]
  ])
    fs.writeFileSync(path.join(consumer, name), text);
  fs.appendFileSync(
    path.join(consumer, 'consumer.cts'),
    `
import debounceDeep = require('go-fns/src/debounce');const d=debounceDeep((q:string)=>q.length,20);const n:number|undefined=d('x');d.cancel();const specialize=api.partialRight((n:number,s:string)=>s+n,'x');const text:string=specialize(2);const repeated:Promise<number[]>=api.repeatAsync(()=>1,2);`
  );
  fs.appendFileSync(
    path.join(consumer, 'consumer.mts'),
    `
import {debounce,throttle,partial,partialRight,unary,when,ifElse,repeatAsync} from 'go-fns';const d=debounce((n:number)=>n*2);const p=partial((a:number,b:number)=>a+b,1);const r:number=p(2);const values:Promise<number[]>=repeatAsync(()=>1,2);const title:string=when((s:string)=>!s,()=>"title")('');const choice:number|string=ifElse((n:number)=>n>0,n=>n,()=>"zero")(2);`
  );
  const typeFixtures = [
    'removed-aliases',
    'additions',
    'cached-and-variadic-results',
    'optional-callbacks',
    'callback-unions',
    'async-predicates',
    'async-completion',
    'callback-inference',
    'pipeline-unions',
    'overloaded-results',
    'receiver-composition',
    'bound-tuple-unions',
    'result'
  ];
  for (const name of typeFixtures) {
    const source = fs
      .readFileSync(path.join(root, 'test/types', name + '.ts'), 'utf8')
      .replace(/'\.\.\/\.\.(?:\/index)?'/g, "'go-fns'")
      .replace(/'\.\.\/\.\.\/src\//g, "'go-fns/src/");
    for (const extension of ['.cts', '.mts']) fs.writeFileSync(path.join(consumer, name + extension), source);
  }
  fs.writeFileSync(
    path.join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        target: 'ES2020',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        esModuleInterop: true,
        lib: ['ES2020'],
        types: []
      },
      files: ['consumer.cts', 'consumer.mts', ...typeFixtures.flatMap((name) => [name + '.cts', name + '.mts'])]
    })
  );
  const typeCompiler = process.env.TYPESCRIPT_COMPILER || require.resolve('typescript/bin/tsc');
  run(process.execPath, [typeCompiler, '-p', path.join(consumer, 'tsconfig.json')], { cwd: consumer });

  const executable = `import api, {pipe, partial, partialRight, repeatAsync, debounce, sleep, result, notAsync, andAsync, orAsync, whenAsync, ifElseAsync, norAsync, xorAsync} from 'go-fns';
import resultDeep = require('go-fns/src/result');
import pipeDeep = require('go-fns/src/pipe');
import notDeep = require('go-fns/src/logic/notAsync');
import andDeep = require('go-fns/src/logic/andAsync');
import orDeep = require('go-fns/src/logic/orAsync');
import whenDeep = require('go-fns/src/whenAsync');
import ifElseDeep = require('go-fns/src/ifElseAsync');
import norDeep = require('go-fns/src/logic/norAsync');
import xorDeep = require('go-fns/src/logic/xorAsync');
async function main() {
    if (api.pipe !== pipe || pipeDeep !== pipe || api.partialRight !== partialRight || api.repeatAsync !== repeatAsync) throw Error('Default/named/deep import identity');
    const evaluated: number = result((a, b) => a + b, 2, 3);
    if (evaluated !== 5 || resultDeep !== result || result(api) !== api) throw Error('Result import behaviour');
    const number: number = api.pipe((value: number) => value + 1)(2);
    if (number !== 3 || Object.keys(api).length !== 34) throw Error('Incomplete default API');
    if (api.notAsync !== notAsync || api.andAsync !== andAsync || api.orAsync !== orAsync ||
        notDeep !== notAsync || andDeep !== andAsync || orDeep !== orAsync) throw Error('Async predicate import identity');
    const negated: boolean = await notAsync(async (value: number) => value > 0)(-1);
    const both: boolean = await api.andAsync((value: number) => value > 0, async (value: number) => value < 10)(2);
    const either: boolean = await orDeep(() => Promise.resolve(false), () => 'yes')();
    if (!negated || !both || !either) throw Error('Async predicate import behaviour');
    if (api.whenAsync !== whenAsync || api.ifElseAsync !== ifElseAsync || api.norAsync !== norAsync || api.xorAsync !== xorAsync ||
        whenDeep !== whenAsync || ifElseDeep !== ifElseAsync || norDeep !== norAsync || xorDeep !== xorAsync) throw Error('Async completion import identity');
    const transformed: number = await whenDeep(async (n: number) => n > 0, (n: number) => n * 2)(3);
    const selected: number | string = await ifElseAsync((n: number) => Promise.resolve(n > 0), (n: number) => n, () => 'no')(-1);
    const neither: boolean = await norDeep(() => Promise.resolve(false))();
    const exactlyOne: boolean = await xorDeep(() => Promise.resolve(true), () => false)();
    if (transformed !== 6 || selected !== 'no' || !neither || !exactlyOne) throw Error('Async completion import behaviour');
    const values: number[] = await repeatAsync(() => 4, 2);
    if (values.join(',') !== '4,4') throw Error('Async import behaviour');
    const scheduled = debounce((value: number) => value, 0); scheduled(9);
    if (scheduled.flush() !== 9) throw Error('Scheduler import behaviour');
    scheduled.cancel(); await sleep(0);
}
main().then(() => console.log(${JSON.stringify(checks.completionMarker)})).catch(error => { setTimeout(() => { throw error; },0); });`;
  for (const extension of ['ts', 'cts', 'mts']) {
    // ESM uses the public default function export from the CommonJS deep module.
    const text =
      extension === 'mts'
        ? executable.replace(/import (\w+) = require\(([^)]+)\);/g, 'import $1 from $2;')
        : executable;
    fs.writeFileSync(path.join(consumer, 'default-import.' + extension), text);
  }
  const shared = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    esModuleInterop: true,
    target: 'ES2017',
    lib: ['ES2020', 'DOM'],
    types: [],
    outDir: 'emitted'
  };
  for (const [mode, module, moduleResolution, files] of [
    ['classic', 'CommonJS', 'Node', ['default-import.ts']],
    ['nodenext', 'NodeNext', 'NodeNext', ['default-import.cts', 'default-import.mts']]
  ]) {
    const config = path.join(consumer, 'tsconfig.' + mode + '.json');
    fs.writeFileSync(config, JSON.stringify({ compilerOptions: { ...shared, module, moduleResolution }, files }));
    run(process.execPath, [typeCompiler, '-p', config], { cwd: consumer });
  }
  for (const mode of ['classic', 'nodenext']) {
    const esmMode = mode === 'nodenext';
    const lines = ["import api from 'go-fns';"];
    for (const name of functionNames) {
      lines.push(
        esmMode
          ? `import ${name}Default, { ${name} as ${name}Named } from 'go-fns/${name}';`
          : `import ${name}Default from 'go-fns/${name}';`
      );
      lines.push(`const ${name}Typed: typeof api.${name} = ${name}Default;`);
      lines.push(
        `if (${name}Typed !== api.${name}${esmMode ? ` || ${name}Named !== api.${name}` : ''}) throw Error('${name} identity');`
      );
    }
    lines.push("const transformed: number = applyIfDefault('42', true, value => Number(value));");
    lines.push('const resolved: number = resultDefault((value: number) => value + 1, 2);');
    lines.push('const piped: number = pipeDefault((value: number) => value + 1)(2);');
    lines.push('// @ts-expect-error Direct function imports preserve callback input validation.');
    lines.push("applyIfDefault('42', true, (value: number) => value);");
    lines.push(`console.log(${JSON.stringify(checks.completionMarker)});`);
    const source = 'function-subpaths.' + (esmMode ? 'mts' : 'ts');
    const config = path.join(consumer, 'subpaths-' + mode + '.json');
    fs.writeFileSync(path.join(consumer, source), lines.join('\n'));
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          ...shared,
          module: esmMode ? 'NodeNext' : 'CommonJS',
          moduleResolution: esmMode ? 'NodeNext' : 'Node',
          skipLibCheck: false,
          verbatimModuleSyntax: esmMode
        },
        files: [source]
      })
    );
    run(process.execPath, [typeCompiler, '-p', config], { cwd: consumer });
  }
  const esm = `import api,{${expected.join(',')}} from 'go-fns';
import assert from 'assert';
const named={${expected.join(',')}};
assert.deepStrictEqual(Object.keys(named).sort(),Object.keys(api).sort());
for (const key of Object.keys(named)) assert.strictEqual(api[key],named[key]);
assert.strictEqual(api.pipe(x=>x+1)(2),3);
assert.strictEqual(api.pipeAsync,pipeAsync);
assert.strictEqual(api.attemptResult,attemptResult);
assert.strictEqual(api.tapAsync,tapAsync);
assert.strictEqual(api.partialRight,partialRight);
assert.strictEqual(api.repeatAsync,repeatAsync);
assert.strictEqual(api.notAsync,notAsync);
assert.strictEqual(api.andAsync,andAsync);
assert.strictEqual(api.orAsync,orAsync);
assert.strictEqual(api.whenAsync,whenAsync);
assert.strictEqual(api.ifElseAsync,ifElseAsync);
assert.strictEqual(api.norAsync,norAsync);
assert.strictEqual(api.xorAsync,xorAsync);
async function checkPredicates() {
  assert.strictEqual(await whenAsync(async () => true,x => x + 1)(2),3);
  assert.strictEqual(await ifElseAsync(async () => false,() => 'yes',() => 'no')(),'no');
  assert.strictEqual(await norAsync(async () => false)(),true);
  assert.strictEqual(await xorAsync(async () => true,() => false)(),true);
  assert.strictEqual(await notAsync(() => Promise.resolve(false))(),true);
  assert.strictEqual(await andAsync(() => true,async () => true)(),true);
  assert.strictEqual(await orAsync(() => false,async () => true)(),true);
}
checkPredicates().then(() => console.log(${JSON.stringify(checks.completionMarker)})).catch(error => { setTimeout(() => { throw error; },0); });`;
  fs.writeFileSync(path.join(consumer, 'imports.mjs'), esm);
  for (const runtime of runtimes) {
    for (const file of ['default-import.js', 'default-import.cjs', 'function-subpaths.js'])
      checks.completion(runConsumer(runtime, [path.join(consumer, 'emitted', file)], { cwd: consumer }));
    const version = runConsumer(runtime, ['-p', 'process.versions.node']);
    if (require('./runtime-support')(version)) {
      checks.completion(runConsumer(runtime, [path.join(consumer, 'imports.mjs')], { cwd: consumer }));
      checks.completion(runConsumer(runtime, [path.join(consumer, 'emitted/default-import.mjs')], { cwd: consumer }));
      checks.completion(
        runConsumer(runtime, [path.join(consumer, 'emitted/function-subpaths.mjs')], { cwd: consumer })
      );
    }
  }
  if (options.browser) {
    console.log(run('python', [path.join(root, 'scripts/test-browser-driver.py')]));
    console.log(
      run('python', [path.join(root, 'scripts/test-browser.py'), '--package-root', installed], { timeout: 210000 })
    );
  }
  console.log(
    JSON.stringify(
      {
        package: pkg.name,
        version: pkg.version,
        tarball,
        sha256: digest,
        runtimes: versions,
        files: files.length,
        sourceModules: sourceFiles.length + 1,
        sourceFilesMatched,
        tests: count,
        status: 'passed',
        importModes: ['CommonJS', 'ESM named', 'ESM default'],
        typescriptConsumer: 'passed',
        archivedFilesExcluded: true
      },
      null,
      2
    )
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
