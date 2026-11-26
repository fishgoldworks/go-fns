'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runtimeFiles } = require('./package-layout');

const normalise = (text) => text.replace(/\r\n?/g, '\n');

function readMap(directory, bundle, ops) {
  const mapFile = bundle + '.map';
  const code = ops.readFileSync(path.join(directory, bundle), 'utf8');
  const map = JSON.parse(ops.readFileSync(path.join(directory, mapFile), 'utf8'));

  if (
    map.version !== 3 ||
    map.file !== bundle ||
    (map.sourceRoot !== undefined && map.sourceRoot !== '') ||
    typeof map.mappings !== 'string' ||
    !map.mappings ||
    !Array.isArray(map.sources) ||
    !Array.isArray(map.sourcesContent) ||
    map.sources.length !== map.sourcesContent.length ||
    !code.trimEnd().endsWith('\n//# sourceMappingURL=' + mapFile)
  ) {
    throw Error('Invalid source map or bundle reference: ' + mapFile);
  }

  const sources = new Map();

  for (const [index, url] of map.sources.entries()) {
    // Terser resolves the optional ./ segment when composing Webpack's map.
    const name = typeof url === 'string' && /^webpack:\/\/Functions\/(?:\.\/)?(.+)$/.exec(url)?.[1];
    const content = map.sourcesContent[index];

    if (!name || typeof content !== 'string' || sources.has(name)) {
      throw Error('Invalid source map entry in ' + mapFile + ': ' + url);
    }

    sources.set(name, normalise(content));
  }

  return sources;
}

module.exports = function checkSourceMap(directory, ops = fs) {
  const root = path.dirname(directory);
  const authored = new Set(['index.js', ...runtimeFiles(root).filter((file) => file.endsWith('.js'))]);
  const readable = readMap(directory, 'go-fns.js', ops);
  const minified = readMap(directory, 'go-fns.min.js', ops);

  for (const file of authored) {
    const content = normalise(ops.readFileSync(path.join(root, file), 'utf8'));

    if (readable.get(file) !== content || minified.get(file) !== content) {
      throw Error('Source map content does not match packaged source: ' + file);
    }
  }

  for (const name of readable.keys()) {
    if (!authored.has(name) && !name.startsWith('webpack/')) {
      throw Error('Unexpected readable source map entry: ' + name);
    }
  }

  for (const [name, content] of minified) {
    if (readable.get(name) !== content) {
      throw Error('Minified source map does not match the readable source map: ' + name);
    }
  }
};
