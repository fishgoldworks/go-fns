# Changelog

## 2.0.0

### Upgrading from 1.0.0

The original ten root exports and their public function subpaths remain available.
Review these upgrade actions:

- Use Node.js 8.0.0 or later for CommonJS; see the [runtime requirements](#check-runtime-and-compiler-requirements).
- Bind callbacks that require a fixed receiver; review the [receiver migration steps](#preserve-callback-receivers).
- Validate counts passed to [`repeat`](docs/API.md#repeatfn-count-args); see the [count validation changes](#validate-repetition-counts).
- Handle invalid callbacks as `TypeError`; see the [callback validation changes](#handle-callback-validation-errors).
- Replace internal helper imports with application-owned validation; see the [public import migration steps](#replace-internal-helper-imports).
- Use TypeScript 5.4 or later for the included declarations; review the [compiler requirements](#check-runtime-and-compiler-requirements).
- Build and install the generated package for local use; see the [local installation steps](#use-generated-output-for-local-installs).

#### Check runtime and compiler requirements

Use Node.js 8.0.0 or later for CommonJS. The old package's singular `engine`
metadata advertised Node.js 0.10; it was not a valid npm `engines` constraint.
The supported runtime range is now explicit and checked on the actual minimum.
See [Runtime support](README.md#runtime-support) for other module formats and browsers.

Version 2.0.0 includes TypeScript declarations. Typed consumers need TypeScript
5.4 or later; review callback inputs and receivers and the
[declaration and resolution requirements](docs/API.md#typescript).

#### Preserve callback receivers

Returned wrappers preserve the caller's exact receiver. For [`pipe`](docs/API.md#pipefns), [`spread`](docs/API.md#spreadfn),
[`or`](docs/API.md#orfns), [`xor`](docs/API.md#xorfns) and [`nor`](docs/API.md#norfns), a plain call now supplies `undefined`; `.call(null)`
preserves `null`, and primitive receivers stay primitive. The 1.0.0 wrappers
substituted the global object for nullish receivers and boxed primitives.
Bind a callback to its owner or call the wrapper with an explicit object when
it needs a fixed receiver. A non-strict callback can still coerce its own `this`.

[`and`](docs/API.md#andfns) and [`not`](docs/API.md#notfn) also forward the wrapper caller's receiver instead of using the
callback itself. Use `callback.bind(callback)` only when intentionally retaining
that old behaviour. [`attempt`](docs/API.md#attemptfn-args) and [`repeat`](docs/API.md#repeatfn-count-args) keep their original
callback-as-receiver convention.

#### Validate repetition counts

[`repeat`](docs/API.md#repeatfn-count-args) accepts integer counts from 0 to 4,294,967,295, with `null`/`undefined`
meaning zero. Strings, booleans, fractions, negative values, `NaN` and infinity
now fail before invocation. Convert and validate external counts explicitly;
use `Math.ceil` on a finite non-negative number only if the old fractional
loop behaviour was intentional.

#### Handle callback validation errors

Invalid required callbacks throw `TypeError` without coercing the input.
Avoid depending on the former error message text or coercion side effects.

#### Replace internal helper imports

Use documented root exports or public `src/` function modules. The old
`src/expectFunction`, `src/expectFunctions` and `src/filterFunctions` internal
paths are no longer exported; validate application inputs in application code.

#### Use generated output for local installs

For local installation/linking, build and use `package/` or the verified
tarball. The source checkout is private and rejects root packing/publication.

### Added

- [`ary`](docs/API.md#aryfn-count) to cap the number of arguments forwarded to a callback and [`memoize`](docs/API.md#memoizefn-options) to reuse results for matching calls with a bounded, clearable cache.
- [`withDefaultArgs`](docs/API.md#withdefaultargsfn-defaultargs) to supply positional defaults to an existing function when arguments are omitted or `undefined`, preserving defined values, call-time receivers and callback results.
- Added individual function imports such as `go-fns/pipe` and `go-fns/applyIf`, with shared identity, callable CommonJS and named/default ES module exports. Existing public source imports remain supported.

- Standalone async pipelines, predicate combinators and conditional branches.
  Async predicate combinators await callbacks sequentially and short-circuit.
- [`result`](docs/API.md#resultvalue-args) for fixed values or callbacks; [`attemptResult`](docs/API.md#attemptresultfn-args) and [`attemptResultAsync`](docs/API.md#attemptresultasyncfn-args)
  for discriminated success/failure outcomes; [`tap`](docs/API.md#tapobserver) and [`tapAsync`](docs/API.md#tapasyncobserver) observers.
- Cancellable [`sleep`](docs/API.md#sleepmilliseconds-options), cached invocation with [`once`](docs/API.md#oncefn), and [`debounce`](docs/API.md#debouncefn-milliseconds-options) and [`throttle`](docs/API.md#throttlefn-milliseconds-options)
  schedulers with controls to cancel, flush or check pending work.
- [`partial`](docs/API.md#partialfn-args), [`partialRight`](docs/API.md#partialrightfn-args), [`unary`](docs/API.md#unaryfn), [`when`](docs/API.md#whenpredicate-transform), [`ifElse`](docs/API.md#ifelsepredicate-ontrue-onfalse) and [`repeatAsync`](docs/API.md#repeatasyncfn-count-args).
- [`applyIf`](docs/API.md#applyifvalue-condition-transform) for immediate conditional transformation using a boolean flag or a predicate's truthiness.
- TypeScript declarations for all public exports and their focused imports, including
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
  `Functions` browser global and readable/minified UMD bundles with source maps.
- Generate the consumer package separately from the private development root;
  exclude maintainer tooling, tests, local experiments and benchmark evidence.
- Version 2.0.0 uses the MIT licence and retains Michael Ko's 2022 copyright notice.
  Version 1.0.0 was published under GNU LGPLv3.

### Documentation

- Clarified callback outcomes, cached scheduler return values and how predicates short-circuit in the README and API reference.

## 1.0.0 — 2022-10-29

- Initial release.
