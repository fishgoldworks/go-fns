'use strict';

const path = require('node:path');

module.exports = require(process.env.GO_FNS_TEST_ENTRY ? path.resolve(process.env.GO_FNS_TEST_ENTRY) : '../..');
