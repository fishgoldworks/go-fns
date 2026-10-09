'use strict';
// Shared deterministic workloads for Node and Chromium. This is benchmark code,
// not a runtime dependency. Results are consumed rather than timing empty calls.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GoFnsBench = factory();
})(globalThis, function () {
  const specs = [];
  for (const length of [0, 1, 2, 4, 16])
    specs.push({ name: `pipe/integer/${length}`, type: 'pipe', length, mixed: false });
  for (const length of [2, 4, 16, 64])
    specs.push({ name: `pipe/mixed-numeric/${length}`, type: 'pipe', length, mixed: true });
  for (const length of [0, 1, 2, 8])
    specs.push({ name: `construct/pipe/${length}`, type: 'construct', helper: 'pipe', length });
  for (const helper of ['and', 'or', 'nor', 'xor']) {
    for (const length of [1, 2, 8]) specs.push({ name: `${helper}/full/${length}`, type: 'logic', helper, length });
    specs.push({ name: `${helper}/short-circuit/8`, type: 'logic', helper, length: 8, early: true });
    specs.push({ name: `construct/${helper}/2`, type: 'construct', helper, length: 2 });
  }
  specs.push({ name: 'construct/and/nullish', type: 'construct', helper: 'and', length: 8, nullish: true });
  for (const count of [0, 1, 3, 8]) specs.push({ name: `attempt/${count}-args`, type: 'attempt', count });
  specs.push({ name: 'attempt/caught-value', type: 'attempt', throwing: true });
  for (const length of [0, 1, 10, 1000]) {
    for (const count of [0, 3, 8])
      specs.push({ name: `repeat/${length}-times/${count}-args`, type: 'repeat', length, count });
  }
  specs.push({ name: 'spread/3-args', type: 'spread' });
  specs.push({ name: 'not/predicate', type: 'not' });
  specs.push({ name: 'application/filter-records', type: 'records' });
  specs.push({ name: 'application/transform-record', type: 'record-pipe' });

  function create(api, spec) {
    const add = (value) => value + 1;
    const sum = (a = 1, b = 2, c = 3) => a + b + c;
    if (spec.type === 'pipe') {
      const callbacks = spec.mixed ? [(x) => x + 1, (x) => x * 2, (x) => x - 1, (x) => x * 0.5] : [add];
      const fn = api.pipe(...Array.from({ length: spec.length }, (_, i) => callbacks[i % callbacks.length]));
      return (i) => fn(i) || 0;
    }
    if (spec.type === 'construct') {
      const callbacks = Array.from({ length: spec.length }, (_, i) =>
        spec.nullish && i % 2 ? (i % 3 ? null : undefined) : add
      );
      const retained = new Array(64);
      globalThis.__goFnsBenchmarkRetained = retained; // Force construction results to escape.
      return (i) => {
        const fn = api[spec.helper](...callbacks);
        retained[i & 63] = fn;
        return fn.length + retained[i & 63].length;
      };
    }
    if (spec.type === 'logic') {
      const callbacks = Array.from({ length: spec.length }, (_, index) => {
        // Full cases vary their outcome with input, and reach the final predicate.
        if (spec.helper === 'and')
          return spec.early && index === 0
            ? (x) => x < 0
            : index === spec.length - 1
              ? (x) => (x & 1) === 0
              : (x) => x >= 0;
        if (spec.helper === 'or' || spec.helper === 'nor')
          return spec.early && index === 0
            ? (x) => x >= 0
            : index === spec.length - 1
              ? (x) => (x & 1) === 0
              : (x) => x < 0;
        return spec.early && index < 2
          ? (x) => x >= 0
          : index === spec.length - 1
            ? (x) => (x & 1) === 0
            : (x) => x < 0;
      });
      const fn = api[spec.helper](...callbacks);
      return (i) => (fn(i) ? 1 : 0);
    }
    if (spec.type === 'attempt') {
      if (spec.throwing) {
        const fail = (value) => {
          throw value;
        };
        return (i) => api.attempt(fail, i);
      }
      if (spec.count === 0) return (i) => api.attempt(sum);
      if (spec.count === 1) return (i) => api.attempt(sum, i);
      if (spec.count === 3) return (i) => api.attempt(sum, i, 2, 3);
      return (i) => api.attempt(sum, i, 2, 3, 4, 5, 6, 7, 8);
    }
    if (spec.type === 'repeat') {
      function consume(results) {
        return results.length ? results.length + results[0] + results[results.length - 1] : 0;
      }
      if (spec.count === 0) return (i) => consume(api.repeat(sum, spec.length));
      if (spec.count === 3) return (i) => consume(api.repeat(sum, spec.length, i, 2, 3));
      return (i) => consume(api.repeat(sum, spec.length, i, 2, 3, 4, 5, 6, 7, 8));
    }
    if (spec.type === 'spread') {
      const fn = api.spread(sum),
        args = [0, 2, 3];
      return (i) => {
        args[0] = i;
        return fn(args);
      };
    }
    if (spec.type === 'not') {
      const fn = api.not((value) => (value & 1) === 0);
      return (i) => (fn(i) ? 1 : 0);
    }
    if (spec.type === 'records') {
      const records = Array.from({ length: 128 }, (_, i) => ({ active: i % 3 !== 0, score: i, owner: i % 5 }));
      const fn = api.and(
        (row) => row.active,
        (row) => row.score >= 32,
        (row) => row.owner !== 1
      );
      return (i) => {
        const matches = records.filter(fn);
        return matches.length + matches[i % matches.length].score;
      };
    }
    if (spec.type === 'record-pipe') {
      const records = Array.from({ length: 256 }, (_, i) => ({ amount: i * 1.25, units: (i % 8) + 1 }));
      const fn = api.pipe(
        (row) => row.amount * row.units,
        (value) => value * 1.15,
        Math.round,
        (value) => value / 100
      );
      return (i) => Math.round(fn(records[i & 255]) * 100);
    }
    throw new Error('Unknown benchmark: ' + spec.name);
  }
  function median(samples) {
    const ordered = samples.slice().sort((a, b) => a - b);
    const midpoint = ordered.length >> 1;
    return ordered.length % 2 ? ordered[midpoint] : (ordered[midpoint - 1] + ordered[midpoint]) / 2;
  }
  function measure(api, options = {}) {
    const samples = options.samples || 9;
    const targetMs = options.targetMs || 12;
    const warmupMs = options.warmupMs || 30;
    const now = () => performance.now();
    const output = [];
    let sink = 0;
    for (const spec of specs.filter((value) => !options.filter || value.name.includes(options.filter))) {
      const operation = create(api, spec);
      function run(iterations) {
        let checksum = 0;
        for (let i = 0; i < iterations; i++) checksum = (checksum + operation(i & 255)) | 0;
        return checksum;
      }
      const probe = run(1024);
      let iterations = 1024;
      const warmupStart = now();
      do {
        sink ^= run(iterations);
      } while (now() - warmupStart < warmupMs);
      for (;;) {
        const start = now();
        sink ^= run(iterations);
        const elapsed = now() - start;
        if (elapsed >= targetMs || iterations >= 8388608) break;
        iterations *= 2;
      }
      const nsPerOperation = [];
      for (let sample = 0; sample < samples; sample++) {
        const start = now();
        sink ^= run(iterations);
        nsPerOperation.push(((now() - start) * 1e6) / iterations);
      }
      if (run(1024) !== probe) throw Error('Non-deterministic workload: ' + spec.name);
      output.push({ name: spec.name, iterations, probe, medianNs: median(nsPerOperation), nsPerOperation });
    }
    return { cases: output, sink };
  }
  return { specs, create, measure, median };
});
