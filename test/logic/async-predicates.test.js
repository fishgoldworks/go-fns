'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('../helpers/api.js');
const { invalidFunctions, values } = require('../helpers/values.js');
const names = ['notAsync', 'andAsync', 'orAsync'];
const connectives = ['andAsync', 'orAsync'];

function deferred() {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

function truth(name, value) {
  return name === 'notAsync' ? !value : Boolean(value);
}

suite('async predicates', function () {
  for (const name of names) {
    suite(name, function () {
      test('is exported as the exact-reference async alias', function () {
        assert.equal(typeof api[name], 'function');
        assert.equal(api[name.slice(0, -5)].async, api[name]);
      });
      test('constructs synchronously without invoking callbacks', function () {
        let calls = 0;
        const wrapper = api[name](() => {
          calls++;
          return true;
        });
        assert.equal(typeof wrapper, 'function');
        assert.equal(calls, 0);
      });
      for (const [label, value] of values) {
        for (const mode of ['value', 'promise', 'thenable']) {
          test(`awaits a ${mode} with ${label} truthiness and returns a boolean`, async function () {
            const wrapper = api[name](() =>
              mode === 'value'
                ? value
                : mode === 'promise'
                  ? Promise.resolve(value)
                  : { then: (resolve) => resolve({ then: (innerResolve) => innerResolve(value) }) }
            );
            const result = wrapper();
            assert.ok(result instanceof Promise);
            assert.equal(await result, truth(name, value));
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
        ['symbol', Symbol('this')]
      ]) {
        test(`preserves a strict ${label} receiver and all original arguments`, async function () {
          const token = {},
            inputPromise = Promise.resolve(false);
          const seen = [];
          const callback = function () {
            seen.push(this);
            assert.equal(arguments.length, 4);
            assert.equal(arguments[0], token);
            assert.equal(arguments[1], inputPromise);
            assert.equal(arguments[2], undefined);
            assert.equal(arguments[3], 17);
            return name !== 'orAsync';
          };
          const callbacks = name === 'notAsync' ? [callback] : [callback, callback];
          await api[name](...callbacks).call(receiver, token, inputPromise, undefined, 17);
          assert.deepEqual(
            seen,
            callbacks.map(() => receiver)
          );
        });
      }
      test('preserves undefined this and zero arguments on a plain invocation', async function () {
        let calls = 0;
        const wrapper = api[name](function () {
          calls++;
          assert.equal(this, undefined);
          assert.equal(arguments.length, 0);
          return false;
        });
        assert.equal(await wrapper(), truth(name, false));
        assert.equal(calls, 1);
      });
      test('does not inspect or await promise-like input arguments', async function () {
        const input = Object.defineProperty({}, 'then', {
          get() {
            throw new Error('input must not be awaited');
          }
        });
        assert.equal(
          await api[name](function (value) {
            assert.equal(value, input);
            return true;
          })(input),
          truth(name, true)
        );
      });
      test('honors bound callback receivers', async function () {
        const boundReceiver = {};
        assert.equal(
          await api[name](
            function () {
              assert.equal(this, boundReceiver);
              return Promise.resolve(false);
            }.bind(boundReceiver)
          ).call({}),
          truth(name, false)
        );
      });
      test('awaits cross-realm promises from cross-realm callbacks', async function () {
        const fn = vm.runInNewContext('(function (value) { return Promise.resolve(value); })');
        assert.equal(await api[name](fn)(false), truth(name, false));
        assert.equal(await api[name](fn)(true), truth(name, true));
      });
      test('treats a generator result as truthy without iterating it', async function () {
        assert.equal(
          await api[name](function* () {
            yield assert.fail('must not iterate');
          })(),
          truth(name, true)
        );
      });
      test('ignores hostile call and apply properties', async function () {
        const callback = new Proxy(
          function (value) {
            return value;
          },
          {
            get() {
              throw new Error('must not read callback properties');
            }
          }
        );
        assert.equal(await api[name](callback)(false), truth(name, false));
      });
      test('starts the first callback during invocation and returns a promise', async function () {
        const gate = deferred();
        let calls = 0;
        const wrapper = api[name](() => {
          calls++;
          return gate.promise;
        });
        const pending = wrapper();
        assert.equal(calls, 1);
        assert.ok(pending instanceof Promise);
        gate.resolve(false);
        assert.equal(await pending, truth(name, false));
      });
      for (const [label, error] of values) {
        for (const mode of ['throw', 'reject', 'thenable rejection', 'then getter throw']) {
          test(`rejects ${mode} ${label} with the exact failure value`, async function () {
            const wrapper = api[name](() => {
              if (mode === 'throw') throw error;
              if (mode === 'reject') return Promise.reject(error);
              if (mode === 'thenable rejection') return { then: (resolve, reject) => reject(error) };
              return Object.defineProperty({}, 'then', {
                get() {
                  throw error;
                }
              });
            });
            let pending;
            assert.doesNotThrow(() => {
              pending = wrapper();
            });
            assert.ok(pending instanceof Promise);
            await assert.rejects(pending, (actual) => Object.is(actual, error));
          });
        }
      }
      test('reevaluates callbacks for each invocation without caching results', async function () {
        let value = false,
          calls = 0;
        const wrapper = api[name](() => {
          calls++;
          return value;
        });
        assert.equal(await wrapper(), truth(name, false));
        value = true;
        assert.equal(await wrapper(), truth(name, true));
        assert.equal(calls, 2);
      });
      test('creates independent wrappers that capture their configured callback', async function () {
        const callbacks = [() => false];
        const first = api[name](...callbacks),
          second = api[name](...callbacks);
        callbacks[0] = () => true;
        assert.notEqual(first, second);
        assert.equal(await first(), truth(name, false));
        assert.equal(await second(), truth(name, false));
      });
      test('keeps concurrent invocations independent when they finish out of order', async function () {
        const firstGate = deferred(),
          secondGate = deferred(),
          first = { gate: firstGate, decision: false },
          second = { gate: secondGate, decision: true },
          firstReceiver = {},
          secondReceiver = {},
          visits = [];
        const callbacks = [
          function (input) {
            visits.push([input, this, 0]);
            return input.gate.promise;
          }
        ];
        if (name !== 'notAsync') {
          callbacks.push(function (input) {
            visits.push([input, this, 1]);
            return input.decision;
          });
        }
        const wrapper = api[name](...callbacks);
        const a = wrapper.call(firstReceiver, first),
          b = wrapper.call(secondReceiver, second);
        assert.deepEqual(visits, [
          [first, firstReceiver, 0],
          [second, secondReceiver, 0]
        ]);
        secondGate.resolve(name === 'notAsync' ? second.decision : name === 'andAsync');
        assert.equal(await b, truth(name, second.decision));
        firstGate.resolve(name === 'notAsync' ? first.decision : name === 'andAsync');
        assert.equal(await a, truth(name, first.decision));
        assert.deepEqual(
          visits,
          name === 'notAsync'
            ? [
                [first, firstReceiver, 0],
                [second, secondReceiver, 0]
              ]
            : [
                [first, firstReceiver, 0],
                [second, secondReceiver, 0],
                [second, secondReceiver, 1],
                [first, firstReceiver, 1]
              ]
        );
      });
    });
  }

  suite('notAsync validation and reentrancy', function () {
    test('rejects an omitted callback synchronously', function () {
      assert.throws(() => api.notAsync(), TypeError);
    });
    for (const [label, invalid] of invalidFunctions) {
      test(`rejects a ${label} callback synchronously without coercion`, function () {
        assert.throws(() => api.notAsync(invalid), TypeError);
      });
    }
    test('is reentrant without sharing invocation state', async function () {
      const visits = [];
      const wrapper = api.notAsync(async function (depth) {
        visits.push(depth);
        return depth ? await wrapper(depth - 1) : false;
      });
      assert.equal(await wrapper(3), false);
      assert.deepEqual(visits, [3, 2, 1, 0]);
    });
  });

  for (const name of connectives) {
    suite(`${name} sequencing and validation`, function () {
      const continuing = name === 'andAsync';
      for (let arity = 0; arity <= 6; arity++) {
        for (let bits = 0; bits < 2 ** arity; bits++) {
          const results = Array.from({ length: arity }, (_, i) => Boolean(bits & (1 << i)));
          const expected = name === 'andAsync' ? arity > 0 && results.every(Boolean) : results.some(Boolean);
          const stop = results.indexOf(!continuing);
          const visited = Array.from({ length: stop < 0 ? arity : stop + 1 }, (_, i) => i);
          for (const mode of ['synchronous', 'asynchronous']) {
            test(`${mode} truth table and short circuit [${results.join(', ')}]`, async function () {
              const visits = [];
              const callbacks = results.map((value, i) => () => {
                visits.push(i);
                return mode === 'synchronous' ? value : Promise.resolve(value);
              });
              const pending = api[name](...callbacks)();
              assert.ok(pending instanceof Promise);
              assert.equal(await pending, expected);
              assert.deepEqual(visits, visited);
            });
          }
        }
      }
      for (const inputs of [[], [null], [undefined], [null, undefined, null]]) {
        test(`empty or all-nullish configuration of length ${inputs.length} resolves false`, async function () {
          const pending = api[name](...inputs)();
          assert.ok(pending instanceof Promise);
          assert.equal(await pending, false);
        });
      }
      test('skips only nullish callbacks and preserves function order', async function () {
        const visits = [];
        assert.equal(
          await api[name](
            null,
            () => {
              visits.push(1);
              return continuing;
            },
            undefined,
            () => {
              visits.push(2);
              return !continuing;
            },
            null,
            () => {
              visits.push(3);
              throw new Error('unreachable');
            }
          )(),
          !continuing
        );
        assert.deepEqual(visits, [1, 2]);
      });
      for (const [label, invalid] of invalidFunctions.filter((entry) => entry[1] !== null && entry[1] !== undefined)) {
        test(`validates an unreachable ${label} entry synchronously before invoking callbacks`, function () {
          let calls = 0;
          assert.throws(
            () =>
              api[name](
                () => {
                  calls++;
                  return !continuing;
                },
                null,
                invalid
              ),
            TypeError
          );
          assert.equal(calls, 0);
        });
      }
      test('waits for each callback before starting the next', async function () {
        const first = deferred(),
          second = deferred(),
          secondStarted = deferred(),
          visits = [];
        const wrapper = api[name](
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
            return continuing;
          }
        );
        const pending = wrapper();
        assert.deepEqual(visits, [1]);
        first.resolve(continuing);
        await secondStarted.promise;
        assert.deepEqual(visits, [1, 2]);
        second.resolve(continuing);
        assert.equal(await pending, continuing);
        assert.deepEqual(visits, [1, 2, 3]);
      });
      test('defers later callbacks even when the first callback returns a plain value', async function () {
        const visits = [];
        const pending = api[name](
          () => {
            visits.push(1);
            return continuing;
          },
          () => {
            visits.push(2);
            return continuing;
          }
        )();
        assert.deepEqual(visits, [1]);
        assert.equal(await pending, continuing);
        assert.deepEqual(visits, [1, 2]);
      });
      for (const mode of ['throw', 'reject', 'then getter throw']) {
        for (const position of [0, 1, 2]) {
          test(`${mode} at position ${position} prevents every later callback`, async function () {
            const error = {},
              visits = [];
            const callbacks = [0, 1, 2, 3].map((i) => () => {
              visits.push(i);
              if (i !== position) return continuing;
              if (mode === 'throw') throw error;
              if (mode === 'reject') return Promise.reject(error);
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
      test('gives proxy apply traps separate argument arrays while preserving the original values', async function () {
        const original = { count: 0 },
          receiver = {},
          trapArrays = [];
        const callback = new Proxy(function () {}, {
          apply(target, context, args) {
            assert.equal(context, receiver);
            assert.equal(args.length, 2);
            assert.equal(args[0], original);
            assert.equal(args[1], undefined);
            original.count++;
            trapArrays.push(args);
            args[0] = 'replaced by trap';
            args.push('extra');
            return continuing;
          }
        });
        assert.equal(await api[name](callback, callback).call(receiver, original, undefined), continuing);
        assert.equal(original.count, 2);
        assert.notEqual(trapArrays[0], trapArrays[1]);
      });
      test('passes shared argument objects with mutations visible to later callbacks', async function () {
        const input = { count: 0 };
        assert.equal(
          await api[name](
            (value) => {
              assert.equal(value, input);
              value.count++;
              return continuing;
            },
            (value) => {
              assert.equal(value, input);
              assert.equal(value.count, 1);
              return continuing;
            }
          )(input),
          continuing
        );
      });
      test('evaluates repeated callback references separately in configured order', async function () {
        let calls = 0;
        const callback = () => {
          calls++;
          return calls < 3 ? continuing : !continuing;
        };
        assert.equal(await api[name](callback, callback, callback, callback)(), !continuing);
        assert.equal(calls, 3);
      });
      test('is reentrant with independent arguments, receivers, and positions', async function () {
        const receiver = {},
          visits = [];
        const wrapper = api[name](
          async function (depth) {
            assert.equal(this, receiver);
            visits.push([depth, 0]);
            return depth ? await wrapper.call(receiver, depth - 1) : continuing;
          },
          function (depth) {
            assert.equal(this, receiver);
            visits.push([depth, 1]);
            return continuing;
          }
        );
        assert.equal(await wrapper.call(receiver, 2), continuing);
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
