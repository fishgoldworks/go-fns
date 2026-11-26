'use strict';

const Module = require('node:module');
const path = require('node:path');
const load = Module._load;
const scripts = path.resolve(__dirname, '../../../scripts');
const failure = new AggregateError(
  [new Error('PRIMARY_DIAGNOSTIC'), new Error('CLEANUP_DIAGNOSTIC')],
  'CLI diagnostic control',
  { cause: new Error('CAUSE_DIAGNOSTIC') }
);

Object.assign(failure, {
  committed: true,
  recoveryDirectory: 'RECOVERY_DIRECTORY',
  tarball: 'RETAINED_TARBALL'
});

// Fail before any build, pack or consumer process; leave the real CLI catch intact.
Module._load = function (request, parent, ...args) {
  if (parent?.filename === path.join(scripts, 'pack-package.js') && request === './build') {
    return {
      async build() {
        throw failure;
      }
    };
  }

  if (parent?.filename === path.join(scripts, 'verify.js') && request === './check-dev-node') {
    return () => {
      throw failure;
    };
  }

  return load.call(this, request, parent, ...args);
};
