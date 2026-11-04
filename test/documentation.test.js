'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { wrap } = require('node:module');
const path = require('node:path');
const { Script } = require('node:vm');
const ts = require('typescript');
const api = require('./helpers/api.js');
const entryDirectory = process.env.GO_FNS_TEST_ENTRY
  ? path.dirname(path.resolve(process.env.GO_FNS_TEST_ENTRY))
  : path.resolve(__dirname, '..');
const docsRoot = path.basename(entryDirectory) === 'dist' ? path.dirname(entryDirectory) : entryDirectory;
const readme = fs.readFileSync(path.join(docsRoot, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const reference = fs.readFileSync(path.join(docsRoot, 'docs/API.md'), 'utf8').replace(/\r\n/g, '\n');
const documentation = reference.split('## API summary\n')[1].split('## Behaviour\n')[0];
function parseReferenceEntries(text) {
  const entries = [...text.matchAll(/^### `([^`]+)`\n([^]*?)(?=^#{1,3} |$(?![^]))/gm)].map((match) => [
    match[1].replace(/\([^)]*\)$/, ''),
    match[1] + '\n' + match[2]
  ]);
  const names = new Set();
  for (const [name] of entries) {
    assert.ok(!names.has(name), 'Duplicate detailed API entry: ' + name);
    names.add(name);
  }
  return entries;
}
const referenceEntries = parseReferenceEntries(documentation);
const references = new Map(referenceEntries);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function assertExamples(example) {
  const source = ts.createSourceFile('readme-example.js', example, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const replacements = [];
  function visit(node) {
    if (ts.isExpressionStatement(node)) {
      // A result belongs to the preceding expression, on this or the next line.
      const result = /^[ \t]*(?:\n[ \t]*)?\/\/ => ([^\n]+)/.exec(example.slice(node.end));
      if (result) {
        let expression = node.expression;
        if (
          ts.isCallExpression(expression) &&
          ts.isPropertyAccessExpression(expression.expression) &&
          expression.expression.expression.getText(source) === 'console' &&
          ['log', 'error', 'debug'].includes(expression.expression.name.text)
        ) {
          assert.equal(expression.arguments.length, 1, 'An annotated console call must print one value.');
          expression = expression.arguments[0];
        }
        const value = expression.getText(source);
        const expected = result[1].trim();
        const throws = /^throws ([A-Za-z]*Error)$/.exec(expected);
        const code = throws
          ? `__assert.throws(() => (${value}), ${throws[1]});`
          : `__assert.deepStrictEqual((${value}), (${expected}));`;
        replacements.push({ start: node.getStart(source), end: node.end, code });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const annotationCount = [...example.matchAll(/\/\/ => /g)].length;
  assert.equal(
    replacements.length,
    annotationCount,
    'Every result annotation must follow an expression statement and contain a JavaScript expected value or throws ErrorType.'
  );
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    example = example.slice(0, replacement.start) + replacement.code + example.slice(replacement.end);
  }
  return example;
}

async function runExample(example) {
  example = example
    .replace(/import (\w+) from 'go-fns';/g, "const $1 = require('go-fns');")
    .replace(/import \{([^}]+)\} from 'go-fns';/g, "const {$1} = require('go-fns');")
    // Wait for assertions in standalone async CommonJS examples.
    .replace(/\nmain\(\);\s*$/, '\nreturn main();');
  const run = new AsyncFunction('require', 'console', '__assert', '__api', assertExamples(example));
  const quietConsole = { log() {}, error() {}, debug() {} };
  await run(
    function (name) {
      if (name === 'assert') return assert;
      if (name === 'go-fns') return api;
      assert.match(name, /^go-fns\/(?:src\/(?:logic\/)?)?[a-zA-Z]+(?:\.js)?$/);
      const key = path.basename(name, '.js');
      assert.ok(Object.prototype.hasOwnProperty.call(api, key));
      return api[key];
    },
    quietConsole,
    assert,
    api
  );
}

function summaryRows() {
  const summary = documentation.split('\n## ')[0];
  return [...summary.matchAll(/^\| \[`([^`]+)`\]\(#([^)]*)\) \| (.+) \| (.+) \|$/gm)];
}
function operationRows() {
  return summaryRows().filter((row) => !row[1].split('(')[0].includes('.'));
}
function publicFunction(name) {
  return name.split('.').reduce((value, key) => value && value[key], api);
}
function summaryLinks() {
  return operationRows().flatMap((row) => [
    { name: row[1].split('(')[0], anchor: row[2] },
    ...[...row[3].matchAll(/\[`([\w.]+)`\]\(#([\w-]+)\)/g)].map((match) => ({
      name: match[1],
      anchor: match[2]
    }))
  ]);
}
function signatureAnchor(signature) {
  return signature
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

suite('documentation examples and public API inventory', function () {
  test('the reference documents every export exactly once', function () {
    const headings = [...documentation.matchAll(/^### `([a-zA-Z]+)\((?!\)\.)[^\n]*\)`$/gm)].map((match) => match[1]);
    assert.deepEqual(headings.sort(), Object.keys(api).sort());
  });
  test('API summary links every root export and scheduler method with a return contract', function () {
    const rows = summaryRows();
    const roots = operationRows();
    const namedLinks = summaryLinks().filter((link) => !link.name.includes('.'));
    assert.deepEqual(namedLinks.map((link) => link.name).sort(), Object.keys(api).sort());
    const operations = [];
    for (const row of roots) {
      const fn = publicFunction(row[1].split('(')[0]);
      const target = Object.keys(api).find((name) => api[name] === fn);
      assert.ok(target, 'Summary operation needs a public reference target: ' + row[1]);
      operations.push(target);
      const signature = references.get(target).split('\n')[0];
      assert.equal(row[1].slice(row[1].indexOf('(')), signature.slice(signature.indexOf('(')));
      assert.equal(row[2], signatureAnchor(signature));
      assert.match(row[4], /^\*\*`[^`]+`\*\*/);
      assert.ok(row[4].includes('<br><br>'), 'Each operation needs a self-contained return explanation.');
    }
    assert.deepEqual(operations.sort(), Object.keys(api).sort(), 'Each distinct operation has one summary row.');
    for (const link of namedLinks) {
      assert.equal(link.anchor, signatureAnchor(references.get(link.name).split('\n')[0]));
    }
    for (const name of ['debounce', 'throttle']) {
      const wrapper = api[name](function () {});
      const methods = Object.keys(wrapper)
        .filter((key) => typeof wrapper[key] === 'function')
        .sort();
      const prefix = name + 'd.';
      const methodRows = rows.filter((row) => row[1].startsWith(prefix));
      assert.deepEqual(methodRows.map((row) => row[1].slice(prefix.length, -2)).sort(), methods);
      for (const row of methodRows) {
        const signature = name + '().' + row[1].slice(prefix.length);
        assert.equal(row[2], signatureAnchor(signature));
      }
      wrapper.cancel();
    }
  });
  test('summary uses standalone names without duplicate attached variants', function () {
    const links = summaryLinks().filter((link) => link.name.includes('.'));
    assert.deepEqual(links, []);
    for (const fn of Object.values(api)) {
      const attached = Object.getOwnPropertyNames(fn).filter(
        (property) => typeof Object.getOwnPropertyDescriptor(fn, property).value === 'function'
      );
      assert.deepEqual(attached, []);
    }
  });
  test('each scheduler documents all attached methods beside its own reference', function () {
    for (const name of ['debounce', 'throttle']) {
      const wrapper = api[name](function () {});
      const methods = Object.keys(wrapper)
        .filter((key) => typeof wrapper[key] === 'function')
        .sort();
      const entries = referenceEntries.filter(([key]) => key.startsWith(name + '().')).map(([, entry]) => entry);
      assert.deepEqual(entries.map((entry) => entry.split('().')[1].split('(')[0]).sort(), methods, name);
      for (const entry of entries) {
        assert.match(entry, /\*\*Parameters\*\*\n\nNo parameters\./);
        assert.match(entry, /\*\*Returns:\*\* `[^`]+` — .+/);
        assert.match(entry, /```javascript\n/);
      }
      wrapper.cancel();
    }
  });
  test('reference inventory rejects duplicate scheduler method entries', function () {
    for (const name of ['debounce', 'throttle']) {
      const duplicate = documentation + '\n### `' + name + '().cancel()`\n\nDuplicate entry.\n';
      assert.throws(() => parseReferenceEntries(duplicate), /Duplicate detailed API entry/);
    }
  });
  test('version shown in README agrees with package metadata', function () {
    assert.ok(readme.includes('**Version:** [' + require('../package.json').version + '](CHANGELOG.md)'));
  });
  test('example checks reject incorrect results and exception claims', async function () {
    await assert.rejects(runExample('1 + 1; // => 3'), assert.AssertionError);
    await assert.rejects(runExample('console.log([1, 2]); // => [1, 3]'), assert.AssertionError);
    await assert.rejects(runExample('Math.floor(1.5); // => throws TypeError'), assert.AssertionError);
    await runExample('JSON.parse("invalid"); // => throws SyntaxError');
    await runExample('await Promise.resolve(3);\n// => 3');
    assert.throws(() => assertExamples('const result = 2; // => 2'), assert.AssertionError);
  });
  for (const [name, section] of references) {
    const examples = [...section.matchAll(/```javascript\n([\s\S]*?)```/g)].map((match) => match[1]);
    test(`${name} includes a runnable JavaScript example and asserts annotated results`, async function () {
      assert.ok(examples.length > 0);
      for (const example of examples) await runExample(example);
    });
  }
});

