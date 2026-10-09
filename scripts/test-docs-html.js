'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { render } = require('./docs-html');
test('HTML preserves every API fragment and rewrites relative document navigation', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../docs/API.md'), 'utf8');
  const html = render(source);
  for (const [, fragment] of source.matchAll(/\]\(#([^)]*)\)/g))
    assert.ok(html.includes('id="' + fragment + '"'), fragment);
  assert.ok(html.includes('href="../../README.md"'));
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<pre><code'));
});
test('HTML code examples escape markup and preserve duplicate heading targets', () => {
  const html = render('# Example\n\n## API\n\n## API\n\n```html\n<script>example</script>\n```\n');
  assert.ok(html.includes('id="api-1"'));
  assert.ok(html.includes('&lt;script&gt;example&lt;/script&gt;'));
});
