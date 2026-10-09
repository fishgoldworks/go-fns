'use strict';
const assert = require('node:assert/strict');
const { attemptResult, attemptResultAsync } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');
suite('structured attempts', function () {
  for (const [label, value] of values) {
    test(`sync success preserves ${label}`, () =>
      assert.deepEqual(
        attemptResult(() => value),
        { ok: true, value }
      ));
    test(`sync failure preserves thrown ${label}`, () =>
      assert.deepEqual(
        attemptResult(() => {
          throw value;
        }),
        { ok: false, error: value }
      ));
    test(`async success preserves resolved ${label}`, async () =>
      assert.deepEqual(await attemptResultAsync(() => value), { ok: true, value }));
    test(`async failure preserves thrown ${label}`, async () =>
      assert.deepEqual(
        await attemptResultAsync(() => {
          throw value;
        }),
        { ok: false, error: value }
      ));
    test(`async failure preserves rejected ${label}`, async () =>
      assert.deepEqual(await attemptResultAsync(() => Promise.reject(value)), { ok: false, error: value }));
  }
  for (const invoke of [attemptResult, attemptResultAsync]) {
    for (const count of [0, 1, 2, 3, 8, 64]) {
      test(`${invoke && invoke.name} forwards exactly ${count} arguments with callback receiver`, async () => {
        const args = Array.from({ length: count }, (_, i) => (i % 2 ? {} : undefined));
        const callback = new Proxy(
          function () {
            assert.equal(this, callback);
            assert.deepEqual([...arguments], args);
            return args;
          },
          {
            get() {
              throw Error('do not read callback properties');
            }
          }
        );
        const result = await invoke.call({}, callback, ...args);
        assert.equal(result.value, args);
        assert.equal(result.ok, true);
      });
    }
    test(`${invoke && invoke.name} preserves a bound receiver`, async () => {
      const context = {};
      const result = await invoke(
        function () {
          return this;
        }.bind(context)
      );
      assert.equal(result.value, context);
    });
    test(`${invoke && invoke.name} distinguishes Error return from throw`, async () => {
      const error = new Error('value');
      assert.deepEqual(await invoke(() => error), { ok: true, value: error });
      assert.deepEqual(
        await invoke(() => {
          throw error;
        }),
        { ok: false, error }
      );
    });
    test(`${invoke && invoke.name} catches invocation errors for classes`, async () => {
      const result = await invoke(class NotCallable {});
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof TypeError);
    });
    test(`${invoke && invoke.name} returns a fresh mutable result object`, async () => {
      const first = await invoke(() => 1),
        second = await invoke(() => 1);
      assert.notEqual(first, second);
      first.ok = false;
      assert.equal(second.ok, true);
    });
  }
  test('sync variant does not read then or assimilate a thenable', () => {
    const value = Object.defineProperty({}, 'then', {
      get() {
        throw new Error('must not await');
      }
    });
    assert.equal(attemptResult(() => value).value, value);
  });
  test('sync variant returns the original rejected promise without catching it', async () => {
    const error = {};
    const promise = Promise.reject(error);
    assert.equal(attemptResult(() => promise).value, promise);
    await assert.rejects(promise, (e) => e === error);
  });
  test('async variant awaits nested thenables', async () => {
    assert.deepEqual(
      await attemptResultAsync(() => ({
        then(resolve) {
          resolve(Promise.resolve(3));
        }
      })),
      { ok: true, value: 3 }
    );
  });
  test('async variant captures throwing then getter', async () => {
    const error = {};
    const value = Object.defineProperty({}, 'then', {
      get() {
        throw error;
      }
    });
    assert.deepEqual(await attemptResultAsync(() => value), { ok: false, error });
  });
});
