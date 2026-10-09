'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = function checkSourceMap(directory, ops = fs) {
  const normalise = (text) => text.replace(/\r\n?/g, '\n');
  const readable = ops.readFileSync(path.join(directory, 'go-fns.js'), 'utf8');
  const minified = ops.readFileSync(path.join(directory, 'go-fns.min.js'), 'utf8');
  const map = JSON.parse(ops.readFileSync(path.join(directory, 'go-fns.min.js.map'), 'utf8'));
  if (
    map.version !== 3 ||
    map.file !== 'go-fns.min.js' ||
    typeof map.mappings !== 'string' ||
    !map.mappings ||
    !Array.isArray(map.sources) ||
    map.sources.length !== 1 ||
    map.sources[0] !== 'go-fns.js' ||
    !Array.isArray(map.sourcesContent) ||
    map.sourcesContent.length !== 1 ||
    typeof map.sourcesContent[0] !== 'string' ||
    normalise(map.sourcesContent[0]) !== normalise(readable) ||
    !minified.includes('sourceMappingURL=go-fns.min.js.map')
  ) {
    throw Error('Generated source map does not match the packaged readable bundle.');
  }
};
