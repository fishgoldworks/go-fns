'use strict';
const path = require('node:path');
const run = require('./helpers/capabilities');
suite('optional runtime capabilities before import', () => {
  test('root/focused imports and distributed loaders preserve their contracts', async () => {
    await run(
      process.env.GO_FNS_TEST_ENTRY ? path.resolve(process.env.GO_FNS_TEST_ENTRY) : path.resolve(__dirname, '..')
    );
  });
});
