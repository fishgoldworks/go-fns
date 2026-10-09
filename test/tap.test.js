'use strict';
const assert = require('node:assert/strict');
const { tap, tapAsync } = require('./helpers/api.js');
const { values } = require('./helpers/values.js');
suite('tap and tapAsync', function () {
  for (const [name, factory] of [
    ['tap', tap],
    ['tapAsync', tapAsync]
  ]) {
    for (const [label, value] of values) {
      test(`${name} observes and preserves ${label} ignoring the observer result`, async () => {
        let calls = 0;
        const run = factory((x) => {
          assert.equal(x, value);
          calls++;
          return 'ignored';
        });
        const result = run(value);
        assert.equal(await result, value);
        assert.equal(calls, 1);
      });
      test(`${name} propagates thrown ${label}`, async () => {
        const run = factory(() => {
          throw value;
        });
        if (name === 'tap')
          assert.throws(
            () => run(1),
            (e) => Object.is(e, value)
          );
        else await assert.rejects(run(1), (e) => Object.is(e, value));
      });
    }
    for (const receiver of [undefined, null, {}, false, 0, 'x', Symbol('receiver')]) {
      test(`${name} forwards ${typeof receiver} receiver with exactly one input`, async () => {
        const token = {};
        const fn = new Proxy(
          function (x) {
            assert.equal(this, receiver);
            assert.deepEqual([...arguments], [token]);
            return 99;
          },
          {
            get() {
              throw Error('property access');
            }
          }
        );
        assert.equal(await factory(fn).call(receiver, token, 'extra'), token);
      });
    }
    test(`${name} sees undefined when no input is supplied`, async () => {
      let seen = false;
      assert.equal(
        await factory(function (x) {
          seen = true;
          assert.equal(x, undefined);
          assert.equal(arguments.length, 1);
        })(),
        undefined
      );
      assert.ok(seen);
    });
    test(`${name} keeps object mutations`, async () => {
      const object = { x: 1 };
      assert.equal(
        await factory((o) => {
          o.x = 2;
        })(object),
        object
      );
      assert.equal(object.x, 2);
    });
    test(`${name} preserves bound observer receiver`, async () => {
      const context = {};
      await factory(
        function () {
          assert.equal(this, context);
        }.bind(context)
      )(2);
    });
    test(`${name} produces fresh wrappers`, () => {
      const fn = () => {};
      assert.notEqual(factory(fn), factory(fn));
    });
  }
  test('sync tap never inspects the observer thenable', () => {
    const bad = Object.defineProperty({}, 'then', {
      get() {
        throw Error('must not await');
      }
    });
    assert.equal(tap(() => bad)(3), 3);
  });
  test('sync tap preserves promise input identity', async () => {
    const promise = Promise.resolve(3);
    assert.equal(tap((x) => assert.equal(x, promise))(promise), promise);
    await promise;
  });
  test('async tap awaits observer completion', async () => {
    const order = [];
    let finish;
    const pending = tapAsync(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )({});
    pending.then(() => order.push('done'));
    await Promise.resolve();
    assert.deepEqual(order, []);
    finish();
    await pending;
    assert.deepEqual(order, ['done']);
  });
  test('async tap propagates observer rejection', async () => {
    const error = {};
    await assert.rejects(tapAsync(() => Promise.reject(error))(1), (e) => e === error);
  });
  test('async tap rejects a throwing then accessor', async () => {
    const error = {};
    await assert.rejects(
      tapAsync(() =>
        Object.defineProperty({}, 'then', {
          get() {
            throw error;
          }
        })
      )(1),
      (e) => e === error
    );
  });
  test('async tap naturally assimilates promise inputs on return', async () => {
    const input = Promise.resolve(4);
    assert.equal(await tapAsync((x) => assert.equal(x, input))(input), 4);
  });
});
