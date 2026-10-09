'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
    .replace(/import \{([^}]+)\} from 'go-fns';/g, "const {$1} = require('go-fns');");
  const run = new AsyncFunction('require', 'console', '__assert', '__api', assertExamples(example));
  const quietConsole = { log() {}, error() {}, debug() {} };
  await run(
    function (name) {
      if (name === 'go-fns') return api;
      assert.match(name, /^go-fns\/src\/(?:logic\/)?[a-zA-Z]+(?:\.js)?$/);
      const key = path.basename(name, '.js');
      assert.ok(Object.prototype.hasOwnProperty.call(api, key));
      return api[key];
    },
    quietConsole,
    assert,
    api
  );
}

suite('documentation examples and public API inventory', function () {
  test('the reference documents every export exactly once', function () {
    const headings = [...documentation.matchAll(/^### `([a-zA-Z]+)\((?!\)\.)[^\n]*\)`$/gm)].map((match) => match[1]);
    assert.deepEqual(headings.sort(), Object.keys(api).sort());
  });
  test('API summary links every root export and scheduler method with a return contract', function () {
    const summary = documentation.split('\n## ')[0];
    const rows = [...summary.matchAll(/^\| \[`([^`]+)`\]\(#([^)]*)\) \| (.+) \| (.+) \|$/gm)];
    const roots = rows.filter((row) => /^[A-Za-z]+\(/.test(row[1]) && !row[1].includes('().'));
    assert.deepEqual(roots.map((row) => row[1].split('(')[0]).sort(), Object.keys(api).sort());
    for (const row of roots) {
      const signature = references.get(row[1].split('(')[0]).split('\n')[0];
      assert.equal(row[1], signature);
      assert.equal(
        row[2],
        signature
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s/g, '-')
      );
    }
    for (const name of ['debounce', 'throttle']) {
      const wrapper = api[name](function () {});
      const methods = Object.keys(wrapper)
        .filter((key) => typeof wrapper[key] === 'function')
        .sort();
      const methodRows = rows.filter((row) => row[1].startsWith(name + '().'));
      assert.deepEqual(methodRows.map((row) => row[1].slice(name.length + 3, -2)).sort(), methods);
      wrapper.cancel();
    }
  });
  test('attached aliases link to the reference for the exact exported function', function () {
    const summary = documentation.split('\n## ')[0];
    const rows = [...summary.matchAll(/^\| \[`([\w.]+)\([^`]*`\]\(#([\w-]+)\) \| .+ Alias of `(\w+)`\. \| (.+) \|$/gm)];
    const actual = [];
    for (const [name, fn] of Object.entries(api)) {
      for (const property of Object.getOwnPropertyNames(fn)) {
        const descriptor = Object.getOwnPropertyDescriptor(fn, property);
        if (typeof descriptor.value !== 'function') continue;
        const target = Object.keys(api).find((key) => api[key] === descriptor.value);
        assert.ok(target, `${name}.${property} needs a public reference target.`);
        actual.push(`${name}.${property}`);
        const row = rows.find((row) => row[1] === `${name}.${property}`);
        assert.ok(row, `Missing reference for ${name}.${property}.`);
        assert.equal(row[3], target);
        const signature = references.get(target).split('\n')[0];
        assert.equal(
          row[2],
          signature
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s_-]/gu, '')
            .replace(/\s/g, '-')
        );
        assert.ok(references.has(target));
      }
    }
    assert.deepEqual(rows.map((row) => row[1]).sort(), actual.sort());
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
        assert.match(entry, /\*\*Parameters:\*\* None\./);
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
