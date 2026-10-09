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
module.exports = function checkDocumentation(readme, reference, root) {
  const documents = { 'README.md': readme.replace(/\r\n/g, '\n'), 'docs/API.md': reference.replace(/\r\n/g, '\n') };
  const overviewHeadings = headings(readme);
  assert.deepEqual(
    overviewHeadings.filter((heading) => heading.depth === 2).map((heading) => heading.title),
    [
      'Contents',
      'Installation',
      'Usage',
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
    const ownHeadings = headings(text),
      anchors = new Set(ownHeadings.map((heading) => heading.anchor));
    const toc = text.split('## Contents\n')[1].split('\n## ')[0];
    for (const heading of ownHeadings.filter((heading) => heading.depth === 2 && heading.title !== 'Contents')) {
      assert.ok(
        toc.includes('[' + heading.title + '](#' + heading.anchor + ')'),
        name + ' Contents omits ' + heading.title
      );
    }
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
};

module.exports.headings = headings;
