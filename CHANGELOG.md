# Changelog

## Unreleased

Planned version: 2.0.0. This release consolidates the unreleased 2.0.x, 2.1.x and 2.2.x development
snapshots. Version labels in the historical benchmark records still identify
their original inputs and measurements; they do not represent published releases.

### Breaking changes

- `and` and `not` now forward the wrapper caller's receiver. Bind callbacks
  explicitly if they need a fixed receiver; `attempt` and `repeat` retain their
  original receiver convention.
- `repeat` no longer coerces strings or booleans, rounds fractions by looping,
  or accepts negative, infinite, `NaN` or non-array-representable counts.
  `null` and `undefined` still mean zero.
- Required callbacks must be functions. Invalid inputs fail without stringifying
  them or invoking coercion hooks. Callback failures keep their documented
  synchronous, promise or result-object behaviour.
- The original ten export names and established empty-input results remain
  available. Unfinished deep-import prototypes are not published APIs.
- The source checkout is no longer an installable or publishable package root.
  Install/link the generated `package/` directory or install the verified tarball.

### Added

- Added sequential `pipeAsync`, synchronous `tap` and asynchronous `tapAsync`.
- Added `andAsync`, `orAsync`, `xorAsync`, `norAsync` and `notAsync` with synchronous factory validation,
  awaited truthiness, exact failure identity and caller receiver/argument forwarding.
  Multi-predicate variants evaluate sequentially and short-circuit; empty or
  all-nullish inputs resolve to `false`. Synchronous combinators remain unchanged.
- Added `whenAsync` and `ifElseAsync` with synchronous validation of all required
  callbacks, awaited predicate decisions and selected results, exact failure identity
  and caller receiver forwarding. `whenAsync` passes one original input and unwraps
  promise or thenable inputs on its unchanged path; `ifElseAsync` forwards all
  original arguments to the predicate and selected branch. Calls remain independent.
- Added `attemptResult` and `attemptResultAsync` with discriminated outcomes and
  exact failure identity, plus `sleep` with AbortSignal-compatible cancellation.
- Added lazy `once` with exact value, promise and failure caching and explicit
  reentrancy errors.
- Added `debounce` and `throttle` with leading/trailing options, latest arguments
  and receivers, detachable `cancel`/`flush`/`pending` methods and `maxWait` for
  debounce. Throttle measures spacing from the last actual invocation.
- Added `partial`, `partialRight`, `unary`, `when`, `ifElse` and sequential
  `repeatAsync`, preserving their documented receiver and argument contracts.
- Attached exact-reference variants: `pipe.async`, `attempt.result`,
  `attempt.resultAsync`, `attemptResult.async`, `tap.async`, `and.async`, `or.async`,
  `xor.async`, `nor.async`, `not.async`, `when.async`, `ifElse.async`,
  `partial.right` and `repeat.async`.
- Included TypeScript declarations for all 32 exports and public source modules.
  Checked pipeline stages, callback unions, receiver requirements, stable cached
  results, optional/rest arguments, structural predicates and synchronous type guards.
  Async predicate and branch decisions do not claim type-guard or complement narrowing.

### Correctness and performance

- Timer option declarations now accept explicit `undefined` for `signal`, `leading`,
  `trailing` and `maxWait` with `exactOptionalPropertyTypes`, matching runtime defaults.

- Reject primitive string argument lists in `spread` declarations to match native
  invocation. Preserve boxed strings, typed arrays, readonly arrays and object
  array-likes for compatible variadic callbacks.

- Fixed scheduler recovery after a clock throws during timer expiry, and preserved
  cancellation/replacement during clock reads in expiry and `flush()`. Pending state,
  cached results and later scheduling now remain consistent with timer ownership.
- Preserved concrete receiver requirements in callback unions containing `this: any`
  for `once`, pipelines and `partialRight`, including their aliases. Multi-stage
  pipelines and synchronous `when`/`ifElse` also retain those requirements when
  another callback accepts an unrestricted receiver.
- Check every possible saved-argument tuple in `partialRight` and `partial.right`;
  a longer tuple can no longer hide inputs required by a shorter alternative.

- Fixed source timer helpers when `window` is the only available host alias, preserving
  the host receiver. Guarded the final global lookup so unsupported source embeddings
  fail clearly only when a host-dependent operation is requested.

