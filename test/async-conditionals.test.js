'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api.js');
const { invalidFunctions, values } = require('./helpers/values.js');

function deferred() {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

function returned(value, mode) {
  if (mode === 'promise') return Promise.resolve(value);
  if (mode === 'thenable') return { then: (resolve) => resolve({ then: (inner) => inner(value) }) };
  return value;
}

function failWith(error, mode) {
  if (mode === 'throw') throw error;
  if (mode === 'reject') return Promise.reject(error);
  if (mode === 'thenable rejection') return { then: (resolve, reject) => reject(error) };
  return Object.defineProperty({}, 'then', {
    get() {
      throw error;
    }
  });
}

suite('async conditional composition', function () {
  for (const name of ['whenAsync', 'ifElseAsync']) {
    suite(name, function () {
      const isWhen = name === 'whenAsync';
      const arity = isWhen ? 2 : 3;
      test('is exported as the exact-reference async alias', function () {
        assert.equal(typeof api[name], 'function');
        assert.equal(api[isWhen ? 'when' : 'ifElse'].async, api[name]);
      });
      test('constructs fresh wrappers synchronously without invoking callbacks', function () {
        let calls = 0;
        const callback = () => ++calls;
        const first = api[name](callback, callback, callback);
        assert.equal(typeof first, 'function');
        assert.notEqual(first, api[name](callback, callback, callback));
        assert.equal(calls, 0);
      });
      for (let supplied = 0; supplied < arity; supplied++) {
        test(`requires all callbacks with ${supplied} supplied`, function () {
          assert.throws(() => api[name](...Array(supplied).fill(() => true)), TypeError);
        });
      }
      for (let position = 0; position < arity; position++) {
        for (const [label, invalid] of invalidFunctions) {
          test(`synchronously rejects ${label} at callback ${position} without invocation or coercion`, function () {
            let calls = 0;
            const callbacks = Array(arity).fill(() => {
              calls++;
              return true;
            });
            callbacks[position] = invalid;
            assert.throws(() => api[name](...callbacks), TypeError);
            assert.equal(calls, 0);
          });
        }
      }
      for (const [label, value] of values) {
        for (const mode of ['value', 'promise', 'thenable']) {
          test(`selects one branch from awaited ${mode} ${label} truthiness`, async function () {
            const input = {},
              visits = [];
            const wrapper = api[name](
              (original) => {
                assert.equal(original, input);
                visits.push('predicate');
                return returned(value, mode);
              },
              () => {
                visits.push('true');
                return 'yes';
              },
              () => {
                visits.push('false');
                return 'no';
              }
            );
            const pending = wrapper(input);
            assert.ok(pending instanceof Promise);
            assert.equal(await pending, value ? 'yes' : isWhen ? input : 'no');
            assert.deepEqual(visits, value ? ['predicate', 'true'] : isWhen ? ['predicate'] : ['predicate', 'false']);
          });
          for (const decision of isWhen ? [true] : [true, false]) {
            test(`unwraps selected ${decision} branch ${mode} ${label}`, async function () {
              const selected = () => returned(value, mode);
              const unused = () => assert.fail('unselected branch');
              const wrapper = api[name](() => decision, decision ? selected : unused, decision ? unused : selected);
              const pending = wrapper('input');
              assert.ok(pending instanceof Promise);
              assert.ok(Object.is(await pending, value));
            });
          }
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
        for (const decision of [true, false]) {
          test(`preserves strict ${label} this and original arguments on ${decision}`, async function () {
            const input = {},
              inputPromise = Promise.resolve(false),
              seen = [];
            const original = [input, inputPromise, undefined, 17];
            function check() {
              seen.push(this);
              assert.deepEqual([...arguments], isWhen ? [input] : original);
            }
            const wrapper = api[name](
              function () {
                Reflect.apply(check, this, arguments);
                return decision;
              },
              function () {
                Reflect.apply(check, this, arguments);
                return 'yes';
              },
              function () {
                Reflect.apply(check, this, arguments);
                return 'no';
              }
            );
            assert.equal(await wrapper.apply(receiver, original), decision ? 'yes' : isWhen ? input : 'no');
            assert.deepEqual(seen, isWhen && !decision ? [receiver] : [receiver, receiver]);
          });
        }
      }
      for (const decision of [true, false]) {
        test(`preserves plain-call undefined this and omitted-argument arity on ${decision}`, async function () {
          const calls = [];
          const callback = function () {
            assert.equal(this, undefined);
            assert.equal(arguments.length, isWhen ? 1 : 0);
            if (isWhen) assert.equal(arguments[0], undefined);
            calls.push('callback');
            return decision;
          };
          const wrapper = api[name](callback, callback, callback);
          assert.equal(await wrapper(), isWhen && !decision ? undefined : decision);
          assert.equal(calls.length, isWhen && !decision ? 1 : 2);
        });
      }
      test('passes promise-like inputs untouched to the predicate and selected branch', async function () {
        const input = Object.defineProperty({}, 'then', {
          get() {
            throw new Error('input was inspected');
          }
        });
        const wrapper = api[name](
          (value) => {
            assert.equal(value, input);
            return true;
          },
          (value) => {
            assert.equal(value, input);
            return 'done';
          },
          () => assert.fail('false branch')
        );
        assert.equal(await wrapper(input), 'done');
      });
      test('honors bound callbacks and assimilates cross-realm predicate and branch promises', async function () {
        const receiver = {};
        const predicate = function () {
          assert.equal(this, receiver);
          return false;
        }.bind(receiver);
        const foreignPredicate = vm.runInNewContext('(function () { return Promise.resolve(true); })');
        const foreignBranch = vm.runInNewContext('(function (value) { return Promise.resolve(value + 1); })');
        assert.equal(await api[name](foreignPredicate, foreignBranch, foreignBranch)(2), 3);
        assert.equal(await api[name](predicate, foreignBranch, foreignBranch)(2), isWhen ? 2 : 3);
      });
      test('treats generator predicate results as truthy without iterating', async function () {
        assert.equal(
          await api[name](
            function* () {
              yield assert.fail('must not iterate');
            },
            () => 'yes',
            () => 'no'
          )(),
          'yes'
        );
      });
      test('ignores callback call/apply properties and isolates proxy argument arrays', async function () {
        const original = { count: 0 },
          receiver = {},
          trapArrays = [];
        function proxy(result) {
          return new Proxy(function () {}, {
            get() {
              throw new Error('callback property read');
            },
            apply(target, context, args) {
              assert.equal(context, receiver);
              assert.deepEqual(args, isWhen ? [original] : [original, undefined]);
              original.count++;
              trapArrays.push(args);
              args[0] = 'replacement';
              args.push('extra');
              return result;
            }
          });
        }
        assert.equal(
          await api[name](proxy(true), proxy('done'), proxy('wrong')).call(receiver, original, undefined),
          'done'
        );
        assert.equal(original.count, 2);
        assert.notEqual(trapArrays[0], trapArrays[1]);
      });
      test('starts the predicate immediately and awaits it before selecting a branch', async function () {
        const predicateGate = deferred(),
          branchGate = deferred(),
          branchStarted = deferred(),
          visits = [];
        const pending = api[name](
          () => {
            visits.push('predicate');
            return predicateGate.promise;
          },
          () => {
            visits.push('branch');
            branchStarted.resolve();
            return branchGate.promise;
          },
          () => assert.fail('false branch')
        )();
        assert.ok(pending instanceof Promise);
        assert.deepEqual(visits, ['predicate']);
        predicateGate.resolve(true);
        await branchStarted.promise;
        assert.deepEqual(visits, ['predicate', 'branch']);
        let settled = false;
        pending.then(() => {
          settled = true;
        });
        await Promise.resolve();
        assert.equal(settled, false);
        branchGate.resolve('done');
        assert.equal(await pending, 'done');
      });
      test('defers branch invocation even for a synchronous predicate result', async function () {
        const visits = [];
        const pending = api[name](
          () => {
            visits.push('predicate');
            return true;
          },
          () => {
            visits.push('branch');
            return 3;
          },
          () => assert.fail('false branch')
        )();
        assert.deepEqual(visits, ['predicate']);
        assert.equal(await pending, 3);
        assert.deepEqual(visits, ['predicate', 'branch']);
      });
      for (const [label, error] of values) {
        for (const mode of ['throw', 'reject', 'thenable rejection', 'then getter throw']) {
          for (const stage of isWhen ? ['predicate', 'true'] : ['predicate', 'true', 'false']) {
            test(`rejects ${stage} ${mode} ${label} with exact identity and stops callbacks`, async function () {
              const visits = [];
              const callbacks = ['predicate', 'true', 'false'].map((position) => () => {
                visits.push(position);
                if (position === stage) return failWith(error, mode);
                if (position === 'predicate') return stage === 'true';
                assert.fail('unselected branch');
              });
              let pending;
              assert.doesNotThrow(() => {
                pending = api[name](...callbacks)();
              });
              assert.ok(pending instanceof Promise);
              await assert.rejects(pending, (actual) => Object.is(actual, error));
              assert.deepEqual(visits, stage === 'predicate' ? ['predicate'] : ['predicate', stage]);
            });
          }
        }
      }
      test('reevaluates repeated callback references and each invocation', async function () {
        let calls = 0;
        const callback = () => ++calls;
        const wrapper = api[name](callback, callback, callback);
        assert.equal(await wrapper(), 2);
        assert.equal(await wrapper(), 4);
        assert.equal(calls, 4);
      });
      test('keeps concurrent calls independent when predicates resolve out of order', async function () {
        const first = { gate: deferred(), label: 'first' },
          second = { gate: deferred(), label: 'second' };
        const firstReceiver = {},
          secondReceiver = {},
          visits = [];
        const wrapper = api[name](
          function (input) {
            visits.push([input.label, this, 'predicate']);
            return input.gate.promise;
          },
          function (input) {
            visits.push([input.label, this, 'true']);
            return input.label;
          },
          function (input) {
            visits.push([input.label, this, 'false']);
            return input.label;
          }
        );
        const a = wrapper.call(firstReceiver, first),
          b = wrapper.call(secondReceiver, second);
        assert.notEqual(a, b);
        assert.deepEqual(visits, [
          ['first', firstReceiver, 'predicate'],
          ['second', secondReceiver, 'predicate']
        ]);
        second.gate.resolve(true);
        assert.equal(await b, 'second');
        first.gate.resolve(false);
        assert.equal(await a, isWhen ? first : 'first');
        assert.deepEqual(
          visits,
          isWhen
            ? [
                ['first', firstReceiver, 'predicate'],
                ['second', secondReceiver, 'predicate'],
                ['second', secondReceiver, 'true']
              ]
            : [
                ['first', firstReceiver, 'predicate'],
                ['second', secondReceiver, 'predicate'],
                ['second', secondReceiver, 'true'],
                ['first', firstReceiver, 'false']
              ]
        );
      });
      test('is reentrant with independent inputs and receivers', async function () {
        const receiver = {},
          visits = [];
        const wrapper = api[name](
          async function (depth) {
            assert.equal(this, receiver);
            visits.push(['predicate', depth]);
            if (depth) assert.equal(await wrapper.call(receiver, depth - 1), depth - 1);
            return true;
          },
          function (depth) {
            assert.equal(this, receiver);
            visits.push(['branch', depth]);
            return depth;
          },
          () => assert.fail('false branch')
        );
        assert.equal(await wrapper.call(receiver, 2), 2);
        assert.deepEqual(visits, [
          ['predicate', 2],
          ['predicate', 1],
          ['predicate', 0],
          ['branch', 0],
          ['branch', 1],
          ['branch', 2]
        ]);
      });
    });
  }
  for (const [label, value] of values) {
    for (const mode of ['value', 'promise', 'thenable']) {
      test(`whenAsync false branch resolves original ${mode} ${label}`, async function () {
        const input = returned(value, mode);
        const wrapper = api.whenAsync(
          (original) => {
            assert.equal(original, input);
            return false;
          },
          () => assert.fail('transform')
        );
        assert.ok(Object.is(await wrapper(input), value));
      });
    }
  }
  test('whenAsync assimilates its untouched falsy-branch input only after the predicate settles', async function () {
    const gate = deferred(),
      visits = [],
      input = {
        then(resolve) {
          visits.push('then');
          resolve('unwrapped');
        }
      };
    const pending = api.whenAsync(
      (value) => {
        assert.equal(value, input);
        visits.push('predicate');
        return gate.promise;
      },
      () => assert.fail('transform')
    )(input);
    assert.deepEqual(visits, ['predicate']);
    await Promise.resolve();
    assert.deepEqual(visits, ['predicate']);
    gate.resolve(false);
    assert.equal(await pending, 'unwrapped');
    assert.deepEqual(visits, ['predicate', 'then']);
  });
  test('whenAsync rejects a falsy-branch input then getter failure with exact identity', async function () {
    const error = {},
      input = Object.defineProperty({}, 'then', {
        get() {
          throw error;
        }
      });
    const pending = api.whenAsync(
      (original) => {
        assert.equal(original, input);
        return false;
      },
      () => assert.fail('transform')
    )(input);
    await assert.rejects(pending, (actual) => actual === error);
  });
});
