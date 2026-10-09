'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { repeatAsync } = require('./helpers/api.js');
const { invalidFunctions, values } = require('./helpers/values.js');
suite('repeatAsync', function () {
  for (const [label, fn] of invalidFunctions)
    test(`rejects invalid ${label} callback as a promise`, async () => {
      const result = repeatAsync(fn);
      assert.ok(result instanceof Promise);
      await assert.rejects(result, TypeError);
    });
  for (const count of [undefined, null, 0, -0])
    test(`zero/nullish count ${String(count)} does not execute`, async () => {
      const fn = () => {
        throw 1;
      };
      const a = await repeatAsync(fn, count),
        b = await repeatAsync(fn, count);
      assert.deepEqual(a, []);
      assert.notEqual(a, b);
    });
  for (const count of [1, 2, 10, 1000])
    test(`executes and resolves ${count} results in order`, async () => {
      let calls = 0;
      assert.deepEqual(
        await repeatAsync(() => ++calls, count),
        Array.from({ length: count }, (_, i) => i + 1)
      );
    });
  for (const [label, value] of values)
    test(`awaits values and thenables resolving ${label}`, async () => {
      const result = await repeatAsync(
        () => ({
          then(resolve) {
            resolve(value);
          }
        }),
        2
      );
      assert.equal(result[0], value);
      assert.equal(result[1], value);
    });
  for (const count of [NaN, Infinity, -Infinity, -1, -0.5, 1.5, 2 ** 32, Number.MAX_VALUE])
    test(`rejects invalid numeric count ${count}`, async () => {
      await assert.rejects(
        repeatAsync(() => {
          throw new Error('executed');
        }, count),
        RangeError
      );
    });
  for (const count of ['2', false, {}, [], 2n, Symbol(), new Number(2)])
    test(`rejects ${typeof count} count without coercion`, async () => {
      await assert.rejects(
        repeatAsync(() => {
          throw new Error('executed');
        }, count),
        TypeError
      );
    });
  test('validates count before first invocation, including hostile coercion', async () => {
    let calls = 0;
    await assert.rejects(
      repeatAsync(() => calls++, {
        [Symbol.toPrimitive]() {
          throw 1;
        }
      }),
      TypeError
    );
    assert.equal(calls, 0);
  });
  test('awaits each result before invoking the next', async () => {
    const releases = [];
    let active = 0,
      calls = 0;
    const result = repeatAsync(() => {
      calls++;
      active++;
      assert.equal(active, 1);
      return new Promise((resolve) =>
        releases.push(() => {
          active--;
          resolve(calls);
        })
      );
    }, 3);
    assert.equal(calls, 1);
    for (let i = 1; i <= 3; i++) {
      assert.equal(calls, i);
      releases.shift()();
      await Promise.resolve();
    }
    assert.deepEqual(await result, [1, 2, 3]);
    assert.equal(active, 0);
  });
  for (const [label, error] of values)
    for (const mode of ['throw', 'reject'])
      test(`${mode} ${label} halts further invocation`, async () => {
        let calls = 0;
        await assert.rejects(
          repeatAsync(() => {
            if (++calls === 2) {
              if (mode === 'throw') throw error;
              return Promise.reject(error);
            }
            return 1;
          }, 4),
          (e) => Object.is(e, error)
        );
        assert.equal(calls, 2);
      });
  test('supports maximum representable count without eager allocation', async () => {
    const token = {};
    let calls = 0;
    await assert.rejects(
      repeatAsync(
        () => {
          calls++;
          throw token;
        },
        2 ** 32 - 1
      ),
      (e) => e === token
    );
    assert.equal(calls, 1);
  });
  test('preserves callback receiver and arguments without an index', async () => {
    const token = {};
    function fn() {
      assert.equal(this, fn);
      return [...arguments];
    }
    assert.deepEqual(await repeatAsync.call({}, fn, 2, token, undefined), [
      [token, undefined],
      [token, undefined]
    ]);
    assert.deepEqual(
      await repeatAsync(function () {
        return arguments.length;
      }, 2),
      [0, 0]
    );
  });
  test('bound and cross-realm callbacks are supported', async () => {
    const receiver = {};
    assert.equal(
      (
        await repeatAsync(
          function () {
            return this;
          }.bind(receiver),
          1
        )
      )[0],
      receiver
    );
    const fn = vm.runInNewContext('(function(x){return Promise.resolve(x+1);})');
    assert.deepEqual(await repeatAsync(fn, 2, 1), [2, 2]);
  });
  test('hostile call/apply properties are not read', async () => {
    const fn = (x) => x;
    Object.defineProperties(fn, {
      call: {
        get() {
          throw 1;
        }
      },
      apply: {
        get() {
          throw 2;
        }
      }
    });
    assert.deepEqual(await repeatAsync(fn, 2, 3), [3, 3]);
  });
  test('reentrant and concurrent calls have independent state', async () => {
    assert.deepEqual(await repeatAsync(() => repeatAsync(() => 1, 2), 2), [
      [1, 1],
      [1, 1]
    ]);
    assert.deepEqual(await Promise.all([repeatAsync(() => 1, 2), repeatAsync(() => 2, 3)]), [
      [1, 1],
      [2, 2, 2]
    ]);
  });
  test('a then getter failure rejects with the original error', async () => {
    const error = {};
    await assert.rejects(
      repeatAsync(
        () => ({
          get then() {
            throw error;
          }
        }),
        1
      ),
      (e) => e === error
    );
  });
});
