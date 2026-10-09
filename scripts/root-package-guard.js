'use strict';
console.error(
  'The development root is private. Run npm run verify:all, then publish the verified artifacts/go-fns-<version>.tgz after release approval. Use npm run pack:package to build a candidate.'
);
process.exitCode = 1;
