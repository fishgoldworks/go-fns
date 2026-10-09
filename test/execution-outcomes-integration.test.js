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

function opaque() {
  return new Proxy(
    {},
    {
      get() {
        assert.fail('An outcome must not be inspected or coerced');
      }
    }
  );
}

suite('execution outcomes: invocation, failure and settlement boundaries', function () {
  for (const name of ['attempt', 'attemptResult', 'attemptResultAsync']) {
    const invoke = api[name];
    const structured = name !== 'attempt';
    async function observed(callback, ...args) {
      const output = invoke(callback, ...args);
      // Await the async API only: the synchronous API must not assimilate its result.
      return name === 'attemptResultAsync' ? await output : { sync: output };
    }
    function extract(output) {
      return name === 'attemptResultAsync' ? output : output.sync;
    }

    test(`${name}: a thrown hostile thenable remains an opaque failure`, async () => {
      const error = opaque();
      const result = extract(
        await observed(() => {
          throw error;
        })
      );
      if (structured) {
        assert.equal(result.ok, false);
        assert.equal(result.error, error);
        assert.deepEqual(Object.keys(result).sort(), ['error', 'ok']);
        assert.equal(Object.hasOwn(result, 'value'), false);
      } else assert.equal(result, error);
    });

    test(`${name}: does not reuse a previous invocation's success or failure`, async () => {
      const error = Object.freeze({ code: 'fail' });
      const value = Object.freeze({ code: 'success' });
      let calls = 0;
      const callback = () => {
        if (++calls % 2 === 1) throw error;
        return value;
      };
      const first = extract(await observed(callback));
      const second = extract(await observed(callback));
      const third = extract(await observed(callback));
      if (structured) {
        assert.deepEqual(first, { ok: false, error });
        assert.deepEqual(second, { ok: true, value });
        assert.deepEqual(third, { ok: false, error });
        assert.notEqual(first, third);
      } else {
        assert.equal(first, error);
        assert.equal(second, value);
        assert.equal(third, error);
      }
      assert.equal(calls, 3);
    });

    test(`${name}: snapshots top-level arguments while preserving referenced values`, async () => {
      const token = { value: 1 },
        original = [token, undefined, 'tail'];
      let executions = 0;
      const traps = [];
      const callback = new Proxy(function () {}, {
        apply(target, receiver, args) {
          assert.equal(receiver, callback);
          assert.deepEqual(args, original);
          assert.equal(traps.includes(args), false);
          traps.push(args);
          args[0].value++;
          args.length = 0;
          executions++;
          return executions;
        },
        get() {
          assert.fail('Callback properties must not be inspected');
        }
      });
      for (let i = 1; i <= 2; i++) {
        const result = extract(await observed(callback, ...original));
        assert.equal(structured ? result.value : result, i);
      }
      assert.deepEqual(original, [token, undefined, 'tail']);
      assert.equal(token.value, 3);
    });

    test(`${name}: invocation of an already-revoked callable is an execution failure`, async () => {
      const revoked = Proxy.revocable(() => assert.fail('revoked callback executed'), {});
      revoked.revoke();
      const result = extract(await observed(revoked.proxy));
      const error = structured ? result.error : result;
      if (structured) assert.equal(result.ok, false);
      assert.ok(error instanceof TypeError);
    });

    test(`${name}: cross-realm thrown Errors preserve identity and prototype`, async () => {
      const realm = vm.runInNewContext(
        '(() => { const error = new RangeError("foreign"); return { error, fn() { throw error; } }; })()'
      );
      const result = extract(await observed(realm.fn));
      assert.equal(structured ? result.error : result, realm.error);
      assert.equal(Object.getPrototypeOf(structured ? result.error : result), Object.getPrototypeOf(realm.error));
    });

    test(`${name}: generators are invoked, not iterated`, async () => {
      let bodyCalls = 0;
      function* callback(value) {
        bodyCalls++;
        assert.equal(this, callback);
        yield value;
      }
      const result = extract(await observed(callback, 'token'));
      const iterator = structured ? result.value : result;
      assert.equal(bodyCalls, 0);
      assert.deepEqual(iterator.next(), { value: 'token', done: false });
      assert.equal(bodyCalls, 1);
    });

    test(`${name}: nested wrappers keep their own callback receivers`, async () => {
      const inner = function () {
        assert.equal(this, inner);
        return 'inner';
      };
      const outer = function () {
        assert.equal(this, outer);
        assert.equal(api.attempt(inner), 'inner');
        assert.equal(this, outer);
        return 'outer';
      };
      const result = extract(await observed(outer));
      assert.equal(structured ? result.value : result, 'outer');
    });
  }

  for (const name of ['attemptResult', 'attemptResultAsync']) {
    test(`${name}: a callback may successfully return a failure-shaped object`, async () => {
      const value = { ok: false, error: undefined };
      const result = name === 'attemptResult' ? api[name](() => value) : await api[name](() => value);
      assert.equal(result.ok, true);
      assert.equal(result.value, value);
      assert.deepEqual(Object.keys(result).sort(), ['ok', 'value']);
      assert.equal(Object.hasOwn(result, 'error'), false);
    });
    test(`${name}: returning and throwing the same Error remain distinct`, async () => {
      const error = new Error('exact outcome');
      const successes = api[name](() => error);
      const failures = api[name](() => {
        throw error;
      });
      const [success, failure] =
        name === 'attemptResult' ? [successes, failures] : await Promise.all([successes, failures]);
      assert.deepEqual(success, { ok: true, value: error });
      assert.deepEqual(failure, { ok: false, error });
    });
    test(`${name}: consumer mutation cannot affect a later result record`, async () => {
      const value = { shared: true };
      const first = await api[name](() => value);
      first.ok = false;
      first.value = 'replaced';
      first.error = 'consumer-added';
      Object.freeze(first);
      const next = await api[name](() => value);
      assert.notEqual(first, next);
      assert.deepEqual(next, { ok: true, value });
    });
  }

  test('attemptResultAsync: callback starts immediately but the outcome is promise-based', async () => {
    const visits = [];
    const pending = api.attemptResultAsync(() => {
      visits.push('callback');
      return 3;
    });
    pending.then(() => visits.push('settled'));
    assert.deepEqual(visits, ['callback']);
    assert.deepEqual(await pending, { ok: true, value: 3 });
    assert.deepEqual(visits, ['callback', 'settled']);
  });

  for (const first of ['resolve', 'reject']) {
    test(`attemptResultAsync: first ${first} wins over later settlement and throws`, async () => {
      const value = {},
        error = opaque();
      let getterCalls = 0,
        thenCalls = 0;
      const thenable = {
        get then() {
          getterCalls++;
          return function (resolve, reject) {
            assert.equal(this, thenable);
            thenCalls++;
            if (first === 'resolve') {
              resolve(value);
              reject(error);
            } else {
              reject(error);
              resolve(value);
            }
            throw new Error('post-settlement exception');
          };
        }
      };
      const outcome = await api.attemptResultAsync(() => thenable);
      if (first === 'resolve') assert.deepEqual(outcome, { ok: true, value });
      else {
        assert.equal(outcome.ok, false);
        assert.equal(outcome.error, error);
      }
      assert.equal(getterCalls, 1);
      assert.equal(thenCalls, 1);
    });
  }

  test('attemptResultAsync: follows a first resolution to a pending promise despite a later reject', async () => {
    const gate = deferred(),
      started = deferred(),
      value = {};
    let settled = false;
    const pending = api.attemptResultAsync(() => ({
      then(resolve, reject) {
        resolve(gate.promise);
        reject('late');
        started.resolve();
      }
    }));
    pending.then(() => {
      settled = true;
    });
    await started.promise;
    await Promise.resolve();
    assert.equal(settled, false);
    gate.resolve(value);
    assert.deepEqual(await pending, { ok: true, value });
  });

  test('attemptResultAsync: a noncallable then property returns the original value', async () => {
    let reads = 0;
    const value = {
      get then() {
        reads++;
        return 17;
      }
    };
    const result = await api.attemptResultAsync(() => value);
    assert.equal(result.ok, true);
    assert.equal(result.value, value);
    assert.equal(reads, 1);
  });

  test('attemptResultAsync: thrown promise is not awaited as a rejection reason', async () => {
    const gate = deferred();
    const result = await api.attemptResultAsync(() => {
      throw gate.promise;
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, gate.promise);
    gate.resolve('late');
  });

  test('attemptResultAsync: reentry from a then getter keeps outcomes independent', async () => {
    const error = opaque();
    let nested,
      outerCalls = 0;
    const value = {
      get then() {
        nested = api.attemptResultAsync(() => {
          throw error;
        });
        return (resolve) => resolve(9);
      }
    };
    const result = await api.attemptResultAsync(() => {
      outerCalls++;
      return value;
    });
    assert.deepEqual(result, { ok: true, value: 9 });
    const failure = await nested;
    assert.equal(failure.ok, false);
    assert.equal(failure.error, error);
    assert.equal(outerCalls, 1);
  });

  test('attemptResultAsync: interleaved invocations settle independently and out of order', async () => {
    const gates = [deferred(), deferred(), deferred()],
      error = opaque(),
      token = {};
    const records = [];
    const pending = gates.map((gate, index) =>
      api
        .attemptResultAsync(function callback(input) {
          assert.equal(this, callback);
          assert.equal(input, index);
          return gate.promise;
        }, index)
        .then((result) => {
          records.push(index);
          return result;
        })
    );
    gates[2].resolve(token);
    await pending[2];
    gates[1].reject(error);
    await pending[1];
    gates[0].resolve(undefined);
    const [a, b, c] = await Promise.all(pending);
    assert.deepEqual(records, [2, 1, 0]);
    assert.deepEqual(a, { ok: true, value: undefined });
    assert.equal(b.ok, false);
    assert.equal(b.error, error);
    assert.deepEqual(c, { ok: true, value: token });
    assert.notEqual(a, b);
    assert.notEqual(b, c);
  });

  test('nested attemptResult treats an inner configuration error as the outer callback failure', async () => {
    const sync = api.attemptResult(() => api.attemptResult(null));
    assert.equal(sync.ok, false);
    assert.ok(sync.error instanceof TypeError);
    const async = await api.attemptResultAsync(() => api.attemptResultAsync(null));
    assert.equal(async.ok, false);
    assert.ok(async.error instanceof TypeError);
    assert.throws(() => api.attemptResult(null), TypeError);
    await assert.rejects(api.attemptResultAsync(null), TypeError);
  });

  test('attempt preserves a returned promise while attemptResultAsync observes the eventual rejection', async () => {
    const gate = deferred(),
      error = opaque();
    const returned = api.attempt(() => gate.promise);
    const recorded = api.attemptResult(() => returned);
    const awaited = api.attemptResultAsync(() => recorded.value);
    assert.equal(returned, gate.promise);
    assert.equal(recorded.ok, true);
    assert.equal(recorded.value, gate.promise);
    gate.reject(error);
    const outcome = await awaited;
    assert.equal(outcome.ok, false);
    assert.equal(outcome.error, error);
  });
});
