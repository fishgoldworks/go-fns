'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Markdown = require('markdown-it');
const { headings } = require('./documentation-contract');

function render(reference) {
  const markdown = new Markdown({ html: true });
  const anchors = headings(reference);
  let heading = 0;

  markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    tokens[index].attrSet('id', anchors[heading++].anchor);

    return self.renderToken(tokens, index, options);
  };

  // API.md lives in docs/; generated HTML lives one directory further down.
  markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href');

    if (href && !/^(?:#|[a-z]+:|\/)/i.test(href)) tokens[index].attrSet('href', '../' + href);

    return self.renderToken(tokens, index, options);
  };

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Go Functions API</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#17202a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd4dc;padding:.6rem;text-align:left;vertical-align:top}pre{padding:1rem;overflow:auto;background:#f5f7fa}code{font-family:ui-monospace,monospace}a{color:#075bb5}h2,h3,h4{scroll-margin-top:1rem}</style>
</head><body><main>${markdown.render(reference)}</main></body></html>
`;
}

module.exports = { render };
if (require.main === module) {
  if (process.argv.length !== 2) throw Error('Usage: node scripts/docs-html.js');
  const destination = path.resolve(__dirname, '../docs/html');

  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(
    path.join(destination, 'index.html'),
    render(fs.readFileSync(path.resolve(__dirname, '../docs/API.md'), 'utf8'))
  );
  console.log('Generated docs/html/index.html from the canonical full API reference.');
}
