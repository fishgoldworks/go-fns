'use strict';

// This consumer deliberately uses only capabilities present in Node.js 8.0.0.
var assert = require('assert');
var path = require('path');
var packageDirectory = process.argv[2];
var expected = [
  'and',
  'andAsync',
  'applyIf',
  'ary',
  'attempt',
  'attemptResult',
  'attemptResultAsync',
  'debounce',
  'delay',
  'ifElse',
  'ifElseAsync',
  'memoize',
  'nor',
  'norAsync',
  'not',
  'notAsync',
  'once',
  'or',
  'orAsync',
  'partial',
  'partialRight',
  'pipe',
  'pipeAsync',
  'repeat',
  'repeatAsync',
  'result',
  'sleep',
  'spread',
  'tap',
  'tapAsync',
  'throttle',
  'unary',
  'when',
  'whenAsync',
  'withDefaultArgs',
  'xor',
  'xorAsync'
];
var removedAttachments = [
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
  ['tap', 'async', 'tapAsync'],
  ['partial', 'right', 'partialRight'],
  ['repeat', 'async', 'repeatAsync']
];
var results = [];

function load(relative) {
  return require(
    packageDirectory ? path.join(packageDirectory, relative || '.') : 'go-fns' + (relative ? '/' + relative : '')
  );
}

async function rejects(promise, expectedError) {
  var rejected = false;

  try {
    await promise;
  } catch (error) {
    rejected = true;
    if (typeof expectedError === 'function') assert(error instanceof expectedError);
    else assert.strictEqual(error, expectedError);
  }

  assert.strictEqual(rejected, true, 'Expected a rejected promise');
}

async function withClock(run) {
  var original = {
    set: global.setTimeout,
    clear: global.clearTimeout,
    now: Date.now,
    performance: Object.getOwnPropertyDescriptor(global, 'performance')
  };
  var now = 1000,
    sequence = 0,
    jobs = new Map();

  global.setTimeout = function (fn, duration) {
    var id = ++sequence;

    jobs.set(id, { fn: fn, time: now + duration });

    return id;
  };

  global.clearTimeout = function (id) {
    jobs.delete(id);
  };

  Date.now = function () {
    return now;
  };

  Object.defineProperty(global, 'performance', { configurable: true, value: undefined });
  var clock = {
    jobs: jobs,
    now: function () {
      return now;
    },
    tick: function (duration) {
      var end = now + duration,
        fired = 0;

      while (true) {
        var firstId = undefined,
          first = undefined;

        jobs.forEach(function (job, id) {
          if (job.time <= end && (!first || job.time < first.time)) {
            firstId = id;
            first = job;
          }
        });
        if (!first) break;
        assert(++fired < 1000, 'Unbounded timer loop');
        now = first.time;
        jobs.delete(firstId);
        first.fn();
      }

      now = end;
    }
  };

  try {
    return await run(clock);
  } finally {
    global.setTimeout = original.set;
    global.clearTimeout = original.clear;
    Date.now = original.now;
    if (original.performance) Object.defineProperty(global, 'performance', original.performance);
    else delete global.performance;
  }
}

function signalController() {
  var listeners = [];
  var signal = {
    aborted: false,
    reason: undefined,
    addEventListener: function (type, listener) {
      assert.strictEqual(this, signal);
      assert.strictEqual(type, 'abort');
      listeners.push(listener);
    },
    removeEventListener: function (type, listener) {
      assert.strictEqual(this, signal);
      assert.strictEqual(type, 'abort');
      listeners = listeners.filter(function (entry) {
        return entry !== listener;
      });
    }
  };

  return {
    signal: signal,
    listeners: function () {
      return listeners.length;
    },
    dispatch: function () {
      listeners.slice().forEach(function (listener) {
        listener();
      });
    },
    abort: function (reason) {
      signal.aborted = true;
      signal.reason = reason;
      this.dispatch();
    }
  };
}

