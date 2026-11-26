'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const cleanup = require('./cleanup');

module.exports = function checkDocumentationTypes(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), pkg.name + '-documentation-types-'));
  let failure;

  try {
    const files = [];

    for (const name of ['README.md', 'docs/API.md']) {
      const text = fs.readFileSync(path.join(root, name), 'utf8');
      const blocks = [...text.matchAll(/```typescript\r?\n([\s\S]*?)```/g)];

      assert.ok(blocks.length, name + ' must include checked TypeScript examples.');
      for (const [index, block] of blocks.entries()) {
        const file = path.join(temporary, name.replace(/[/.]/g, '-') + '-' + index + '.ts');
        const prefix =
          pkg.name === 'go-template-fn' && !/import template/.test(block[1])
            ? 'import template = require("go-template-fn");\n'
            : '';

        fs.writeFileSync(file, prefix + block[1] + '\nexport {};\n');
        files.push(file);
      }
    }

    const options = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      types: [],
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      baseUrl: root,
      paths: { [pkg.name]: [path.join(root, 'index.d.ts')] }
    };
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(files, options));

    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (file) => file,
        getNewLine: () => '\n'
      })
    );
  } catch (error) {
    failure = { error };
  } finally {
    cleanup(
      [() => fs.rmSync(temporary, { recursive: true, force: true })],
      failure,
      'Documentation TypeScript consumer cleanup failed at ' + temporary
    );
  }
};
