'use strict';

const assert = require('node:assert/strict');
const api = require('../helpers/api.js');
const multi = ['and', 'or', 'nor', 'xor'];
const all = [...multi, 'not'];

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function singleResult(name, value) {
  return name === 'not' || name === 'nor' ? !value : Boolean(value);
}

suite('async predicate lifecycle', function () {
  for (const name of all) {
    const factory = api[name + 'Async'];

    for (const order of ['resolve-reject', 'resolve-throw', 'reject-resolve', 'nested-resolve-reject']) {
      test(`${name}Async: ${order} settlement obeys the first outcome without starting extra callbacks`, async () => {
        const failure = Object.freeze({ name, order });
        const nested = deferred();
        const registered = deferred();
        let reads = 0,
          thenCalls = 0,
          callbackCalls = 0;
        const value = name === 'and'; // continuation for every multi-predicate operator
        const result = Object.defineProperty({}, 'then', {
          get() {
            reads++;
            assert.equal(reads, 1);

            return function (resolve, reject) {
              thenCalls++;
              assert.equal(this, result);
              registered.resolve();
              if (order === 'reject-resolve') {
                reject(failure);
                resolve(value);

                return;
              }

              resolve(order === 'nested-resolve-reject' ? nested.promise : value);
              if (order === 'resolve-throw') throw failure;
              reject(failure);
              resolve(!value);
            };
          }
        });
        const callbacks = [
          () => {
            callbackCalls++;

            return result;
          }
        ];

        if (name !== 'not')
          callbacks.push(() => {
            callbackCalls++;

            return value;
          });
        const pending = factory(...callbacks)();
        const observed = pending.then(
          (value) => ({ ok: true, value }),
          (error) => ({ ok: false, error })
        );

        assert.equal(callbackCalls, 1);

        await registered.promise;
        if (order === 'nested-resolve-reject') {
          assert.equal(callbackCalls, 1, 'nested resolution has not completed yet');

          nested.resolve(value);
        }

        const outcome = await observed;

        assert.equal(outcome.ok, order !== 'reject-resolve');
        if (outcome.ok) assert.equal(outcome.value, singleResult(name, value));
        else assert.equal(outcome.error, failure);
        assert.equal(thenCalls, 1);
        assert.equal(reads, 1);
        assert.equal(callbackCalls, name === 'not' || !outcome.ok ? 1 : 2);
      });
    }

    for (const mode of ['throw', 'reject']) {
      test(`${name}Async: ${mode} reasons are not assimilated or coerced`, async () => {
        const error = new Proxy({}, { get: () => assert.fail('rejection reasons must not be inspected') });
        let calls = 0;
        const fn = () => {
          calls++;
          if (mode === 'throw') throw error;

          return Promise.reject(error);
        };

        const observed = factory(fn)().then(
          () => assert.fail('must reject'),
          (actual) => assert.equal(actual, error)
        );

        await observed;
        assert.equal(calls, 1);
      });
    }

    test(`${name}Async: a callable then with hostile call/apply properties is invoked intrinsically`, async () => {
      let calls = 0;
      const then = new Proxy(
        function (resolve) {
          calls++;
          resolve(false);
        },
        { get: () => assert.fail('the then method properties must not be inspected') }
      );

      assert.equal(await factory(() => ({ then }))(), singleResult(name, false));
      assert.equal(calls, 1);
    });

    test(`${name}Async: a class-valued then rejects as an invocation failure`, async () => {
      class Then {}
      await assert.rejects(factory(() => ({ then: Then }))(), TypeError);
    });

    test(`${name}Async: repeated calls reread a mutable then getter and return independent promises`, async () => {
      let reads = 0;
      const result = Object.defineProperty({}, 'then', {
        get() {
          const decision = reads++ % 2 === 0;

          return (resolve) => resolve(decision);
        }
      });
      const wrapper = factory(() => result);

      const first = wrapper(),
        second = wrapper();

      assert.notEqual(first, second);
      assert.equal(await first, singleResult(name, true));
      assert.equal(await second, singleResult(name, false));
      assert.equal(reads, 2);
    });
  }

  for (const name of multi) {
    const factory = api[name + 'Async'];
    const continuing = name === 'and';

    for (const disposition of ['short circuit', 'continue', 'reject']) {
      test(`${name}Async: ${disposition} with a subsequent callback revoked while awaiting`, async () => {
        const gate = deferred(),
          started = deferred();
        const failure = Object.freeze({ name, disposition });
        let revokedCalls = 0;
        const revocable = Proxy.revocable(() => (++revokedCalls, continuing), {});
        const prefix = name === 'xor' ? [() => true] : [];
        const wrapper = factory(
          ...prefix,
          () => {
            started.resolve();

            return gate.promise;
          },
          revocable.proxy
        );
        const observed = wrapper().then(
          (value) => ({ ok: true, value }),
          (error) => ({ ok: false, error })
        );

        await started.promise;

        revocable.revoke();

        if (disposition === 'reject') gate.reject(failure);
        else gate.resolve(disposition === 'short circuit' ? !continuing : continuing);

        const outcome = await observed;

        assert.equal(revokedCalls, 0);
        if (disposition === 'short circuit') {
          assert.equal(outcome.ok, true);
          assert.equal(outcome.value, name === 'or');
        } else {
          assert.equal(outcome.ok, false);
          if (disposition === 'reject') assert.equal(outcome.error, failure);
          else assert.ok(outcome.error instanceof TypeError);
        }
      });
    }

    test(`${name}Async: a shared thenable is evaluated separately at each callback position`, async () => {
      const sequence = name === 'xor' ? [false, true, false, true] : [continuing, !continuing];
      let reads = 0,
        calls = 0;
      const result = Object.defineProperty({}, 'then', {
        get() {
          const value = sequence[reads++];

          return (resolve) => resolve(value);
        }
      });
      const fn = () => {
        calls++;

        return result;
      };

      const wrapper = factory(...Array(sequence.length + 1).fill(fn));

      assert.equal(await wrapper(), name === 'or');
      assert.equal(reads, sequence.length);
      assert.equal(calls, sequence.length);
    });

    test(`${name}Async: concurrent success, short circuit, and rejection keep cursors and XOR counts isolated`, async () => {
      const ids = ['failure', 'stop', 'success'];
      const requests = ids.map((id) => ({ id, gate: deferred(), started: deferred(), visits: [] }));
      const receivers = ids.map((id) => ({ id }));
      const failure = Object.freeze({ rejected: true });
      const wrapper = factory(
        function (request) {
          assert.equal(this.id, request.id);
          request.visits.push(0);

          return name === 'xor' || continuing;
        },
        function (request) {
          assert.equal(this.id, request.id);
          request.visits.push(1);
          request.started.resolve();

          return request.gate.promise;
        },
        function (request) {
          assert.equal(this.id, request.id);
          request.visits.push(2);

          return continuing;
        }
      );
      // Attach handlers before any rejection. These test calls deliberately finish out of order.
      const outcomes = requests.map((request, index) =>
        wrapper.call(receivers[index], request).then(
          (value) => ({ ok: true, value }),
          (error) => ({ ok: false, error })
        )
      );

      await Promise.all(requests.map((request) => request.started.promise));
      for (const request of requests) assert.deepEqual(request.visits, [0, 1]);

      requests[1].gate.resolve(!continuing);

      assert.deepEqual(await outcomes[1], { ok: true, value: name === 'or' });

      requests[0].gate.reject(failure);

      assert.deepEqual(await outcomes[0], { ok: false, error: failure });

      requests[2].gate.resolve(continuing);

      assert.deepEqual(await outcomes[2], { ok: true, value: name !== 'or' });
      assert.deepEqual(
        requests.map((request) => request.visits),
        [
          [0, 1],
          [0, 1],
          [0, 1, 2]
        ]
      );
    });

    test(`${name}Async: predicate snapshot survives a caller-array mutation during await`, async () => {
      const gate = deferred();
      const calls = [];
      const callbacks = [
        () => gate.promise,
        null,
        () => {
          calls.push('original');

          return continuing;
        }
      ];
      const wrapper = factory(...callbacks);

      const pending = wrapper();

      callbacks.fill(() => assert.fail('changed caller array'));
      callbacks.push(123);

      gate.resolve(continuing);

      assert.equal(await pending, name === 'and' || name === 'nor');
      assert.deepEqual(calls, ['original']);
    });

    test(`${name}Async: a then getter can reenter the same wrapper without sharing progress`, async () => {
      const visits = [];
      const nested = [];
      const wrapper = factory(
        function (depth) {
          visits.push([depth, 0]);

          return Object.defineProperty({}, 'then', {
            get() {
              if (depth) nested.push(wrapper(depth - 1));

              return (resolve) => resolve(continuing);
            }
          });
        },
        (depth) => {
          visits.push([depth, 1]);

          return continuing;
        }
      );
      const result = await wrapper(2);

      assert.equal(result, name === 'and' || name === 'nor');
      assert.deepEqual(await Promise.all(nested), [result, result]);
      assert.deepEqual(visits.slice(0, 3), [
        [2, 0],
        [1, 0],
        [0, 0]
      ]);
      assert.deepEqual(
        visits
          .filter((visit) => visit[1] === 1)
          .map((visit) => visit[0])
          .sort(),
        [0, 1, 2]
      );
    });
  }
});
