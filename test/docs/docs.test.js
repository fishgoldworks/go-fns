'use strict';

const { test } = require('node:test');

test('shared README conventions apply to the template and generated README', () => {
  const check = require('../../scripts/lib/check-library-readme.cjs');

  check.checkRepository(path.resolve(__dirname, '../..'));
  for (const file of ['scripts/README.template.md', 'README.md']) {
    const markdown = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');

    assert.throws(
      () => check(markdown.replace('Licensed under the [MIT licence](LICENSE.md).', '[MIT](LICENSE.md).'), file),
      /Licence sentence/
    );
    if (file === 'README.md') {
      assert.throws(
        () => check(markdown.replace('- **Licence:** [MIT]', '- **Licence:** [{{LICENSE}}]'), file),
        /project information/
      );
    }
  }
});
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { render, generate } = require('../../scripts/docs.js');
const pkg = { name: 'fixture', version: '2.3.4', license: 'MIT', engines: { node: '>=18' } };

test('renders metadata and heading links without changing authored examples', () => {
  const template =
    '# Fixture\n{{VERSION}} {{LICENSE}}\n{{TOC}}\n## Hello world\n```js\n## not a heading\nconsole.log(123);\n```\n## Hello world\n';
  const output = render(template, pkg);

  assert.match(output, /2\.3\.4 MIT/);
  assert.match(output, /\[Hello world\]\(#hello-world\)/);
  assert.match(output, /\[Hello world\]\(#hello-world-1\)/);
  assert.ok(output.includes('## not a heading\nconsole.log(123);'));
  assert.ok(!output.includes('[not a heading]'));
});

test('rejects unresolved template metadata', () => {
  assert.throws(() => render('{{UNKNOWN}}', pkg), /Unknown documentation token/);
});

test('generation is repeatable and check rejects drift without writing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-command-'));

  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(
      path.join(root, 'scripts/API.template.md'),
      '# Fixture API\n{{VERSION}}\n## Contents\n{{TOC}}\n## API summary\n\n**Run tasks**\n\n| API | Description | Returns |\n| --- | --- | --- |\n| [`run()`](#run) | Execute. | A value |\n\n**Stop tasks**\n\n| API | Description | Returns |\n| --- | --- | --- |\n| [`stop()`](#stop) | Stop. | A value |\n\n<!-- summary-notes:start -->\nThe result belongs to [`run`](#run).\n<!-- summary-notes:end -->\n\n### `run()`\nA result.\n\n### `stop()`\nA result.\n'
    );
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(
      path.join(root, 'scripts/README.template.md'),
      '# Fixture\n{{VERSION}}\n{{TOC}}\n## Usage\ntext\n## API summary\n{{API_SUMMARY}}\n'
    );
    generate({ root });
    const before = fs.readFileSync(path.join(root, 'README.md'));
    const overview = before.toString();

    assert.match(overview, /- \[Usage\]\(#usage\)\n- \[API summary\]\(#api-summary\)\n## Usage/);
    assert.match(
      overview,
      /## API summary\n\[Run tasks\]\(#run-tasks\) · \[Stop tasks\]\(#stop-tasks\)\n\n### Run tasks\n/
    );
    assert.ok(overview.includes('### Stop tasks\n\n| API'));
    assert.ok(overview.includes('[`run()`](docs/API.md#run)'));
    assert.ok(overview.endsWith('The result belongs to [`run`](docs/API.md#run).\n'));
    generate({ root, check: true });
    generate({ root });
    assert.deepEqual(fs.readFileSync(path.join(root, 'README.md')), before);
    const reference = fs.readFileSync(path.join(root, 'docs/API.md'));

    fs.appendFileSync(path.join(root, 'docs/API.md'), '\nstale');
    assert.throws(() => generate({ root, check: true }), /docs\/API.md is stale/);
    assert.equal(fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8'), reference.toString() + '\nstale');
    fs.writeFileSync(path.join(root, 'docs/API.md'), reference);
    fs.appendFileSync(path.join(root, 'README.md'), '\nstale');
    const stale = fs.readFileSync(path.join(root, 'README.md'));

    assert.throws(() => generate({ root, check: true }), /README.md is stale/);
    assert.deepEqual(fs.readFileSync(path.join(root, 'README.md')), stale);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ ...pkg, version: '9.0.0' }));
    generate({ root });
    assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /9\.0\.0/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('checks CRLF checkouts without rewriting them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-crlf-'));

  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(
      path.join(root, 'scripts/API.template.md'),
      '# Fixture API\n{{VERSION}}\n## Contents\n{{TOC}}\n## API summary\n| API | Description | Returns |\n| --- | --- | --- |\n| [`run()`](#run) | Execute. | A value |\n\n### `run()`\nA result.\n'
    );
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(root, 'scripts/README.template.md'), '# Fixture\r\n{{VERSION}}\r\n{{API_SUMMARY}}\r\n');
    generate({ root });
    const reference = fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8').replace(/\n/g, '\r\n');

    fs.writeFileSync(path.join(root, 'docs/API.md'), reference);
    const text = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\n/g, '\r\n');

    fs.writeFileSync(path.join(root, 'README.md'), text);
    generate({ root, check: true });
    assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), text);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ignores tilde and nested fences and counts anchors at every heading level', () => {
  const output = render(
    '# Shared\n{{TOC}}\n~~~~js\n## Hidden\n```\n## Hidden too\n~~~~\n## Shared\n### Shared\n## Shared\n',
    pkg
  );

  assert.ok(!output.includes('[Hidden]'));
  assert.ok(!output.includes('[Hidden too]'));
  assert.ok(output.includes('[Shared](#shared-1)'));
  assert.ok(output.includes('[Shared](#shared-3)'));
});

