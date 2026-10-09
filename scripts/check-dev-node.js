'use strict';
// Runtime users still support Node 8.0.0+. Only repository release/coverage tools
// require this newer version; fail before a low-level CLI option error.
function checkDevelopmentNode(version) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 16)) {
    throw new Error(
      'Release development commands require Node.js 22.16+; library runtime support remains Node.js 8.0.0+. Use the version in .nvmrc.'
    );
  }
}
module.exports = checkDevelopmentNode;
if (require.main === module) {
  try {
    checkDevelopmentNode(process.versions.node);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
