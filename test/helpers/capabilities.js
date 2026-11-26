'use strict';

// Fresh VM realms remove capabilities before any production module is evaluated.
// Keep this harness executable on the actual Node.js 8.0.0 consumer runtime.
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var scenarios = [
  { name: 'present' },
  { name: 'no performance', remove: ['performance'] },
  { name: 'undefined performance', clock: 'undefined' },
  { name: 'null performance', clock: 'null' },
  { name: 'no performance.now', clock: 'missing' },
  { name: 'non-callable performance.now', clock: 'non-callable' },
  { name: 'no Performance constructor', remove: ['Performance'] },
  { name: 'no AbortController', remove: ['AbortController'] },
  { name: 'no AbortSignal', remove: ['AbortSignal'] },
  { name: 'no abort constructors', remove: ['AbortController', 'AbortSignal'] },
  { name: 'no globalThis', remove: ['globalThis'] },
  { name: 'no self', remove: ['self'] },
  { name: 'no global', remove: ['global'] },
  { name: 'no window', remove: ['window'] },
  { name: 'only globalThis', alias: 'globalThis' },
  { name: 'only self', alias: 'self' },
  { name: 'only global', alias: 'global' },
  { name: 'only window', alias: 'window' },
  {
    name: 'window and Date fallback without abort constructors',
    alias: 'window',
    remove: ['performance', 'AbortController', 'AbortSignal']
  },
  {
    name: 'worker and missing clock method without abort constructors',
    alias: 'self',
    clock: 'missing',
    remove: ['AbortController', 'AbortSignal']
  },
  { name: 'no setTimeout', remove: ['setTimeout'] },
  { name: 'no clearTimeout', remove: ['clearTimeout'] },
  {
    name: 'no timers or optional clock/cancellation',
    remove: ['setTimeout', 'clearTimeout', 'performance', 'AbortController', 'AbortSignal']
  }
];
var modes = ['commonjs', 'global', 'worker-global', 'amd', 'exports-only'];

function prepare(scenario) {
  var context = vm.createContext({ assert: assert, scenario: scenario });

  vm.runInContext(
    `
    var host = this;
    var importing = true;
    var fixture = { host: host, jobs: [], clockReads: 0, dateReads: 0, performanceReads: 0 };
    ['globalThis', 'self', 'global', 'window'].forEach(function (name) { host[name] = host; });
    host.Performance = function Performance() {};
    host.AbortController = function AbortController() { throw Error('Native controller should not be constructed'); };
    host.AbortSignal = function AbortSignal() { throw Error('Native signal should not be constructed'); };
    var clock = { now: function () {
      assert.strictEqual(this, clock, 'Clock receiver'); fixture.performanceReads++; return 1000;
    }};
    Object.defineProperty(host, 'performance', { configurable: true, get: function () {
      assert.strictEqual(importing, false, 'Import read performance'); fixture.clockReads++;
      return clock;
    }});
    Date.now = function () { fixture.dateReads++; return 1000; };
    host.setTimeout = function (fn, duration) {
      assert.strictEqual(importing, false, 'Import called setTimeout');
      var job = { fn: fn, args: Array.prototype.slice.call(arguments, 2), duration: duration };
      fixture.jobs.push(job);
      fixture.timerReceiver = this;
      return job;
    };
    host.clearTimeout = function (job) {
      var index = fixture.jobs.indexOf(job);
      if (index !== -1) fixture.jobs.splice(index, 1);
    };
    fixture.fire = function () {
      var job = fixture.jobs.shift();
      assert.ok(job, 'Expected a scheduled timer');
      return Reflect.apply(job.fn, host, job.args);
    };
    if (scenario.clock === 'undefined') clock = undefined;
    if (scenario.clock === 'null') clock = null;
    if (scenario.clock === 'missing') delete clock.now;
    if (scenario.clock === 'non-callable') clock.now = 1;
    if (scenario.alias) ['globalThis', 'self', 'global', 'window'].forEach(function (name) {
      if (name !== scenario.alias) delete host[name];
    });
    (scenario.remove || []).forEach(function (name) { delete host[name]; assert.strictEqual(typeof host[name], 'undefined'); });
  `,
    context
  );

  return context;
}

function loader(context) {
  var cache = Object.create(null);

  return function load(filename) {
    filename = require.resolve(filename);

    if (cache[filename]) {
      return cache[filename].exports;
    }

    var module = { exports: {} };

    cache[filename] = module;
    var evaluate = vm.runInContext(
      '(function(require, module, exports) {\n' + fs.readFileSync(filename, 'utf8') + '\n})',
      context,
      { filename: 'capability-realm:' + filename, timeout: 1000 }
    );

    evaluate(
      function (relative) {
        assert.strictEqual(relative[0], '.', 'Production dependency must be local');

        return load(path.resolve(path.dirname(filename), relative));
      },
      module,
      module.exports
    );

    return module.exports;
  };
}

