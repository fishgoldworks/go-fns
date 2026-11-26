'use strict';

const assert = require('node:assert/strict');
const { pipe } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');

suite('pipe', function () {
  test('an empty pipeline returns undefined rather than identity', function () {
    assert.equal(pipe()(42), undefined);
  });

  for (let pattern = 0; pattern < 81; pattern++) {
    test(`normalizes functions, null and undefined in four-slot pattern ${pattern}`, function () {
      let code = pattern,
        expected = 10;
      const input = [];

      for (let i = 0; i < 4; i++, code = Math.floor(code / 3)) {
        const choice = code % 3;

        if (choice === 0) {
          input.push((value) => value + i + 1);
          expected += i + 1;
        } else input.push(choice === 1 ? null : undefined);
      }

      assert.equal(pipe(...input)(10), input.some((value) => typeof value === 'function') ? expected : undefined);
    });
  }

  test('the first function receives all arguments; subsequent functions receive one result', function () {
    const sequence = [];
    const wrapper = pipe(
      function (a, b) {
        sequence.push(Array.from(arguments));

        return a + b;
      },
      function (value) {
        sequence.push(Array.from(arguments));

        return value * 2;
      }
    );

    assert.equal(wrapper(2, 3), 10);
    assert.deepEqual(sequence, [[2, 3], [5]]);
  });

  test('supports a no-argument first function', function () {
    assert.equal(pipe(() => 4, Math.sqrt)(), 2);
  });

  for (const [label, value] of values) {
    test(`passes a ${label} result unchanged to the next stage`, function () {
      assert.equal(
        pipe(
          () => value,
          (result) => {
            assert.equal(result, value);

            return result;
          }
        )(),
        value
      );
    });
  }

  for (const receiver of [undefined, null, {}, 0, 'x', false, Symbol('this')]) {
    test(`forwards receiver of type ${typeof receiver} through every stage`, function () {
      const wrapper = pipe(
        function (value) {
          assert.equal(this, receiver);

          return value + 1;
        },
        function (value) {
          assert.equal(this, receiver);

          return value * 2;
        }
      );

      assert.equal(wrapper.call(receiver, 2), 6);
    });
  }

  test('keeps bound callback receivers', function () {
    const receiver = {};

    assert.equal(
      pipe(
        function () {
          return this;
        }.bind(receiver)
      ).call({}),
      receiver
    );
  });

  for (const position of [0, 1, 2]) {
    test(`stops at an exception in stage ${position}`, function () {
      const error = {},
        calls = [];
      const stages = [0, 1, 2].map((i) => () => {
        calls.push(i);
        if (i === position) throw error;

        return i;
      });

      assert.throws(pipe(...stages), (value) => value === error);
      assert.deepEqual(
        calls,
        Array.from({ length: position + 1 }, (_, i) => i)
      );
    });
  }

  test('does not await or unwrap promises', async function () {
    const promise = Promise.resolve(2);

    assert.equal(pipe(() => promise)(), promise);
    assert.equal(
      pipe(
        () => promise,
        (result) => result === promise
      )(),
      true
    );
  });

  test('passes rejected promises through without catching their later rejection', async function () {
    const error = new Error('later');
    const promise = Promise.reject(error);
    const result = pipe(() => promise)();

    assert.equal(result, promise);
    await assert.rejects(result, (value) => value === error);
  });

  test('is reentrant', function () {
    const wrapper = pipe(
      (value) => (value > 0 ? wrapper(value - 1) : 0),
      (value) => value + 1
    );

    assert.equal(wrapper(3), 4);
    assert.equal(wrapper(0), 1);
  });

  test('captures the function sequence without retaining the caller array', function () {
    const functions = [(value) => value + 1];
    const wrapper = pipe(...functions);

    functions[0] = () => 99;
    functions.push(() => 0);
    assert.equal(wrapper(1), 2);
  });

  test('supports callbacks with shadowed call and apply properties', function () {
    function first(value) {
      return value + 1;
    }

    function last(value) {
      return value * 2;
    }

    first.apply = null;
    last.call = null;
    assert.equal(pipe(first, last)(2), 6);
  });
});
