'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('../helpers/api.js');
const { invalidFunctions, values } = require('../helpers/values.js');

function deferred() {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });

  return { promise, resolve };
}

suite('async NOR and exactly-one XOR', function () {
  for (const name of ['norAsync', 'xorAsync']) {
    suite(name, function () {
      const isNor = name === 'norAsync';

      test('constructs fresh wrappers synchronously without invoking callbacks', function () {
        let calls = 0;
        const fn = () => ++calls;
        const first = api[name](fn);

        assert.equal(typeof first, 'function');
        assert.notEqual(first, api[name](fn));
        assert.equal(calls, 0);
      });

      for (let arity = 0; arity <= 6; arity++) {
        for (let bits = 0; bits < 2 ** arity; bits++) {
          const results = Array.from({ length: arity }, (_, i) => Boolean(bits & (1 << i)));
          const truePositions = results.flatMap((value, i) => (value ? [i] : []));
          const expected = isNor ? arity > 0 && truePositions.length === 0 : truePositions.length === 1;
          const stop = truePositions[isNor ? 0 : 1];
          const visited = Array.from({ length: stop === undefined ? arity : stop + 1 }, (_, i) => i);

          for (const mode of ['synchronous', 'asynchronous', 'thenable']) {
            test(`${mode} truth table and short circuit [${results.join(', ')}]`, async function () {
              const visits = [];
              const callbacks = results.map((value, i) => () => {
                visits.push(i);

                if (mode === 'asynchronous') {
                  return Promise.resolve(value);
                }

                if (mode === 'thenable') {
                  return { then: (resolve) => resolve(value) };
                }

                return value;
              });
              const pending = api[name](...callbacks)();

              assert.ok(pending instanceof Promise);
              assert.equal(await pending, expected);
              assert.deepEqual(visits, visited);
            });
          }
        }
      }

      for (const [label, value] of values) {
        for (const mode of ['value', 'promise', 'nested thenable']) {
          test(`awaits ${mode} ${label} truthiness and returns a boolean`, async function () {
            const pending = api[name](() =>
              mode === 'value'
                ? value
                : mode === 'promise'
                  ? Promise.resolve(value)
                  : { then: (resolve) => resolve({ then: (inner) => inner(value) }) }
            )();

            assert.ok(pending instanceof Promise);
            assert.equal(await pending, isNor ? !value : Boolean(value));
          });
        }
      }

      for (const inputs of [[], [null], [undefined], [null, undefined, null]]) {
        test(`empty or all-nullish configuration of length ${inputs.length} resolves false`, async function () {
          const pending = api[name](...inputs)();

          assert.ok(pending instanceof Promise);
          assert.equal(await pending, false);
        });
      }

      test('skips only nullish callbacks while preserving order', async function () {
        const visits = [];

        assert.equal(
          await api[name](
            null,
            () => {
              visits.push(1);

              return false;
            },
            undefined,
            () => {
              visits.push(2);

              return true;
            },
            null
          )(),
          !isNor
        );
        assert.deepEqual(visits, [1, 2]);
      });

      for (const [label, invalid] of invalidFunctions.filter((entry) => entry[1] !== null && entry[1] !== undefined)) {
        for (const position of [0, 1, 3]) {
          test(`synchronously rejects ${label} at position ${position}, including unreachable entries`, function () {
            let calls = 0;
            const callbacks = [
              () => {
                calls++;

                return true;
              },
              () => {
                calls++;

                return true;
              },
              null,
              () => false
            ];

            callbacks[position] = invalid;
            assert.throws(() => api[name](...callbacks), TypeError);
            assert.equal(calls, 0);
          });
        }
      }

      for (const [label, receiver] of [
        ['undefined', undefined],
        ['null', null],
        ['object', {}],
        ['number', 0],
        ['string', 'x'],
        ['boolean', false],
        ['symbol', Symbol('receiver')]
      ]) {
        test(`preserves strict ${label} this and every original argument for every callback`, async function () {
          const input = {},
            inputPromise = Promise.resolve(true),
            seen = [];
          const callback = function () {
            seen.push(this);
            assert.deepEqual([...arguments], [input, inputPromise, undefined, 17]);

            return false;
          };

          assert.equal(await api[name](callback, callback).call(receiver, input, inputPromise, undefined, 17), isNor);
          assert.deepEqual(seen, [receiver, receiver]);
        });
      }

      test('preserves undefined this and zero arguments for plain invocation', async function () {
        let calls = 0;
        const wrapper = api[name](function () {
          calls++;
          assert.equal(this, undefined);
          assert.equal(arguments.length, 0);

          return false;
        });

        assert.equal(await wrapper(), isNor);
        assert.equal(calls, 1);
      });

      test('does not inspect or await promise-like input arguments', async function () {
        const input = Object.defineProperty({}, 'then', {
          get() {
            throw new Error('input was inspected');
          }
        });

        assert.equal(
          await api[name]((original) => {
            assert.equal(original, input);

            return false;
          })(input),
          isNor
        );
      });

      test('honors bound callback receivers', async function () {
        const receiver = {};

        assert.equal(
          await api[name](
            function () {
              assert.equal(this, receiver);

              return false;
            }.bind(receiver)
          ).call({}),
          isNor
        );
      });

      test('awaits cross-realm promises and invokes cross-realm functions', async function () {
        const callback = vm.runInNewContext('(function (value) { return Promise.resolve(value); })');

        assert.equal(await api[name](callback)(false), isNor);
        assert.equal(await api[name](callback)(true), !isNor);
      });

      test('treats generator results as truthy without iterating them', async function () {
        assert.equal(
          await api[name](function* () {
            yield assert.fail('must not iterate');
          })(),
          !isNor
        );
      });

      test('ignores hostile callback properties and isolates proxy argument arrays', async function () {
        const original = { count: 0 },
          receiver = {},
          trapArrays = [];
        const callback = new Proxy(function () {}, {
          get() {
            throw new Error('callback property read');
          },
          apply(target, context, args) {
            assert.equal(context, receiver);
            assert.deepEqual(args, [original, undefined]);
            original.count++;
            trapArrays.push(args);
            args[0] = 'replacement';
            args.push('extra');

            return false;
          }
        });

        assert.equal(await api[name](callback, callback).call(receiver, original, undefined), isNor);
        assert.equal(original.count, 2);
        assert.notEqual(trapArrays[0], trapArrays[1]);
      });

      test('keeps argument object mutations visible to subsequent callbacks', async function () {
        const input = { count: 0 };

        assert.equal(
          await api[name](
            (original) => {
              assert.equal(original, input);
              original.count++;

              return false;
            },
            (original) => {
              assert.equal(original, input);
              assert.equal(original.count, 1);

              return false;
            }
          )(input),
          isNor
        );
      });

      test('starts the first predicate immediately and waits for each result before continuing', async function () {
        const first = deferred(),
          second = deferred(),
          secondStarted = deferred(),
          visits = [];
        const pending = api[name](
          () => {
            visits.push(1);

            return first.promise;
          },
          () => {
            visits.push(2);
            secondStarted.resolve();

            return second.promise;
          },
          () => {
            visits.push(3);

            return false;
          }
        )();

        assert.ok(pending instanceof Promise);
        assert.deepEqual(visits, [1]);
        first.resolve(false);
        await secondStarted.promise;
        assert.deepEqual(visits, [1, 2]);
        second.resolve(false);
        assert.equal(await pending, isNor);
        assert.deepEqual(visits, [1, 2, 3]);
      });

      test('defers later callbacks even for synchronous preceding results', async function () {
        const visits = [];
        const pending = api[name](
          () => {
            visits.push(1);

            return false;
          },
          () => {
            visits.push(2);

            return false;
          }
        )();

        assert.deepEqual(visits, [1]);
        assert.equal(await pending, isNor);
        assert.deepEqual(visits, [1, 2]);
      });

      test('short-circuits after the awaited decisive truthy result', async function () {
        const gate = deferred(),
          visits = [];
        const callbacks = isNor
          ? []
          : [
              () => {
                visits.push('first true');

                return true;
              }
            ];
        const started = deferred();

        callbacks.push(
          () => {
            visits.push('gate');
            started.resolve();

            return gate.promise;
          },
          () => assert.fail('callback after decisive truthy result')
        );
        const pending = api[name](...callbacks)();

        await started.promise;
        assert.deepEqual(visits, isNor ? ['gate'] : ['first true', 'gate']);
        gate.resolve(true);
        assert.equal(await pending, false);
      });

      for (const [label, error] of values) {
        for (const mode of ['throw', 'reject', 'thenable rejection', 'then getter throw']) {
          test(`rejects ${mode} ${label} with exact failure identity`, async function () {
            const callback = () => {
              if (mode === 'throw') throw error;

              if (mode === 'reject') {
                return Promise.reject(error);
              }

              if (mode === 'thenable rejection') {
                return { then: (resolve, reject) => reject(error) };
              }

              return Object.defineProperty({}, 'then', {
                get() {
                  throw error;
                }
              });
            };

            let pending;

            assert.doesNotThrow(() => {
              pending = api[name](callback)();
            });
            assert.ok(pending instanceof Promise);
            await assert.rejects(pending, (actual) => Object.is(actual, error));
          });
        }
      }

      for (const mode of ['throw', 'reject', 'thenable rejection', 'then getter throw']) {
        for (const position of [0, 1, 2]) {
          test(`${mode} at position ${position} stops all later callbacks`, async function () {
            const error = {},
              visits = [];
            const callbacks = [0, 1, 2, 3].map((i) => () => {
              visits.push(i);

              if (i !== position) {
                return false;
              }

              if (mode === 'throw') throw error;

              if (mode === 'reject') {
                return Promise.reject(error);
              }

              if (mode === 'thenable rejection') {
                return { then: (resolve, reject) => reject(error) };
              }

              return Object.defineProperty({}, 'then', {
                get() {
                  throw error;
                }
              });
            });

            await assert.rejects(api[name](...callbacks)(), (actual) => actual === error);
            assert.deepEqual(visits, [0, 1, 2, 3].slice(0, position + 1));
          });
        }
      }

      test('reevaluates each occurrence of repeated callback references until short circuit', async function () {
        let calls = 0;
        const callback = () => ++calls % 2 === 0;

        assert.equal(await api[name](callback, callback, callback, callback, callback)(), false);
        assert.equal(calls, isNor ? 2 : 4);
      });

      test('does not cache callback results between invocations', async function () {
        let value = false,
          calls = 0;
        const wrapper = api[name](() => {
          calls++;

          return value;
        });

        assert.equal(await wrapper(), isNor);
        value = true;
        assert.equal(await wrapper(), !isNor);
        assert.equal(calls, 2);
      });

      test('captures configured callback entries independently from the caller array', async function () {
        const callbacks = [() => false];
        const first = api[name](...callbacks),
          second = api[name](...callbacks);

        callbacks[0] = () => true;
        assert.equal(await first(), isNor);
        assert.equal(await second(), isNor);
      });

      test('keeps simultaneous calls independent when gates resolve out of order', async function () {
        const first = { gate: deferred(), value: false },
          second = { gate: deferred(), value: true };
        const firstReceiver = {},
          secondReceiver = {},
          visits = [];
        const wrapper = api[name](
          function (input) {
            visits.push([input, this, 0]);

            return input.gate.promise;
          },
          function (input) {
            visits.push([input, this, 1]);

            return input.value;
          }
        );
        const a = wrapper.call(firstReceiver, first),
          b = wrapper.call(secondReceiver, second);

        assert.notEqual(a, b);
        assert.deepEqual(visits, [
          [first, firstReceiver, 0],
          [second, secondReceiver, 0]
        ]);
        second.gate.resolve(false);
        assert.equal(await b, !isNor);
        first.gate.resolve(false);
        assert.equal(await a, isNor);
        assert.deepEqual(visits, [
          [first, firstReceiver, 0],
          [second, secondReceiver, 0],
          [second, secondReceiver, 1],
          [first, firstReceiver, 1]
        ]);
      });

      test('is reentrant with independent receivers, arguments and loop positions', async function () {
        const receiver = {},
          visits = [];
        const wrapper = api[name](
          async function (depth) {
            assert.equal(this, receiver);
            visits.push([depth, 0]);
            if (depth) assert.equal(await wrapper.call(receiver, depth - 1), isNor);

            return false;
          },
          function (depth) {
            assert.equal(this, receiver);
            visits.push([depth, 1]);

            return false;
          }
        );

        assert.equal(await wrapper.call(receiver, 2), isNor);
        assert.deepEqual(visits, [
          [2, 0],
          [1, 0],
          [0, 0],
          [0, 1],
          [1, 1],
          [2, 1]
        ]);
      });
    });
  }
});
