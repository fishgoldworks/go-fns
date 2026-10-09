'use strict';
// Browser-only contract checks; loaded by scripts/test-browser.py without a CDN.
window.runGoFnsBrowserContracts = async function (bundleSource) {
  const f = window.Functions;
  let cases = 0,
    assertions = 0;
  function equal(actual, expected) {
    assertions++;
    if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
  function throwsType(fn) {
    let error;
    try {
      fn();
    } catch (value) {
      error = value;
    }
    equal(error instanceof TypeError, true);
  }
  async function test(name, fn) {
    try {
      await fn();
      cases++;
    } catch (error) {
      throw new Error(`${name}: ${error.message}`, { cause: error });
    }
  }
  // Each iframe loses capabilities before its own bundle is evaluated.
  for (const capability of [
    'present',
    'performance',
    'performance.now',
    'AbortController',
    'AbortSignal',
    'globalThis',
    'self',
    'window-only',
    'combined',
    'signal.addEventListener',
    'signal.removeEventListener'
  ]) {
    await test('fresh browser capabilities: ' + capability, async () => {
      const frame = document.createElement('iframe');
      document.body.append(frame);
      try {
        const host = frame.contentWindow;
        const controller = new host.AbortController();
        const reason = {};
        if (capability === 'performance.now') {
          Object.defineProperty(host.performance, 'now', { value: undefined });
          equal(typeof host.performance.now, 'undefined');
        }
        const remove =
          capability === 'window-only'
            ? ['globalThis', 'self']
            : capability === 'combined'
              ? ['globalThis', 'self', 'performance', 'AbortController', 'AbortSignal']
              : ['performance', 'AbortController', 'AbortSignal', 'globalThis', 'self'].includes(capability)
                ? [capability]
                : [];
        for (const name of remove) {
          delete host[name];
          equal(typeof host[name], 'undefined');
        }
        if (capability.startsWith('signal.')) {
          Object.defineProperty(controller.signal, capability.slice(7), { value: undefined });
        }
        host.eval(bundleSource);
        const api = host.Functions,
          value = {},
          receiver = {};
        equal(Object.keys(api).length, 32);
        equal(api.pipe((x) => x)(value), value);
        equal(
          api.when(
            () => false,
            () => {
              throw Error('Skipped callback');
            }
          )(value),
          value
        );
        equal(
          await api.whenAsync(
            () => false,
            () => {
              throw Error('Skipped callback');
            }
          )(value),
          value
        );
        if (capability.startsWith('signal.')) {
          let error;
          try {
            await api.sleep(0, { signal: controller.signal });
          } catch (caught) {
            error = caught;
          }
          equal(error instanceof host.TypeError, true);
          equal(error.message.includes('AbortSignal-compatible'), true);
        } else {
          await api.sleep(0);
          const waiting = api.sleep(100, { signal: controller.signal });
          controller.abort(reason);
          let error;
          try {
            await waiting;
          } catch (caught) {
            error = caught;
          }
          equal(error, reason);
        }
        await new Promise((resolve, reject) =>
          api.delay(
            function (input) {
              try {
                equal(this, host);
                equal(input, value);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            0,
            value
          )
        );
        for (const name of ['debounce', 'throttle']) {
          let calls = 0;
          const scheduled = api[name](
            function (input) {
              calls++;
              equal(this, receiver);
              equal(input, value);
              return input;
            },
            10,
            { leading: false }
          );
          scheduled.call(receiver, value);
          equal(calls, 0);
          equal(scheduled.pending(), true);
          equal(scheduled.flush(), value);
          equal(calls, 1);
          equal(scheduled.pending(), false);
          scheduled.call(receiver, value);
          scheduled.cancel();
          equal(scheduled.pending(), false);
        }
      } finally {
        frame.remove();
      }
    });
  }
  await test('all thirty-two public exports', () =>
    equal(
      Object.keys(f).sort().join(','),
      'and,andAsync,attempt,attemptResult,attemptResultAsync,debounce,delay,ifElse,ifElseAsync,nor,norAsync,not,notAsync,once,or,orAsync,partial,partialRight,pipe,pipeAsync,repeat,repeatAsync,sleep,spread,tap,tapAsync,throttle,unary,when,whenAsync,xor,xorAsync'
    ));
  for (const name of ['and', 'or', 'nor', 'xor']) {
    for (let size = 0; size <= 6; size++) {
      for (let bits = 0; bits < 2 ** size; bits++) {
        await test(`${name} truth table ${size}/${bits}`, () => {
          const values = Array.from({ length: size }, (_, i) => !!(bits & (1 << i)));
          const truths = values.filter(Boolean).length;
          const expected =
            name === 'and'
              ? size > 0 && truths === size
              : name === 'or'
                ? truths > 0
                : name === 'nor'
                  ? size > 0 && truths === 0
                  : truths === 1;
          equal(f[name](...values.map((value) => () => value))(), expected);
        });
      }
    }
  }
  await test('pipeline ignores all nullish positions', () =>
    equal(
      f.pipe(
        null,
        (a, b) => a + b,
        undefined,
        (x) => x * 2,
        null
      )(2, 3),
      10
    ));
  await test('empty pipeline stays undefined', () => equal(f.pipe(null, undefined)(7), undefined));
  for (const name of ['and', 'or', 'xor', 'nor', 'not']) {
    await test(`${name} preserves receiver`, () => {
      const receiver = {};
      let seen;
      f[name](function () {
        seen = this;
        return true;
      }).call(receiver);
      equal(seen, receiver);
    });
  }
  for (const [name, invoke] of [
    ['namespace', (...args) => f.delay(...args)],
    [
      'detached',
      (...args) => {
        const { delay } = f;
        return delay(...args);
      }
    ],
    ['explicit receiver', (...args) => f.delay.call({}, ...args)]
  ]) {
    await test(`browser timer ${name}`, async () => {
      let synchronous = true,
        handle;
      const token = {};
      const complete = new Promise((resolve, reject) => {
        handle = invoke(
          function (first, second) {
            try {
              equal(synchronous, false);
              equal(this, window);
              equal(first, token);
              equal(second, undefined);
              equal(arguments.length, 2);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          0,
          token,
          undefined
        );
      });
      equal(typeof handle, 'number');
      synchronous = false;
      await complete;
    });
  }
  await test('timer cancellation', async () => {
    let calls = 0;
    const handle = f.delay(() => calls++, 0);
    clearTimeout(handle);
    await new Promise((resolve) => setTimeout(resolve, 10));
    equal(calls, 0);
  });
  await test('bound browser callback receiver', async () => {
    const receiver = {};
    const actual = await new Promise((resolve) =>
      f.delay(
        function () {
          resolve(this);
        }.bind(receiver),
        0
      )
    );
    equal(actual, receiver);
  });
  await test('zero and null repetition counts', () => {
    equal(f.repeat(() => 1, 0).length, 0);
    equal(f.repeat(() => 1, null).length, 0);
  });
  await test('unbounded repetition fails before callback execution', () => {
    let called = false,
      error;
    try {
      f.repeat(() => {
        called = true;
        throw Error('must not execute');
      }, Infinity);
    } catch (value) {
      error = value;
    }
    equal(error instanceof RangeError, true);
    equal(called, false);
  });
  await test('validation never calls coercion hooks', () => {
    const hostile = {
      [Symbol.toPrimitive]() {
        throw Error('must not coerce');
      }
    };
    throwsType(() => f.not(hostile));
    throwsType(() => f.and(hostile));
  });
  await test('cross-realm callbacks and argument arrays', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const fn = frame.contentWindow.Function('a', 'b', 'return a + b');
      const values = new frame.contentWindow.Array(2, 3);
      equal(f.spread(fn)(values), 5);
      equal(f.pipe(fn, (x) => x * 2)(2, 3), 10);
    } finally {
      frame.remove();
    }
  });
  await test('callable proxies and shadowed invocation properties', () => {
    function callback(value) {
      return value + 1;
    }
    callback.apply = null;
    callback.call = null;
    equal(f.pipe(callback, callback)(1), 3);
    equal(f.spread(new Proxy(callback, {}))([2]), 3);
  });
  await test('promises remain synchronous values', async () => {
    const value = Promise.resolve(false);
    equal(f.pipe(() => value)(), value);
    equal(f.and(() => value)(), true);
    equal(f.not(() => value)(), false);
    equal(
      f.attempt(() => value),
      value
    );
    equal(f.repeat(() => value, 1)[0], value);
    equal(await value, false);
  });

  await test('async predicates await foreign promises and preserve document.all truthiness', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      for (const value of [false, true, document.all]) {
        const promise = frame.contentWindow.Promise.resolve(value);
        equal(await f.not.async(() => promise)(), !value);
        equal(await f.and.async(() => promise)(), !!value);
        equal(await f.or.async(() => promise)(), !!value);
      }
    } finally {
      frame.remove();
    }
  });
  for (const [name, proceed] of [
    ['andAsync', true],
    ['orAsync', false]
  ]) {
    await test(`${name} preserves arguments, receiver, timing and short circuiting`, async () => {
      const input = Promise.resolve(3),
        receiver = {};
      let release,
        calls = 0;
      const run = f[name](
        null,
        function (value, optional) {
          calls++;
          equal(value, input);
          equal(optional, undefined);
          equal(arguments.length, 2);
          equal(this, receiver);
          return new Promise((resolve) => {
            release = resolve;
          });
        },
        undefined,
        function (value, optional) {
          calls++;
          equal(value, input);
          equal(optional, undefined);
          equal(arguments.length, 2);
          equal(this, receiver);
          return !proceed;
        },
        () => {
          throw Error('Must short circuit');
        }
      );
      const pending = run.call(receiver, input, undefined);
      equal(pending instanceof Promise, true);
      equal(calls, 1);
      release(proceed);
      equal(await pending, !proceed);
      equal(calls, 2);
      equal(await f[name](null, undefined)(), false);
      const reason = {};
      await rejectsExact(
        f[name](
          () => Promise.reject(reason),
          () => {
            throw Error('Must stop');
          }
        )(),
        reason
      );
    });
  }

  await test('async conditionals preserve browser inputs and await only the selected branch', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const foreign = frame.contentWindow.Promise;
      const input = foreign.resolve(3),
        receiver = {};
      let calls = 0,
        release;
      const choose = f.ifElseAsync(
        function (value, second) {
          equal(this, receiver);
          equal(value, input);
          equal(second, undefined);
          equal(arguments.length, 2);
          calls++;
          return new foreign((resolve) => {
            release = resolve;
          });
        },
        () => {
          throw Error('Must select false');
        },
        function (value, second) {
          equal(this, receiver);
          equal(value, input);
          equal(second, undefined);
          equal(arguments.length, 2);
          calls++;
          return foreign.resolve('false branch');
        }
      );
      const pending = choose.call(receiver, input, undefined);
      equal(calls, 1);
      release(false);
      equal(await pending, 'false branch');
      equal(calls, 2);
      const transform = f.when.async(
        function (value) {
          equal(value, input);
          equal(this, receiver);
          equal(arguments.length, 1);
          return foreign.resolve(false);
        },
        () => {
          throw Error('Must skip transform');
        }
      );
      equal(await transform.call(receiver, input, 'ignored'), 3);
      equal(
        await f.whenAsync(
          async () => true,
          (value) => value + 1
        )(3),
        4
      );
      equal(
        await f.whenAsync(
          () => document.all,
          () => 'wrong'
        )(input),
        3
      );
      equal(
        await f.ifElse.async(
          () => document.all,
          () => 'wrong',
          () => 'right'
        )(),
        'right'
      );
      equal(await f.norAsync(() => foreign.resolve(document.all))(), true);
      equal(
        await f.xorAsync(
          () => foreign.resolve(document.all),
          () => true
        )(),
        true
      );
      throwsType(() => f.whenAsync(() => false, document.all));
      throwsType(() =>
        f.ifElseAsync(
          () => true,
          () => true,
          document.all
        )
      );
      const reason = {};
      await rejectsExact(
        f.whenAsync(
          () => foreign.reject(reason),
          () => 'wrong'
        )(),
        reason
      );
      await rejectsExact(
        f.ifElseAsync(
          () => false,
          () => 'wrong',
          () => foreign.reject(reason)
        )(),
        reason
      );
    } finally {
      frame.remove();
    }
  });
  await test('async NOR and XOR short circuit at their documented thresholds', async () => {
    equal(await f.norAsync()(), false);
    equal(await f.xorAsync(null, undefined)(), false);
    equal(
      await f.norAsync(
        async () => true,
        () => {
          throw Error('Must stop');
        }
      )(),
      false
    );
    equal(
      await f.xorAsync(
        async () => true,
        async () => true,
        () => {
          throw Error('Must stop at two');
        }
      )(),
      false
    );
    equal(
      await f.xorAsync(
        async () => false,
        async () => true
      )(),
      true
    );
  });

  await test('worker bundle and native timer', async () => {
    const runWorker = async function () {
      try {
        const api = self.Functions;
        for (const name of ['not', 'and', 'or', 'when', 'ifElse', 'nor', 'xor']) {
          if (api[name].async !== api[name + 'Async']) throw Error('Worker alias identity: ' + name);
        }
        if (
          !(await api.notAsync(() => Promise.resolve(false))()) ||
          !(await api.and.async(
            () => true,
            () => Promise.resolve(true)
          )()) ||
          !(await api.orAsync(
            () => false,
            () => Promise.resolve(true)
          )())
        ) {
          throw Error('Async worker predicate');
        }
        if (
          (await api.whenAsync(
            async () => true,
            (value) => value + 1
          )(2)) !== 3 ||
          (await api.ifElse.async(
            async () => false,
            () => 0,
            () => 1
          )()) !== 1 ||
          !(await api.norAsync(async () => false)()) ||
          !(await api.xor.async(
            async () => false,
            () => true
          )())
        ) {
          throw Error('Async worker completion');
        }
        const output = api.pipe(null, (value) => value + 1)(2);
        const handle = api.delay((value) => self.postMessage({ value, kind: typeof handle }), 0, output);
      } catch (error) {
        self.postMessage({ error: error.message });
      }
    };
    const source = bundleSource + '\nself.onmessage = ' + runWorker.toString() + ';';
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    try {
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(null);
      });
      equal(result.error, undefined);
      equal(result.value, 3);
      equal(result.kind, 'number');
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  });
  for (const count of [0, 1, 2, 3, 4, 8, 64]) {
    for (const name of ['attempt', 'repeat']) {
      await test(`${name} preserves ${count} native rest arguments`, () => {
        const token = {},
          args = Array.from({ length: count }, (_, i) => (i % 2 ? token : undefined));
        let calls = 0;
        function callback() {
          equal(this, callback);
          equal(arguments.length, count);
          for (let i = 0; i < count; i++) equal(arguments[i], args[i]);
          calls++;
          return token;
        }
        if (name === 'attempt') equal(f.attempt(callback, ...args), token);
        else {
          const result = f.repeat(callback, 3, ...args);
          equal(result.length, 3);
          for (const value of result) equal(value, token);
        }
        equal(calls, name === 'attempt' ? 1 : 3);
      });
    }
  }
  for (const count of [1, 2, 3, 4, 16, 64]) {
    await test(`pipeline invokes ${count} hostile-property callbacks without lookup`, () => {
      const callback = new Proxy(
        function (value) {
          equal(arguments.length, 1);
          equal(this, null);
          return value + 1;
        },
        {
          get(target, key, receiver) {
            if (key === 'call' || key === 'apply') throw Error('must not read ' + key);
            return Reflect.get(target, key, receiver);
          }
        }
      );
      equal(f.pipe(...Array(count).fill(callback)).call(null, 0), count);
    });
  }
  await test('attempt preserves reflected arity', () => equal(f.attempt.length, 2));
  await test('repeat preserves reflected arity', () => equal(f.repeat.length, 3));
  // document.all has the unusual [[IsHTMLDDA]] semantics: == null and typeof
  // undefined, but is neither null nor undefined. It must not be silently skipped.
  for (const name of ['pipe', 'and', 'or', 'nor', 'xor', 'notAsync', 'andAsync', 'orAsync', 'norAsync', 'xorAsync']) {
    await test(`${name} rejects document.all rather than treating it as null`, () =>
      throwsType(() => f[name](document.all)));
  }
  await test('repeat rejects document.all as a count', () => throwsType(() => f.repeat(() => 1, document.all)));
  await test('spread treats document.all as an array-like collection', () =>
    equal(
      f.spread(function () {
        return arguments.length;
      })(document.all),
      document.all.length
    ));
  async function rejectsExact(promise, reason) {
    let rejected = false;
    await promise.then(
      () => {},
      (error) => {
        rejected = true;
        equal(error, reason);
      }
    );
    equal(rejected, true);
  }
  async function rejectsType(promise) {
    let error;
    try {
      await promise;
    } catch (value) {
      error = value;
    }
    equal(error instanceof TypeError, true);
  }
  for (const [parent, property, name] of [
    ['when', 'async', 'whenAsync'],
    ['ifElse', 'async', 'ifElseAsync'],
    ['nor', 'async', 'norAsync'],
    ['xor', 'async', 'xorAsync'],
    ['not', 'async', 'notAsync'],
    ['and', 'async', 'andAsync'],
    ['or', 'async', 'orAsync'],
    ['pipe', 'async', 'pipeAsync'],
    ['attempt', 'result', 'attemptResult'],
    ['attempt', 'resultAsync', 'attemptResultAsync'],
    ['attemptResult', 'async', 'attemptResultAsync'],
    ['tap', 'async', 'tapAsync']
  ]) {
    await test(`${parent}.${property} exact alias`, () => equal(f[parent][property], f[name]));
  }
  const resultValues = [
    undefined,
    null,
    false,
    true,
    0,
    -0,
    NaN,
    1,
    Infinity,
    '',
    'text',
    0n,
    Symbol('value'),
    {},
    [],
    new Error('value')
  ];
  for (let i = 0; i < resultValues.length; i++) {
    const value = resultValues[i];
    await test(`async predicates await truthiness ${i}`, async () => {
      equal(await f.norAsync(() => Promise.resolve(value))(), !value);
      equal(await f.xorAsync(() => Promise.resolve(value))(), !!value);
      equal(await f.notAsync(() => Promise.resolve(value))(), !value);
      equal(await f.andAsync(() => Promise.resolve(value))(), !!value);
      equal(await f.orAsync(() => Promise.resolve(value))(), !!value);
    });
    await test(`structured outcomes preserve value ${i}`, async () => {
      const success = f.attemptResult(() => value),
        failure = f.attemptResult(() => {
          throw value;
        });
      equal(success.ok, true);
      equal(success.value, value);
      equal('error' in success, false);
      equal(failure.ok, false);
      equal(failure.error, value);
      equal('value' in failure, false);
      const asyncSuccess = await f.attemptResultAsync(() => Promise.resolve(value));
      const asyncFailure = await f.attemptResultAsync(() => Promise.reject(value));
      equal(asyncSuccess.ok, true);
      equal(asyncSuccess.value, value);
      equal(asyncFailure.ok, false);
      equal(asyncFailure.error, value);
    });
    await test(`once caches returned and thrown value ${i}`, () => {
      let calls = 0;
      const run = f.once(() => {
        calls++;
        return value;
      });
      equal(run(), value);
      equal(run(), value);
      equal(calls, 1);
      let failures = 0;
      const fail = f.once(() => {
        failures++;
        throw value;
      });
      for (let j = 0; j < 2; j++) {
        let caught = false;
        try {
          fail();
        } catch (error) {
          caught = true;
          equal(error, value);
        }
        equal(caught, true);
      }
      equal(failures, 1);
    });
    await test(`tap variants retain value ${i}`, async () => {
      equal(
        f.tap((input) => {
          equal(input, value);
          return 'ignored';
        })(value),
        value
      );
      equal(
        await f.tapAsync(async (input) => {
          equal(input, value);
          return 'ignored';
        })(value),
        value
      );
    });
    await test(`sleep preserves abort reason ${i}`, async () => {
      const controller = new AbortController();
      const wait = f.sleep(200, { signal: controller.signal });
      controller.abort(value);
      await rejectsExact(wait, controller.signal.reason);
      await rejectsExact(f.sleep(0, { signal: controller.signal }), controller.signal.reason);
    });
  }
  await test('async pipeline ordering, variadic first stage and receivers', async () => {
    const context = {};
    const seen = [];
    const run = f.pipeAsync(
      null,
      function (a, b) {
        equal(this, context);
        equal(arguments.length, 2);
        seen.push(1);
        return Promise.resolve(a + b);
      },
      undefined,
      function (value) {
        equal(this, context);
        equal(arguments.length, 1);
        seen.push(2);
        return value * 2;
      }
    );
    equal(await run.call(context, 2, 3), 10);
    equal(seen.join(','), '1,2');
    equal(await f.pipeAsync()(42), undefined);
  });
  await test('async pipeline stops before later side effects on rejection', async () => {
    const error = {};
    let called = false;
    await rejectsExact(
      f.pipeAsync(
        () => Promise.reject(error),
        () => {
          called = true;
        }
      )(),
      error
    );
    equal(called, false);
  });
  await test('async tap waits for its observer', async () => {
    let release,
      done = false;
    const token = {};
    const result = f
      .tapAsync(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )(token)
      .then((value) => {
        done = true;
        return value;
      });
    await Promise.resolve();
    equal(done, false);
    release();
    equal(await result, token);
    equal(done, true);
  });
  await test('once promise identity and reentrancy', async () => {
    const promise = Promise.resolve(3);
    const get = f.once(() => promise);
    equal(get(), promise);
    equal(get(), promise);
    await promise;
    const recursive = f.once(() => recursive());
    let first;
    try {
      recursive();
    } catch (error) {
      first = error;
    }
    equal(first instanceof Error, true);
    try {
      recursive();
    } catch (error) {
      equal(error, first);
    }
  });
  await test('sleep window namespace, detached, bound and synthetic abort events', async () => {
    await f.sleep(0);
    const { sleep } = f;
    await sleep(0);
    await sleep.call({}, 0);
    const controller = new AbortController();
    const pending = f.sleep(200, { signal: controller.signal });
    controller.signal.dispatchEvent(new Event('abort'));
    controller.abort('real');
    await rejectsExact(pending, 'real');
  });
  await test('sleep normal resolution removes its abort listener', async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    let adds = 0,
      removes = 0;
    const add = signal.addEventListener,
      remove = signal.removeEventListener;
    signal.addEventListener = function () {
      adds++;
      return Reflect.apply(add, this, arguments);
    };
    signal.removeEventListener = function () {
      removes++;
      return Reflect.apply(remove, this, arguments);
    };
    await f.sleep(0, { signal });
    equal(adds, 1);
    equal(removes, 1);
    controller.abort();
    equal(removes, 1);
  });
  for (const name of ['pipeAsync', 'attemptResult', 'tap', 'tapAsync', 'once']) {
    await test(`${name} rejects document.all`, () => throwsType(() => f[name](document.all)));
  }
  await test('promise operations reject document.all as configuration', async () => {
    await rejectsType(f.attemptResultAsync(document.all));
    await rejectsType(f.sleep(document.all));
    await rejectsType(f.sleep(0, document.all));
    await rejectsType(f.sleep(0, { signal: document.all }));
  });
  await test('new APIs accept callbacks, promises and signals from an iframe', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const foreign = frame.contentWindow;
      const fn = foreign.eval('(function(n){return Promise.resolve(n+1);})');
      equal(await f.pipeAsync(fn, (n) => n * 2)(3), 8);
      equal((await f.attemptResultAsync(fn, 3)).value, 4);
      const callback = foreign.eval('(function(value){return value;})');
      const token = {};
      equal(f.once(callback)(token), token);
      equal(f.tap(callback)(token), token);
      const controller = new foreign.AbortController();
      const pending = f.sleep(200, { signal: controller.signal });
      controller.abort(token);
      await rejectsExact(pending, token);
    } finally {
      frame.remove();
    }
  });
  await test('new async APIs operate in a Worker without the DOM', async () => {
    const source =
      bundleSource +
      `\nself.onmessage=async function(){try{const f=Functions;const tap=f.tapAsync(async()=>{});const value=await f.pipe.async(async(a,b)=>a+b,tap,x=>x*2)(2,3);const result=await f.attempt.resultAsync(()=>Promise.resolve(value));await f.sleep(0);const once=f.once(()=>({}));const same=once()===once();const c=new AbortController();const pending=f.sleep(100,{signal:c.signal});c.abort('cancelled');let reason;try{await pending;}catch(error){reason=error;}self.postMessage({value:result.value,ok:result.ok,same,reason});}catch(error){self.postMessage({error:error.message});}};`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    try {
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(null);
      });
      equal(result.error, undefined);
      equal(result.value, 10);
      equal(result.ok, true);
      equal(result.same, true);
      equal(result.reason, 'cancelled');
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  });
  await test('2.2 aliases are exact references', () => {
    equal(f.partial.right, f.partialRight);
    equal(f.repeat.async, f.repeatAsync);
  });
  for (const name of ['partial', 'partialRight', 'unary', 'when', 'ifElse', 'debounce', 'throttle']) {
    await test(`${name} rejects document.all as a callback`, () => throwsType(() => f[name](document.all)));
  }
  for (const name of ['debounce', 'throttle']) {
    await test(`${name} rejects document.all duration, options and flags`, () => {
      throwsType(() => f[name](() => 1, document.all));
      throwsType(() => f[name](() => 1, 1, document.all));
      throwsType(() => f[name](() => 1, 1, { leading: document.all }));
      throwsType(() => f[name](() => 1, 1, { trailing: document.all }));
    });
    for (const leading of [false, true])
      for (const trailing of [false, true]) {
        await test(`${name} edge matrix ${leading}/${trailing}`, () =>
          goFnsTestClock((clock) => {
            const seen = [];
            const fn = f[name](
              (value) => {
                seen.push(value);
                return value;
              },
              10,
              { leading, trailing }
            );
            fn(1);
            equal(fn.pending(), !leading && trailing);
            clock.tick(4);
            fn(2);
            equal(fn.pending(), trailing);
            clock.tick(30);
            equal(seen.join(','), [...(leading ? [1] : []), ...(trailing ? [2] : [])].join(','));
            equal(fn.pending(), false);
            equal(clock.tasks.size, 0);
          }));
      }
    await test(`${name} clears handle zero and flushes latest receiver`, () =>
      goFnsTestClock((clock) => {
        let calls = 0;
        const token = {};
        function fn(value) {
          equal(this, token);
          calls++;
          return value;
        }
        const scheduled = f[name](fn, 10, { leading: false });
        scheduled.call(token, 1);
        equal(clock.tasks.has(0), true);
        scheduled.cancel();
        clock.tick(20);
        equal(calls, 0);
        scheduled.call({}, 2);
        scheduled.call(token, 3);
        const { flush, pending } = scheduled;
        equal(flush(), 3);
        equal(pending(), false);
        equal(clock.tasks.size, 0);
        equal(calls, 1);
      }));
    await test(`${name} recursive flush retains newly scheduled work`, () =>
      goFnsTestClock((clock) => {
        const seen = [];
        const fn = f[name](
          (n) => {
            seen.push(n);
            if (n === 1) fn(2);
          },
          10,
          { leading: false }
        );
        fn(1);
        fn.flush();
        equal(fn.pending(), true);
        clock.tick(10);
        equal(seen.join(','), '1,2');
        equal(clock.tasks.size, 0);
      }));
    await test(`${name} browser namespace and real native timer`, async () => {
      let resolve;
      const finished = new Promise((r) => {
        resolve = r;
      });
      const token = {};
      const box = {
        fn: f[name](
          function (value) {
            equal(this, box);
            resolve(value);
          },
          1,
          { leading: false }
        )
      };
      box.fn(token);
      equal(await finished, token);
      equal(box.fn.pending(), false);
      box.fn.cancel();
    });
  }
  for (const name of ['debounce', 'throttle']) {
    for (const clockCase of ['failure', 'expiry reentry', 'flush reentry']) {
      await test(`${name} browser clock ${clockCase}`, () =>
        goFnsTestClock((clock) => {
          let hook, scheduled;
          const reason = {},
            receiver = {},
            cached = {},
            replacement = {},
            seen = [];
          Object.defineProperty(window, 'performance', {
            configurable: true,
            value: {
              now() {
                if (hook) {
                  const run = hook;
                  hook = undefined;
                  run();
                }
                return clock.now();
              }
            }
          });
          scheduled = f[name](
            function (value) {
              equal(this, receiver);
              seen.push(value);
              return value;
            },
            10,
            { leading: false }
          );
          scheduled.call(receiver, cached);
          equal(scheduled.flush(), cached);
          scheduled.call(receiver, 'discarded');
          hook = () => {
            if (clockCase === 'failure') throw reason;
            scheduled.cancel();
            scheduled.call(receiver, replacement);
          };
          if (clockCase === 'failure') {
            let error;
            try {
              clock.tick(10);
            } catch (caught) {
              error = caught;
            }
            equal(error, reason);
          } else if (clockCase === 'flush reentry') equal(scheduled.flush(), cached);
          else clock.tick(10);
          equal(seen.length, 1);
          equal(seen[0], cached);
          equal(scheduled.pending(), clockCase !== 'failure');
          equal(clock.tasks.size, clockCase === 'failure' ? 0 : 1);
          if (clockCase === 'failure') {
            equal(scheduled.flush(), cached);
            scheduled.call(receiver, replacement);
          }
          clock.tick(10);
          equal(seen.length, 2);
          equal(seen[1], replacement);
          equal(scheduled.pending(), false);
          equal(clock.tasks.size, 0);
        }));
    }
  }
  await test('throttle trailing edge preserves the next spacing interval', () =>
    goFnsTestClock((clock) => {
      const seen = [];
      const fn = f.throttle((n) => seen.push([clock.now(), n]), 10);
      fn(1);
      clock.tick(1);
      fn(2);
      clock.tick(9);
      clock.tick(1);
      fn(3);
      equal(seen.length, 2);
      clock.tick(9);
      equal(JSON.stringify(seen), '[[1000,1],[1010,2],[1020,3]]');
    }));
  await test('debounce maxWait prevents starvation', () =>
    goFnsTestClock((clock) => {
      const seen = [];
      const fn = f.debounce((n) => seen.push([clock.now(), n]), 10, { maxWait: 25 });
      for (let i = 0; i < 7; i++) {
        fn(i);
        clock.tick(4);
      }
      equal(JSON.stringify(seen), '[[1025,6]]');
      clock.tick(20);
      equal(seen.length, 1);
    }));
  await test('debounce rejects document.all maxWait', () =>
    throwsType(() => f.debounce(() => 1, 1, { maxWait: document.all })));
  await test('argument adapters and branch truthiness in browsers', () => {
    equal(JSON.stringify(['10', '20', '30'].map(f.unary(parseInt))), '[10,20,30]');
    equal(f.partial((area, text) => area + text, 'listings:')('ready'), 'listings:ready');
    equal(f.partialRight((text, end) => text + end, '!')('ready'), 'ready!');
    equal(
      f.when(
        () => document.all,
        () => 1
      )('kept'),
      'kept'
    );
    equal(
      f.ifElse(
        () => document.all,
        () => 1,
        () => 2
      )(),
      2
    );
    const args = f.unary(function () {
      return Array.from(arguments);
    })();
    equal(args.length, 1);
    equal(args[0], undefined);
  });
  await test('repeatAsync rejection and sequential execution in browser', async () => {
    await rejectsType(f.repeatAsync(document.all));
    await rejectsType(f.repeatAsync(() => 1, document.all));
    let active = 0,
      max = 0,
      calls = 0;
    const result = await f.repeatAsync(async () => {
      calls++;
      active++;
      max = Math.max(max, active);
      await Promise.resolve();
      active--;
      return calls;
    }, 3);
    equal(result.join(','), '1,2,3');
    equal(max, 1);
    let count = 0;
    await rejectsExact(
      f.repeatAsync(() => {
        count++;
        throw 'failed';
      }, 3),
      'failed'
    );
    equal(count, 1);
  });
  await test('2.2 callbacks and receivers from an iframe', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const foreign = frame.contentWindow;
      const fn = foreign.eval('(function(a,b){return this.value+a+b;})');
      const receiver = { value: 2 };
      equal(f.partial(fn, 3).call(receiver, 4), 9);
      equal(f.partialRight(fn, 4).call(receiver, 3), 9);
      const options = foreign.eval('({leading:false,trailing:true})');
      const scheduled = f.debounce(fn, 20, options);
      scheduled.call(receiver, 3, 4);
      equal(scheduled.flush(), 9);
      scheduled.cancel();
      const asyncFn = foreign.eval('(async function(n){return n+1;})');
      equal((await f.repeatAsync(asyncFn, 2, 1)).join(','), '2,2');
    } finally {
      frame.remove();
    }
  });
  await test('all 2.2 helpers run in a Worker without a window', async () => {
    const source =
      bundleSource +
      `\nself.onmessage=async function(){try{const f=Functions;const seen=[];const d=f.debounce(x=>seen.push(x),10);d(1);d(2);d.flush();d.cancel();const t=f.throttle(x=>x,10);const throttled=t(3);t.cancel();const fn=f.partialRight((a,b)=>a+b,2);const branch=f.ifElse(x=>x>0,f.unary(fn),()=>0);const n=f.when(x=>x<5,x=>x*2)(branch(1));const values=await f.repeatAsync(()=>n,2);self.postMessage({seen,throttled,values,partial:f.partial((a,b)=>a+b,1)(2)});}catch(error){self.postMessage({error:error.message});}};`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    try {
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(null);
      });
      equal(result.error, undefined);
      equal(result.seen.join(','), '2');
      equal(result.throttled, 3);
      equal(result.values.join(','), '6,6');
      equal(result.partial, 3);
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  });

  for (const name of ['debounce', 'throttle'])
    for (const direction of [-1, 1]) {
      await test(`${name} ignores wall-clock step ${direction}`, () =>
        goFnsTestClock((clock) => {
          const seen = [];
          const fn = f[name]((x) => seen.push([clock.now(), x]), 100, { leading: true });
          fn(1);
          clock.tick(1);
          clock.wallJump(direction * 3600000);
          fn(2);
          equal(seen.length, 1);
          clock.tick(100);
          equal(
            JSON.stringify(seen),
            JSON.stringify([
              [1000, 1],
              [name === 'throttle' ? 1100 : 1101, 2]
            ])
          );
          equal(clock.tasks.size, 0);
        }));
    }
  for (const name of ['partial', 'partialRight']) {
    await test(`${name} optimized zero-input proxy path isolates arguments`, () => {
      const seen = [],
        token = {};
      const fn = f[name](
        new Proxy(function () {}, {
          apply(target, receiver, args) {
            seen.push(args);
            const first = args[0];
            args[0] = 'mutated';
            return first;
          }
        }),
        token
      );
      equal(fn(), token);
      equal(fn(), token);
      equal(seen[0] === seen[1], false);
    });
  }

  // cross-helper handoffs in an actual browser, not only isolated utilities.
  for (const outer of ['partial', 'partialRight']) {
    for (const inner of ['partial', 'partialRight']) {
      await test(`${outer}/${inner} nesting and proxy argument isolation`, () => {
        const receiver = {},
          token = {};
        const first = [token, undefined],
          second = ['suffix'],
          input = [3];
        const middle = outer === 'partial' ? [...second, ...input] : [...input, ...second];
        const expected = inner === 'partial' ? [...first, ...middle] : [...middle, ...first];
        const lists = [];
        const callback = new Proxy(function () {}, {
          get() {
            throw new Error('Callback property access');
          },
          apply(target, context, args) {
            equal(context, receiver);
            equal(args.length, expected.length);
            args.forEach((value, i) => equal(value, expected[i]));
            equal(lists.includes(args), false);
            lists.push(args);
            args.length = 0;
            return token;
          }
        });
        const run = f[outer](f[inner](callback, ...first), ...second);
        equal(run.apply(receiver, input), token);
        equal(run.apply(receiver, input), token);
        equal(lists.length, 2);
      });
    }
  }
  await test('spread snapshots length and never requests an iterator', () => {
    const visits = [];
    const list = {
      get length() {
        visits.push('length');
        return 2;
      },
      get 0() {
        visits.push('0');
        Object.defineProperty(list, 'length', { value: 0 });
        return 4;
      },
      get 1() {
        visits.push('1');
        return 5;
      },
      get [Symbol.iterator]() {
        throw new Error('Unexpected iterator read');
      }
    };
    equal(
      f.pipe(
        f.spread((a, b) => a + b),
        f.partialRight((value, n) => value * n, 2)
      )(list),
      18
    );
    equal(visits.join(','), 'length,0,1');
  });
  for (const name of ['whenAsync', 'ifElseAsync']) {
    await test(`${name} assimilates a predicate only once across a pipeline`, async () => {
      let thenCalls = 0,
        branches = 0;
      const input = {},
        receiver = {};
      const condition = {
        then(resolve) {
          thenCalls++;
          resolve(true);
          resolve(false);
          throw new Error('Late failure after settlement');
        }
      };
      const choose = f[name](
        function (value) {
          equal(value, input);
          equal(this, receiver);
          return condition;
        },
        function (value) {
          branches++;
          equal(this, receiver);
          return value;
        },
        () => {
          throw new Error('Unselected branch');
        }
      );
      equal(
        await f
          .pipeAsync(
            choose,
            f.tapAsync((value) => equal(value, input))
          )
          .call(receiver, input),
        input
      );
      equal(thenCalls, 1);
      equal(branches, 1);
    });
    await test(`${name} does not invoke a revoked unselected callback`, async () => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const input = {};
      const revoked = Proxy.revocable(() => 'unused', {});
      const pending = f[name](
        () => gate,
        revoked.proxy,
        () => input
      )(input);
      revoked.revoke();
      release(false);
      equal(await pending, input);
    });
  }
  await test('tapAsync waits before adopting an input thenable', async () => {
    const visits = [];
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const input = {
      get then() {
        visits.push('then');
        return (resolve) => resolve(7);
      }
    };
    const result = f.tapAsync((value) => {
      equal(value, input);
      visits.push('observer');
      return gate;
    })(input);
    await Promise.resolve();
    equal(visits.join(','), 'observer');
    release();
    equal(await result, 7);
    equal(visits.join(','), 'observer,then');
  });
  // real browser truthiness, lazy execution and thenable lifecycle checks.
  for (const name of ['and', 'or', 'nor', 'xor', 'not']) {
    await test(`${name} distinguishes a thenable from its document.all outcome`, async () => {
      let reads = 0,
        calls = 0;
      const result = {
        get then() {
          reads++;
          return (resolve, reject) => {
            calls++;
            resolve(document.all);
            reject(new Error('Late rejection must be ignored'));
            resolve(true);
          };
        }
      };
      equal(f[name](() => result)(), name !== 'nor' && name !== 'not');
      equal(reads, 0);
      equal(await f[name + 'Async'](() => result)(), name === 'nor' || name === 'not');
      equal(reads, 1);
      equal(calls, 1);
    });
    await test(`${name}Async does not assimilate a rejection reason`, async () => {
      const failure = new Proxy(
        {},
        {
          get() {
            throw new Error('Rejection reason property was read');
          }
        }
      );
      await f[name + 'Async'](() => Promise.reject(failure))().then(
        () => {
          throw new Error('Expected rejection');
        },
        (actual) => equal(actual, failure)
      );
    });
  }
  for (const name of ['and', 'or', 'nor', 'xor']) {
    await test(`${name}Async skips a revoked callback after an awaited decision`, async () => {
      let release, announce;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const started = new Promise((resolve) => {
        announce = resolve;
      });
      const revoked = Proxy.revocable(() => {
        throw new Error('Should not run');
      }, {});
      const prefix = name === 'xor' ? [() => true] : [];
      const wrapper = f[name + 'Async'](
        ...prefix,
        () => {
          announce();
          return gate;
        },
        revoked.proxy
      );
      const pending = wrapper();
      await started;
      revoked.revoke();
      release(name !== 'and');
      equal(await pending, name === 'or');
    });
    await test(`${name}Async isolates reentry from a then getter`, async () => {
      const continuance = name === 'and';
      const nested = [];
      const visited = [];
      const wrapper = f[name + 'Async'](
        (depth) => ({
          get then() {
            if (depth) nested.push(wrapper(depth - 1));
            return (resolve) => resolve(continuance);
          }
        }),
        (depth) => {
          visited.push(depth);
          return continuance;
        }
      );
      const expected = name === 'and' || name === 'nor';
      equal(await wrapper(2), expected);
      for (const pending of nested) equal(await pending, expected);
      equal(visited.sort().join(','), '0,1,2');
    });
  }
  // result identity, asynchronous repetition and cached state.
  for (const name of ['attemptResult', 'attemptResultAsync']) {
    await test(`${name} distinguishes returned document.all from thrown document.all`, async () => {
      const success = await f[name](() => document.all);
      const failure = await f[name](() => {
        throw document.all;
      });
      equal(success.ok, true);
      equal(success.value, document.all);
      equal(failure.ok, false);
      equal(failure.error, document.all);
    });
  }
  await test('attemptResultAsync captures a hostile thrown value without assimilation', async () => {
    const reason = new Proxy(
      {},
      {
        get() {
          throw new Error('Failure was inspected');
        }
      }
    );
    const result = await f.attemptResultAsync(() => {
      throw reason;
    });
    equal(result.ok, false);
    equal(result.error, reason);
  });
  await test('attemptResultAsync follows the first resolution through a pending thenable', async () => {
    let release, started;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    let settled = false;
    const pending = f.attemptResultAsync(() => ({
      then(resolve, reject) {
        resolve(gate);
        reject('late');
        started();
      }
    }));
    pending.then(() => {
      settled = true;
    });
    await ready;
    equal(settled, false);
    release(document.all);
    const result = await pending;
    equal(result.ok, true);
    equal(result.value, document.all);
  });
  await test('repeatAsync reawaits each occurrence of a repeated thenable', async () => {
    let reads = 0;
    const value = {
      get then() {
        const n = ++reads;
        return (resolve) => resolve(n);
      }
    };
    const output = await f.repeatAsync(() => value, 3);
    equal(output.join(','), '1,2,3');
    equal(reads, 3);
  });
  for (const outcome of ['resolve', 'reject']) {
    await test(`repeatAsync handles revocation after a pending ${outcome}`, async () => {
      let release,
        fail,
        calls = 0;
      const reason = {};
      const gate = new Promise((resolve, reject) => {
        release = resolve;
        fail = reject;
      });
      const callable = Proxy.revocable(() => {
        calls++;
        return gate;
      }, {});
      const check = f.repeatAsync(callable.proxy, 2).then(
        () => {
          throw new Error('Expected failure');
        },
        (error) => {
          if (outcome === 'reject') equal(error, reason);
          else equal(error instanceof TypeError, true);
        }
      );
      callable.revoke();
      if (outcome === 'resolve') release(1);
      else fail(reason);
      await check;
      equal(calls, 1);
    });
  }
  await test('once caches document.all even though it is falsy and typeof undefined', () => {
    let calls = 0;
    const wrapper = f.once(() => {
      calls++;
      return document.all;
    });
    equal(wrapper(), document.all);
    equal(wrapper(), document.all);
    equal(calls, 1);
  });
  await test('once caches a thrown document.all without treating it as a missing error', () => {
    let calls = 0;
    const wrapper = f.once(() => {
      calls++;
      throw document.all;
    });
    for (let i = 0; i < 2; i++) {
      const result = f.attemptResult(wrapper);
      equal(result.ok, false);
      equal(result.error, document.all);
    }
    equal(calls, 1);
  });
  await test('once retains an async rejection promise without retrying', async () => {
    const reason = {};
    let calls = 0;
    const wrapper = f.once(async () => {
      calls++;
      throw reason;
    });
    const promise = wrapper();
    equal(wrapper(), promise);
    await promise.then(
      () => {
        throw new Error('Expected rejection');
      },
      (error) => equal(error, reason)
    );
    equal(wrapper(), promise);
    equal(calls, 1);
  });
  await test('once keeps a returned thenable raw during reentrant assimilation', async () => {
    let calls = 0,
      reads = 0;
    const value = {
      get then() {
        reads++;
        equal(wrapper(), value);
        return (resolve) => resolve(7);
      }
    };
    const wrapper = f.once(() => {
      calls++;
      return value;
    });
    equal(wrapper(), value);
    equal(reads, 0);
    equal(await wrapper(), 7);
    equal(await wrapper(), 7);
    equal(reads, 2);
    equal(calls, 1);
  });
  await test('repeatAsync collects structured failures instead of stopping', async () => {
    let calls = 0;
    const reason = {};
    const results = await f.repeatAsync(
      () =>
        f.attemptResultAsync(() => {
          if (++calls === 2) throw reason;
          return calls;
        }),
      3
    );
    equal(results.length, 3);
    equal(results[0].value, 1);
    equal(results[1].ok, false);
    equal(results[1].error, reason);
    equal(results[2].value, 3);
    equal(calls, 3);
  });
  // registration may synchronously enter instrumentation before a handle exists.
  for (const reason of [{ cancelled: true }, document.all]) {
    for (const phase of ['before', 'after']) {
      await test(`sleep clears a late native handle (${phase}, ${typeof reason})`, async () => {
        const nativeSet = window.setTimeout;
        const nativeClear = window.clearTimeout;
        const controller = new AbortController();
        const live = new Set();
        let handle;
        let cleared = 0;
        window.setTimeout = function (callback, milliseconds) {
          if (phase === 'before') controller.abort(reason);
          handle = nativeSet.call(window, callback, milliseconds);
          live.add(handle);
          if (phase === 'after') controller.abort(reason);
          return handle;
        };
        window.clearTimeout = function (id) {
          live.delete(id);
          cleared++;
          nativeClear.call(window, id);
        };
        try {
          await f.sleep(60_000, { signal: controller.signal }).then(
            () => {
              throw new Error('Expected cancellation');
            },
            (error) => equal(error, reason)
          );
          equal(live.size, 0);
          equal(cleared, 1);
        } finally {
          nativeClear.call(window, handle);
          window.setTimeout = nativeSet;
          window.clearTimeout = nativeClear;
        }
      });
    }
  }
  for (const name of ['debounce', 'throttle']) {
    for (const action of ['cancel', 'flush', 'replace']) {
      await test(`${name} ${action} during registration owns exactly one outcome`, () =>
        window.goFnsTestClock((clock) => {
          const originalSet = window.setTimeout;
          let first = true;
          const seen = [];
          const scheduled = f[name](
            (value) => {
              seen.push(value);
              return value;
            },
            10,
            { leading: false }
          );
          window.setTimeout = (callback, duration) => {
            if (first) {
              first = false;
              if (action === 'flush') equal(scheduled.flush(), 'first');
              else {
                scheduled.cancel();
                if (action === 'replace') scheduled('replacement');
              }
            }
            return originalSet(callback, duration);
          };
          scheduled('first');
          equal(clock.tasks.size, action === 'replace' ? 1 : 0);
          clock.tick(10);
          equal(seen.join(','), action === 'flush' ? 'first' : action === 'replace' ? 'replacement' : '');
          equal(scheduled.pending(), false);
          equal(clock.tasks.size, 0);
        }));
    }
    await test(`${name} cancellation in real native timer instrumentation`, () => {
      const nativeSet = window.setTimeout;
      const nativeClear = window.clearTimeout;
      const live = new Set();
      let called = 0;
      const scheduled = f[name](() => ++called, 60_000, { leading: true });
      window.setTimeout = function (callback, duration) {
        scheduled.cancel();
        const handle = nativeSet.call(window, callback, duration);
        live.add(handle);
        return handle;
      };
      window.clearTimeout = function (handle) {
        live.delete(handle);
        nativeClear.call(window, handle);
      };
      try {
        equal(scheduled(), undefined);
        equal(called, 0);
        equal(live.size, 0);
        equal(scheduled.pending(), false);
      } finally {
        for (const handle of live) nativeClear.call(window, handle);
        window.setTimeout = nativeSet;
        window.clearTimeout = nativeClear;
      }
    });
    await test(`${name} a stale timer cannot duplicate successor work`, () =>
      window.goFnsTestClock((clock) => {
        const seen = [];
        const scheduled = f[name]((value) => seen.push(value), 10, { leading: false });
        scheduled('old');
        const stale = [...clock.tasks.values()][0].fn;
        scheduled.cancel();
        scheduled('new');
        stale();
        equal(clock.tasks.size, 1);
        clock.tick(10);
        equal(seen.join(','), 'new');
        equal(clock.tasks.size, 0);
      }));
  }
  for (const name of ['debounce', 'throttle']) {
    await test(`${name} leading-only suppressed calls preserve cooldown and cached result`, () =>
      window.goFnsTestClock((clock) => {
        const result = {},
          firstThis = {},
          nextThis = {},
          seen = [];
        const scheduled = f[name](
          function (value) {
            seen.push([this, value]);
            return result;
          },
          10,
          { leading: true, trailing: false }
        );
        equal(scheduled.call(firstThis, 'first'), result);
        clock.tick(1);
        equal(scheduled.call({}, { discarded: true }), result);
        equal(scheduled.pending(), false);
        equal(scheduled.flush(), result);
        clock.tick(20);
        equal(seen.length, 1);
        equal(clock.tasks.size, 0);
        equal(scheduled.call(nextThis, 'next'), result);
        equal(seen[0][0], firstThis);
        equal(seen[1][0], nextThis);
        equal(seen[1][1], 'next');
        scheduled.cancel();
        equal(clock.tasks.size, 0);
      }));
    await test(`${name} keeps latest inputs during reentrant leading registration`, () =>
      window.goFnsTestClock((clock) => {
        const register = window.setTimeout,
          receiver = {},
          seen = [];
        let reentered = false;
        const scheduled = f[name](
          function (value) {
            seen.push([this, value, arguments.length]);
            return value;
          },
          10,
          { leading: true, trailing: false }
        );
        window.setTimeout = (callback, duration) => {
          if (!reentered) {
            reentered = true;
            equal(scheduled.call(receiver, 'latest', undefined), undefined);
          }
          return register(callback, duration);
        };
        equal(scheduled('first'), 'latest');
        equal(seen.length, 1);
        equal(seen[0][0], receiver);
        equal(seen[0][1], 'latest');
        equal(seen[0][2], 2);
        equal(scheduled.pending(), false);
        clock.tick(10);
        equal(seen.length, 1);
        equal(clock.tasks.size, 0);
      }));
  }
  return { cases, assertions, status: 'passed' };
};
