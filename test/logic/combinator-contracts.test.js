'use strict';
const assert = require('node:assert/strict');
const api = require('../helpers/api.js');

const multi = ['and', 'or', 'nor', 'xor'];
const all = [...multi, 'not'];

function expected(name, truths) {
  const positions = truths.flatMap((truth, index) => (truth ? [index] : []));
  if (name === 'not') return !truths[0];
  if (name === 'and') return truths.length > 0 && positions.length === truths.length;
  if (name === 'or') return positions.length > 0;
  if (name === 'nor') return truths.length > 0 && positions.length === 0;
  return positions.length === 1;
}

function prefixLength(name, truths) {
  const truePositions = truths.flatMap((truth, index) => (truth ? [index] : []));
  const decisive = name === 'and' ? truths.indexOf(false) : truePositions[name === 'xor' ? 1 : 0];
  return decisive === undefined || decisive < 0 ? truths.length : decisive + 1;
}

// Metadata is independent of coercion performed by the implementation under test.
const samples = [
  { make: () => false, truth: false },
  { make: () => 0, truth: false },
  { make: () => -0, truth: false },
  { make: () => '', truth: false },
  { make: () => NaN, truth: false },
  { make: () => undefined, truth: false },
  { make: () => null, truth: false },
  { make: () => 0n, truth: false },
  { make: () => true, truth: true },
  { make: () => Object(false), truth: true },
  { make: () => Object.create(null), truth: true },
  { make: () => [], truth: true },
  { make: () => Symbol('decision'), truth: true },
  { make: () => function () {}, truth: true },
  { make: () => -1, truth: true },
  { make: () => 1n, truth: true }
];