function loadBundle(context, filename, mode) {
  if (mode === 'amd') {
    context.define = function (dependencies, factory) {
      assert.strictEqual(dependencies.length, 0);
      context.loaded = factory();
    };

    context.define.amd = true;
  } else if (mode === 'commonjs') {
    context.module = { exports: {} };
    context.exports = context.module.exports;
  } else if (mode === 'exports-only') context.exports = {};
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename: filename, timeout: 1000 });

  return (
    context.loaded ||
    (context.module && context.module.exports) ||
    (context.exports && context.exports.Functions) ||
    context.Functions
  );
}

async function rejects(promise, check) {
  var failed = false;

  try {
    await promise;
  } catch (error) {
    failed = true;
    check(error);
  }

  assert.strictEqual(failed, true, 'Expected a rejection');
}

function signalFixture() {
  var listener;

  return {
    aborted: false,
    reason: { cancelled: true },
    listeners: 0,
    addEventListener: function (type, fn) {
      assert.strictEqual(type, 'abort');
      listener = fn;
      this.listeners++;
    },
    removeEventListener: function (type, fn) {
      assert.strictEqual(type, 'abort');
      assert.strictEqual(fn, listener);
      this.listeners--;
    },
    abort: function () {
      this.aborted = true;
      listener();
    }
  };
}

async function exercise(api, fixture, scenario) {
  var value = {},
    receiver = {},
    thrown = {};

  assert.strictEqual(
    api
      .pipe(function (a, b) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(a, value);
        assert.strictEqual(b, 7);

        return a;
      })
      .call(receiver, value, 7),
    value
  );
  assert.strictEqual(
    api.when(
      function () {
        return false;
      },
      function () {
        throw Error('Skipped callback ran');
      }
    )(value),
    value
  );
  assert.strictEqual(
    await api.whenAsync(
      function () {
        return false;
      },
      function () {
        throw Error('Skipped async callback ran');
      }
    )(value),
    value
  );
  assert.strictEqual(
    api.tap(function (input) {
      assert.strictEqual(input, value);
    })(value),
    value
  );
  assert.strictEqual(
    api.attemptResult(function () {
      throw thrown;
    }).error,
    thrown
  );
  assert.strictEqual(
    (
      await api.attemptResultAsync(function () {
        throw thrown;
      })
    ).error,
    thrown
  );
  assert.strictEqual(
    api.not(function () {
      return false;
    })(),
    true
  );
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
        return 1;
      },
      function (input) {
        return input;
      }
    ),
    value
  );
  assert.strictEqual(api.result(value), value);
  assert.strictEqual(
    api.result(function (input) {
      return input;
    }, value),
    value
  );
  assert.strictEqual(Object.prototype.hasOwnProperty.call(api.when, 'async'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(api.pipe, 'async'), false);
  var once = api.once(function () {
    return value;
  });

  assert.strictEqual(once(), value);
  assert.strictEqual(once(), value);
  // Signal methods are required only on the supplied object, independently of constructors.
  for (var method of ['addEventListener', 'removeEventListener']) {
    var invalid = signalFixture();

    delete invalid[method];
    await rejects(api.sleep(5, { signal: invalid }), function (error) {
      assert.strictEqual(error.name, 'TypeError');
      assert.ok(/AbortSignal-compatible/.test(error.message));
    });
    assert.strictEqual(fixture.jobs.length, 0);
  }

  var aborted = signalFixture();

  aborted.aborted = true;
  await rejects(api.sleep(5, { signal: aborted }), function (error) {
    assert.strictEqual(error, aborted.reason);
  });
  assert.strictEqual(fixture.jobs.length, 0);
  var missing = scenario.remove || [];

  if (missing.indexOf('setTimeout') !== -1) {
    assert.throws(function () {
      api.delay(function () {});
    }, /setTimeout/);
    await rejects(api.sleep(5), function (error) {
      assert.ok(/setTimeout/.test(error.message));
    });
    for (var name of ['debounce', 'throttle']) {
      var unsupported = api[name](function () {
        throw Error('Unsupported timer invoked callback');
      }, 5);

      assert.throws(function () {
        unsupported();
      }, /setTimeout/);
      assert.strictEqual(unsupported.pending(), false);
    }

    return;
  }

  var called = 0;
  var timer = api.delay(
    function (a) {
      called++;
      assert.strictEqual(this, fixture.host);
      assert.strictEqual(a, value);
    },
    5,
    value
  );

  assert.strictEqual(timer, fixture.jobs[0]);
  assert.strictEqual(fixture.timerReceiver, fixture.host);
  assert.strictEqual(called, 0);
  fixture.fire();
  assert.strictEqual(called, 1);
  var pause = api.sleep(5);

  assert.strictEqual(fixture.timerReceiver, fixture.host);
  fixture.fire();
  if (missing.indexOf('clearTimeout') !== -1) {
    await rejects(pause, function (error) {
      assert.ok(/clearTimeout/.test(error.message));
    });
    for (var factory of ['debounce', 'throttle']) {
      var pending = api[factory](
        function () {
          throw Error('Failed flush invoked callback');
        },
        5,
        { leading: false }
      );

      pending();
      assert.throws(function () {
        pending.flush();
      }, /clearTimeout/);
      assert.strictEqual(pending.pending(), false);
      fixture.fire();
    }

    return;
  }

  assert.strictEqual(await pause, undefined);
  var signal = signalFixture();
  var cancelled = api.sleep(5, { signal: signal });

  assert.strictEqual(signal.listeners, 1);
  signal.abort();
  await rejects(cancelled, function (error) {
    assert.strictEqual(error, signal.reason);
  });
  assert.strictEqual(signal.listeners, 0);
  assert.strictEqual(fixture.jobs.length, 0);
  var completedSignal = signalFixture();
  var completed = api.sleep(5, { signal: completedSignal });

  fixture.fire();
  assert.strictEqual(await completed, undefined);
  assert.strictEqual(completedSignal.listeners, 0);
  for (var scheduler of ['debounce', 'throttle']) {
    var calls = 0;
    var scheduled = api[scheduler](
      function (a, b) {
        calls++;
        assert.strictEqual(this, receiver);
        assert.strictEqual(a, value);
        assert.strictEqual(b, 7);

        return a;
      },
      5,
      { leading: false }
    );

    scheduled.call(receiver, value, 7);
    assert.strictEqual(calls, 0);
    assert.strictEqual(scheduled.pending(), true);
    assert.strictEqual(scheduled.flush(), value);
    assert.strictEqual(calls, 1);
    assert.strictEqual(scheduled.pending(), false);
    assert.strictEqual(fixture.jobs.length, 0);
    scheduled(value, 7);
    scheduled.cancel();
    assert.strictEqual(calls, 1);
    assert.strictEqual(scheduled.pending(), false);
    assert.strictEqual(fixture.jobs.length, 0);
  }

  if (scenario.clock || missing.indexOf('performance') !== -1) {
    assert.ok(fixture.dateReads > 0, 'Date.now fallback was not used');
    assert.strictEqual(fixture.performanceReads, 0);
  } else {
    assert.ok(fixture.performanceReads > 0, 'Available performance.now was not used');
    assert.strictEqual(fixture.dateReads, 0);
  }
}

