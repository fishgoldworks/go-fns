'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api.js');
const { invalidFunctions, values } = require('./helpers/values.js');

suite('2.2 argument adapters and conditional composition', function () {
  for (const name of ['partial', 'partialRight', 'unary', 'when', 'ifElse', 'repeatAsync', 'debounce', 'throttle']) {
    test(`${name} is an exported function`, () => assert.equal(typeof api[name], 'function'));
  }
  for (const name of ['partial', 'partialRight', 'unary']) {
    for (const [label, value] of invalidFunctions) {
      test(`${name} rejects ${label} callback`, () => assert.throws(() => api[name](value), TypeError));
    }
    test(`${name} does not invoke at construction and returns fresh wrappers`, () => {
      let calls = 0;
      const fn = () => ++calls;
      assert.notEqual(api[name](fn), api[name](fn));
      assert.equal(calls, 0);
    });
    test(`${name} forwards this and ignores hostile call/apply properties`, () => {
      const receiver = {};
      function fn() {
        assert.equal(this, receiver);
        return [...arguments];
      }
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
      assert.deepEqual(api[name](fn).call(receiver, 3), [3]);
    });
    test(`${name} handles bound and cross-realm callbacks`, () => {
      const receiver = {};
      function fn() {
        return this;
      }
      assert.equal(api[name](fn.bind(receiver))(), receiver);
      const foreign = vm.runInNewContext('(function(x){return x+1;})');
      assert.equal(api[name](foreign)(1), 2);
    });
    for (const [label, value] of values) {
      test(`${name} preserves returned and thrown ${label}`, () => {
        assert.equal(api[name](() => value)(), value);
        assert.throws(
          () =>
            api[name](() => {
              throw value;
            })(),
          (e) => Object.is(e, value)
        );
      });
    }
    test(`${name} returns the same promise without awaiting`, async () => {
      const promise = Promise.resolve(3);
      assert.equal(api[name](() => promise)(), promise);
      await promise;
    });
    test(`${name} propagates a revoked callable failure`, () => {
      const revoked = Proxy.revocable(() => 1, {});
      const wrapper = api[name](revoked.proxy);
      revoked.revoke();
      assert.throws(() => wrapper(), TypeError);
    });
  }
  for (const name of ['partial', 'partialRight']) {
    for (const fixedCount of [0, 1, 2, 5])
      for (const dynamicCount of [0, 1, 3, 7]) {
        test(`${name} orders ${fixedCount} fixed and ${dynamicCount} dynamic arguments`, () => {
          const fixed = Array.from({ length: fixedCount }, (_, i) => ({ fixed: i }));
          const dynamic = Array.from({ length: dynamicCount }, (_, i) => ({ dynamic: i }));
          const fn = api[name](
            function () {
              return [...arguments];
            },
            ...fixed
          );
          const expected = name === 'partial' ? [...fixed, ...dynamic] : [...dynamic, ...fixed];
          assert.deepEqual(fn(...dynamic), expected);
          assert.deepEqual(fn(...dynamic), expected);
        });
      }
    test(`${name} preserves explicit undefined and reference identity`, () => {
      const token = {};
      const fn = api[name](
        function () {
          return [...arguments];
        },
        undefined,
        token
      );
      const result = fn(null);
      assert.deepEqual(result, name === 'partial' ? [undefined, token, null] : [null, undefined, token]);
      assert.equal(result[name === 'partial' ? 1 : 2], token);
    });
    test(`${name} isolates arrays passed to a function proxy`, () => {
      let previous;
      const fn = new Proxy(() => {}, {
        apply(_, receiver, args) {
          assert.notEqual(args, previous);
          previous = args;
          const value = args.slice();
          args.length = 0;
          return value;
        }
      });
      const wrapper = api[name](fn, 'fixed');
      assert.deepEqual(wrapper('a'), name === 'partial' ? ['fixed', 'a'] : ['a', 'fixed']);
      assert.deepEqual(wrapper('b'), name === 'partial' ? ['fixed', 'b'] : ['b', 'fixed']);
    });
    test(`${name} supports recursive use without changing saved arguments`, () => {
      let wrapper;
      function fn(...args) {
        const n = args[name === 'partial' ? 1 : 0];
        return n ? wrapper(n - 1) : args;
      }
      wrapper = api[name](fn, 'fixed');
      assert.deepEqual(wrapper(2), name === 'partial' ? ['fixed', 0] : [0, 'fixed']);
    });
  }
  test('unary always passes exactly one value including omission', () => {
    const fn = api.unary(function () {
      return [...arguments];
    });
    assert.deepEqual(fn(), [undefined]);
    assert.deepEqual(fn(1, 2, 3), [1]);
  });
  test('unary prevents Array.map callback argument leakage', () => {
    assert.deepEqual(['10', '20', '30'].map(api.unary(parseInt)), [10, 20, 30]);
    const format = api.unary(api.partialRight(JSON.stringify, null, 2));
    assert.deepEqual([{ a: 1 }, { a: 2 }].map(format), ['{\n  "a": 1\n}', '{\n  "a": 2\n}']);
  });
  for (const name of ['when', 'ifElse']) {
    for (const [label, value] of invalidFunctions) {
      for (const position of name === 'when' ? [0, 1] : [0, 1, 2]) {
        test(`${name} rejects ${label} at callback position ${position} immediately`, () => {
          let called = false;
          const args = Array(name === 'when' ? 2 : 3).fill(() => {
            called = true;
          });
          args[position] = value;
          assert.throws(() => api[name](...args), TypeError);
          assert.equal(called, false);
        });
      }
    }
    for (const [label, value] of values) {
      test(`${name} uses truthiness of ${label} and evaluates once`, () => {
        let predicates = 0,
          yes = 0,
          no = 0;
        const token = {};
        const fn = api[name](
          () => {
            predicates++;
            return value;
          },
          () => {
            yes++;
            return 'yes';
          },
          () => {
            no++;
            return 'no';
          }
        );
        assert.equal(fn(token), value ? 'yes' : name === 'when' ? token : 'no');
        assert.equal(predicates, 1);
        assert.equal(yes, value ? 1 : 0);
        assert.equal(no, !value && name === 'ifElse' ? 1 : 0);
      });
    }
    test(`${name} treats promises as truthy without awaiting`, async () => {
      const p = Promise.resolve(false);
      const fn = api[name](
        () => p,
        () => p,
        () => 0
      );
      assert.equal(fn(1), p);
      await p;
    });
    test(`${name} forwards receiver and honors bound callbacks`, () => {
      const receiver = {};
      function check() {
        assert.equal(this, receiver);
        return true;
      }
      function branch() {
        assert.equal(this, receiver);
        return 1;
      }
      assert.equal(api[name](check, branch, branch).call(receiver, 3, 4), 1);
      assert.equal(api[name](check.bind(receiver), branch.bind(receiver), branch.bind(receiver))(3), 1);
    });
    test(`${name} ignores hostile callback invocation properties`, () => {
      const yes = () => true,
        fn = (x) => x;
      for (const f of [yes, fn])
        Object.defineProperties(f, {
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
      assert.equal(api[name](yes, fn, fn)(3), 3);
    });
    for (const failure of ['predicate', 'selected branch']) {
      test(`${name} propagates ${failure} exception without extra calls`, () => {
        const token = {};
        let calls = 0;
        const fn = api[name](
          () => {
            calls++;
            if (failure === 'predicate') throw token;
            return true;
          },
          () => {
            calls++;
            throw token;
          },
          () => {
            throw new Error('unselected');
          }
        );
        assert.throws(
          () => fn(1),
          (e) => e === token
        );
        assert.equal(calls, failure === 'predicate' ? 1 : 2);
      });
    }
  }
  test('when passes exactly one input and preserves original object on false', () => {
    const value = {};
    let p, t;
    const yes = api.when(
      function () {
        p = [...arguments];
        return true;
      },
      function () {
        t = [...arguments];
        return value;
      }
    );
    assert.equal(yes(value, 2), value);
    assert.deepEqual(p, [value]);
    assert.deepEqual(t, [value]);
    assert.equal(
      api.when(
        () => false,
        () => {
          throw 1;
        }
      )(value),
      value
    );
    assert.equal(
      api.when(
        () => false,
        () => {
          throw 1;
        }
      )(),
      undefined
    );
  });
  test('ifElse forwards all arguments to selected branch only', () => {
    for (const truth of [true, false]) {
      const args = [{}, undefined, 3];
      let seen;
      const predicate = function () {
        assert.deepEqual([...arguments], args);
        return truth;
      };
      const selected = function () {
        seen = [...arguments];
        return this;
      };
      const fail = () => {
        throw 1;
      };
      const receiver = {};
      assert.equal(
        api.ifElse(predicate, truth ? selected : fail, truth ? fail : selected).apply(receiver, args),
        receiver
      );
      assert.deepEqual(seen, args);
    }
    assert.equal(
      api.ifElse(
        () => false,
        () => 1,
        function () {
          return arguments.length;
        }
      )(),
      0
    );
  });
});
