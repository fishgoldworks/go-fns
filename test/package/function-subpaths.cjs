'use strict';

// Executed unchanged on the minimum Node 8 consumer.
var assert = require('assert');
var path = require('path');
var names = JSON.parse(process.argv[2]);
var root = require.resolve('go-fns');
var directory = path.dirname(root) + path.sep;

for (var name of names) {
  for (var file of Object.keys(require.cache)) if (file.indexOf(directory) === 0) delete require.cache[file];
  var focused = require('go-fns/' + name);

  assert.strictEqual(typeof focused, 'function');
  assert.strictEqual(require.cache[root], undefined, name + ' loaded the root aggregator');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(focused, name), false);
  var api = require('go-fns');

  assert.strictEqual(focused, api[name], name + ' identity');
  for (var property of ['async', 'result', 'resultAsync', 'right'])
    assert.strictEqual(Object.prototype.hasOwnProperty.call(focused, property), false);
  assert.strictEqual(focused, require('go-fns/' + name + '.js'));
}

assert.strictEqual(require('go-fns/applyIf')('42', true, Number), 42);
var value = {};

assert.strictEqual(require('go-fns/result')(value), value);
assert.strictEqual(
  require('go-fns/pipe')(function (x) {
    return x + 1;
  })(2),
  3
);
assert.throws(function () {
  require('go-fns/getGlobal');
});
console.log('go-fns:consumer-complete');