async function run(entry, resolveFocused) {
  entry = require.resolve(entry);
  var bundled = /go-fns(?:\.min)?\.js$/.test(entry);
  var imports = bundled ? modes : resolveFocused ? ['root', 'focused', 'functions'] : ['root', 'focused'];
  var mappings = [];

  if (!bundled) {
    var pattern = /module\.exports\.(\w+) = require\('([^']+)'\)/g;
    var source = fs.readFileSync(entry, 'utf8');
    var match;

    while ((match = pattern.exec(source))) mappings.push(match);
  }

  var cases = 0;

  for (var scenario of scenarios) {
    for (var mode of imports) {
      var context = prepare(scenario);

      try {
        var api;

        if (bundled) api = loadBundle(context, entry, mode);
        else {
          var load = loader(context);

          if (mode === 'root') api = load(entry);
          else {
            api = {};
            for (var mapping of mappings)
              api[mapping[1]] = load(
                resolveFocused
                  ? resolveFocused(mode === 'functions' ? './' + mapping[1] : mapping[2])
                  : path.resolve(path.dirname(entry), mapping[2])
              );
          }
        }

        assert.strictEqual(Object.keys(api).length, 37, 'Incomplete API import');
        assert.strictEqual(context.fixture.clockReads, 0, 'Import read optional clock');
        context.importing = false;
        await exercise(api, context.fixture, scenario);
        cases++;
      } catch (error) {
        error.message = path.basename(entry) + ' / ' + mode + ' / ' + scenario.name + ': ' + error.message;
        throw error;
      }
    }
  }

  return { cases: cases, scenarios: scenarios.length, imports: imports };
}

module.exports = run;