test('documentation TypeScript snippets compile against the selected declarations', function () {
  require('../scripts/documentation-types')(docsRoot);
});
for (const [name, text] of Object.entries({ 'README.md': readme, 'docs/API.md': reference })) {
  for (const [index, block] of [...text.matchAll(/```(javascript|html)\n([\s\S]*?)\n```/g)].entries()) {
    const example =
      block[1] === 'html'
        ? [...block[2].matchAll(/<script>([\s\S]*?)<\/script>/g)]
            .map((match) => match[1])
            .join('\n')
            .replace(/\bFunctions\b/g, '__api')
        : block[2];
    test(name + ' example ' + (index + 1) + ' executes its annotated results', async function () {
      if (block[1] === 'javascript' && /\brequire\(['"]go-fns/.test(example)) {
        assert.doesNotThrow(() => new Script(wrap(example)), 'Example must parse as CommonJS before instrumentation.');
      }
      await runExample(example);
    });
  }
}

for (const name of Object.keys(api)) {
  test(name + ' source JSDoc example executes its documented results', async function () {
    const directory = [
      'and',
      'andAsync',
      'or',
      'orAsync',
      'xor',
      'xorAsync',
      'nor',
      'norAsync',
      'not',
      'notAsync'
    ].includes(name)
      ? 'src/logic'
      : 'src';
    const source = fs.readFileSync(path.join(docsRoot, directory, name + '.js'), 'utf8');
    const comment = source.match(/\/\*\*[\s\S]*?\*\//)[0];
    const example = comment.split('@example\n')[1]?.split(/\n \* @/)[0];
    assert.ok(example, name + ': missing executable source example');
    await runExample('const { ' + name + ' } = require("go-fns");\n' + example.replace(/^ \* ?/gm, ''));
  });
}
