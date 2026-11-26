# Historical performance

This record preserves measurements from the labelled unreleased development snapshots. For current commands and output handling, see the [benchmark and evidence guidance](../CONTRIBUTING.md#benchmarks-and-historical-evidence).

## Historical 2.2.2 declaration patch context

In the unreleased 2.2.2 development snapshot, all 31 production JavaScript modules
(index.js plus src modules) were byte-for-byte unchanged from 2.2.1. That snapshot
changed declarations, verification and documentation; it claimed no additional
runtime speedup. The measurements below retain their original 2.2.1-versus-2.2.0
labels. They do not measure the later Node 8 compatibility changes consolidated
into the 2.0.0 release candidate.

## Historical 2.2.1 measurements

### Partial-application changes

[`partial`](API.md#partialfn-args) and [`partialRight`](API.md#partialrightfn-args) now use direct argument forwarding when no arguments
are saved, direct intrinsic invocation when none are supplied, and one combined
array otherwise. There is no shared mutable invocation scratch buffer. Reflect.apply
still supplies each proxy invocation with its own arguments array. Construction
continues to validate the callback and return a fresh wrapper.

### Measured comparison with 2.2.0

Measured locally on 2026-09-19 (New Zealand), Linux x64, Node.js 22.16.0 and Chromium
144.0.7559.96. The baseline source files and browser bundle are unchanged copies;
`benchmarks/baseline-2.2.0/manifest.json` records their hashes and original archive hash.

There are 24 workloads: 14 numeric invocation cases, 8 construct-and-retain cases,
and 2 record/string identity cases. Each run uses 40 ms warmup per implementation,
calibrated batches targeting at least 8 ms, 11 measured samples, alternating order,
and result checksums. Two fresh runs per runtime are retained. Construction results
escape into a table of 256 wrappers, then are consumed. This is not an allocation
profiler and does not measure all possible engine/JIT decisions.

The ranges below are the two per-run median speedup ratios (baseline / updated),
not confidence intervals. Below 1.00x is slower. Both engines use V8. Cheap callback
work magnifies relative wrapper improvements; expensive application work dilutes
them. Construction is broadly unchanged and sometimes slightly slower. Do not
interpret the table as an application-wide improvement or Firefox/Safari result.

| Workload | Node range | Chromium range |
| --- | ---: | ---: |
| `partial/0-saved/3-supplied` | 5.65–5.81x | 3.06–3.24x |
| `partial/2-saved/0-supplied` | 9.86–9.93x | 7.42–7.72x |
| `partial/1-saved/2-supplied` | 5.55–5.88x | 4.73–4.77x |
| `partial/2-saved/3-supplied` | 4.32–4.39x | 4.14–4.17x |
| `partial/3-saved/8-supplied` | 3.05–3.09x | 3.19–3.28x |
| `partial/8-saved/16-supplied` | 2.02–2.05x | 2.29–2.33x |
| `partial/16-saved/32-supplied` | 1.44–1.48x | 1.69–1.74x |
| `partialRight/0-saved/3-supplied` | 11.44–13.14x | 9.65–10.29x |
| `partialRight/2-saved/0-supplied` | 2.30–2.32x | 2.09–2.20x |
| `partialRight/1-saved/2-supplied` | 4.84–5.01x | 4.72–4.87x |
| `partialRight/2-saved/3-supplied` | 4.48–4.57x | 4.31–4.36x |
| `partialRight/3-saved/8-supplied` | 3.31–3.40x | 3.27–3.38x |
| `partialRight/8-saved/16-supplied` | 2.25–2.27x | 2.36–2.47x |
| `partialRight/16-saved/32-supplied` | 1.65–1.66x | 1.78–1.81x |
| `partial/construct-retain-0` | 0.81–0.96x | 1.03–1.12x |
| `partial/construct-retain-2` | 1.00–1.02x | 1.19–1.21x |
| `partial/construct-retain-8` | 0.98–1.04x | 1.01–1.02x |
| `partial/construct-retain-32` | 0.98–0.98x | 0.91–1.01x |
| `partial/record-and-string` | 5.53–5.93x | 4.42–4.62x |
| `partialRight/construct-retain-0` | 1.00–1.02x | 1.03–1.15x |
| `partialRight/construct-retain-2` | 0.87–1.03x | 0.88–1.00x |
| `partialRight/construct-retain-8` | 0.99–1.13x | 1.02–1.05x |
| `partialRight/construct-retain-32` | 0.99–1.02x | 1.00–1.04x |
| `partialRight/record-and-string` | 4.87–4.98x | 4.51–4.69x |

Run `npm run benchmark:adapters` and `npm run benchmark:adapters:browser` to reproduce.
The raw timings and checksums are under `benchmarks/adapters/results/`. The benchmark
harness uses generated call sites for measurement only; production code does not
use eval or generated functions. Original 2.0.1 measurements follow for historical
reference and are not current full-library or bundle-size measurements.

---

## Historical 2.0.1 measurements

### Changes retained

Only three runtime modules changed from 2.0.0. [`attempt`](API.md#attemptfn-args) and [`repeat`](API.md#repeatfn-count-args) collect
callback arguments with native rest parameters instead of slicing `arguments`.
This removes the explicit slicing call; it does not claim that rest parameters
are universally allocation-free. Their reflected `length` values remain 2 and 3,
respectively, with unchanged property descriptors.

[`pipe`](API.md#pipefns) invokes subsequent unary stages through a captured, uncurried intrinsic
`Function.prototype.call`. It no longer constructs an explicit `[result]` argument
array at each subsequent stage. The first stage still receives all original
arguments through `Reflect.apply`. This retains strict receiver forwarding,
exact argument counts, bound functions, callable proxies and callbacks with
hostile or shadowed `call`/`apply` properties. No scratch arrays are shared between
invocations, and no generated code, caching or dependency was added to the runtime.

Small-composition specialisations and in-place rest-array normalisation were
tried but rejected: they complicated the implementation and regressed other
workloads. Logical helpers, [`spread`](API.md#spreadfn), [`delay`](API.md#delayfn-milliseconds-args), validation and count limits retain
the 2.0.0 implementations. There is no eager preallocation of potentially enormous
repetition result arrays.

The previous fallback-minified bundle retained development comments because its
cross-realm regular-expression comment filter was not applied as intended.
The fallback minifier now explicitly removes comments and inserts the licence
banner as a preamble, with the source map generated for that final output.

### Local measurements

These are synthetic workload measurements, not end-to-end application speedups.
The callbacks are deliberately cheap, so reductions in wrapper overhead produce
large relative improvements. Expensive user callbacks will dilute those gains.
Both tested runtimes use V8; these results do not establish Firefox/Safari or
all supported Node.js version performance.

Measured on 2026-09-19 using Node.js 22.16.0 (V8 12.4.254.21-node.26),
Chromium 144.0.7559.96, Linux x64, AMD EPYC 9V74 80-Core Processor.
There are 55 deterministic workloads per runtime. Each implementation receives
two fresh-process/page runs, with order reversed in the second round. Each run
uses at least 20 ms warm-up per case, calibrated iterations targeting at least
6 ms per timing sample, and seven measured samples: 14 timing samples per case
and implementation. Checksums consume the results and are checked for agreement.
Construction results escape into a retained table. Node runs use isolated
processes; browser runs use fresh contexts and the minified bundles.

The table reports baseline time / updated time. A value above 1.00x is faster;
below 1.00x is slower. These are medians, not guarantees or confidence intervals.

| Workload | Node before (ns/op) | Node after (ns/op) | Node ratio | Chromium ratio |
| --- | ---: | ---: | ---: | ---: |
| `attempt/3-args` | 33.43 | 5.19 | 6.45x | 6.36x |
| `repeat/10-times/3-args` | 165.89 | 86.02 | 1.93x | 1.92x |
| `repeat/1000-times/3-args` | 16904.30 | 10015.12 | 1.69x | 1.80x |
| `pipe/mixed-numeric/16` | 200.56 | 98.07 | 2.05x | 1.46x |
| `pipe/mixed-numeric/64` | 868.03 | 365.37 | 2.38x | 1.59x |
| `application/transform-record` | 45.19 | 31.48 | 1.44x | 1.26x |
| `pipe/integer/4` | 23.34 | 23.21 | 1.01x | 0.92x |

Performance is not uniformly better. In the full Chromium run, short integer
pipeline cases measured around 0.90–0.93x, including the empty and one-stage cases
that never enter the changed unary invocation path. A targeted confirmation run
with 50 ms warm-up, at least 12 ms samples and 18 samples per implementation gave
0.98–1.06x across those cases. This run-to-run variation is why small differences
are not treated as reliable wins. The full matrix and confirmation run are retained,
including slower cases; unchanged functions serve as controls. No claim is made
that every workload became faster.

#### Minified distribution size

The uncompressed size changed from **12,543 bytes** to **3,590 bytes**, a **71.4% reduction**.

The gzip level 9 size changed from **3,013 bytes** to **1,014 bytes**, a **66.3% reduction**.

Size figures compare the supplied 2.0.0 and 2.0.1 minified artifacts, not a separately
verified Webpack/UglifyJS rebuild. The licence banner and source map remain.
The source map includes source content; the size figures above are for the JS file
only. No network-loading or parsing-time speedup is claimed from these byte counts.

### Reproduce from the complete source archive

No Node benchmark dependencies are required. The unmodified 2.0.0 source and
browser bundles are retained under `benchmarks/baseline-2.0.0`, with SHA-256 fingerprints
in `manifest.json`. Benchmarks and baseline fixtures are not published to npm.

```sh
npm run benchmark -- --rounds 2 --samples 7 --target-ms 6 --warmup-ms 20 --output .benchmark-results/node.json
npm run benchmark:browser -- --rounds 2 --samples 7 --target-ms 6 --warmup-ms 20 --output .benchmark-results/chromium.json
```

The browser command needs Python Playwright and Chromium; see
[Browser tooling](../CONTRIBUTING.md#browser-tooling). Longer runs are available by increasing `--samples`, `--target-ms`,
`--warmup-ms` and `--rounds`. The defaults use longer samples than the recorded run.
Both runners accept `--filter` to select a workload substring. The Node runner
accepts `--baseline` and `--candidate` entry paths; the browser runner accepts
baseline and candidate UMD bundle paths and an optional `--chromium` path.

Raw timing samples, dispersion percentiles, workload checksums and artifact hashes
are in `benchmarks/results/node-22.json` and `benchmarks/results/chromium-144.json`.
The short-pipeline confirmation is in `benchmarks/results/chromium-short-pipes.json`.
Timing thresholds are deliberately not unit-test assertions: CPU contention,
virtualisation, garbage collection, JIT decisions and runtime versions affect them.
Actual timers are tested for correctness, not benchmarked as if scheduler delay
were synchronous library overhead.

### Full measurement matrix

| Workload | Node before ns/op | Node after ns/op | Node ratio | Chromium before ns/op | Chromium after ns/op | Chromium ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `pipe/integer/0` | 1.13 | 1.13 | 1.01x | 1.03 | 1.13 | 0.91x |
| `pipe/integer/1` | 8.01 | 8.22 | 0.97x | 9.54 | 10.54 | 0.90x |
| `pipe/integer/2` | 14.44 | 13.72 | 1.05x | 15.54 | 16.78 | 0.93x |
| `pipe/integer/4` | 23.34 | 23.21 | 1.01x | 26.32 | 28.61 | 0.92x |
| `pipe/integer/16` | 87.28 | 83.86 | 1.04x | 89.65 | 98.42 | 0.91x |
| `pipe/mixed-numeric/2` | 14.07 | 14.12 | 1.00x | 15.45 | 15.64 | 0.99x |
| `pipe/mixed-numeric/4` | 27.45 | 26.66 | 1.03x | 28.04 | 28.23 | 0.99x |
| `pipe/mixed-numeric/16` | 200.56 | 98.07 | 2.05x | 151.82 | 103.76 | 1.46x |
| `pipe/mixed-numeric/64` | 868.03 | 365.37 | 2.38x | 625.61 | 393.68 | 1.59x |
| `construct/pipe/0` | 46.76 | 45.83 | 1.02x | 45.20 | 45.78 | 0.99x |
| `construct/pipe/1` | 57.15 | 56.13 | 1.02x | 60.65 | 57.98 | 1.05x |
| `construct/pipe/2` | 63.49 | 60.80 | 1.04x | 67.14 | 64.09 | 1.05x |
| `construct/pipe/8` | 77.68 | 70.82 | 1.10x | 75.53 | 75.15 | 1.01x |
| `and/full/1` | 10.03 | 9.42 | 1.06x | 10.25 | 9.63 | 1.06x |
| `and/full/2` | 16.57 | 15.90 | 1.04x | 19.07 | 18.79 | 1.02x |
| `and/full/8` | 47.66 | 47.06 | 1.01x | 56.84 | 56.46 | 1.01x |
| `and/short-circuit/8` | 10.55 | 9.76 | 1.08x | 12.49 | 12.11 | 1.03x |
| `construct/and/2` | 70.16 | 66.17 | 1.06x | 70.95 | 66.38 | 1.07x |
| `or/full/1` | 16.12 | 15.57 | 1.04x | 16.69 | 15.64 | 1.07x |
| `or/full/2` | 22.73 | 22.41 | 1.01x | 26.70 | 26.32 | 1.01x |
| `or/full/8` | 70.54 | 66.06 | 1.07x | 90.03 | 86.59 | 1.04x |
| `or/short-circuit/8` | 15.79 | 15.26 | 1.03x | 17.45 | 16.98 | 1.03x |
| `construct/or/2` | 69.56 | 66.28 | 1.05x | 74.77 | 66.76 | 1.12x |
| `nor/full/1` | 15.88 | 15.46 | 1.03x | 17.45 | 16.12 | 1.08x |
| `nor/full/2` | 22.68 | 22.07 | 1.03x | 27.47 | 27.08 | 1.01x |
| `nor/full/8` | 68.84 | 67.46 | 1.02x | 82.40 | 90.79 | 0.91x |
| `nor/short-circuit/8` | 15.55 | 15.53 | 1.00x | 16.12 | 16.40 | 0.98x |
| `construct/nor/2` | 74.06 | 66.34 | 1.12x | 67.52 | 67.90 | 0.99x |
| `xor/full/1` | 16.52 | 16.35 | 1.01x | 16.78 | 16.31 | 1.03x |
| `xor/full/2` | 23.30 | 23.51 | 0.99x | 27.66 | 27.66 | 1.00x |
| `xor/full/8` | 80.79 | 88.10 | 0.92x | 85.83 | 83.92 | 1.02x |
| `xor/short-circuit/8` | 23.59 | 23.90 | 0.99x | 26.51 | 26.89 | 0.99x |
| `construct/xor/2` | 68.34 | 67.69 | 1.01x | 71.33 | 67.90 | 1.05x |
| `construct/and/nullish` | 76.90 | 75.02 | 1.03x | 77.82 | 75.91 | 1.03x |
| `attempt/0-args` | 31.65 | 4.57 | 6.93x | 30.14 | 4.55 | 6.62x |
| `attempt/1-args` | 34.05 | 5.13 | 6.63x | 32.81 | 5.17 | 6.34x |
| `attempt/3-args` | 33.43 | 5.19 | 6.45x | 32.42 | 5.10 | 6.36x |
| `attempt/8-args` | 37.99 | 5.08 | 7.48x | 36.24 | 5.17 | 7.00x |
| `attempt/caught-value` | 508.52 | 460.91 | 1.10x | 3369.14 | 3344.73 | 1.01x |
| `repeat/0-times/0-args` | 20.58 | 4.57 | 4.50x | 18.50 | 4.67 | 3.96x |
| `repeat/0-times/3-args` | 22.75 | 4.49 | 5.06x | 20.69 | 5.67 | 3.65x |
| `repeat/0-times/8-args` | 24.14 | 4.52 | 5.34x | 23.08 | 6.77 | 3.41x |
| `repeat/1-times/0-args` | 44.90 | 26.29 | 1.71x | 44.82 | 26.32 | 1.70x |
| `repeat/1-times/3-args` | 48.20 | 23.58 | 2.04x | 46.35 | 25.18 | 1.84x |
| `repeat/1-times/8-args` | 53.27 | 25.21 | 2.11x | 58.75 | 25.18 | 2.33x |
| `repeat/10-times/0-args` | 162.98 | 110.59 | 1.47x | 168.61 | 117.49 | 1.44x |
| `repeat/10-times/3-args` | 165.89 | 86.02 | 1.93x | 155.64 | 81.25 | 1.92x |
| `repeat/10-times/8-args` | 205.74 | 89.90 | 2.29x | 192.26 | 83.92 | 2.29x |
| `repeat/1000-times/0-args` | 16727.50 | 12013.34 | 1.39x | 15185.55 | 11035.16 | 1.38x |
| `repeat/1000-times/3-args` | 16904.30 | 10015.12 | 1.69x | 14453.12 | 8007.81 | 1.80x |
| `repeat/1000-times/8-args` | 19973.84 | 10517.04 | 1.90x | 17285.16 | 8984.37 | 1.92x |
| `spread/3-args` | 14.69 | 14.67 | 1.00x | 14.78 | 14.50 | 1.02x |
| `not/predicate` | 4.98 | 5.04 | 0.99x | 5.17 | 5.29 | 0.98x |
| `application/filter-records` | 1760.89 | 1782.64 | 0.99x | 3051.76 | 3051.76 | 1.00x |
| `application/transform-record` | 45.19 | 31.48 | 1.44x | 41.39 | 32.81 | 1.26x |
