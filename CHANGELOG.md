# Changelog

## Unreleased — 2.0.0

### Upgrading from 1.0.0

The original ten root exports and their public function subpaths remain available.
The following changes require attention when upgrading:

- Use Node.js 8.0.0 or later for CommonJS. The old package's singular `engine`
  metadata advertised Node.js 0.10; it was not a valid npm `engines` constraint.
  The supported runtime range is now explicit and checked on the actual minimum.
- Returned wrappers preserve the caller's exact receiver. For `pipe`, `spread`,
  `or`, `xor` and `nor`, a plain call now supplies `undefined`; `.call(null)`
  preserves `null`, and primitive receivers stay primitive. The 1.0.0 wrappers
  substituted the global object for nullish receivers and boxed primitives.
  Bind a callback to its owner or call the wrapper with an explicit object when
  it needs a fixed receiver. A non-strict callback can still coerce its own `this`.
- `and` and `not` also forward the wrapper caller's receiver instead of using the
  callback itself. Use `callback.bind(callback)` only when intentionally retaining
  that old behaviour. `attempt` and `repeat` keep their original
  callback-as-receiver convention.
- `repeat` accepts integer counts from 0 to 4,294,967,295, with `null`/`undefined`
  meaning zero. Strings, booleans, fractions, negative values, `NaN` and infinity
  now fail before invocation. Convert and validate external counts explicitly;
  use `Math.ceil` on a finite non-negative number only if the old fractional
  loop behaviour was intentional.
- Invalid required callbacks throw `TypeError` without coercing the input.
  Avoid depending on the former error message text or coercion side effects.
- Use documented root exports or public `src/` function modules. The old
  `src/expectFunction`, `src/expectFunctions` and `src/filterFunctions` internal
  paths are no longer exported; validate application inputs in application code.
- For local installation/linking, build and use `package/` or the verified
  tarball. The source checkout is private and rejects root packing/publication.

### Removed

- Removed the 14 duplicate attached variant names from the 2.0.0 development API. Use standalone names such as `pipeAsync`, `attemptResult`, `attemptResultAsync` and `partialRight`. Scheduler methods `cancel`, `flush` and `pending` remain.

### Added

- Added individual function imports such as `go-fns/pipe` and `go-fns/applyIf`, with shared identity, callable CommonJS and named/default ES module exports. Existing public source imports remain supported.

- Async pipelines, predicate combinators and conditional branches, with sequential
  evaluation, short-circuiting and matching attached `.async` variants.
- `result` for fixed values or callbacks; `attemptResult` and `attemptResultAsync`
  for discriminated success/failure outcomes; `tap` and `tapAsync` observers.
- Cancellable `sleep`, cached invocation with `once`, and `debounce`/`throttle`
  schedulers with `cancel`, `flush` and `pending` controls.
- `partial`, `partialRight`, `unary`, `when`, `ifElse` and `repeatAsync`.
- `applyIf` for immediate conditional transformation using a boolean flag or a predicate's truthiness.
- TypeScript declarations for all 34 exports and their focused imports, including
  callback arguments, receivers, optional/rest parameters and result inference.

### Fixed

- Skip actual `null`/`undefined` sequence entries consistently and validate supplied
  callbacks before execution, without invoking input coercion hooks.
- Preserve callback results, thrown values and caller receivers as documented,
  including callable objects with shadowed `call` or `apply` properties.
- Invoke native timers with the host receiver and preserve `document.all`
  distinctions in readable and minified browser bundles.

### Compatibility and packaging

- CommonJS on Node.js 8.0.0+; default/named ES module imports through CommonJS
  interoperability on Node.js 12.20.0+ within 12.x, or 14.13.0+.
  TypeScript declarations require TypeScript 5.4+. See the README for browser
  syntax and required/optional native capabilities.
- Retain zero runtime dependencies, public function source subpaths, the
  `Functions` browser global and readable/minified UMD bundles with a source map.
- Generate the consumer package separately from the private development root;
  exclude maintainer tooling, tests, local experiments and benchmark evidence.
- Use the MIT licence and retain Michael Ko's copyright notice.

### Documentation

- Aligned the README, API reference and editor comments with shared documentation conventions, clarified cached scheduler return values and consolidated alias summaries.

## 1.0.0 — 2022-10-29

- Initial release.