suite('predicate family cross-contracts', function () {
  for (const name of multi) {
    for (const asynchronous of [false, true]) {
      const exported = name + (asynchronous ? 'Async' : '');
      test(`${exported}: 128 reproducible mixed-value/nullish streams match result and call-prefix oracles`, async () => {
        let state = 0x5f3759df;
        const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
        for (let scenario = 0; scenario < 128; scenario++) {
          const receiver = Object.freeze({ scenario });
          const input = Object.freeze({ token: scenario });
          const args = [input, undefined, scenario, null];
          const configured = [],
            truths = [],
            indexes = [],
            visits = [];
          // Retain runs beyond the previous exhaustive six-predicate table.
          const length = scenario % 5 === 0 ? 65 : scenario % 25;
          for (let i = 0; i < length; i++) {
            const draw = next();
            if (draw % 7 === 0) configured.push(null);
            else if (draw % 11 === 0) configured.push(undefined);
            else {
              const sample = samples[(draw >>> 8) % samples.length];
              const value = sample.make();
              truths.push(sample.truth);
              indexes.push(i);
              configured.push(function () {
                assert.equal(this, receiver);
                assert.deepEqual(Array.from(arguments), args);
                visits.push(i);
                if (!asynchronous || i % 3 === 0) return value;
                if (i % 3 === 1) return Promise.resolve(value);
                return { then: (resolve) => resolve({ then: (nested) => nested(value) }) };
              });
            }
          }
          const result = api[exported](...configured).apply(receiver, args);
          if (!asynchronous) assert.equal(typeof result, 'boolean');
          else assert.ok(result instanceof Promise);
          assert.equal(await result, expected(name, truths), `${exported} scenario ${scenario}`);
          assert.deepEqual(visits, indexes.slice(0, prefixLength(name, truths)), `${exported} scenario ${scenario}`);
        }
      });
      test(`${exported}: duplicate callback positions are not deduplicated`, async () => {
        let visits = 0;
        const sequence =
          name === 'and' ? [true, true, false] : name === 'xor' ? [false, true, false, true] : [false, true];
        const fn = () => sequence[visits++];
        const result = api[exported](...Array(sequence.length + 1).fill(fn))();
        assert.equal(await result, name === 'or');
        assert.equal(visits, sequence.length);
      });
      test(`${exported}: changing the configuration array after construction cannot replace captured callbacks`, async () => {
        let calls = 0;
        const callbacks = [null, () => (++calls, false), undefined];
        const wrapper = api[exported](...callbacks);
        callbacks.fill(() => assert.fail('changed configuration must not be consulted'));
        callbacks.push(123);
        assert.equal(await wrapper(), name === 'nor');
        assert.equal(calls, 1);
      });
      test(`${exported}: invalid configuration following decisive predicates is still rejected immediately`, () => {
        let calls = 0;
        const fn = () => (++calls, name !== 'and');
        const invalid = new Proxy({}, { get: () => assert.fail('validation must not inspect properties') });
        assert.throws(() => api[exported](fn, fn, null, invalid), TypeError);
        assert.equal(calls, 0);
      });
    }
  }

  for (const name of all) {
    for (const kind of ['then getter', 'coercion hooks', 'revoked proxy']) {
      test(`${name}: truthiness does not inspect a result's ${kind}`, () => {
        let result;
        if (kind === 'revoked proxy') {
          const revocable = Proxy.revocable({}, {});
          revocable.revoke();
          result = revocable.proxy;
        } else {
          result = Object.create(null);
          for (const key of kind === 'then getter' ? ['then'] : ['valueOf', 'toString', Symbol.toPrimitive]) {
            Object.defineProperty(result, key, { get: () => assert.fail('must not inspect result property') });
          }
        }
        assert.equal(api[name](() => result)(), expected(name, [true]));
      });
    }
    test(`${name}Async: awaiting ordinary objects does not invoke coercion hooks`, async () => {
      const result = new Proxy(
        {},
        {
          get(target, key) {
            if (key === 'then') return undefined;
            assert.fail(`unexpected result property read: ${String(key)}`);
          }
        }
      );
      assert.equal(await api[name + 'Async'](() => result)(), expected(name, [true]));
    });
    test(`${name} and ${name}Async do not iterate async generators`, async () => {
      let bodyCalls = 0;
      const fn = async function* () {
        bodyCalls++;
        yield false;
      };
      assert.equal(api[name](fn)(), expected(name, [true]));
      assert.equal(await api[name + 'Async'](fn)(), expected(name, [true]));
      assert.equal(bodyCalls, 0);
    });
    for (const asynchronous of [false, true]) {
      const exported = name + (asynchronous ? 'Async' : '');
      test(`${exported}: rejected promise arguments are passed raw rather than adopted`, async () => {
        const failure = Object.freeze({ failure: exported });
        const input = Promise.reject(failure);
        // The caller owns a rejected input, irrespective of whether a predicate inspects it.
        const handled = input.catch((error) => assert.equal(error, failure));
        const wrapper = api[exported](function (argument) {
          assert.equal(argument, input);
          assert.equal(arguments.length, 2);
          assert.equal(arguments[1], undefined);
          return false;
        });
        assert.equal(await wrapper(input, undefined), expected(name, [false]));
        await handled;
      });
      test(`${exported}: callback invocation distinguishes no arguments from explicit undefined`, async () => {
        const counts = [];
        const wrapper = api[exported](function () {
          counts.push(arguments.length);
          return false;
        });
        await wrapper();
        await wrapper(undefined);
        assert.deepEqual(counts, [0, 1]);
      });
      test(`${exported}: reached class and revoked function failures are execution errors, not factory errors`, async () => {
        class Callback {}
        const revoked = Proxy.revocable(function () {}, {});
        revoked.revoke();
        for (const callback of [Callback, revoked.proxy]) {
          let wrapper;
          assert.doesNotThrow(() => {
            wrapper = api[exported](callback);
          });
          if (asynchronous) await assert.rejects(wrapper(), TypeError);
          else assert.throws(wrapper, TypeError);
        }
      });
    }
  }

  for (const asynchronous of [false, true]) {
    test(`nonempty ${asynchronous ? 'async' : 'sync'} De Morgan pairs preserve results and visited prefixes`, async () => {
      const suffix = asynchronous ? 'Async' : '';
      for (let mask = 0; mask < 32; mask++) {
        for (const [direct, connective] of [
          ['nor', 'or'],
          ['or', 'nor']
        ]) {
          const leftVisits = [],
            rightVisits = [];
          const values = Array.from({ length: 5 }, (_, i) => !!(mask & (1 << i)));
          const callbacks = (log) =>
            values.map((value, i) => () => {
              log.push(i);
              return asynchronous ? Promise.resolve(value) : value;
            });
          const left = await api[direct + suffix](...callbacks(leftVisits))();
          const right = await api['not' + suffix](api[connective + suffix](...callbacks(rightVisits)))();
          assert.equal(left, right);
          assert.deepEqual(leftVisits, rightVisits);
        }
      }
      // NOR intentionally is not NOT(OR) for an empty (including all-nullish) configuration.
      assert.equal(await api['nor' + suffix](null, undefined)(), false);
      assert.equal(await api['not' + suffix](api['or' + suffix](null, undefined))(), true);
    });
  }
});
