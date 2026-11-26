'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

suite('composition handoffs', function () {
  // These check combinations, not a second copy of each helper's truth table.
  for (const outer of ['partial', 'partialRight']) {
    for (const inner of ['partial', 'partialRight']) {
      for (const shape of ['empty', 'saved only', 'input only', 'mixed']) {
        test(`${outer} wrapping ${inner}: ${shape} argument lists preserve identity and receiver`, function () {
          const receiver = Object.freeze({ role: 'caller' });
          const first = Object.freeze({ position: 'inner' });
          const last = Symbol('outer');
          const a = shape === 'empty' || shape === 'input only' ? [] : [first, undefined];
          const b = shape === 'empty' || shape === 'input only' ? [] : [last, -0];
          const c = shape === 'empty' || shape === 'saved only' ? [] : [null, NaN, Object.freeze({})];
          const outerArgs = outer === 'partial' ? [...b, ...c] : [...c, ...b];
          const expected = inner === 'partial' ? [...a, ...outerArgs] : [...outerArgs, ...a];
          const seen = [];
          const fn = new Proxy(function () {}, {
            get() {
              assert.fail('The callback properties must not be read.');
            },
            apply(target, context, input) {
              assert.equal(context, receiver);
              assert.equal(input.length, expected.length);
              input.forEach((value, i) => assert.ok(Object.is(value, expected[i])));
              assert.equal(seen.includes(input), false);
              seen.push(input);
              input.length = 0;

              return first;
            }
          });
          const run = api[outer](api[inner](fn, ...a), ...b);

          assert.equal(run.apply(receiver, c), first);
          assert.equal(run.apply(receiver, c), first);
          assert.equal(seen.length, 2);
        });
      }
    }
  }

  test('spread snapshots length but reads each argument in order, including inherited entries', function () {
    const log = [];
    const token = Object.freeze({});
    const prototype = { 1: token };
    const input = Object.create(prototype);

    Object.defineProperties(input, {
      length: {
        configurable: true,
        get() {
          log.push('length');

          return 3;
        }
      },
      0: {
        get() {
          log.push('0');
          Object.defineProperty(input, 'length', { value: 0 });

          return undefined;
        }
      },
      2: {
        get() {
          log.push('2');

          return 'last';
        }
      },
      [Symbol.iterator]: {
        get() {
          return assert.fail('Array-like expansion must not use the iterator.');
        }
      }
    });
    const result = api.spread(function () {
      log.push('call');

      return Array.from(arguments);
    })(input);

    assert.deepEqual(result, [undefined, token, 'last']);
    assert.equal(result[1], token);
    assert.deepEqual(log, ['length', '0', '2', 'call']);
  });

  for (const length of [undefined, -1, -0, 0, 1.9, '2']) {
    test(`spread length conversion: ${Object.is(length, -0) ? '-0' : String(length)}`, function () {
      function callback() {
        return { receiver: this, args: Array.from(arguments) };
      }

      const receiver = {};
      const list = { 0: 'zero', 1: 'one', length };

      assert.deepEqual(api.spread(callback).call(receiver, list), Reflect.apply(callback, receiver, list));
    });
  }

  test('spread propagates symbol length errors without reading numeric entries or invoking callback', function () {
    let invoked = false;
    const input = {
      length: Symbol('invalid length'),
      get 0() {
        return assert.fail('Length conversion must finish before indexed reads.');
      }
    };

    assert.throws(
      () =>
        api.spread(() => {
          invoked = true;
        })(input),
      TypeError
    );
    assert.equal(invoked, false);
  });

  test('spread allows argument getters to reenter the same wrapper without corrupting either call', function () {
    const receiver = {};
    const run = api.spread(
      api.partialRight(function () {
        assert.equal(this, receiver);

        return Array.from(arguments);
      }, 'suffix')
    );
    let inner;
    const input = {
      length: 2,
      get 0() {
        inner = run.call(receiver, ['nested']);

        return 'outer';
      },
      1: undefined
    };

    assert.deepEqual(run.call(receiver, input), ['outer', undefined, 'suffix']);
    assert.deepEqual(inner, ['nested', 'suffix']);
  });

  for (const compose of ['pipe', 'pipeAsync']) {
    for (let seed = 0; seed < 16; seed++) {
      test(`${compose} mixed sequence ${seed} agrees with an explicit reference`, async function () {
        const receiver = { offset: seed + 1 };
        const seen = [];
        const steps = [];
        let expected = seed;
        const expectedSeen = [];

        for (let i = 0; i < 6; i++) {
          const choice = ((seed >>> (i % 4)) + i) % 4;

          if (choice === 0) {
            steps.push(
              api.partialRight(function (value, delta) {
                assert.equal(this, receiver);
                assert.equal(arguments.length, 2);

                return value + delta + this.offset;
              }, i)
            );
            expected += i + receiver.offset;
          } else if (choice === 1) {
            steps.push(
              api.when(
                (value) => value % 2 === 0,
                (value) => value / 2
              )
            );
            if (expected % 2 === 0) expected /= 2;
          } else if (choice === 2) {
            steps.push(
              api.ifElse(
                (value) => value > 4,
                (value) => value - 3,
                (value) => value + 4
              )
            );
            expected = expected > 4 ? expected - 3 : expected + 4;
          } else {
            steps.push(
              api.tap(function (value) {
                assert.equal(this, receiver);
                seen.push(value);

                return 'ignored';
              })
            );
            expectedSeen.push(expected);
          }

          steps.push(i % 2 ? null : undefined);
        }

        const result = api[compose](...steps).call(receiver, seed);

        if (compose === 'pipe') assert.equal(result, expected);
        else assert.equal(await result, expected);
        assert.deepEqual(seen, expectedSeen);
      });
    }
  }

  test('a pipeline expands only an explicit spread stage; later stages still receive one array result', function () {
    const token = {};
    const receiver = {};
    const value = api
      .pipe(
        api.spread(
          api.partial(function () {
            assert.equal(this, receiver);
            assert.deepEqual(Array.from(arguments), ['prefix', token, undefined]);

            return [token, 7];
          }, 'prefix')
        ),
        api.unary(function (input) {
          assert.equal(this, receiver);
          assert.equal(arguments.length, 1);

          return input;
        }),
        api.tap((input) => {
          input.push(9);
        })
      )
      .call(receiver, [token, undefined]);

    assert.deepEqual(value, [token, 7, 9]);
    assert.equal(value[0], token);
  });

  for (const name of ['pipe', 'spread', 'partial', 'partialRight', 'unary', 'when', 'ifElse', 'tap']) {
    test(`${name} in a synchronous composition does not inspect a thenable result or input`, function () {
      const input = Object.defineProperty({}, 'then', {
        get() {
          return assert.fail('Unexpected promise assimilation.');
        }
      });
      let wrapper;

      if (name === 'when')
        wrapper = api.when(
          () => false,
          () => assert.fail('Unselected transform.')
        );
      else if (name === 'ifElse')
        wrapper = api.ifElse(
          () => true,
          (x) => x,
          () => assert.fail('Unselected branch.')
        );
      else if (name === 'tap') wrapper = api.tap(() => input);
      else if (name === 'spread') wrapper = (x) => api.spread((value) => value)([x]);
      else wrapper = api[name]((x) => x);
      assert.equal(api.pipe(wrapper, (x) => x)(input), input);
    });
  }

  // Malformed thenables are valid inputs to native promise assimilation. The first
  // settlement must win and a second callback invocation must never be triggered.
  for (const slot of [
    'pipeline stage',
    'tap observer',
    'when predicate',
    'when transform',
    'ifElse predicate',
    'true branch',
    'false branch'
  ]) {
    for (const mode of ['resolve twice', 'resolve then throw', 'reject then resolve', 'reject then throw']) {
      test(`${slot}: ${mode} preserves first settlement and exact failure identity`, async function () {
        const token = Object.freeze({ result: true });
        const reason = Symbol('reason');
        let thenCalls = 0,
          predicateCalls = 0,
          branchCalls = 0,
          finalCalls = 0;
        const thenable = {
          then(resolve, reject) {
            assert.equal(this, thenable);
            thenCalls++;
            if (mode.startsWith('reject')) reject(reason);
            else resolve(token);
            if (mode.endsWith('throw')) throw new Error('Already settled');
            resolve('ignored second settlement');
          }
        };
        const predicate = () => {
          predicateCalls++;

          return thenable;
        };

        const selected = () => {
          branchCalls++;

          return thenable;
        };

        const selectedValue = () => {
          branchCalls++;

          return token;
        };

        const unused = () => assert.fail('Unselected branch');
        let operation;

        if (slot === 'pipeline stage') operation = api.pipeAsync(() => thenable);
        else if (slot === 'tap observer') operation = api.tapAsync(() => thenable);
        else if (slot === 'when predicate') operation = api.whenAsync(predicate, selectedValue);
        else if (slot === 'when transform') operation = api.whenAsync(() => true, selected);
        else if (slot === 'ifElse predicate') operation = api.ifElseAsync(predicate, selectedValue, unused);
        else
          operation = api.ifElseAsync(
            () => slot === 'true branch',
            slot === 'true branch' ? selected : unused,
            slot === 'false branch' ? selected : unused
          );
        const pending = api.pipeAsync(operation, (value) => {
          finalCalls++;

          return value;
        })(token);

        if (mode.startsWith('reject')) {
          await assert.rejects(pending, (error) => error === reason);
          assert.equal(finalCalls, 0);
        } else {
          assert.equal(await pending, token);
          assert.equal(finalCalls, 1);
        }

        assert.equal(thenCalls, 1);
        if (slot.endsWith('predicate')) {
          assert.equal(predicateCalls, 1);
          assert.equal(branchCalls, mode.startsWith('reject') ? 0 : 1);
        } else if (slot.endsWith('branch') || slot === 'when transform') assert.equal(branchCalls, 1);
      });
    }
  }

  for (const name of ['whenAsync', 'ifElseAsync']) {
    test(`${name} preserves live input and receiver references across an await`, async function () {
      const gate = deferred();
      const input = { value: 1 };
      const receiver = { value: 2 };
      let seen;
      const run = api[name](
        function (x) {
          assert.equal(this, receiver);
          assert.equal(x, input);

          return gate.promise;
        },
        function (x) {
          seen = x;

          return x.value + this.value;
        },
        () => assert.fail('unselected')
      );
      const pending = run.call(receiver, input);

      input.value = 3;
      receiver.value = 4;
      gate.resolve(true);
      assert.equal(await pending, 7);
      assert.equal(seen, input);
    });

    for (const selected of [false, true]) {
      test(`${name} with a callback revoked while awaiting the predicate: selected=${selected}`, async function () {
        const gate = deferred();
        const callback = Proxy.revocable(() => 'selected', {});
        const input = {};
        const run = api[name](
          () => gate.promise,
          callback.proxy,
          () => input
        );
        const pending = run(input);

        callback.revoke();
        gate.resolve(selected);
        if (selected) await assert.rejects(pending, TypeError);
        else assert.equal(await pending, input);
      });
    }
  }

  test('tapAsync does not inspect an input thenable until its observer has completed', async function () {
    const gate = deferred();
    const visits = [];
    const input = {
      get then() {
        visits.push('input then');

        return (resolve) => resolve(7);
      }
    };
    const pending = api.tapAsync((x) => {
      assert.equal(x, input);
      visits.push('observer');

      return gate.promise;
    })(input);

    await Promise.resolve();
    assert.deepEqual(visits, ['observer']);
    gate.resolve();
    assert.equal(await pending, 7);
    assert.deepEqual(visits, ['observer', 'input then']);
  });

  test('mixed asynchronous pipeline isolates interleaved receivers, rejected calls and observation', async function () {
    const gates = new Map();
    const observed = [];
    const error = Symbol('one call failed');
    const run = api.pipeAsync(
      function (id) {
        const gate = deferred();

        gates.set(id, gate);

        return gate.promise;
      },
      api.whenAsync(
        (value) => value % 2 === 0,
        (value) => value / 2
      ),
      api.ifElseAsync(
        (value) => value > 0,
        api.partialRight(function (value, delta) {
          return value + this.offset + delta;
        }, 1),
        () => 0
      ),
      api.tapAsync(function (value) {
        observed.push([this, value]);
      })
    );
    const a = { offset: 10 },
      b = { offset: 20 },
      c = { offset: 30 };
    const first = run.call(a, 'a'),
      failed = run.call(b, 'b'),
      last = run.call(c, 'c');
    const rejection = assert.rejects(failed, (e) => e === error);

    gates.get('c').resolve(4);
    assert.equal(await last, 33);
    gates.get('b').reject(error);
    await rejection;
    gates.get('a').resolve(6);
    assert.equal(await first, 14);
    assert.deepEqual(observed, [
      [c, 33],
      [a, 14]
    ]);
    const next = run.call(b, 'next');

    gates.get('next').resolve(2);
    assert.equal(await next, 22);
  });

  for (const compose of ['pipe', 'pipeAsync']) {
    test(`${compose} retains a foreign sloppy callback's native receiver rules`, async function () {
      const other = vm.runInNewContext(
        '({ capture: function(value) { return { receiver: this, value }; }, global: this })'
      );
      const run = api[compose](api.partialRight(other.capture));

      assert.equal((await run.call(null, 7)).receiver, other.global);
      const receiver = {};

      assert.equal((await run.call(receiver, 8)).receiver, receiver);
    });
  }
});
