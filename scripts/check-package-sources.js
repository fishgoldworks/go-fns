'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { consumerFiles, runtimeFiles, functionContents } = require('./package-layout');

// A passing behavioral suite cannot prove that an archive contains the reviewed
// revision. Compare every source-backed file; generated bundles have separate checks.
module.exports = function checkPackageSources(root, installed) {
  const files = [...consumerFiles, ...runtimeFiles(root)];

  for (const file of files) {
    const expected = fs.readFileSync(path.join(root, file));
    const actual = fs.readFileSync(path.join(installed, file));

    if (!actual.equals(expected)) throw new Error('Packaged source differs: ' + file);
  }

  const generated = functionContents(root);

  for (const [file, content] of Object.entries(generated)) {
    if (fs.readFileSync(path.join(installed, file), 'utf8') !== content)
      throw new Error('Generated function entry differs: ' + file);
  }

  return files.length + Object.keys(generated).length;
};
