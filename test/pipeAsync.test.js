'use strict';

const assert = require('node:assert/strict');
const { pipeAsync } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');

suite('pipeAsync', function () {
  test('empty pipeline always resolves undefined', async () => {
    const result = pipeAsync()(42);

    assert.ok(result instanceof Promise);
    assert.equal(await result, undefined);
  });

  for (let pattern = 0; pattern < 81; pattern++) {
    test(`skips nullish entries in pattern ${pattern}`, async () => {
      let code = pattern,
        expected = 10,
        functions = 0;
      const stages = [];

      for (let i = 0; i < 4; i++, code = Math.floor(code / 3)) {
        const choice = code % 3;

        if (choice === 0) {
          stages.push(async (value) => value + i + 1);
          expected += i + 1;
          functions++;
        } else stages.push(choice === 1 ? null : undefined);
      }

      assert.equal(await pipeAsync(...stages)(10), functions ? expected : undefined);
    });
  }

  for (const [label, value] of values) {
    test(`passes resolved ${label} unchanged`, async () =>
      assert.equal(
        await pipeAsync(
          () => Promise.resolve(value),
          (x) => {
            assert.equal(x, value);

            return x;
          }
        )(),
        value
      ));

    for (const position of [0, 1, 2]) {
      test(`rejects thrown ${label} at position ${position} and skips later stages`, async () => {
        const calls = [];
        const stages = [0, 1, 2].map((i) => async () => {
          calls.push(i);
          if (position === i) throw value;

          return i;
        });

        await assert.rejects(pipeAsync(...stages)(), (error) => Object.is(error, value));
        assert.deepEqual(calls, [0, 1, 2].slice(0, position + 1));
      });
    }
  }

  for (const receiver of [undefined, null, {}, 0, 'x', false, Symbol('this')]) {
    test(`preserves ${typeof receiver} receiver and stage arities`, async () => {
      const stages = [
        function (a, b) {
          assert.equal(this, receiver);
          assert.equal(arguments.length, 2);

          return Promise.resolve(a + b);
        },
        function (sum) {
          assert.equal(this, receiver);
          assert.equal(arguments.length, 1);

          return sum * 2;
        }
      ];

      assert.equal(await pipeAsync(...stages).call(receiver, 2, 3), 10);
    });
  }

  test('awaits first stage before invoking the next', async () => {
    let release;
    const calls = [];
    const run = pipeAsync(
      () => {
        calls.push(1);

        return new Promise((resolve) => {
          release = resolve;
        });
      },
      (value) => {
        calls.push(2);

        return value + 1;
      }
    );

    const pending = run();

    assert.deepEqual(calls, [1]);

    release(3);

    assert.equal(await pending, 4);
    assert.deepEqual(calls, [1, 2]);
  });

  test('async invocation failures never throw synchronously', async () => {
    const error = {};
    let result;

    assert.doesNotThrow(() => {
      result = pipeAsync(() => {
        throw error;
      })();
    });

    await assert.rejects(result, (e) => e === error);
  });

  test('assimilates nested thenables including the last stage', async () =>
    assert.equal(
      await pipeAsync(
        () => ({
          then(resolve) {
            resolve(Promise.resolve(2));
          }
        }),
        (x) => ({
          then(resolve) {
            resolve(x + 1);
          }
        })
      )(),
      3
    ));

  test('rejects throwing then accessors', async () => {
    const error = {};

    await assert.rejects(
      pipeAsync(() =>
        Object.defineProperty({}, 'then', {
          get() {
            throw error;
          }
        })
      )(),
      (e) => e === error
    );
  });

  test('supports concurrent calls without sharing result state', async () => {
    const resolvers = [];
    const run = pipeAsync(
      (x) => new Promise((resolve) => resolvers.push(() => resolve(x))),
      (x) => x * 2
    );

    const a = run(1),
      b = run(2);

    resolvers[1]();
    resolvers[0]();

    assert.deepEqual(await Promise.all([a, b]), [2, 4]);
  });

  test('is reentrant', async () => {
    const run = pipeAsync(
      async (x) => (x ? await run(x - 1) : 0),
      (x) => x + 1
    );

    assert.equal(await run(5), 6);
  });

  test('captures stages without retaining caller array', async () => {
    const stages = [(x) => x + 1];
    const run = pipeAsync(...stages);

    stages[0] = () => 99;

    assert.equal(await run(2), 3);
  });

  test('creates fresh wrappers', () => {
    const fn = (x) => x;

    assert.notEqual(pipeAsync(fn), pipeAsync(fn));
  });

  test('supports bound callbacks', async () => {
    const context = {};

    assert.equal(
      await pipeAsync(
        function () {
          return this;
        }.bind(context)
      ).call({}),
      context
    );
  });

  test('ignores hostile call/apply properties through a long pipeline', async () => {
    const fn = new Proxy(
      function (x) {
        assert.equal(arguments.length, 1);

        return x + 1;
      },
      {
        get() {
          throw Error('property access');
        }
      }
    );

    assert.equal(await pipeAsync(...Array(256).fill(fn))(0), 256);
  });

  test('supports zero initial arguments', async () =>
    assert.equal(
      await pipeAsync(function () {
        assert.equal(arguments.length, 0);

        return 4;
      }, Math.sqrt)(),
      2
    ));
});
