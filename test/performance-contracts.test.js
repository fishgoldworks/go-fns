'use strict';
const assert = require('node:assert/strict');
const api = require('./helpers/api.js');

// Contract tests for allocation and small-composition optimisations. No wall-clock
// thresholds belong here; benchmarks measure speed separately from correctness.
suite('optimisation compatibility', function () {
  for (const [name, length] of Object.entries({
    pipe: 1,
    spread: 1,
    attempt: 2,
    repeat: 3,
    delay: 3,
    and: 1,
    or: 1,
    xor: 1,
    nor: 1,
    not: 1
  })) {
    test(`${name} preserves its reflected arity and descriptor`, function () {
      assert.deepEqual(Object.getOwnPropertyDescriptor(api[name], 'length'), {
        value: length,
        writable: false,
        enumerable: false,
        configurable: true
      });
    });
  }
  for (const size of [0, 1, 2, 3, 4, 8, 32]) {
    for (const name of ['pipe', 'and', 'or', 'nor', 'xor']) {
      test(`${name} returns fresh, constructible zero-arity wrappers for ${size} callbacks`, function () {
        const callbacks = Array.from({ length: size }, () => () => false);
        const first = api[name](...callbacks),
          second = api[name](...callbacks);
        assert.notEqual(first, second);
        assert.equal(first.length, 0);
        assert.notEqual(first.prototype, second.prototype);
        first.marker = 17;
        assert.equal(second.marker, undefined);
        assert.ok(new first() instanceof first);
      });
      test(`${name} validates late entries even with ${size} preceding callbacks`, function () {
        const sentinel = new Error('must not execute');
        const callbacks = Array.from({ length: size }, () => () => {
          throw sentinel;
        });
        assert.throws(() => api[name](null, ...callbacks, undefined, {}), TypeError);
      });
    }
    if (size > 0) {
      test(`pipeline of ${size} stages preserves reentrant calls and exact unary arguments`, function () {
        const receiver = {},
          calls = [];
        const queue = Array.from(
          { length: size },
          (_, index) =>
            function (value) {
              assert.equal(this, receiver);
              assert.equal(arguments.length, 1);
              calls.push([index, value]);
              if (index === 0 && value === 3) return Reflect.apply(wrapper, receiver, [0]);
              return value + 1;
            }
        );
        const wrapper = api.pipe(...queue);
        assert.equal(Reflect.apply(wrapper, receiver, [3]), size * 2 - 1);
        assert.equal(calls.length, size * 2);
        assert.equal(Reflect.apply(wrapper, receiver, [0]), size);
      });
      test(`pipeline of ${size} stages never reads callback call or apply properties`, function () {
        const callback = new Proxy(
          function (value) {
            return value + 1;
          },
          {
            get(target, key, receiver) {
              if (key === 'call' || key === 'apply') throw Error('property lookup');
              return Reflect.get(target, key, receiver);
            }
          }
        );
        assert.equal(api.pipe(...Array(size).fill(callback))(0), size);
      });
    }
  }
  for (const size of [0, 1, 2, 3, 4, 5, 8, 16, 64]) {
    for (const name of ['attempt', 'repeat']) {
      test(`${name} preserves ${size} explicit arguments and the callback receiver`, function () {
        const token = Object.freeze({});
        const args = Array.from({ length: size }, (_, i) => (i % 3 === 0 ? undefined : i % 3 === 1 ? token : i));
        let calls = 0;
        function callback() {
          calls++;
          assert.equal(this, callback);
          assert.deepEqual(Array.from(arguments), args);
          return token;
        }
        if (name === 'attempt') assert.equal(api.attempt(callback, ...args), token);
        else assert.deepEqual(api.repeat(callback, 3, ...args), [token, token, token]);
        assert.equal(calls, name === 'attempt' ? 1 : 3);
      });
      test(`${name} gives a callable proxy a fresh ${size}-argument trap array`, function () {
        const args = Array.from({ length: size }, (_, i) => i);
        const seen = [];
        const callback = new Proxy(function () {}, {
          apply(target, receiver, list) {
            assert.equal(receiver, callback);
            assert.deepEqual(list, args);
            assert.equal(seen.includes(list), false);
            seen.push(list);
            list.length = 0;
            return 7;
          }
        });
        if (name === 'attempt') {
          assert.equal(api.attempt(callback, ...args), 7);
          assert.equal(api.attempt(callback, ...args), 7);
        } else assert.deepEqual(api.repeat(callback, 3, ...args), [7, 7, 7]);
      });
    }
  }
  test('large repeated results remain dense and preserve heterogeneous values', function () {
    const values = [1, 1.25, undefined, null, {}, 'x', Symbol('x'), 1n];
    let i = 0;
    const result = api.repeat(() => values[i++ % values.length], 1024);
    assert.equal(result.length, 1024);
    for (let j = 0; j < result.length; j++) {
      assert.equal(Object.hasOwn(result, j), true);
      assert.equal(result[j], values[j % values.length]);
    }
  });
  test('proxy argument mutation cannot corrupt later pipeline calls', function () {
    const arrays = [];
    const stage = new Proxy(function () {}, {
      apply(target, receiver, args) {
        assert.equal(args.length, 1);
        assert.equal(arrays.includes(args), false);
        arrays.push(args);
        const result = args[0] + 1;
        args[0] = 999;
        args.push('extra');
        return result;
      }
    });
    const p = api.pipe(stage, stage, stage, stage);
    assert.equal(p(0), 4);
    assert.equal(p(10), 14);
  });
});
