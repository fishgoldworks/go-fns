'use strict';

const assert = require('node:assert/strict');
const api = require('../helpers/api.js');
const { values } = require('../helpers/values.js');
const names = ['and', 'or', 'nor', 'xor'];

function expected(name, values) {
  const count = values.filter(Boolean).length;

  return name === 'and'
    ? values.length > 0 && count === values.length
    : name === 'or'
      ? count > 0
      : name === 'nor'
        ? values.length > 0 && count === 0
        : count === 1;
}

function expectedVisits(name, values) {
  if (name === 'and') {
    const i = values.indexOf(false);

    return i < 0 ? values.length : i + 1;
  }

  if (name === 'or' || name === 'nor') {
    const i = values.indexOf(true);

    return i < 0 ? values.length : i + 1;
  }

  const first = values.indexOf(true),
    second = values.indexOf(true, first + 1);

  return second < 0 ? values.length : second + 1;
}

suite('logical connectives', function () {
  for (const name of names) {
    suite(name, function () {
      for (let arity = 0; arity <= 6; arity++) {
        for (let bits = 0; bits < 2 ** arity; bits++) {
          const truth = Array.from({ length: arity }, (_, i) => Boolean(bits & (1 << i)));

          test(`truth table and short circuit: [${truth.join(', ')}]`, function () {
            const order = [],
              receiver = {},
              args = [{ token: true }, 17, undefined];
            const predicates = truth.map(
              (value, i) =>
                function () {
                  order.push(i);
                  assert.equal(this, receiver);
                  assert.deepEqual(Array.from(arguments), args);

                  return value;
                }
            );

            assert.equal(api[name](...predicates).apply(receiver, args), expected(name, truth));
            assert.deepEqual(
              order,
              Array.from({ length: expectedVisits(name, truth) }, (_, i) => i)
            );
          });
        }
      }

      for (const [label, value] of values) {
        test(`coerces a ${label} result to a boolean`, function () {
          assert.equal(api[name](() => value)(), expected(name, [value]));
        });
      }

      for (let pattern = 0; pattern < 27; pattern++) {
        test(`ignores nullish predicates in three-slot pattern ${pattern}`, function () {
          const truth = [],
            input = [];
          let code = pattern;

          for (let i = 0; i < 3; i++, code = Math.floor(code / 3)) {
            const choice = code % 3;

            if (choice === 0) {
              const value = i % 2 === 0;

              truth.push(value);
              input.push(() => value);
            } else input.push(choice === 1 ? null : undefined);
          }

          assert.equal(api[name](...input)(), expected(name, truth));
        });
      }

      for (const [label, receiver] of [
        ['undefined', undefined],
        ['null', null],
        ['number', 42],
        ['string', 'x'],
        ['boolean', false],
        ['symbol', Symbol('this')]
      ]) {
        test(`forwards an explicit ${label} receiver without boxing`, function () {
          let seen;

          api[name](function () {
            seen = this;

            return true;
          }).call(receiver);
          assert.equal(seen, receiver);
        });
      }

      test('does not substitute the global object on a plain wrapper invocation', function () {
        let seen = 'unset';
        const wrapper = api[name](function () {
          seen = this;

          return true;
        });

        wrapper();
        assert.equal(seen, undefined);
      });

      test('honors bound callback receivers', function () {
        const boundReceiver = {};
        let seen;

        api[name](
          function () {
            seen = this;

            return true;
          }.bind(boundReceiver)
        ).call({});
        assert.equal(seen, boundReceiver);
      });

      test('treats generator and async callback results as truthy values without awaiting', async function () {
        assert.equal(
          api[name](function* () {
            yield false;
          })(),
          name !== 'nor'
        );
        assert.equal(
          api[name](async function () {
            return false;
          })(),
          name !== 'nor'
        );
      });

      test('supports callable objects whose apply property is shadowed', function () {
        function predicate() {
          return true;
        }

        predicate.apply = null;
        assert.equal(api[name](predicate)(), name !== 'nor');
      });

      for (const [label, error] of [
        ['Error', new Error('user failure')],
        ['object', {}],
        ['null', null],
        ['undefined', undefined],
        ['symbol', Symbol('failure')]
      ]) {
        test(`propagates a thrown ${label} unchanged and stops`, function () {
          let called = 0;
          const wrapper = api[name](
            () => {
              throw error;
            },
            () => {
              called++;
            }
          );
          let caught = false;

          try {
            wrapper();
          } catch (actual) {
            caught = true;
            assert.equal(actual, error);
          }

          assert.equal(caught, true);
          assert.equal(called, 0);
        });
      }

      test('reevaluates predicates on each call', function () {
        let current = false;
        const wrapper = api[name](() => current);

        assert.equal(wrapper(), expected(name, [false]));
        current = true;
        assert.equal(wrapper(), expected(name, [true]));
      });

      test('is reentrant and keeps per-invocation state isolated', function () {
        let nested = false;
        const wrapper = api[name](
          () => {
            if (!nested) {
              nested = true;
              assert.equal(wrapper(), expected(name, [true, false]));
              nested = false;
            }

            return true;
          },
          () => false
        );

        assert.equal(wrapper(), expected(name, [true, false]));
      });
    });
  }

  test('xor is exactly-one, not odd parity', function () {
    assert.equal(
      api.xor(
        () => true,
        () => true,
        () => true
      )(),
      false
    );
  });

  for (const name of names) {
    test(`${name} never calls callbacks hidden by short circuit`, function () {
      const fail = () => {
        throw new Error('should not execute');
      };

      const leading = name === 'and' ? [() => false] : name === 'xor' ? [() => true, () => true] : [() => true];

      assert.equal(api[name](...leading, fail)(), name === 'or');
    });
  }
});
