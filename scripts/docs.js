'use strict';

// Authored overview and reference templates share one maintained API inventory.
const fs = require('node:fs');
const path = require('node:path');

function headingSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function render(template, pkg) {
  const text = template.replace(/\r\n/g, '\n');
  let fence = null;
  const seen = new Map();
  const headings = [];

  for (const line of text.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);

    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }

    const match = !fence && /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);

    if (!match) continue;
    const title = match[2];
    const slug = headingSlug(title);
    const count = seen.get(slug) || 0;

    seen.set(slug, count + 1);
    if (match[1].length === 2 && title !== 'Contents') {
      headings.push(`- [${title}](#${slug}${count ? '-' + count : ''})`);
    }

    if (
      match[1].length === 3 &&
      ['Invalid arguments and callback errors', 'Scheduling and argument adaptation'].includes(title)
    )
      headings.push(`  - [${title}](#${slug}${count ? '-' + count : ''})`);
  }

  const values = { VERSION: pkg.version, LICENSE: pkg.license, NAME: pkg.name, TOC: headings.join('\n') };

  return text.replace(/\{\{([A-Z_]+)\}\}/g, (token, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key) || typeof values[key] !== 'string')
      throw Error('Unknown documentation token: ' + token);

    return values[key];
  });
}

function readmeSummary(reference) {
  const section = reference.split('## API summary\n')[1]?.split('\n## ')[0] ?? '';
  const tables = [
    ...section.matchAll(/(?:\*\*([^*\n]+)\*\*\n\n)?(\| API \| Description \| Returns \|\n(?:\|[^\n]+\n)+)/g)
  ];

  if (!tables.length) throw Error('The API reference must contain an API summary table.');
  const jumpLinks = [];
  const groups = [];

  for (const [, title, table] of tables) {
    const rows = table.trimEnd().replace(/\]\(#/g, '](docs/API.md#');

    if (title) jumpLinks.push(`[${title}](#${headingSlug(title)})`);
    groups.push(title ? `### ${title}\n\n${rows}` : rows);
  }

  if (jumpLinks.length) groups.unshift(jumpLinks.join(' · '));
  const notes = /<!-- summary-notes:start -->\n([^]*?)\n<!-- summary-notes:end -->/.exec(section);

  if (notes) groups.push(notes[1].trim().replace(/\]\(#/g, '](docs/API.md#'));

  return groups.join('\n\n');
}

function generate({ root = path.resolve(__dirname, '..'), check = false } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const referenceTemplate = fs.readFileSync(path.join(root, 'scripts/API.template.md'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'scripts/README.template.md'), 'utf8');
  const api = undefined;
  const reference = render(referenceTemplate, pkg, api);

  if (template.split('{{API_SUMMARY}}').length !== 2) throw Error('The README needs exactly one API summary field.');
  const overview = template.replace('{{API_SUMMARY}}', () => readmeSummary(reference));
  const documents = { 'README.md': render(overview, pkg, api, reference), 'docs/API.md': reference };

  for (const [name, output] of Object.entries(documents)) {
    const target = path.join(root, name);

    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output)
        throw Error(name + ' is stale. Run npm run docs.');
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, output);
    }
  }

  return documents;
}

module.exports = { render, generate };
if (require.main === module) {
  if (process.argv.slice(2).some((arg) => arg !== '--check') || process.argv.length > 3)
    throw Error('Usage: node scripts/docs.js [--check]');
  generate({ check: process.argv.includes('--check') });
  console.log(
    process.argv.includes('--check') ? 'README.md and docs/API.md are current.' : 'Generated README.md and docs/API.md.'
  );
}
