'use strict';

const fs = require('node:fs');
const path = require('node:path');
const original = {
  temporary: fs.mkdtempSync,
  read: fs.readFileSync,
  copy: fs.cpSync,
  remove: fs.rmSync,
  append: fs.appendFileSync
};
const mode = process.env.GO_FNS_CLEANUP_MODE;
const kind = process.env.GO_FNS_CLEANUP_KIND;
const journal = process.env.GO_FNS_CLEANUP_JOURNAL;
const primary = new Error('PRIMARY_CONSUMER_CHECK_FAILED');
const cleanup = new Error('CONSUMER_CLEANUP_FAILED');
const prefixes = {
  package: 'go-fns-consumer-',
  types: 'go-fns-types-',
  documentation: 'go-fns-documentation-types-'
};
let temporary;

function record(value) {
  original.append(journal, JSON.stringify(value) + '\n');
}

function insideTemporary(file) {
  return temporary && String(file).startsWith(temporary + path.sep);
}

fs.mkdtempSync = function (prefix, ...args) {
  const directory = original.temporary(prefix, ...args);

  if (path.basename(directory).startsWith(prefixes[kind])) {
    temporary = directory;
    record({ event: 'created', directory });
  }

  return directory;
};

fs.readFileSync = function (file, ...args) {
  if (kind === 'package' && mode !== 'cleanup-only' && insideTemporary(file)) throw primary;
  if (kind === 'documentation' && mode !== 'cleanup-only' && temporary && path.basename(String(file)) === 'README.md')
    throw primary;

  return original.read(file, ...args);
};

fs.cpSync = function (source, target, ...args) {
  if (kind === 'types' && mode !== 'cleanup-only' && insideTemporary(target)) throw primary;

  return original.copy(source, target, ...args);
};

fs.rmSync = function (directory, ...args) {
  if (directory === temporary) {
    record({ event: 'cleanup', directory });
    if (mode !== 'primary-only') throw cleanup;
  }

  const result = original.remove(directory, ...args);

  if (directory === temporary) record({ event: 'removed', directory });

  return result;
};

process.on('uncaughtExceptionMonitor', (error) => {
  const errors = error instanceof AggregateError ? error.errors : [error];

  record({
    event: 'failure',
    primaryIdentity: error === primary,
    primaryRetained: errors.includes(primary),
    cleanupRetained: errors.includes(cleanup),
    combinedOrder: errors[0] === primary && errors[1] === cleanup,
    aggregate: error instanceof AggregateError,
    errorCount: errors.length,
    message: error.message
  });
});
