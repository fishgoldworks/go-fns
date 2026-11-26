'use strict';

const assert = require('node:assert/strict');
const api = require('./helpers/api.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

suite('repetition and cached state: lifetime and interaction contracts', function () {
  for (const name of ['repeat', 'repeatAsync']) {
    const invoke = api[name];

    for (const position of [1, 2, 4]) {
      test(`${name}: failure at ${position} retains completed side effects but returns no partial result`, async () => {
        const effects = [],
          reason = Object.freeze({ position });
        const callback = () => {
          effects.push(effects.length + 1);

          if (effects.length === position) throw reason;

          return effects.length;
        };

        if (name === 'repeat')
          assert.throws(
            () => invoke(callback, 4),
            (error) => error === reason
          );
        else await assert.rejects(invoke(callback, 4), (error) => error === reason);
        assert.deepEqual(
          effects,
          Array.from({ length: position }, (_, i) => i + 1)
        );
      });
    }

    for (const count of [undefined, null, 0, -0]) {
      test(`${name}: ${String(count)} count does not invoke a revoked callable`, async () => {
        const callable = Proxy.revocable(() => assert.fail('invoked'), {});

        callable.revoke();
        const output = invoke(callable.proxy, count);

        assert.deepEqual(name === 'repeatAsync' ? await output : output, []);
      });
    }

    test(`${name}: callable proxies cannot modify the next invocation's argument list`, async () => {
      const token = { count: 0 },
        trapArrays = [];
      const callback = new Proxy(function () {}, {
        apply(target, receiver, args) {
          assert.equal(receiver, callback);
          assert.deepEqual(args, [token, undefined, 'tail']);
          assert.equal(trapArrays.includes(args), false);
          trapArrays.push(args);
          token.count++;
          args.length = 0;

          return token.count;
        },
        get() {
          assert.fail('callback properties read');
        }
      });
      const output = invoke(callback, 4, token, undefined, 'tail');

      assert.deepEqual(name === 'repeatAsync' ? await output : output, [1, 2, 3, 4]);
      assert.equal(trapArrays.length, 4);
    });

    test(`${name}: snapshot counts are not read again when a callback changes the source binding`, async () => {
      let count = 3,
        calls = 0;
      const output = invoke(() => {
        count = 0;

        return ++calls;
      }, count);

      assert.deepEqual(name === 'repeatAsync' ? await output : output, [1, 2, 3]);
      assert.equal(count, 0);
    });

    test(`${name}: result entries alias returned objects without cloning`, async () => {
      const token = { updates: 0 };
      const output = invoke(() => {
        token.updates++;

        return token;
      }, 3);
      const values = name === 'repeatAsync' ? await output : output;

      assert.equal(token.updates, 3);
      assert.equal(values.length, 3);
      for (const value of values) assert.equal(value, token);
      values[0].updates = 8;
      assert.equal(values[2].updates, 8);
    });

    test(`${name}: a caller-mutated result array does not become the next invocation's storage`, async () => {
      const first = await invoke(() => 1, 2);

      first.length = 0;
      first.push('consumer');
      Object.freeze(first);
      const second = await invoke(() => 2, 3);

      assert.notEqual(first, second);
      assert.deepEqual(second, [2, 2, 2]);
    });
  }

  test('repeat: one repeated thenable reference is never inspected', () => {
    const value = new Proxy(
      {},
      {
        get() {
          assert.fail('thenable inspection');
        }
      }
    );
    const output = api.repeat(() => value, 3);

    assert.equal(output.length, 3);
    for (const entry of output) assert.equal(entry, value);
  });

  test('repeatAsync: the same thenable is awaited anew on each invocation', async () => {
    let reads = 0,
      calls = 0;
    const value = {
      get then() {
        const n = ++reads;

        return (resolve) => {
          calls++;
          resolve(n);
        };
      }
    };

    assert.deepEqual(await api.repeatAsync(() => value, 3), [1, 2, 3]);
    assert.equal(reads, 3);
    assert.equal(calls, 3);
  });

  test('repeatAsync: repeated settlement does not duplicate calls or results', async () => {
    const visited = [];
    const output = await api.repeatAsync(() => {
      const n = visited.length;

      visited.push(n);

      return {
        then(resolve, reject) {
          resolve(n);
          resolve(100);
          reject('late');
          throw 'late throw';
        }
      };
    }, 4);

    assert.deepEqual(visited, [0, 1, 2, 3]);
    assert.deepEqual(output, [0, 1, 2, 3]);
  });

  test('repeatAsync: a nested pending thenable prevents the next callback from starting', async () => {
    const inner = deferred(),
      started = deferred();
    let calls = 0;
    const pending = api.repeatAsync(() => {
      calls++;

      if (calls === 1) {
        return {
          then(resolve) {
            resolve(inner.promise);
            started.resolve();
          }
        };
      }

      return 2;
    }, 2);

    await started.promise;
    const startedBeforeResolution = calls;

    inner.resolve(1);
    assert.equal(startedBeforeResolution, 1);
    assert.deepEqual(await pending, [1, 2]);
  });

  for (const mode of ['resolve', 'reject']) {
    test(`repeatAsync: revocation while pending respects the preceding ${mode} outcome`, async () => {
      const gate = deferred(),
        reason = {};
      let calls = 0;
      const callable = Proxy.revocable(() => {
        calls++;

        return gate.promise;
      }, {});
      const pending = api.repeatAsync(callable.proxy, 2);
      // Attach the rejection handler before releasing the gate.
      const check = assert.rejects(pending, mode === 'resolve' ? TypeError : (error) => error === reason);

      callable.revoke();
      if (mode === 'resolve') gate.resolve(1);
      else gate.reject(reason);
      await check;
      assert.equal(calls, 1);
    });
  }

  test('repeatAsync: nested failure can be captured without corrupting the outer repetition', async () => {
    let calls = 0,
      nestedCalls = 0;
    const error = {};
    const result = await api.repeatAsync(async () => {
      calls++;
      const inner = await api.attemptResultAsync(() =>
        api.repeatAsync(() => {
          nestedCalls++;

          if (nestedCalls % 2 === 0) throw error;

          return nestedCalls;
        }, 3)
      );

      assert.equal(inner.ok, false);
      assert.equal(inner.error, error);

      return calls;
    }, 3);

    assert.deepEqual(result, [1, 2, 3]);
    assert.equal(nestedCalls, 6);
  });

  test('repeatAsync: concurrent runs isolate argument references, results and failures', async () => {
    const gates = [deferred(), deferred()],
      error = {};
    const calls = [0, 0];

    function callback(index) {
      assert.equal(this, callback);
      calls[index]++;

      return calls[index] === 1 ? gates[index].promise : index;
    }

    const good = api.repeatAsync(callback, 3, 0);
    const bad = api.repeatAsync(callback, 5, 1);
    const failure = assert.rejects(bad, (actual) => actual === error);

    gates[1].reject(error);
    await failure;
    assert.deepEqual(calls, [1, 1]);
    gates[0].resolve('first');
    assert.deepEqual(await good, ['first', 0, 0]);
    assert.deepEqual(calls, [3, 1]);
  });

  test('repeatAsync: reentry from a then getter does not replace the outer results', async () => {
    let nested,
      calls = 0;
    const output = await api.repeatAsync(() => {
      const n = ++calls;

      return {
        get then() {
          if (n === 1) nested = api.repeatAsync(() => 'inner', 2);

          return (resolve) => resolve(n);
        }
      };
    }, 3);

    assert.deepEqual(output, [1, 2, 3]);
    assert.deepEqual(await nested, ['inner', 'inner']);
  });

  test('once: ignored later arguments are not inspected even after the callback is revoked', () => {
    const value = {},
      ignored = new Proxy(
        {},
        {
          get() {
            assert.fail('ignored argument inspected');
          }
        }
      );
    const callable = Proxy.revocable(() => value, {});
    const wrapper = api.once(callable.proxy);

    assert.equal(wrapper(), value);
    callable.revoke();
    assert.equal(wrapper.call(ignored, ignored), value);
  });

  test('once: caches self-revoking callback success without invoking it twice', () => {
    const value = {};
    const callable = Proxy.revocable(() => {
      callable.revoke();

      return value;
    }, {});
    const wrapper = api.once(callable.proxy);

    assert.equal(wrapper(), value);
    assert.equal(wrapper('ignored'), value);
  });

  test('once: caches self-revoking callback failure without replacing the thrown value', () => {
    const error = {};
    const callable = Proxy.revocable(() => {
      callable.revoke();
      throw error;
    }, {});
    const wrapper = api.once(callable.proxy);

    assert.throws(wrapper, (actual) => actual === error);
    assert.throws(wrapper, (actual) => actual === error);
  });

  test('once: multiple caught reentrant calls do not overwrite the final success', () => {
    let calls = 0;
    const token = {},
      errors = [];
    const wrapper = api.once(() => {
      calls++;
      for (let i = 0; i < 3; i++) {
        const result = api.attemptResult(wrapper);

        assert.equal(result.ok, false);
        assert.match(result.error.message, /reentran/i);
        errors.push(result.error);
      }

      return token;
    });

    assert.equal(wrapper(), token);
    assert.equal(wrapper(), token);
    assert.equal(calls, 1);
    assert.equal(errors.length, 3);
  });

  test('once: callback may replace a caught reentrancy error with its own cached failure', () => {
    const reason = {};
    const wrapper = api.once(() => {
      assert.throws(wrapper, /reentran/i);
      throw reason;
    });

    assert.throws(wrapper, (error) => error === reason);
    assert.throws(wrapper, (error) => error === reason);
  });

  test('once: mutually recursive wrappers retain the same escaping error', () => {
    let firstCalls = 0,
      secondCalls = 0;
    const first = api.once(() => {
      firstCalls++;

      return second();
    });
    const second = api.once(() => {
      secondCalls++;

      return first();
    });
    const outcome = api.attemptResult(first);

    assert.equal(outcome.ok, false);
    assert.match(outcome.error.message, /reentran/i);
    assert.throws(first, (error) => error === outcome.error);
    assert.throws(second, (error) => error === outcome.error);
    assert.equal(firstCalls, 1);
    assert.equal(secondCalls, 1);
  });

  test('once: an async callback throwing before its first await caches the rejected promise', async () => {
    const reason = {};
    let calls = 0;
    const wrapper = api.once(async () => {
      calls++;
      throw reason;
    });
    const first = wrapper();

    assert.equal(wrapper(), first);
    await assert.rejects(first, (error) => error === reason);
    assert.equal(wrapper(), first);
    assert.equal(calls, 1);
  });

  test('once: reentry inside a Promise executor becomes a cached rejected promise', async () => {
    const wrapper = api.once(() => new Promise((resolve) => resolve(wrapper())));
    const first = wrapper();

    assert.equal(wrapper(), first);
    let reason;

    await first.then(
      () => assert.fail('should reject'),
      (error) => {
        reason = error;
      }
    );
    assert.match(reason.message, /reentran/i);
    assert.equal(wrapper(), first);
    await assert.rejects(wrapper(), (error) => error === reason);
  });

  test('once: asynchronous reentry after the callback returns sees the cached promise', async () => {
    let nested, first;
    const wrapper = api.once(async () => {
      await Promise.resolve();
      nested = wrapper();

      return 4;
    });

    first = wrapper();
    assert.equal(await first, 4);
    assert.equal(nested, first);
  });

  test('once: awaiting a returned thenable does not change its cached raw identity', async () => {
    let reads = 0,
      callbacks = 0;
    const value = {
      get then() {
        reads++;
        assert.equal(wrapper(), value);

        return (resolve) => resolve(7);
      }
    };
    const wrapper = api.once(() => {
      callbacks++;

      return value;
    });

    assert.equal(wrapper(), value);
    assert.equal(reads, 0);
    assert.equal(await wrapper(), 7);
    assert.equal(await wrapper(), 7);
    assert.equal(reads, 2);
    assert.equal(callbacks, 1);
    assert.equal(wrapper(), value);
  });

  test('once: generator side effects belong to iterator advancement, not wrapper calls', () => {
    let entered = 0;
    const wrapper = api.once(function* () {
      entered++;
      yield 1;
      yield 2;
    });
    const first = wrapper();

    assert.equal(entered, 0);
    assert.deepEqual(first.next(), { value: 1, done: false });
    assert.equal(wrapper(), first);
    assert.deepEqual(wrapper().next(), { value: 2, done: false });
    assert.equal(entered, 1);
  });

  test('once: cached failures stay opaque even when they have a throwing then getter', () => {
    const reason = new Proxy(
      {},
      {
        get() {
          assert.fail('cached error inspected');
        }
      }
    );
    let calls = 0;
    const wrapper = api.once(() => {
      calls++;
      throw reason;
    });

    for (let i = 0; i < 3; i++) assert.throws(wrapper, (error) => error === reason);
    assert.equal(calls, 1);
  });

  test('once: mutation of a cached returned object is visible without invoking again', () => {
    const value = { version: 1 };
    let calls = 0;
    const wrapper = api.once(() => {
      calls++;

      return value;
    });

    wrapper().version = 2;
    assert.equal(wrapper(), value);
    assert.equal(wrapper().version, 2);
    assert.equal(calls, 1);
  });

  test('repeatAsync of once shares one execution; once of repeatAsync caches the entire run', async () => {
    let calls = 0;
    const one = api.once(async () => ++calls);

    assert.deepEqual(await api.repeatAsync(one, 3), [1, 1, 1]);
    assert.equal(calls, 1);
    const whole = api.once(() => api.repeatAsync(async () => ++calls, 3));
    const first = whole();

    assert.equal(whole(), first);
    assert.deepEqual(await first, [2, 3, 4]);
    assert.equal(calls, 4);
    assert.equal(whole(), first);
  });

  test('repeatAsync of attemptResultAsync collects failures and intentionally continues', async () => {
    let calls = 0;
    const reason = {};
    const results = await api.repeatAsync(
      () =>
        api.attemptResultAsync(() => {
          if (++calls === 2) throw reason;

          return calls;
        }),
      3
    );

    assert.deepEqual(results, [
      { ok: true, value: 1 },
      { ok: false, error: reason },
      { ok: true, value: 3 }
    ]);
    assert.equal(calls, 3);
  });

  test('attemptResultAsync of repeatAsync captures one failure and repetition stops', async () => {
    let calls = 0;
    const reason = {};
    const outcome = await api.attemptResultAsync(() =>
      api.repeatAsync(() => {
        if (++calls === 2) throw reason;

        return calls;
      }, 4)
    );

    assert.deepEqual(outcome, { ok: false, error: reason });
    assert.equal(calls, 2);
  });

  test('attemptResult of once-cached failure creates fresh records around the same reason', () => {
    let calls = 0;
    const reason = {};
    const run = api.once(() => {
      calls++;
      throw reason;
    });
    const first = api.attemptResult(run),
      second = api.attemptResult(run);

    assert.deepEqual(first, { ok: false, error: reason });
    assert.deepEqual(second, { ok: false, error: reason });
    assert.notEqual(first, second);
    assert.equal(calls, 1);
  });
});