- Require every possible callback input and receiver for single-stage pipelines,
  including pipelines with nullish gaps.
- Keep overloaded callback arguments aligned with the captured return signature
  in pipeline fallbacks and right partial application.
- Reject tarball destinations inside generated `package/`, including Windows case
  variants and filesystem aliases, before building. A later build must not delete
  the release candidate.

- Clear late-returned `sleep` timer handles after synchronous cancellation while
  preserving the selected abort reason.
- Preserve debounce/throttle task ownership through timer registration, cleanup,
  cancellation and reentry. Release unused arguments and receivers from suppressed
  leading-only calls without disrupting pending work.
- Infer direct-execution callback inputs from supplied arguments, preserve result
  types and reject unsafe operations where captured callbacks lack input context.
  Support compatible dynamic pipeline tails after a known first stage.
- Preserved concrete `whenAsync` input and awaited result types when another callback
  has an unconstrained inferred input. Kept explicit tuple-union call alternatives
  intact across synchronous and asynchronous predicate combinators.
- Contextually checked inputs and receivers inside inferred `whenAsync` and
  `ifElseAsync` callbacks. Annotated transforms and branches inform compatible
  predicates. Callbacks require explicit annotations where no safe context can be
  inferred instead of silently permitting unsafe operations through `any`.
- Repaired public imports; skipped actual nullish sequence entries consistently and
  validated all supplied callbacks before execution without coercing invalid values.
- Forwarded exact caller receivers through returned wrappers, including `and` and
  `not`; kept `attempt` and `repeat`'s callback-as-receiver convention.
- Invoked callable objects safely when their `call` or `apply` property is shadowed;
  preserved proxy argument isolation, reflected arities and observable errors.
- Invoked host timers with the host global, including browser namespace calls.
  Selected a receiver-bound monotonic scheduler clock when available, with a
  documented `Date.now()` fallback and lazy host access.
- Rejected invalid repetition counts before callback invocation or allocation;
  preserved nullish `spread` inputs as empty argument lists.
- Preserved the browser's `document.all` distinction from actual `null` and
  `undefined`, including in minified bundles.
- Reduced unnecessary invocation arrays in composition, attempts, repetition and
  partial application. Kept synchronous and asynchronous implementations separate.
  Historical workload measurements and fingerprinted baselines remain available.

### Compatibility, packaging and verification

- Added fresh-load optional-capability regressions to source, installed consumers and
  readable/minified bundle checks, including actual minimum-runtime and Chromium checks.

- Supported CommonJS consumers on Node.js 8.0.0 and later, with default and named
  ES module imports through CommonJS interoperability on Node.js 14.13.0 and later,
  or Node.js 12.20.0+ within 12.x.
  Kept Node.js 22.16+ as the separate development requirement and retained zero
  runtime dependencies.
- Generated a complete, self-contained `package/` directory while keeping the
  development root private. Preserved public source subpaths and declarations;
  excluded maintainer tooling, tests, prototypes and benchmark evidence from npm.
- Built and packed one candidate, recorded its SHA-256 digest and verified the exact
  tarball across installed consumers and browser checks. Rejected wrong-directory
  root packing/publication and missing supplied tarballs.
- Staged complete distribution output before replacement; tested build failures,
  rollback and cleanup. Verified source-map mappings and embedded readable source.
- Stage new tarballs and checksums before replacement, override inherited npm
  dry-run mode and restore the previous candidate when packing fails.
- Compare packaged sources with the checkout and require complete consumer/test
  reports. Reject empty or interrupted runs, verify native coverage inventory and
  enforce external deadlines for runtime and browser checks.
- Preserved Webpack's UMD loader formats and used Terser for minification. Replaced
  Mocha with the native test runner and removed the unused Webpack CLI.
- Expanded runtime, source coverage, declaration, bundle, browser/Worker and
  installed-consumer checks. Generated the README from its canonical template and
  checked references for functions, attached variants and scheduler methods.
- Used the MIT licence for this release and retained Michael Ko's copyright notice.

## 1.0.0 — 2022-10-29

- Initial release. The supplied archive identified itself as 1.1.0, but contained no 1.1.0 changelog entry.
