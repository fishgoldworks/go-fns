'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function headings(text) {
  const entries = [],
    counts = new Map();
  let fence = null;

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);

    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }

    const heading = !fence && /^(#{1,6}) (.+)$/.exec(line);

    if (!heading) continue;
    const slug = heading[2]
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = counts.get(slug) || 0;

    counts.set(slug, count + 1);
    entries.push({ depth: heading[1].length, title: heading[2], anchor: slug + (count ? '-' + count : '') });
  }

  return entries;
}

function checkLinks(name, text, documents, root) {
  const anchors = new Set(headings(text).map((heading) => heading.anchor));

  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:https?:|mailto:)/.test(target)) continue;
    const [file, fragment] = target.split('#');

    if (!file) {
      assert.ok(anchors.has(fragment), 'Broken ' + name + ' anchor: ' + target);
      continue;
    }

    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(name), file));
    const targetText =
      documents[relative] ||
      (root && fs.existsSync(path.join(root, relative)) && fs.readFileSync(path.join(root, relative), 'utf8'));

    assert.ok(
      targetText !== undefined && targetText !== false,
      'Missing documentation link: ' + name + ' -> ' + target
    );
    if (fragment)
      assert.ok(
        headings(targetText).some((heading) => heading.anchor === fragment),
        'Broken documentation fragment: ' + name + ' -> ' + target
      );
  }
}

function checkTaskNavigation(readme, reference) {
  const section = readme.split('## Common tasks\n')[1].split('\n## ')[0];
  const navigation = section
    .split('\n### ')[0]
    .trim()
    .replace(/^<!-- prettier-ignore -->\n/, '');
  const lines = navigation.split('\n');

  assert.equal(lines[0], '| Task | API |', 'Common tasks navigation starts with Task / API columns.');
  assert.match(lines[1], /^\| -+ \| -+ \|$/, 'Common tasks navigation has two columns.');

  const entries = headings(readme);
  const start = entries.findIndex((heading) => heading.depth === 2 && heading.title === 'Common tasks');
  const end = entries.findIndex((heading, index) => index > start && heading.depth === 2);
  const recipes = entries.slice(start + 1, end).filter((heading) => heading.depth === 3);
  const rows = lines.slice(2);
  const apiAnchors = new Map(
    headings(reference)
      .filter((heading) => heading.depth === 3 && /^`[^`(]+\(/.test(heading.title))
      .map((heading) => [/^`([^`(]+)\(/.exec(heading.title)[1], heading.anchor])
  );

  assert.equal(rows.length, recipes.length, 'Common tasks navigation matches the recipe count.');
  rows.forEach((row, index) => {
    const cells = /^\| \[([^\]]+)\]\(#([^)]+)\) \| (.+) \|$/.exec(row);

    assert.ok(cells, 'Common tasks navigation uses linked task labels and API names.');
    assert.equal(cells[2], recipes[index].anchor, 'Common tasks navigation follows recipe order.');
    for (const entry of cells[3].split(', ')) {
      const api = /^\[`([^`]+)`\]\(docs\/API\.md#([^)]+)\)$/.exec(entry);

      assert.ok(api, 'Common tasks navigation links each API entry directly.');
      assert.equal(api[2], apiAnchors.get(api[1]), 'Common tasks navigation identifies the correct API entry.');
    }
  });
}

module.exports = function checkDocumentation(readme, reference, root) {
  const documents = { 'README.md': readme.replace(/\r\n/g, '\n'), 'docs/API.md': reference.replace(/\r\n/g, '\n') };
  const overviewHeadings = headings(readme);

  assert.deepEqual(
    overviewHeadings.filter((heading) => heading.depth === 2).map((heading) => heading.title),
    [
      'Contents',
      'Installation',
      'Usage',
      'Common tasks',
      'API summary',
      'Behaviour',
      'TypeScript',
      'Performance',
      'Migration',
      'Development',
      'Further reading',
      'Licence'
    ]
  );
  const contents = documents['README.md'].split('## Contents\n')[1].split('## Installation\n')[0];

  assert.equal(contents.split('- [Common tasks](#common-tasks)').length, 2, 'Contents lists Common tasks once.');
  assert.ok(contents.includes('- [API summary](#api-summary)'));
  for (const [, target] of contents.matchAll(/\]\(([^)]+)\)/g)) {
    assert.ok(target.startsWith('#'), 'Contents must link within the current document: ' + target);
  }

  assert.ok(readme.includes('**[View full API documentation](docs/API.md)**'));
  assert.ok(
    readme.includes(
      'See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.'
    )
  );
  assert.ok(!overviewHeadings.some((heading) => heading.depth > 2 && heading.title === 'API summary'));
  for (const heading of overviewHeadings.filter((heading) => heading.depth === 2 && heading.title !== 'Contents')) {
    assert.ok(contents.includes('[' + heading.title + '](#' + heading.anchor + ')'), 'Contents omits ' + heading.title);
  }

  const summary = documents['README.md'].split('## API summary\n')[1].split('\n## ')[0];

  assert.ok(summary.includes('| API | Description | Returns |'));
  for (const row of summary.split('\n').filter((line) => line.startsWith('| [`'))) {
    assert.match(
      row,
      /^\| \[`[^`]+`\]\(docs\/API\.md#[^)]+\) \| .+ \| .+ \|$/,
      'Summary rows link directly to API signatures.'
    );
  }

  for (const [name, text] of Object.entries(documents)) {
    const ownHeadings = headings(text);
    const toc = text.split('## Contents\n')[1].split('\n## ')[0];

    for (const heading of ownHeadings.filter((heading) => heading.depth === 2 && heading.title !== 'Contents')) {
      assert.ok(
        toc.includes('[' + heading.title + '](#' + heading.anchor + ')'),
        name + ' Contents omits ' + heading.title
      );
    }

    checkLinks(name, text, documents, root);

    for (const table of text.matchAll(
      /\| Parameter \| Type \|(?: Default \|)? Description \|\n\|[^\n]+\n((?:\|[^\n]+\n)+)/g
    )) {
      assert.ok(
        !table[0].includes('| Default |') ||
          table[1]
            .split('\n')
            .filter(Boolean)
            .some((row) => !row.includes(' | â€” | ')),
        'Omit an all-empty Default column.'
      );
    }

    assert.ok(!/README_V[23]|Comparison draft|comparison draft/.test(text));
    assert.ok(!/\{\{(?:VERSION|LICENSE|TOC|API_SUMMARY|DOCS_[A-Z_]+)\}\}/.test(text));
  }

  checkTaskNavigation(documents['README.md'], documents['docs/API.md']);

  // Historical measurements stay intact, but their current setup routes must resolve.
  const performanceGuide = root && path.join(root, 'docs/performance.md');

  if (performanceGuide && fs.existsSync(performanceGuide)) {
    checkLinks('docs/performance.md', fs.readFileSync(performanceGuide, 'utf8'), documents, root);
  }
};

module.exports.headings = headings;
