# Go Functions

**A collection of JavaScript utilities for working with functions and their results.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)

- **Version:** [2.0.0](CHANGELOG.md)
- **Licence:** [MIT](LICENSE.md)

Build synchronous or asynchronous pipelines, combine predicates, adapt callback arguments, and capture success or failure. Control when and how often functions run with helpers for delays, debouncing and throttling.

No runtime dependencies. TypeScript declarations included.

**[View full API documentation](docs/API.md)**

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [API summary](#api-summary)
- [Behaviour](#behaviour)
- [TypeScript](#typescript)
- [Performance](#performance)
- [Migration](#migration)
- [Development](#development)
- [Further reading](#further-reading)
- [Licence](#licence)

## Installation

Using npm:

```sh
npm install go-fns
```

Using Yarn:

```sh
yarn add go-fns
```

### Runtime support

<!-- prettier-ignore -->
| Environment | Requirement |
| --- | --- |
| CommonJS | Node.js 8.0.0 or later, including function subpaths and existing public `src/` imports. |
| ES modules | Node.js 14.13.0 or later, or Node.js 12.20.0+ within 12.x, for both default and named imports. Root imports use CommonJS interoperability. Function subpaths have native ES module entries. |
| Browser | Modern browsers with `Reflect.apply`, `Number.isInteger`, `Number.isFinite`, promises and async functions. |
| Cancellation | `sleep` accepts an AbortSignal-compatible object supplied by the host; native `AbortController` and `AbortSignal` constructors are optional. |

`performance` and its `now` method are optional: schedulers fall back to `Date.now()`.
Timer operations need host timers; importing the library and using unrelated functions do not.
The host can be exposed through `globalThis`, `self`, `global` or `window`; no individual
alias is mandatory. See [Optional host capabilities](docs/API.md#optional-host-capabilities)
for fallback and failure behaviour.

The library installs no global polyfills. See [Development](#development) for the separate contributor runtime requirement.

## Usage

### ES modules

<!-- prettier-ignore -->
```javascript
import { pipe, not } from 'go-fns';

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

A default import (`import Functions from 'go-fns'`) exposes the complete public API object. The package entry is CommonJS; Node loads these ES module imports through its CommonJS interoperability.

### CommonJS

<!-- prettier-ignore -->
```javascript
const { pipe, not } = require('go-fns');

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

### Function subpaths

Every top-level function also has an individual import path. CommonJS returns the
same callable directly; ES modules provide both named and default exports, such
as `import { pipe } from 'go-fns/pipe'` or `import pipe from 'go-fns/pipe'`.

<!-- prettier-ignore -->
```javascript
const pipe = require('go-fns/pipe');
const not = require('go-fns/not');

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

These entries share function identity with named root imports
and load the function's implementation directly. Existing public `src/` imports,
with or without `.js`, remain supported, including `go-fns/src/pipe` and
`go-fns/src/logic/not.js`.

### Browser

Load Go Functions from jsDelivr or host a bundle yourself:

- [Minified bundle](https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js)
- [Readable bundle](https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.js)

The bundle exposes `Functions`:

<!-- prettier-ignore -->
```html
<script src="https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js"></script>
<script>
  const { pipe, not } = Functions;
  pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
  [1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
</script>
```

Both `dist/go-fns.js` and `dist/go-fns.min.js` expose the `Functions` UMD namespace.
The bundles also support CommonJS, AMD and Workers. A source checkout generates
these files in `package/dist/`; installed packages contain them in `dist/`.
Importing the library does not start timers, make network requests or access the DOM.

## API summary

See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.

**Composition and observation**

| API | Description | Returns |
| --- | --- | --- |
| [`pipe(...fns)`](docs/API.md#pipefns) | Creates a function that runs synchronous stages from left to right. | **`Function`** — `(...args) => T \| undefined`<br><br>A pipeline that returns the last stage result, or `undefined` when there are no stages. |
| [`pipeAsync(...fns)`](docs/API.md#pipeasyncfns) | Creates a function that runs stages from left to right, awaiting each result. | **`Function`** — `(...args) => Promise<Awaited<T> \| undefined>`<br><br>A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages. |
| [`tap(observer)`](docs/API.md#tapobserver) | Creates a function that calls an observer and returns the original input. | **`Function`** — `(value: V) => V`<br><br>A wrapper that calls the observer and returns the exact input value or reference. |
| [`tapAsync(observer)`](docs/API.md#tapasyncobserver) | Creates a function that awaits an observer before returning its input value. | **`Function`** — `(value: V) => Promise<Awaited<V>>`<br><br>A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped. |

**Predicate logic**

| API | Description | Returns |
| --- | --- | --- |
| [`and(...fns)`](docs/API.md#andfns) | Creates a predicate that determines whether all supplied predicates return truthy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are truthy; otherwise `false`. |
| [`andAsync(...fns)`](docs/API.md#andasyncfns) | Creates a predicate that awaits results in order and determines whether all are truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if at least one predicate is supplied and all awaited results are truthy; otherwise `false`. |
| [`or(...fns)`](docs/API.md#orfns) | Creates a predicate that determines whether any supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if any result is truthy; otherwise `false`. |
| [`orAsync(...fns)`](docs/API.md#orasyncfns) | Creates a predicate that awaits results in order and determines whether any is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if any awaited result is truthy; otherwise `false`. |
| [`not(fn)`](docs/API.md#notfn) | Creates a predicate that negates its callback's truthiness. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if the callback result is falsy; otherwise `false`. |
| [`notAsync(fn)`](docs/API.md#notasyncfn) | Creates a predicate that awaits its callback result and negates its truthiness. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if the awaited callback result is falsy; otherwise `false`. |
| [`nor(...fns)`](docs/API.md#norfns) | Creates a predicate that determines whether all supplied predicates return falsy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are falsy; otherwise `false`. |
| [`norAsync(...fns)`](docs/API.md#norasyncfns) | Creates a predicate that awaits results in order and determines whether all are falsy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` if at least one predicate is supplied and all awaited results are falsy; otherwise `false`. |
| [`xor(...fns)`](docs/API.md#xorfns) | Creates a predicate that determines whether exactly one supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if exactly one result is truthy; otherwise `false`. |
| [`xorAsync(...fns)`](docs/API.md#xorasyncfns) | Creates a predicate that awaits results in order and determines whether exactly one is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` for exactly one truthy result; it stops at the second truthy result and otherwise resolves to `false`. |

**Conditional transformations**

| API | Description | Returns |
| --- | --- | --- |
| [`applyIf(value, condition, transform)`](docs/API.md#applyifvalue-condition-transform) | Applies a transformation immediately when the condition is `true` or the predicate returns a truthy value. | **`T \| V`**<br><br>The exact transformation result or original input; promises are not awaited. |
| [`when(predicate, transform)`](docs/API.md#whenpredicate-transform) | Creates a function that transforms one value when the predicate returns a truthy result. | **`Function`** — `(value: V) => V \| T`<br><br>A wrapper returning the transform result for a truthy predicate result, or the original input otherwise. |
| [`whenAsync(predicate, transform)`](docs/API.md#whenasyncpredicate-transform) | Creates a function that awaits a predicate and conditionally transforms one input. | **`Function`** — `(value: V) => Promise<Awaited<V \| T>>`<br><br>A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. |
| [`ifElse(predicate, onTrue, onFalse)`](docs/API.md#ifelsepredicate-ontrue-onfalse) | Creates a function that evaluates a predicate once and calls the matching branch. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise. |
| [`ifElseAsync(predicate, onTrue, onFalse)`](docs/API.md#ifelseasyncpredicate-ontrue-onfalse) | Creates a function that awaits a predicate and runs only the matching branch. | **`Function`** — `(...args) => Promise<Awaited<T>>`<br><br>A wrapper resolving to the awaited result of `onTrue` for a truthy decision, or `onFalse` otherwise. |

**Argument adaptation**

| API | Description | Returns |
| --- | --- | --- |
| [`spread(fn)`](docs/API.md#spreadfn) | Creates a function that passes an array-like input to its callback as individual arguments. | **`Function`** — `(args) => T`<br><br>A wrapper that spreads the supplied argument list and returns the callback result. |
| [`partial(fn, ...args)`](docs/API.md#partialfn-args) | Creates a function that prepends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after prepending the saved arguments. |
| [`partialRight(fn, ...args)`](docs/API.md#partialrightfn-args) | Creates a function that appends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after appending the saved arguments. |
| [`unary(fn)`](docs/API.md#unaryfn) | Creates a function that forwards exactly one argument to its callback. | **`Function`** — `(value) => T`<br><br>A wrapper returning the callback result after passing exactly one argument. |

**Execution and outcomes**

| API | Description | Returns |
| --- | --- | --- |
| [`result(value, ...args)`](docs/API.md#resultvalue-args) | Calls a function once with the supplied arguments, or returns a non-function value unchanged. | **`T \| V`**<br><br>The exact callback result or original value; promises are not awaited. |
| [`attempt(fn, ...args)`](docs/API.md#attemptfn-args) | Invokes a callback synchronously and returns its result or the exact value it throws. | **`unknown`**<br><br>The callback result, or the exact value thrown synchronously. |
| [`attemptResult(fn, ...args)`](docs/API.md#attemptresultfn-args) | Invokes a callback synchronously and reports success or failure in a result object. | **`Result<T>`**<br><br>A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw. |
| [`attemptResultAsync(fn, ...args)`](docs/API.md#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`once(fn)`](docs/API.md#oncefn) | Creates a function that invokes its callback at most once and caches the first outcome. | **`Function`** — `(...args) => T`<br><br>A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls. |
| [`repeat(fn, count?, ...args)`](docs/API.md#repeatfn-count-args) | Invokes a callback a specified number of times synchronously and collects its results. | **`T[]`**<br><br>A fresh array containing each synchronous callback result in invocation order. |
| [`repeatAsync(fn, count?, ...args)`](docs/API.md#repeatasyncfn-count-args) | Invokes a callback a specified number of times sequentially, awaiting each result. | **`Promise<Awaited<T>[]>`**<br><br>A promise resolving to a fresh array of sequentially awaited callback results in invocation order. |

**Scheduling and cancellation**

| API | Description | Returns |
| --- | --- | --- |
| [`delay(fn, milliseconds?, ...args)`](docs/API.md#delayfn-milliseconds-args) | Schedules a callback through the host's `setTimeout` and returns its timer handle. | **`TimerHandle`**<br><br>The native timeout handle: a browser number or a Node.js `Timeout` object. |
| [`sleep(milliseconds?, options?)`](docs/API.md#sleepmilliseconds-options) | Creates a promise that resolves after a cancellable pause. | **`Promise<void>`**<br><br>A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted. |
| [`debounce(fn, milliseconds?, options?)`](docs/API.md#debouncefn-milliseconds-options) | Creates a function that combines a burst of calls using the latest arguments and receiver. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes `cancel`, `flush` and `pending` methods. |
| [`throttle(fn, milliseconds?, options?)`](docs/API.md#throttlefn-milliseconds-options) | Creates a function that limits callback invocation frequency while calls continue. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes `cancel`, `flush` and `pending` methods. |
| [`debounced.cancel()`](docs/API.md#debouncecancel) | Discards pending calls and resets scheduling, retaining the most recent callback return value. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`debounced.flush()`](docs/API.md#debounceflush) | Invokes eligible pending work immediately, or returns the most recent callback return value. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`debounced.pending()`](docs/API.md#debouncepending) | Checks whether a callback invocation is scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |
| [`throttled.cancel()`](docs/API.md#throttlecancel) | Discards pending calls and resets scheduling, retaining the most recent callback return value. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`throttled.flush()`](docs/API.md#throttleflush) | Invokes eligible pending work immediately, or returns the most recent callback return value. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`throttled.pending()`](docs/API.md#throttlepending) | Checks whether a callback invocation is scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |

`T` denotes a callback or branch result and `V` the input value type. Signatures summarise call shapes; see [TypeScript](#typescript) for inference and receiver requirements, and the full declarations for overloads.

## Behaviour

`applyIf(value, condition, transform)` applies one transformation immediately. The condition is a boolean flag or a predicate whose result uses JavaScript truthiness, matching `when`. Use `when` to create a reusable transformation.

<!-- prettier-ignore -->
```javascript
import { applyIf } from 'go-fns';

applyIf('42', true, Number);                   // => 42
applyIf('42', false, Number);                  // => '42'
applyIf('42', value => value.length, Number);  // => 42
```

`result(value, ...args)` accepts a fixed value or a callback that computes one.
It returns the value unchanged or calls the callback once and propagates any throw.
To use a function as the value, pass a callback that returns it.

Use `attemptResult` to distinguish a normal return from a throw, or
`attemptResultAsync` to capture a promise rejection as well. Both use `ok` to
identify the outcome. `attempt` returns the raw value in either case.

<!-- prettier-ignore -->
```javascript
import { attempt, attemptResult } from 'go-fns';

const error = new Error('Unavailable');
const returnError = () => error;
const throwError = () => { throw error; };

attempt(returnError) === attempt(throwError); // => true
attemptResult(returnError);                  // => { ok: true, value: error }
attemptResult(throwError);                   // => { ok: false, error }
```

`and`, `or`, `not`, `nor` and `xor` create predicates. The supplied callbacks run when you call the returned predicate.

<!-- prettier-ignore -->
```javascript
import { and, not, or } from 'go-fns';

const isActive = user => user.active;
const isOwner = user => user.role === 'owner';
const isAdmin = user => user.role === 'admin';
const isLocked = user => user.locked;
const canEdit = and(isActive, or(isOwner, isAdmin), not(isLocked));

canEdit({ active: true, role: 'admin', locked: false }); // => true
canEdit({ active: true, role: 'admin', locked: true });  // => false
```

The multi-predicate helpers evaluate from left to right. `and` stops at the first falsy result. `or` and `nor` stop at the first truthy result. `xor` succeeds when **exactly one** result is truthy and stops at the second truthy result. With no predicates, or only `null` and `undefined` entries, all four return a predicate that returns `false`. `not` requires one callback.

Synchronous helpers treat promises as ordinary values. Use `pipeAsync`,
`attemptResultAsync`, `tapAsync` and `repeatAsync` when results must be awaited.
For predicates, `andAsync`, `orAsync`, `xorAsync`, `norAsync` and `notAsync` create wrappers that always
return `Promise<boolean>`, awaiting callback results while passing arguments unchanged.
The async variants follow the same short-circuit and empty-input rules.
`whenAsync` and `ifElseAsync`
await their predicates before running the selected transform or branch, then
await its result. Their factories validate all required callbacks immediately.

<!-- prettier-ignore -->
```javascript
const { andAsync, ifElseAsync } = require('go-fns');

async function main() {
  const isInRange = andAsync(value => value > 0, async value => value < 10);
  const describe = ifElseAsync(
    isInRange,
    async value => 'Accepted: ' + value,
    value => 'Outside range: ' + value
  );

  console.log(await describe(3));             // => 'Accepted: 3'
  console.log(await describe(12));            // => 'Outside range: 12'
}

main();
```

Async predicate wrappers cannot be used with `Array.prototype.filter` or synchronous
go-types matcher callbacks: those APIs treat their promises as truthy. Use
`await whenAsync(predicate, transform)(value)` for a one-off transformation
with an awaited predicate.

Returned wrappers forward the caller's receiver. `attempt`, its result variants,
`repeat` and `repeatAsync` instead use the callback itself as its receiver.
`applyIf` forwards its caller's receiver, and `result` calls its callback without
forwarding a receiver. Use `method.bind(owner)` for callbacks that need a specific
object as `this`. Required callbacks are validated
before execution. `pipe` and logical combinators skip nullish entries; empty
pipelines return `undefined`. Empty logical predicates return `false`, or resolve to
`false` for async variants.

`debounce` defaults to trailing-only execution. `throttle` defaults to both edges.
Calling a wrapper gives you its most recent callback return value, or `undefined`
before the first successful return. For example, `await debouncedSave(value)`
may await a promise from an earlier save or complete before the scheduled save starts.
Schedulers limit invocation starts and allow asynchronous work to overlap.
Handle promise rejections inside the callback or track completion separately.

Host timers may run late. On a wrapper such as `debouncedSave`, `cancel()` discards
pending work, `flush()` runs eligible work immediately, and `pending()` checks
whether an invocation is scheduled. Work already started continues. Cancel pending
work during cleanup.

See [Behaviour in the full reference](docs/API.md#behaviour) for validation, receiver,
empty-input, timing and argument-adaptation contracts.

## TypeScript

TypeScript declarations are included; no separate `@types` package is required.

The declarations infer callback inputs and results and retain argument and receiver requirements. They support default and named imports, CommonJS imports, individual function paths and existing public `src/` module paths.

For named function-subpath imports, use `Node16`, `NodeNext` or `Bundler` module resolution. Legacy `Node` resolution supports CommonJS and default function imports with the configured interop setting; use named root imports for that resolution mode.

Consumer declarations support TypeScript 5.4 or later. See the [typing contracts and tested compiler versions](docs/API.md#typescript) for inference and receiver limitations.

```typescript
import { pipe, pipeAsync, attemptResult, type Result } from 'go-fns';

const titleLength = pipe(
  (title: string) => title.trim(),
  (title) => title.length
);
const length: number = titleLength(' Hello ');

const asyncLength = pipeAsync(
  async (title: string) => title.trim(),
  (title) => title.length
); // (title: string) => Promise<number>

const result: Result<number> = attemptResult((n: number) => n * 2, 3);
if (result.ok) {
  console.log(result.value); // number
} else {
  // error is unknown: JavaScript can throw values other than Error objects.
  console.error(result.error);
}
```

Dense pipelines infer up to eight stages; dynamic, overloaded and highly polymorphic
callbacks may need typed adapters. See [TypeScript in the full reference](docs/API.md#typescript)
for inference, receiver and timer-handle limits.

## Performance

The synchronous invocation paths avoid unnecessary argument arrays; partial
application wrappers also avoid an intermediate rest-array/concat pair. Async
helpers have separate implementations and do not add promise checks to the
synchronous helpers.

The [historical performance record](https://github.com/koyote130708/go-fns/blob/master/docs/performance.md)
contains Node and Chromium measurements and fingerprinted baselines. Its 2.0.x
and 2.2.x labels identify unreleased development snapshots, not published releases.
Those original labels and measurements remain unchanged so the results can be
reproduced. They are not measurements of version 2.0.0 or a promise of
whole-application speedups; some workloads were slower.

See the [development guide](https://github.com/koyote130708/go-fns/blob/master/docs/project-validation.md#benchmarks-and-historical-evidence) for benchmark commands and output handling.

## Migration

Version 2.0.0 retains the ten original root exports and adds TypeScript declarations
and utilities for async composition, results, scheduling and argument adaptation.
See [Upgrading from 1.0.0](CHANGELOG.md#upgrading-from-100) for changes to receiver
forwarding, repetition counts, runtime requirements and internal import paths.

## Development

Use npm for development. Contributor tools require Node.js 22.16.0 or later, excluding Node.js 23. This requirement is separate from [consumer runtime support](#runtime-support).

```sh
npm ci
npm run build
npm test
```

Edit `scripts/README.template.md` and `scripts/API.template.md`. `npm run build` regenerates `README.md` and `docs/API.md`, then assembles the consumer package under `package/`, including the browser bundles in `package/dist/`. Use `npm run docs` for documentation-only updates.

`npm run test:docs` checks both generated files, links, public API coverage, executable examples and TypeScript snippets. Both documents ship with the package. The installed-package checks run the CommonJS examples on the selected consumer runtimes, including Node.js 8.0.0 in the standard gate.

Run the complete standard gate with the exact Node.js 8.0.0 consumer executable:

```sh
npm run verify -- --node8 /path/to/node-8.0.0
```

`npm run verify` builds and packs one candidate, then checks lint, formatting, generated documentation, source coverage, declarations, build recovery, tooling, package contents and installed consumers. `npm run verify:all` adds Chromium, Firefox and WebKit checks against the same archive, including the browser bundles and README example. `GO_FNS_NODE8` can supply the exact executable instead of `--node8`.

The coverage badge measures executable source-line coverage. The documentation badge measures public API reference coverage. Neither badge guarantees correctness for every input. See the [development guide](https://github.com/koyote130708/go-fns/blob/master/docs/project-validation.md)
for coverage scope, exact-runtime checks, build recovery, local package use,
browser setup, release procedures and benchmark commands.

## Further reading

- [Full API documentation](docs/API.md): parameters, return values, errors, examples and shared contracts.
- [Development guide](https://github.com/koyote130708/go-fns/blob/master/docs/project-validation.md): contributor setup, verification, build, release and benchmark procedures.
- [Changelog](CHANGELOG.md): releases and migration notes.
- [Historical performance record](https://github.com/koyote130708/go-fns/blob/master/docs/performance.md): workloads and baseline results.

## Licence

Licensed under the [MIT licence](LICENSE.md).
