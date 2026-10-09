'use strict';
const assert = require('node:assert/strict');
const { not } = require('../helpers/api.js');
const { values } = require('../helpers/values.js');
suite('not', function () {
  for (const [label, value] of values) {
    test(`negates a ${label} result`, function () {
      assert.equal(not(() => value)(), !value);
    });
  }
  for (const receiver of [undefined, null, {}, 0, 'x', false, Symbol('this')]) {
    test(`forwards receiver of type ${typeof receiver} and all arguments`, function () {
      const args = [1, { value: 2 }, undefined];
      const wrapper = not(function () {
        assert.equal(this, receiver);
        assert.deepEqual(Array.from(arguments), args);
        return true;
      });
      assert.equal(wrapper.apply(receiver, args), false);
    });
  }
  test('preserves bound function receivers', function () {
    const receiver = {};
    assert.equal(
      not(
        function () {
          return this === receiver;
        }.bind(receiver)
      ).call({}),
      false
    );
  });
  test('reevaluates on every invocation', function () {
    let count = 0;
    const wrapper = not(() => ++count % 2);
    assert.equal(wrapper(), false);
    assert.equal(wrapper(), true);
    assert.equal(count, 2);
  });
  test('does not await promises', function () {
    assert.equal(not(async () => false)(), false);
  });
  test('propagates the exact thrown value', function () {
    const error = {};
    assert.throws(
      not(() => {
        throw error;
      }),
      (actual) => actual === error
    );
  });
  test('supports a callback with an overridden apply property', function () {
    function predicate() {
      return true;
    }
    predicate.apply = null;
    assert.equal(not(predicate)(), false);
  });
});