test('Contents includes API summary without listing every function signature', () => {
  const output = render('# Fixture\n{{TOC}}\n## API summary\n### `run(value)`\nA result.\n## Development\n', pkg);

  assert.ok(output.includes('- [API summary](#api-summary)\n- [Development](#development)'));
  assert.ok(!output.includes('[run(value)]'));
});

test('production README follows the shared schema with complete navigation and valid signature anchors', () => {
  const root = path.resolve(__dirname, '../..');

  require('../../scripts/documentation-contract')(
    fs.readFileSync(path.join(root, 'README.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8'),
    root
  );
});

test('Common tasks navigation follows recipe order and identifies the linked APIs', () => {
  const root = path.resolve(__dirname, '../..');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const reference = fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8');
  const check = require('../../scripts/documentation-contract');
  const table = readme.split('## Common tasks\n')[1].split('\n### ')[0];
  const rows = table.split('\n').filter((line) => line.startsWith('| ['));
  const taskAnchors = rows.map((line) => /^\| \[[^\]]+\]\(#([^)]+)\)/.exec(line)[1]);

  check(readme, reference, root);
  assert.throws(
    () => check(readme.replace('](#' + taskAnchors[0] + ') |', '](#' + taskAnchors[1] + ') |'), reference, root),
    /Common tasks navigation.*recipe order/
  );
  assert.throws(
    () => check(readme.replace(rows[0] + '\n', ''), reference, root),
    /Common tasks navigation.*recipe count/
  );

  const apis = [...rows[0].matchAll(/\[`([^`]+)`\]\(docs\/API\.md#([^)]+)\)/g)];
  const wrongEntry = '[`' + apis[0][1] + '`](docs/API.md#' + apis[1][2] + ')';

  assert.throws(
    () => check(readme.replace(apis[0][0], wrongEntry), reference, root),
    /Common tasks navigation.*API entry/
  );
});

test('overview Contents links only to sections within the current document', () => {
  const output = render('# Fixture\n{{TOC}}\n## API summary\n## Behaviour\n', pkg);

  assert.ok(output.includes('- [API summary](#api-summary)\n- [Behaviour](#behaviour)'));
  assert.ok(!output.includes('](docs/API.md)'));
});

test('documentation checks reject broken cross-document fragments', () => {
  const root = path.resolve(__dirname, '../..');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const reference = fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8');

  assert.throws(
    () =>
      require('../../scripts/documentation-contract')(
        readme.replace(/docs\/API.md#([\w-]+)/, 'docs/API.md#missing-fragment'),
        reference,
        root
      ),
    /Broken documentation fragment/
  );
});

for (const target of ['../missing-guide.md', '../CONTRIBUTING.md#missing-browser-heading']) {
  test('documentation checks inspect auxiliary guide links: ' + target, () => {
    const project = path.resolve(__dirname, '../..');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-fns-guide-links-'));
    const readme = fs.readFileSync(path.join(project, 'README.md'), 'utf8');
    const reference = fs.readFileSync(path.join(project, 'docs/API.md'), 'utf8');
    const check = require('../../scripts/documentation-contract');

    try {
      fs.mkdirSync(path.join(root, 'docs'));
      for (const file of ['CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE.md']) {
        fs.copyFileSync(path.join(project, file), path.join(root, file));
      }

      const guide = path.join(root, 'docs/performance.md');

      fs.writeFileSync(guide, '[Browser tooling](../CONTRIBUTING.md#browser-tooling)\n');
      check(readme, reference, root);
      fs.writeFileSync(guide, '[Browser tooling](' + target + ')\n');
      assert.throws(
        () => check(readme, reference, root),
        /(?:Missing documentation link|Broken documentation fragment).*docs\/performance\.md/
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('public declaration tooltips explain calls and link to existing reference entries', () => {
  const ts = require('typescript');
  const root = path.resolve(__dirname, '../..');
  const program = ts.createProgram([path.join(root, 'index.d.ts')], { noEmit: true });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(path.join(root, 'index.d.ts'));
  const reference = fs.readFileSync(path.join(root, 'docs/API.md'), 'utf8');
  const anchors = new Set(
    [...reference.matchAll(/^#{1,6} (.+)$/gm)].map((match) =>
      match[1]
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-')
    )
  );
  const api = require('../../index.js');
  const seen = new Set();
  let signatures = 0;

  function checkLink(tags, name) {
    const see = tags.find((tag) => tag.name === 'see');
    const text = ts.displayPartsToString(see?.text || []);
    const fragment = /docs\/API\.md#([\w-]+)/.exec(text)?.[1];

    assert.ok(anchors.has(fragment), name + ': tooltip needs a working reference link');
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node)) {
      const signature = checker.getSignatureFromDeclaration(node);
      const name = node.name.text;

      assert.ok(
        ts.displayPartsToString(signature.getDocumentationComment(checker)).length > 30,
        name + ': missing useful call description'
      );
      const tags = signature.getJsDocTags();

      assert.ok(
        tags.some((tag) => tag.name === 'returns' && ts.displayPartsToString(tag.text || []).length > 20),
        name + ': missing return meaning'
      );
      checkLink(tags, name);
      for (const parameter of signature.parameters) {
        assert.ok(
          ts.displayPartsToString(parameter.getDocumentationComment(checker)).length > 10,
          name + ': missing parameter description for ' + parameter.name
        );
      }

      seen.add(name);
      signatures++;
    }

    if (ts.isInterfaceDeclaration(node) && node.name.text === 'ScheduledFunction') {
      for (const member of node.members)
        if (ts.isMethodSignature(member)) {
          const signature = checker.getSignatureFromDeclaration(member);

          assert.ok(
            ts.displayPartsToString(signature.getDocumentationComment(checker)).length > 30,
            member.name.text + ': missing method description'
          );
          assert.ok(
            signature.getJsDocTags().some((tag) => tag.name === 'returns'),
            member.name.text + ': missing return meaning'
          );
          checkLink(signature.getJsDocTags(), member.name.text);
        }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  assert.deepEqual([...seen].sort(), Object.keys(api).sort());
  assert.ok(signatures >= seen.size);
});

test('maintainer guide consumer-format examples match the runtime selector', () => {
  const guide = fs.readFileSync(path.resolve(__dirname, '../../CONTRIBUTING.md'), 'utf8');
  const section = guide
    .split('<!-- consumer-format-examples:start -->')[1]
    ?.split('<!-- consumer-format-examples:end -->')[0];

  assert.ok(section, 'The guide needs executable consumer-format selection examples.');
  const rows = [...section.matchAll(/^\| `(\d+\.\d+\.\d+)` \| (CommonJS(?: and native ESM)?) \|$/gm)];

  assert.deepEqual(
    rows.map((row) => row[1]),
    ['8.0.0', '12.19.0', '12.20.0', '13.14.0', '14.12.0', '14.13.0', '22.16.0']
  );
  const supportsNativeEsm = require('../../scripts/runtime-support');

  for (const [, version, formats] of rows) {
    assert.equal(formats, supportsNativeEsm(version) ? 'CommonJS and native ESM' : 'CommonJS', version);
  }
});