async function exercise(api, format) {
  var checks = 0;

  async function check(name, run) {
    try {
      await run();
      checks++;
    } catch (error) {
      var failure = new Error(format + ': ' + name + ': ' + ((error && error.stack) || String(error)));

      throw failure;
    }
  }

  await check('public API and removed attachments', function () {
    expected.forEach(function (name) {
      assert.strictEqual(typeof api[name], 'function', name);
    });
    removedAttachments.forEach(function (entry) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(api[entry[0]], entry[1]), false);
      assert.strictEqual(typeof api[entry[2]], 'function');
    });
  });

  await check('applyIf applies immediately with truthiness, validation and exact receivers', function () {
    var value = {},
      receiver = {},
      promise = Promise.resolve(false),
      calls = 0;

    assert.strictEqual(api.applyIf('42', true, Number), 42);
    assert.strictEqual(
      api.applyIf(value, false, function () {
        throw Error('Skipped transform');
      }),
      value
    );
    assert.strictEqual(
      api.applyIf(
        value,
        function () {
          return promise;
        },
        function () {
          return promise;
        }
      ),
      promise
    );
    assert.strictEqual(
      api.applyIf.call(
        receiver,
        value,
        function (input) {
          calls++;
          assert.strictEqual(this, receiver);
          assert.strictEqual(arguments.length, 1);

          return input;
        },
        function (input) {
          calls++;
          assert.strictEqual(this, receiver);
          assert.strictEqual(arguments.length, 1);

          return input;
        }
      ),
      value
    );
    assert.strictEqual(calls, 2);
    assert.throws(function () {
      api.applyIf(value, undefined, function () {});
    }, TypeError);
    assert.throws(function () {
      api.applyIf(
        value,
        function () {
          throw Error('Predicate must not run');
        },
        null
      );
    }, TypeError);
  });
  await check('result preserves values, invokes once without a receiver and propagates errors', function () {
    var value = {},
      promise = Promise.resolve(7),
      calls = 0,
      error = {};

    assert.strictEqual(api.result(value), value);
    assert.strictEqual(api.result(promise), promise);
    assert.strictEqual(
      api.result.call(
        value,
        function (first, second) {
          calls++;
          assert.strictEqual(this, undefined);
          assert.strictEqual(arguments.length, 2);
          assert.strictEqual(first, value);
          assert.strictEqual(second, undefined);

          return promise;
        },
        value,
        undefined
      ),
      promise
    );
    assert.strictEqual(calls, 1);
    var inner = function () {
      throw Error('Unexpected recursion');
    };

    assert.strictEqual(
      api.result(function () {
        return inner;
      }),
      inner
    );
    assert.throws(
      function () {
        api.result(function () {
          throw error;
        });
      },
      function (actual) {
        return actual === error;
      }
    );
  });
  await check('sleep detects cancellation when its event was not delivered', async function () {
    await withClock(async function (clock) {
      var controller = signalController(),
        reason = {};
      var pending = api.sleep(5, { signal: controller.signal });

      controller.signal.aborted = true;
      controller.signal.reason = reason;
      clock.tick(5);
      await rejects(pending, reason);
      assert.strictEqual(controller.listeners(), 0);
      assert.strictEqual(clock.jobs.size, 0);
    });
  });

  await check('async predicates await results, forward inputs and short circuit sequentially', async function () {
    var input = Promise.resolve('input'),
      receiver = {},
      reason = {};

    assert.strictEqual(
      await api
        .notAsync(function (value) {
          assert.strictEqual(this, receiver);
          assert.strictEqual(value, input);

          return Promise.resolve(false);
        })
        .call(receiver, input),
      true
    );
    assert.throws(function () {
      api.notAsync(null);
    }, TypeError);
    for (var i = 0; i < 2; i++) {
      var name = i === 0 ? 'andAsync' : 'orAsync';
      var proceed = i === 0,
        calls = [],
        release;
      var run = api[name](
        null,
        function (value, second) {
          calls.push('first');
          assert.strictEqual(this, receiver);
          assert.strictEqual(value, input);
          assert.strictEqual(second, undefined);
          assert.strictEqual(arguments.length, 2);

          return new Promise(function (resolve) {
            release = resolve;
          });
        },
        undefined,
        function (value, second) {
          calls.push('second');
          assert.strictEqual(this, receiver);
          assert.strictEqual(value, input);
          assert.strictEqual(second, undefined);
          assert.strictEqual(arguments.length, 2);

          return !proceed;
        },
        function () {
          throw Error('Unexpected third predicate');
        }
      );
      var pending = run.call(receiver, input, undefined);

      assert(pending instanceof Promise);
      assert.deepStrictEqual(calls, ['first']);
      release(proceed);
      assert.strictEqual(await pending, !proceed);
      assert.deepStrictEqual(calls, ['first', 'second']);
      assert.strictEqual(await api[name](null, undefined)(), false);
      assert.throws(function () {
        api[name](function () {
          throw Error('Must not invoke');
        }, 1);
      }, TypeError);
      await rejects(
        api[name](
          function () {
            return Promise.reject(reason);
          },
          function () {
            throw Error('Must stop at rejection');
          }
        )(),
        reason
      );
    }

    await rejects(
      api.notAsync(function () {
        throw reason;
      })(),
      reason
    );
    assert.strictEqual(
      await api.orAsync(function () {
        return {
          then: function (resolve) {
            resolve('yes');
          }
        };
      })(),
      true
    );
  });

  await check('async conditionals await decisions and preserve branch inputs', async function () {
    var receiver = {},
      input = Promise.resolve(7),
      reason = {},
      calls = [],
      release;
    var transform = api.whenAsync(
      function (value) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(arguments.length, 1);
        assert.strictEqual(value, input);
        calls.push('predicate');

        return new Promise(function (resolve) {
          release = resolve;
        });
      },
      function (value) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(arguments.length, 1);
        assert.strictEqual(value, input);
        calls.push('transform');

        return Promise.resolve(9);
      }
    );
    var pending = transform.call(receiver, input, 'ignored');

    assert(pending instanceof Promise);
    assert.deepStrictEqual(calls, ['predicate']);
    release(true);
    assert.strictEqual(await pending, 9);
    assert.deepStrictEqual(calls, ['predicate', 'transform']);
    assert.strictEqual(
      await api.whenAsync(
        function (value) {
          assert.strictEqual(value, input);

          return Promise.resolve(false);
        },
        function () {
          throw Error('Must not transform');
        }
      )(input),
      7
    );
    var choose = api.ifElseAsync(
      function (first, second) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(first, input);
        assert.strictEqual(second, undefined);
        assert.strictEqual(arguments.length, 2);

        return Promise.resolve(false);
      },
      function () {
        throw Error('Must select false');
      },
      function (first, second) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(first, input);
        assert.strictEqual(second, undefined);
        assert.strictEqual(arguments.length, 2);

        return {
          then: function (resolve) {
            resolve(11);
          }
        };
      }
    );

    assert.strictEqual(await choose.call(receiver, input, undefined), 11);
    assert.strictEqual(
      await api.ifElseAsync(
        function () {
          return true;
        },
        function () {
          return 12;
        },
        function () {
          throw Error('Must select true');
        }
      )(),
      12
    );
    assert.throws(function () {
      api.whenAsync(function () {
        return false;
      }, null);
    }, TypeError);
    assert.throws(function () {
      api.ifElseAsync(
        function () {
          return true;
        },
        function () {},
        null
      );
    }, TypeError);
    await rejects(
      api.whenAsync(
        function () {
          return Promise.reject(reason);
        },
        function () {}
      )(),
      reason
    );
    await rejects(
      api.ifElseAsync(
        function () {
          return false;
        },
        function () {},
        function () {
          throw reason;
        }
      )(),
      reason
    );
  });
  await check('async NOR and XOR preserve empty and exactly-one contracts', async function () {
    assert.strictEqual(await api.norAsync(null, undefined)(), false);
    assert.strictEqual(await api.xorAsync(null, undefined)(), false);
    assert.strictEqual(
      await api.norAsync(
        function () {
          return Promise.resolve(false);
        },
        function () {
          return 0;
        }
      )(),
      true
    );
    assert.strictEqual(
      await api.norAsync(
        function () {
          return Promise.resolve(true);
        },
        function () {
          throw Error('Must stop');
        }
      )(),
      false
    );
    assert.strictEqual(
      await api.xorAsync(
        function () {
          return Promise.resolve(true);
        },
        function () {
          return false;
        }
      )(),
      true
    );
    assert.strictEqual(
      await api.xorAsync(
        function () {
          return Promise.resolve(true);
        },
        function () {
          return true;
        },
        function () {
          throw Error('Must stop at second truthy result');
        }
      )(),
      false
    );
    for (var i = 0; i < 2; i++) {
      var name = i ? 'xorAsync' : 'norAsync';

      assert.throws(function () {
        api[name](function () {
          return true;
        }, 1);
      }, TypeError);
      var receiver = {},
        input = {},
        reason = {};

      await api[name](function (first, second) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(first, input);
        assert.strictEqual(second, undefined);
        assert.strictEqual(arguments.length, 2);

        return Promise.resolve(false);
      }).call(receiver, input, undefined);
      await rejects(
        api[name](
          function () {
            return Promise.reject(reason);
          },
          function () {
            throw Error('Must stop');
          }
        )(),
        reason
      );
    }
  });

  await check('pipe forwards receivers, arguments and ordered results', function () {
    var receiver = {},
      seen = [];
    var pipeline = api.pipe(
      null,
      function (a, b) {
        assert.strictEqual(this, receiver);
        seen.push(arguments.length);

        return a + b;
      },
      undefined,
      function (value) {
        assert.strictEqual(this, receiver);
        seen.push(arguments.length);

        return value * 2;
      }
    );

    assert.strictEqual(pipeline.call(receiver, 2, 3), 10);
    assert.deepStrictEqual(seen, [2, 1]);
    assert.strictEqual(api.pipe()(), undefined);
  });
  await check('pipeAsync awaits stages and stops at rejection', async function () {
    var receiver = {},
      order = [],
      reason = {};
    var pipeline = api.pipeAsync(
      function (a, b) {
        assert.strictEqual(this, receiver);

        return {
          then: function (resolve) {
            order.push('resolve');
            resolve(a + b);
          }
        };
      },
      null,
      function (value) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(arguments.length, 1);
        order.push('next');

        return value * 2;
      }
    );

    assert.strictEqual(await pipeline.call(receiver, 2, 3), 10);
    assert.deepStrictEqual(order, ['resolve', 'next']);
    await rejects(
      api.pipeAsync(
        function () {
          return Promise.reject(reason);
        },
        function () {
          throw Error('Unexpected stage');
        }
      )(),
      reason
    );
    assert.strictEqual(await api.pipeAsync()(), undefined);
  });
  await check('withDefaultArgs supplies positional defaults without changing call identity', function () {
    var receiver = {};
    var collect = api.withDefaultArgs(
      function () {
        assert.strictEqual(this, receiver);

        return Array.prototype.slice.call(arguments);
      },
      1,
      'info',
      undefined
    );

    assert.deepStrictEqual(collect.call(receiver), [1, 'info', undefined]);
    assert.deepStrictEqual(collect.call(receiver, undefined, '', null, false), [1, '', null, false]);
    var promise = Promise.resolve(7);
    var forward = api.withDefaultArgs(function (value) {
      return value;
    }, promise);

    assert.strictEqual(forward(), promise);
    assert.strictEqual(forward(null), null);
    assert.throws(function () {
      api.withDefaultArgs({});
    }, TypeError);
  });
  await check('argument caps and memoized call keys work on the installed runtime', function () {
    var owner = {};
    var capture = api.ary(function () {
      assert.strictEqual(this, owner);

      return Array.prototype.slice.call(arguments);
    }, 2);

    assert.deepStrictEqual(capture.call(owner, 'a', 'b', 'c'), ['a', 'b']);
    assert.deepStrictEqual(capture.call(owner), []);

    var cached = api.memoize(function (a, b) {
      return [this, a, b];
    });
    var result = cached.call(owner, 1, 2);

    assert.strictEqual(cached.call(owner, 1, 2), result);
    assert.notStrictEqual(cached.call(owner, 1, 3), result);
    assert.notStrictEqual(cached.call({}, 1, 2), result);
    assert.strictEqual(cached.clear(), undefined);
    assert.notStrictEqual(cached.call(owner, 1, 2), result);
  });
  await check('spread uses array-like inputs and caller receiver', function () {
    var receiver = {};
    var spread = api.spread(function () {
      assert.strictEqual(this, receiver);

      return Array.prototype.slice.call(arguments);
    });

    assert.deepStrictEqual(spread.call(receiver, { 0: 'a', 1: 'b', length: 2 }), ['a', 'b']);
    assert.deepStrictEqual(spread.call(receiver, null), []);
  });
  await check('partial adapters preserve argument order and receiver', function () {
    var receiver = {};

    function collect() {
      assert.strictEqual(this, receiver);

      return Array.prototype.slice.call(arguments);
    }

    assert.deepStrictEqual(api.partial(collect, 1, 2).call(receiver, 3), [1, 2, 3]);
    assert.deepStrictEqual(api.partialRight(collect, 2, 3).call(receiver, 1), [1, 2, 3]);
    assert.deepStrictEqual(api.partial(collect).call(receiver, 1, 2), [1, 2]);
    assert.deepStrictEqual(api.partialRight(collect).call(receiver), []);
    assert.deepStrictEqual(api.unary(collect).call(receiver, 1, 2), [1]);
    assert.deepStrictEqual(api.unary(collect).call(receiver), [undefined]);
  });
  await check('attempt preserves callback receiver, values and throws', function () {
    var reason = {};

    function callback(value) {
      assert.strictEqual(this, callback);

      return value;
    }

    assert.strictEqual(api.attempt(callback, reason), reason);
    assert.strictEqual(
      api.attempt(function () {
        throw reason;
      }),
      reason
    );
    assert.deepStrictEqual(api.attemptResult(callback, reason), { ok: true, value: reason });
    assert.deepStrictEqual(
      api.attemptResult(function () {
        throw reason;
      }),
      { ok: false, error: reason }
    );
  });
  await check('attemptResultAsync captures throws and thenable failures', async function () {
    var reason = {};

    function callback(value) {
      assert.strictEqual(this, callback);

      return Promise.resolve(value);
    }

    assert.deepStrictEqual(await api.attemptResultAsync(callback, reason), { ok: true, value: reason });
    assert.deepStrictEqual(
      await api.attemptResultAsync(function () {
        throw reason;
      }),
      { ok: false, error: reason }
    );
    assert.deepStrictEqual(
      await api.attemptResultAsync(function () {
        return Object.defineProperty({}, 'then', {
          get: function () {
            throw reason;
          }
        });
      }),
      { ok: false, error: reason }
    );
  });
  await check('repeat forwards arguments and preserves count validation', function () {
    var count = 0;

    function callback(value) {
      assert.strictEqual(this, callback);
      assert.strictEqual(arguments.length, 1);

      return value + count++;
    }

    assert.deepStrictEqual(api.repeat(callback, 3, 10), [10, 11, 12]);
    assert.deepStrictEqual(api.repeat(callback, null), []);
    assert.throws(function () {
      api.repeat(callback, 1.5);
    }, RangeError);
    assert.throws(function () {
      api.repeat(callback, '2');
    }, TypeError);
  });
  await check('repeatAsync serialises work and stops after failure', async function () {
    var active = false,
      count = 0,
      reason = {};

    async function callback(value) {
      assert.strictEqual(this, callback);
      assert.strictEqual(arguments.length, 1);
      assert.strictEqual(active, false);
      active = true;
      await Promise.resolve();
      active = false;

      return value + count++;
    }

    assert.deepStrictEqual(await api.repeatAsync(callback, 3, 10), [10, 11, 12]);
    count = 0;
    await rejects(
      api.repeatAsync(function () {
        count++;

        return Promise.reject(reason);
      }, 3),
      reason
    );
    assert.strictEqual(count, 1);
    await rejects(api.repeatAsync(callback, Infinity), RangeError);
  });
  await check('logical connectives preserve truthiness, receiver and short circuiting', function () {
    var receiver = {},
      seen = [];

    function yes(value) {
      assert.strictEqual(this, receiver);
      assert.strictEqual(value, 4);
      seen.push('yes');

      return 'yes';
    }

    function no(value) {
      assert.strictEqual(this, receiver);
      assert.strictEqual(value, 4);
      seen.push('no');

      return 0;
    }

    function unused() {
      throw Error('Unexpected predicate');
    }

    assert.strictEqual(api.and(null, yes, no, unused).call(receiver, 4), false);
    assert.strictEqual(api.or(no, yes, unused).call(receiver, 4), true);
    assert.strictEqual(api.nor(no, yes, unused).call(receiver, 4), false);
    assert.strictEqual(api.xor(yes, yes, unused).call(receiver, 4), false);
    assert.strictEqual(api.xor(yes, no).call(receiver, 4), true);
    assert.strictEqual(api.not(no).call(receiver, 4), true);
    assert.deepStrictEqual(seen, ['yes', 'no', 'no', 'yes', 'no', 'yes', 'yes', 'yes', 'yes', 'no', 'no']);
    assert.strictEqual(api.and()(), false);
    assert.strictEqual(api.or()(), false);
    assert.strictEqual(api.nor()(), false);
    assert.strictEqual(api.xor()(), false);
  });
  await check('tap and tapAsync retain identity and await only the async observer', async function () {
    var receiver = {},
      value = {},
      observed = false;
    var sync = api.tap(function (input) {
      assert.strictEqual(this, receiver);
      assert.strictEqual(arguments.length, 1);
      assert.strictEqual(input, value);

      return 'ignored';
    });

    assert.strictEqual(sync.call(receiver, value, 'ignored'), value);
    var asyncTap = api.tapAsync(async function (input) {
      assert.strictEqual(this, receiver);
      assert.strictEqual(input, value);
      await Promise.resolve();
      observed = true;
    });

    assert.strictEqual(await asyncTap.call(receiver, value), value);
    assert.strictEqual(observed, true);
  });
  await check('once caches exact values, thrown values and promises', function () {
    var receiver = {},
      value = {},
      calls = 0;
    var once = api.once(function (input) {
      calls++;
      assert.strictEqual(this, receiver);

      return input;
    });

    assert.strictEqual(once.call(receiver, value), value);
    assert.strictEqual(once('ignored'), value);
    assert.strictEqual(calls, 1);
    var reason = {},
      failedCalls = 0,
      failed = api.once(function () {
        failedCalls++;
        throw reason;
      });

    assert.throws(failed, function (error) {
      return error === reason;
    });
    assert.throws(failed, function (error) {
      return error === reason;
    });
    assert.strictEqual(failedCalls, 1);
    var promise = Promise.resolve(value),
      promised = api.once(function () {
        return promise;
      });

    assert.strictEqual(promised(), promise);
    assert.strictEqual(promised(), promise);
  });
  await check('when and ifElse choose one branch with the caller receiver', function () {
    var receiver = {},
      value = {},
      transformed = {};
    var when = api.when(
      function (input) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(arguments.length, 1);

        return input === value;
      },
      function (input) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(input, value);

        return transformed;
      }
    );

    assert.strictEqual(when.call(receiver, value, 2), transformed);
    assert.strictEqual(when.call(receiver, 0), 0);
    var conditional = api.ifElse(
      function (a, b) {
        assert.strictEqual(this, receiver);

        return a > b;
      },
      function (a, b) {
        assert.strictEqual(this, receiver);

        return a - b;
      },
      function (a, b) {
        assert.strictEqual(this, receiver);

        return b - a;
      }
    );

    assert.strictEqual(conditional.call(receiver, 5, 2), 3);
    assert.strictEqual(conditional.call(receiver, 2, 5), 3);
  });
  await check('callback validation rejects unsupported values', async function () {
    [
      'pipe',
      'spread',
      'attempt',
      'attemptResult',
      'repeat',
      'delay',
      'and',
      'or',
      'xor',
      'nor',
      'not',
      'pipeAsync',
      'tap',
      'tapAsync',
      'once',
      'partial',
      'partialRight',
      'unary',
      'when',
      'ifElse',
      'debounce',
      'throttle'
    ].forEach(function (name) {
      assert.throws(
        function () {
          api[name](42);
        },
        TypeError,
        name
      );
    });
    await rejects(api.attemptResultAsync(null), TypeError);
    await rejects(api.repeatAsync(null), TypeError);
    await rejects(api.sleep(-1), RangeError);
    await rejects(api.sleep('1'), TypeError);
  });
  await check('delay uses real asynchronous host timers and forwards callback arguments', async function () {
    var synchronous = true,
      handle,
      value = {};
    var waiting = new Promise(function (resolve, reject) {
      handle = api.delay(
        function (input, missing) {
          try {
            assert.strictEqual(synchronous, false);
            assert.strictEqual(this, handle);
            assert.strictEqual(input, value);
            assert.strictEqual(missing, undefined);
            assert.strictEqual(arguments.length, 2);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        0,
        value,
        undefined
      );
    });

    assert.strictEqual(typeof handle.ref, 'function');
    synchronous = false;
    await waiting;
  });
  await check('sleep resolves on a real later turn', async function () {
    var done = false;
    var waiting = api.sleep(0).then(function (value) {
      assert.strictEqual(value, undefined);
      done = true;
    });

    assert.strictEqual(done, false);
    await Promise.resolve();
    assert.strictEqual(done, false);
    await waiting;
    assert.strictEqual(done, true);
  });
  for (var name of ['debounce', 'throttle']) {
    await check(name + ' trailing scheduling, flush and cancellation', async function () {
      await withClock(function (clock) {
        var receiver = {},
          seen = [];
        var scheduled = api[name](
          function (value) {
            assert.strictEqual(this, receiver);
            seen.push([clock.now(), value]);

            return value;
          },
          10,
          { leading: false }
        );

        scheduled.call(receiver, 'first');
        clock.tick(2);
        scheduled.call(receiver, 'last');
        assert.strictEqual(scheduled.pending(), true);
        clock.tick(10);
        assert.deepStrictEqual(seen, [[name === 'debounce' ? 1012 : 1010, 'last']]);
        assert.strictEqual(scheduled.pending(), false);
        scheduled.call(receiver, 'flush');
        assert.strictEqual(scheduled.flush(), 'flush');
        assert.strictEqual(scheduled.pending(), false);
        scheduled.call(receiver, 'cancelled');
        scheduled.cancel();
        clock.tick(100);
        assert.strictEqual(seen.length, 2);
        assert.strictEqual(clock.jobs.size, 0);
      });
    });
  }

  for (var schedulerName of ['debounce', 'throttle']) {
    for (var clockCase of ['failure', 'expiry reentry', 'flush reentry']) {
      await check(schedulerName + ' clock ' + clockCase, async function () {
        await withClock(function (clock) {
          var hook,
            scheduled,
            reason = {},
            receiver = {},
            cached = {},
            replacement = {},
            seen = [];

          Object.defineProperty(global, 'performance', {
            configurable: true,
            value: {
              now: function () {
                if (hook) {
                  var run = hook;

                  hook = undefined;
                  run();
                }

                return clock.now();
              }
            }
          });
          scheduled = api[schedulerName](
            function (value) {
              assert.strictEqual(this, receiver);
              seen.push(value);

              return value;
            },
            10,
            { leading: false }
          );
          scheduled.call(receiver, cached);
          assert.strictEqual(scheduled.flush(), cached);
          scheduled.call(receiver, 'discarded');
          hook = function () {
            if (clockCase === 'failure') throw reason;
            scheduled.cancel();
            scheduled.call(receiver, replacement);
          };

          if (clockCase === 'failure')
            assert.throws(
              function () {
                clock.tick(10);
              },
              function (error) {
                return error === reason;
              }
            );
          else if (clockCase === 'flush reentry') assert.strictEqual(scheduled.flush(), cached);
          else clock.tick(10);
          assert.deepStrictEqual(seen, [cached]);
          assert.strictEqual(scheduled.pending(), clockCase !== 'failure');
          assert.strictEqual(clock.jobs.size, clockCase === 'failure' ? 0 : 1);
          if (clockCase === 'failure') {
            assert.strictEqual(scheduled.flush(), cached);
            scheduled.call(receiver, replacement);
          }

          clock.tick(10);
          assert.deepStrictEqual(seen, [cached, replacement]);
          assert.strictEqual(scheduled.pending(), false);
          assert.strictEqual(clock.jobs.size, 0);
        });
      });
    }
  }

  await check('debounce maxWait bounds postponement', async function () {
    await withClock(function (clock) {
      var seen = [],
        scheduled = api.debounce(
          function () {
            seen.push(clock.now());
          },
          10,
          { maxWait: 25 }
        );

      scheduled();
      for (var i = 0; i < 4; i++) {
        clock.tick(5);
        scheduled();
      }

      clock.tick(5);
      assert.deepStrictEqual(seen, [1025]);
      scheduled.cancel();
    });
  });
  await check('throttle leading calls do not duplicate a trailing invocation', async function () {
    await withClock(function (clock) {
      var calls = 0,
        scheduled = api.throttle(function () {
          return ++calls;
        }, 10);

      assert.strictEqual(scheduled(), 1);
      assert.strictEqual(scheduled.pending(), false);
      clock.tick(10);
      assert.strictEqual(calls, 1);
      assert.strictEqual(clock.jobs.size, 0);
    });
  });
  await check('sleep honours structural signals and releases timer and listener', async function () {
    await withClock(async function (clock) {
      var controller = signalController(),
        reason = {},
        waiting = api.sleep(10, { signal: controller.signal });

      assert.strictEqual(clock.jobs.size, 1);
      assert.strictEqual(controller.listeners(), 1);
      controller.dispatch();
      assert.strictEqual(clock.jobs.size, 1);
      controller.abort(reason);
      await rejects(waiting, reason);
      assert.strictEqual(clock.jobs.size, 0);
      assert.strictEqual(controller.listeners(), 0);
      await rejects(api.sleep(10, { signal: controller.signal }), reason);
      assert.strictEqual(clock.jobs.size, 0);
      controller = signalController();
      waiting = api.sleep(10, { signal: controller.signal });
      clock.tick(10);
      assert.strictEqual(await waiting, undefined);
      assert.strictEqual(clock.jobs.size, 0);
      assert.strictEqual(controller.listeners(), 0);
    });
  });
  if (format === 'commonjs')
    await check('public source subpaths resolve with and without .js', function () {
      expected.forEach(function (name) {
        var relative =
          'src/' +
          (['and', 'andAsync', 'or', 'orAsync', 'xor', 'xorAsync', 'nor', 'norAsync', 'not', 'notAsync'].indexOf(
            name
          ) >= 0
            ? 'logic/'
            : '') +
          name;

        assert.strictEqual(load(relative), api[name], relative);
        assert.strictEqual(load(relative + '.js'), api[name], relative + '.js');
      });
    });
  var result = { format: format, apis: expected.length, checks: checks };

  results.push(result);
  console.log(JSON.stringify(result));
}

async function main() {
  await exercise(load(), 'commonjs');
  await exercise(load('dist/go-fns.js'), 'readable bundle');
  await exercise(load('dist/go-fns.min.js'), 'minified bundle');
  console.log(
    JSON.stringify({
      node: process.version,
      formats: results.length,
      checks: results.reduce(function (sum, result) {
        return sum + result.checks;
      }, 0),
      status: 'passed'
    })
  );
}

main().catch(function (error) {
  console.error((error && error.stack) || error);
  process.exitCode = 1;
});
