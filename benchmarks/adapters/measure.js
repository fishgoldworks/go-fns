'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.runReviewAdapterBenchmark = factory();
})(globalThis, function () {
  const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  return function measure(original, candidate) {
    let sink = 0;
    const output = [];
    for (const name of ['partial', 'partialRight'])
      for (const [fixed, count] of [
        [0, 3],
        [2, 0],
        [1, 2],
        [2, 3],
        [3, 8],
        [8, 16],
        [16, 32]
      ]) {
        const saved = Array.from({ length: fixed }, (_, i) => i + 10);
        function callback() {
          let n = 0;
          for (let i = 0; i < arguments.length; i++) n += arguments[i];
          return n;
        }
        const callbacks = [original[name](callback, ...saved), candidate[name](callback, ...saved)];
        const operations = callbacks.map((fn) => {
          // Independent call site for each implementation; callback work is identical.
          const args = Array.from({ length: count }, (_, i) => (i === 0 ? '(i&255)' : String(i + 1))).join(',');
          const run = new Function('fn', 'n', `let s=0;for(let i=0;i<n;i++)s=(s+fn(${args}))|0;return s`);
          return (n) => run(fn, n);
        });
        if (operations[0](1024) !== operations[1](1024)) throw Error('Result mismatch');
        const iterations = [];
        for (let j = 0; j < 2; j++) {
          let start = performance.now();
          do {
            sink ^= operations[j](32768);
          } while (performance.now() - start < 40);
          let n = 16384;
          for (;;) {
            start = performance.now();
            sink ^= operations[j](n);
            if (performance.now() - start >= 8 || n >= 8388608) break;
            n *= 2;
          }
          iterations[j] = n;
        }
        const timings = [[], []];
        for (let round = 0; round < 11; round++)
          for (const j of round % 2 ? [1, 0] : [0, 1]) {
            const start = performance.now();
            sink ^= operations[j](iterations[j]);
            timings[j].push(((performance.now() - start) * 1e6) / iterations[j]);
          }
        output.push({
          name,
          fixed,
          input: count,
          originalMedianNs: median(timings[0]),
          candidateMedianNs: median(timings[1]),
          speedup: median(timings[0]) / median(timings[1]),
          iterations,
          timings
        });
      }

    function additional(label, name, operations) {
      const timings = [[], []],
        iterations = [];
      if (operations[0](4096) !== operations[1](4096)) throw Error('Result mismatch: ' + label);
      for (let j = 0; j < 2; j++) {
        let start = performance.now();
        do {
          sink ^= operations[j](16384);
        } while (performance.now() - start < 40);
        let n = 8192;
        for (;;) {
          start = performance.now();
          sink ^= operations[j](n);
          if (performance.now() - start >= 8 || n >= 4194304) break;
          n *= 2;
        }
        iterations[j] = n;
      }
      for (let round = 0; round < 11; round++)
        for (const j of round % 2 ? [1, 0] : [0, 1]) {
          const start = performance.now();
          sink ^= operations[j](iterations[j]);
          timings[j].push(((performance.now() - start) * 1e6) / iterations[j]);
        }
      output.push({
        name,
        workload: label,
        originalMedianNs: median(timings[0]),
        candidateMedianNs: median(timings[1]),
        speedup: median(timings[0]) / median(timings[1]),
        iterations,
        timings
      });
    }
    for (const name of ['partial', 'partialRight']) {
      for (const count of [0, 2, 8, 32]) {
        const saved = Array.from({ length: count }, (_, i) => i);
        function callback() {
          return arguments.length;
        }
        const operations = [original, candidate].map((api) => {
          const make = api[name];
          return (n) => {
            const escaped = new Array(256);
            for (let i = 0; i < n; i++) escaped[i & 255] = make(callback, ...saved);
            let sum = 0;
            for (const fn of escaped) sum += fn(1);
            return sum;
          };
        });
        additional('construct-retain-' + count, name, operations);
      }
      const record = { weight: 2 },
        token = {},
        label = 'listing';
      const callback =
        name === 'partial'
          ? function (record, label, value, n) {
              return record.weight + label.length + (value === token ? 1 : 0) + n;
            }
          : function (value, n, record, label) {
              return record.weight + label.length + (value === token ? 1 : 0) + n;
            };
      const operations = [original, candidate].map((api) => {
        const fn = api[name](callback, record, label);
        const run = new Function(
          'fn',
          'token',
          'n',
          'let sum=0;for(let i=0;i<n;i++)sum=(sum+fn(token,i&255))|0;return sum'
        );
        return (n) => run(fn, token, n);
      });
      additional('record-and-string', name, operations);
    }
    return { samples: 11, warmupMs: 40, targetMs: 8, sink, cases: output };
  };
});
