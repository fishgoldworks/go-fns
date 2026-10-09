'use strict';

/**
 * @namespace Utility
 */
/**
 * Propositional logic connectives
 * @namespace Logic
 */
module.exports.pipe = require('./src/pipe');
module.exports.spread = require('./src/spread');
module.exports.attempt = require('./src/attempt');
module.exports.repeat = require('./src/repeat');
module.exports.delay = require('./src/delay');

module.exports.and = require('./src/logic/and');
module.exports.or = require('./src/logic/or');
module.exports.xor = require('./src/logic/xor');
module.exports.nor = require('./src/logic/nor');
module.exports.not = require('./src/logic/not');

module.exports.pipeAsync = require('./src/pipeAsync');
module.exports.attemptResult = require('./src/attemptResult');
module.exports.attemptResultAsync = require('./src/attemptResultAsync');
module.exports.tap = require('./src/tap');
module.exports.tapAsync = require('./src/tapAsync');
module.exports.sleep = require('./src/sleep');
module.exports.once = require('./src/once');

module.exports.partial = require('./src/partial');
module.exports.partialRight = require('./src/partialRight');
module.exports.unary = require('./src/unary');
module.exports.when = require('./src/when');
module.exports.ifElse = require('./src/ifElse');
module.exports.repeatAsync = require('./src/repeatAsync');
module.exports.debounce = require('./src/debounce');
module.exports.throttle = require('./src/throttle');

module.exports.notAsync = require('./src/logic/notAsync');
module.exports.andAsync = require('./src/logic/andAsync');
module.exports.orAsync = require('./src/logic/orAsync');

module.exports.whenAsync = require('./src/whenAsync');
module.exports.ifElseAsync = require('./src/ifElseAsync');
module.exports.norAsync = require('./src/logic/norAsync');
module.exports.xorAsync = require('./src/logic/xorAsync');
