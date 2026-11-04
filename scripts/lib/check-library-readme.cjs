'use strict';

// Shared checker for MIT library READMEs. Keep this copy in sync with the
// canonical checker distributed alongside the library review instructions.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const order = [
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
];
const required = ['Contents', 'Installation', 'Usage', 'API summary', 'Licence'];

function proseLines(markdown) {
  let fence;
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
          fence = undefined;
        }
        return '';
      }
      if (!marker) return line;
      fence = marker[1];
      return '';
    });
}

function checkReadme(markdown, label = 'README') {
  const lines = proseLines(markdown);
  const sections = lines.flatMap((line, index) => {
    const match = /^## (.+)$/.exec(line);
    return match ? [{ title: match[1], index }] : [];
  });
  const titles = sections.map(({ title }) => title);
  const check = (condition, message) => assert.ok(condition, label + ': ' + message);
  check(lines.filter((line) => /^# \S/.test(line)).length === 1, 'use exactly one project title');
  for (const heading of required) check(titles.includes(heading), 'missing section heading ' + heading);
  let previous = -1;
  for (const title of titles) {
    const index = order.indexOf(title);
    if (index < 0) {
      const equivalent = order.some((heading) => heading.toLowerCase() === title.toLowerCase());
      check(
        !equivalent && !['Behavior', 'License', 'API reference'].includes(title),
        'nonstandard section heading ' + title
      );
      continue;
    }
    check(index > previous, 'duplicate or out-of-order section heading ' + title);
    previous = index;
  }
  const contents = sections.find(({ title }) => title === 'Contents').index;
  const opening = lines.slice(0, contents).filter((line) => line.trim());
  check(
    opening.at(-1) === '**[View full API documentation](docs/API.md)**',
    'opening API link must use the shared label and destination immediately before Contents'
  );
  const version = opening.findIndex((line) => /^- \*\*Version:\*\* \[[^\]]+\]\(CHANGELOG\.md\)$/.test(line));
  const licenceLink = opening[version + 1];
  const templateLicence =
    /(?:^|[/\\])README\.template\.md$/.test(label) && licenceLink === '- **Licence:** [{{LICENSE}}](LICENSE.md)';
  check(
    version >= 0 && (licenceLink === '- **Licence:** [MIT](LICENSE.md)' || templateLicence),
    'project information must list the linked Version and Licence in order'
  );
  const licence = sections.find(({ title }) => title === 'Licence').index;
  const summary = sections.find(({ title }) => title === 'API summary').index;
  check(
    lines
      .slice(summary + 1)
      .join('\n')
      .trimStart()
      .split(/\n\s*\n/, 1)[0]
      .replace(/\s+/g, ' ') ===
      'See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.',
    'API summary must open with the shared reference sentence'
  );
  check(
    lines.slice(licence + 1).find((line) => line.trim()) === 'Licensed under the [MIT licence](LICENSE.md).',
    'Licence sentence must be “Licensed under the [MIT licence](LICENSE.md).”'
  );
}

module.exports = checkReadme;

if (require.main === module) {
  const files = process.argv.slice(2);
  assert.ok(files.length, 'Usage: node check-library-readme.cjs <README-or-template> [...]');
  for (const file of files) checkReadme(fs.readFileSync(file, 'utf8'), file);
  console.log('Shared README consistency checks passed for ' + files.length + ' file(s).');
}
