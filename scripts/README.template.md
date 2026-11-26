# Go Functions

**A collection of JavaScript utilities for working with functions and their results.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)

- **Version:** [{{VERSION}}](CHANGELOG.md)
- **Licence:** [{{LICENSE}}](LICENSE.md)

Build synchronous or asynchronous pipelines, observe intermediate values, and combine predicates. Adapt callback arguments, capture success or failure, and reuse results from matching calls. Schedule callbacks and control how often they run.

No runtime dependencies. TypeScript declarations included.

**[View full API documentation](docs/API.md)**

## Contents

{{TOC}}

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
| Cancellation | [`sleep`](docs/API.md#sleepmilliseconds-options) accepts an AbortSignal-compatible object supplied by the host; native `AbortController` and `AbortSignal` constructors are optional. |

`performance` and its `now` method are optional: schedulers fall back to `Date.now()`.
Timer operations need host timers; importing the library and using unrelated functions do not.
The host can be exposed through `globalThis`, `self`, `global` or `window`; no individual
alias is mandatory. See [Optional host capabilities](docs/API.md#optional-host-capabilities)
for fallback and failure behaviour.

The library installs no global polyfills. See [Development](#development) for the separate contributor runtime requirement.

## Usage

### ES modules

Build a title formatter that trims whitespace and fills in blank titles.

<!-- prettier-ignore -->
```javascript
import { pipe, when } from 'go-fns';

const prepareTitle = pipe(
  title => title.trim(),
  when(title => title.length === 0, () => 'Untitled')
);

prepareTitle('  Draft  ');     // => "Draft"
prepareTitle('   ');           // => "Untitled"
```

A default import (`import Functions from 'go-fns'`) exposes the complete public API object. The package entry is CommonJS; Node loads these ES module imports through its CommonJS interoperability.

### CommonJS

<!-- prettier-ignore -->
```javascript
const { pipe, when } = require('go-fns');

const prepareTitle = pipe(
  title => title.trim(),
  when(title => title.length === 0, () => 'Untitled')
);

prepareTitle('  Draft  ');     // => "Draft"
prepareTitle('   ');           // => "Untitled"
```

### Function subpaths

Import [`pipe`](docs/API.md#pipefns) or [`when`](docs/API.md#whenpredicate-transform) directly when you only need one function. Every top-level function has an individual import path. CommonJS returns the
same callable directly; ES modules provide both named and default exports, such
as `import { pipe } from 'go-fns/pipe'` or `import pipe from 'go-fns/pipe'`.

<!-- prettier-ignore -->
```javascript
const pipe = require('go-fns/pipe');
const when = require('go-fns/when');

const prepareTitle = pipe(
  title => title.trim(),
  when(title => title.length === 0, () => 'Untitled')
);

prepareTitle('  Draft  ');     // => "Draft"
prepareTitle('   ');           // => "Untitled"
```

These entries share function identity with named root imports
and load the function's implementation directly. Existing public `src/` imports,
with or without `.js`, remain supported, including `go-fns/src/pipe` and
`go-fns/src/logic/not.js`.

### Browser

Load Go Functions from jsDelivr or host a bundle yourself:

- [Minified bundle](https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-fns.min.js)
- [Readable bundle](https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-fns.js)

The bundle exposes `Functions`:

<!-- prettier-ignore -->
```html
<script src="https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-fns.min.js"></script>
<script>
  const { pipe, when } = Functions;
  const prepareTitle = pipe(
    title => title.trim(),
    when(title => title.length === 0, () => 'Untitled')
  );

  prepareTitle('  Draft  ');   // => "Draft"
  prepareTitle('   ');         // => "Untitled"
</script>
```

Both `dist/go-fns.js` and `dist/go-fns.min.js` expose the `Functions` UMD namespace.
The bundles also support CommonJS, AMD and Workers. A source checkout generates
these files in `package/dist/`; installed packages contain them in `dist/`.
Importing the library does not start timers, make network requests or access the DOM.

## Common tasks

<!-- prettier-ignore -->
| Task | API |
| --- | --- |
| [Choose a conditional helper](#choose-a-conditional-helper) | [`applyIf`](docs/API.md#applyifvalue-condition-transform), [`when`](docs/API.md#whenpredicate-transform), [`ifElse`](docs/API.md#ifelsepredicate-ontrue-onfalse) |
| [Observe a pipeline](#observe-a-pipeline) | [`pipe`](docs/API.md#pipefns), [`tap`](docs/API.md#tapobserver), [`tapAsync`](docs/API.md#tapasyncobserver) |
| [Combine predicates](#combine-predicates) | [`and`](docs/API.md#andfns), [`or`](docs/API.md#orfns), [`not`](docs/API.md#notfn), [`nor`](docs/API.md#norfns), [`xor`](docs/API.md#xorfns) |
| [Handle values and callback outcomes](#handle-values-and-callback-outcomes) | [`result`](docs/API.md#resultvalue-args), [`attemptResult`](docs/API.md#attemptresultfn-args), [`attemptResultAsync`](docs/API.md#attemptresultasyncfn-args), [`attempt`](docs/API.md#attemptfn-args) |
| [Supply defaults to an existing function](#supply-defaults-to-an-existing-function) | [`withDefaultArgs`](docs/API.md#withdefaultargsfn-defaultargs) |
| [Choose a scheduling helper](#choose-a-scheduling-helper) | [`delay`](docs/API.md#delayfn-milliseconds-args), [`sleep`](docs/API.md#sleepmilliseconds-options), [`debounce`](docs/API.md#debouncefn-milliseconds-options), [`throttle`](docs/API.md#throttlefn-milliseconds-options) |

### Choose a conditional helper

Use [`applyIf`](docs/API.md#applyifvalue-condition-transform) when you have a value to process now. Use [`when`](docs/API.md#whenpredicate-transform) to build a
callback that transforms matching inputs and passes the rest through.
Use [`ifElse`](docs/API.md#ifelsepredicate-ontrue-onfalse) when you want to supply a different callback for each outcome.

<!-- prettier-ignore -->
```javascript
import { applyIf, ifElse, when } from 'go-fns';

const title = '  Draft  ';
const trimTitles = true;
const trimTitle = value => value.trim();
const isBlank = value => value.trim() === '';
const defaultTitle = () => 'Untitled';

applyIf(title, trimTitles, trimTitle);   // => 'Draft'

const fillBlankTitle = when(isBlank, defaultTitle);
[title, ''].map(fillBlankTitle);         // => ['  Draft  ', 'Untitled']

const formatTitle = ifElse(isBlank, defaultTitle, trimTitle);
formatTitle(title);                      // => 'Draft'
formatTitle('   ');                      // => 'Untitled'
```

### Observe a pipeline

Use [`tap`](docs/API.md#tapobserver) to log or record an intermediate value
in a pipeline. The next step receives the original value or reference.

<!-- prettier-ignore -->
```javascript
import { pipe, tap } from 'go-fns';

const observed = [];
const formatName = pipe(
  name => name.trim(),
  tap(name => observed.push(name)),
  name => name.toUpperCase()
);

formatName('  Ada  ');         // => 'ADA'
observed;                      // => ['Ada']
```

Use [`tapAsync`](docs/API.md#tapasyncobserver) in an async pipeline when
the next step needs to wait for the observation to finish. See how to
[record an audit entry before continuing the pipeline](docs/API.md#record-an-audit-entry-before-continuing-the-pipeline).

### Combine predicates

[`and`](docs/API.md#andfns), [`or`](docs/API.md#orfns), [`not`](docs/API.md#notfn), [`nor`](docs/API.md#norfns) and [`xor`](docs/API.md#xorfns) create predicates. The supplied callbacks run when you call the returned predicate.

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

### Handle values and callback outcomes

[`result(value, ...args)`](docs/API.md#resultvalue-args) accepts a fixed value or a callback that computes one.
It returns the value unchanged or calls the callback once and propagates any throw.
To use a function as the value, pass a callback that returns it.

Use [`attemptResult`](docs/API.md#attemptresultfn-args) to distinguish a normal return from a throw, or
[`attemptResultAsync`](docs/API.md#attemptresultasyncfn-args) to capture a promise rejection as well. Both use `ok` to
identify the outcome. [`attempt`](docs/API.md#attemptfn-args) returns the raw value in either case.

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

### Supply defaults to an existing function

Use [`withDefaultArgs(fn, ...defaultArgs)`](docs/API.md#withdefaultargsfn-defaultargs) when you cannot or do not want to edit a function's declaration. Defaults fill omitted or `undefined` arguments at their original positions; defined inputs replace them.

<!-- prettier-ignore -->
```javascript
import { withDefaultArgs } from 'go-fns';

const createEntry = (count, level) => ({ count, level });
const createEntryWithDefaults = withDefaultArgs(createEntry, 1, 'info');

createEntryWithDefaults();                    // => { count: 1, level: 'info' }
createEntryWithDefaults(undefined, 'error');  // => { count: 1, level: 'error' }
createEntryWithDefaults(0, '');               // => { count: 0, level: '' }
```

Defaults are captured once and retained by reference. The wrapper forwards its caller's `this`, extra arguments and callback result unchanged. See the [API reference](docs/API.md#withdefaultargsfn-defaultargs) for argument counts, native default initialisers and the [typing limits](docs/API.md#positional-default-arguments).

### Choose a scheduling helper

Use [`delay`](docs/API.md#delayfn-milliseconds-args) to schedule a callback and get its timer handle.
Await [`sleep`](docs/API.md#sleepmilliseconds-options) to pause the current async operation.

<!-- prettier-ignore -->
```javascript
import { delay, sleep } from 'go-fns';

async function main() {
  const messages = [];
  const reminder = delay(() => messages.push('Reminder'), 10);
  clearTimeout(reminder); // Cancel the scheduled callback.

  await sleep(20);
  messages.push('Resumed');
  messages;                    // => ['Resumed']
}

main();
```

By default, [`debounce`](docs/API.md#debouncefn-milliseconds-options) waits for a pause in activity,
while [`throttle`](docs/API.md#throttlefn-milliseconds-options) limits how often work starts while calls continue.

<!-- prettier-ignore -->
```javascript
import { debounce, throttle } from 'go-fns';

const searches = [];
const search = debounce(text => searches.push(text), 1000);
search('c');
search('cat');
searches;                      // => []
search.flush(); // Run the latest search immediately for this example.
searches;                      // => ['cat']

const progress = [];
const report = throttle(value => progress.push(value), 1000);
report(10);
report(20);
report.cancel(); // Discard the pending trailing report.
progress;                      // => [10]
```

See [scheduler results and cancellation](#scheduler-results-and-cancellation) for the rules on awaiting and cancelling work.

## API summary

See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.

{{API_SUMMARY}}

## Behaviour

### Synchronous results and promises

Synchronous helpers treat promises as ordinary values. Use [`pipeAsync`](docs/API.md#pipeasyncfns),
[`attemptResultAsync`](docs/API.md#attemptresultasyncfn-args), [`tapAsync`](docs/API.md#tapasyncobserver) and [`repeatAsync`](docs/API.md#repeatasyncfn-count-args) when results must be awaited.
For predicates, [`andAsync`](docs/API.md#andasyncfns), [`orAsync`](docs/API.md#orasyncfns), [`xorAsync`](docs/API.md#xorasyncfns), [`norAsync`](docs/API.md#norasyncfns) and [`notAsync`](docs/API.md#notasyncfn) create wrappers that always
return `Promise<boolean>`, awaiting callback results while passing arguments unchanged.
The async variants follow the same short-circuit and empty-input rules.
[`whenAsync`](docs/API.md#whenasyncpredicate-transform) and [`ifElseAsync`](docs/API.md#ifelseasyncpredicate-ontrue-onfalse)
await their predicates before running the selected transform or branch, then
await its result. Their factories validate all required callbacks immediately.

Async predicate wrappers cannot be used with `Array.prototype.filter` or synchronous
go-types matcher callbacks: those APIs treat their promises as truthy. Use
`await whenAsync(predicate, transform)(value)` for a one-off transformation
with an awaited predicate.

### Validate callbacks and preserve receivers

Returned wrappers forward the caller's receiver. [`attempt`](docs/API.md#attemptfn-args), its result variants,
[`repeat`](docs/API.md#repeatfn-count-args) and [`repeatAsync`](docs/API.md#repeatasyncfn-count-args) instead use the callback itself as its receiver.
[`applyIf`](docs/API.md#applyifvalue-condition-transform) forwards its caller's receiver, and [`result`](docs/API.md#resultvalue-args) calls its callback without
forwarding a receiver. Use `method.bind(owner)` for callbacks that need a specific
object as `this`. Required callbacks are validated
before execution.

### Predicate evaluation and empty inputs

The multi-predicate helpers evaluate from left to right. [`and`](docs/API.md#andfns) stops at the first falsy result. [`or`](docs/API.md#orfns) and [`nor`](docs/API.md#norfns) stop at the first truthy result. [`xor`](docs/API.md#xorfns) succeeds when **exactly one** result is truthy and stops at the second truthy result. With no predicates, or only `null` and `undefined` entries, all four return a predicate that returns `false`. [`not`](docs/API.md#notfn) requires one callback.

[`pipe`](docs/API.md#pipefns) and [`pipeAsync`](docs/API.md#pipeasyncfns) skip nullish stages. Calling a pipeline
with no remaining stages returns `undefined` or resolves to it.

### Cached results

[`once`](docs/API.md#oncefn) reuses the first outcome across all calls. [`memoize`](docs/API.md#memoizefn-options)
reuses a result when the receiver and every argument match. It bounds the cache,
keeps returned promises by identity, and retries synchronous throws. Use
[`clear()`](docs/API.md#memoizedfnclear) when cached results could be stale.

### Scheduler results and cancellation

[`debounce`](docs/API.md#debouncefn-milliseconds-options) defaults to trailing-only execution. [`throttle`](docs/API.md#throttlefn-milliseconds-options) defaults to both edges.
Calling a wrapper gives you its most recent callback return value, or `undefined`
before the first successful return. For example, `await debouncedSave(value)`
may await a promise from an earlier save or complete before the scheduled save starts.
Schedulers limit invocation starts and allow asynchronous work to overlap.
Handle promise rejections inside the callback or track completion separately.

Host timers may run late. On a debounced wrapper, [`cancel()`](docs/API.md#debouncedfncancel) discards
pending work, [`flush()`](docs/API.md#debouncedfnflush) runs eligible work immediately, and
[`pending()`](docs/API.md#debouncedfnpending) checks whether an invocation is scheduled.
Throttled wrappers provide the same controls. Work already started continues.
Cancel pending work during cleanup.

See [Behaviour in the full reference](docs/API.md#behaviour) for validation, receiver,
empty-input, timing and argument-adaptation contracts.

## TypeScript

TypeScript declarations are included; no separate `@types` package is required.

The declarations infer callback inputs and results and retain argument and receiver requirements. They support default and named imports, CommonJS imports, individual function paths and existing public `src/` module paths.

For named function-subpath imports, use `Node16`, `NodeNext` or `Bundler` module resolution. Legacy `Node` resolution supports CommonJS and default function imports with the configured interop setting; use named root imports for that resolution mode.

Consumer declarations support TypeScript 5.4 or later. See the [typing contracts and tested compiler versions](docs/API.md#typescript) for inference and receiver limitations.

For mixed `import`/`require` projects using `module: "preserve"` with
`moduleResolution: "bundler"`, use TypeScript 5.8.3 or later. TypeScript 5.4.5 has
an import-order-dependent resolution limitation for function subpaths in that configuration.

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

The [historical performance record](https://github.com/fishgoldworks/go-fns/blob/master/docs/performance.md)
contains Node and Chromium measurements and fingerprinted baselines. Its 2.0.x
and 2.2.x labels identify unreleased development snapshots, not published releases.
Those original labels and measurements remain unchanged so the results can be
reproduced. They are not measurements of version 2.0.0 or a promise of
whole-application speedups; some workloads were slower.

See the [development guide](https://github.com/fishgoldworks/go-fns/blob/master/CONTRIBUTING.md#benchmarks-and-historical-evidence) for benchmark commands and output handling.

## Migration

When upgrading from 1.0.0:

- Use Node.js 8.0.0 or later for CommonJS; check the [requirements for other formats](#runtime-support).
- Bind callbacks that need a fixed `this`. Wrappers from [`pipe`](docs/API.md#pipefns), [`spread`](docs/API.md#spreadfn) and predicate combinators now forward the caller's exact receiver.
- Use non-negative integer counts for [`repeat`](docs/API.md#repeatfn-count-args); strings and fractions now fail before the callback runs.
- Handle invalid required callbacks as `TypeError`; validation no longer coerces inputs or preserves the former error message text.
- Replace internal helper imports with application-owned validation and use [public function imports](#function-subpaths).
- If using the included declarations, use TypeScript 5.4 or later and review the [declaration and resolution requirements](#typescript).
- For local installs, build and install `package/` or the verified tarball instead of the private development root.

See the [complete 1.0.0 upgrade steps](CHANGELOG.md#upgrading-from-100) for receiver rules, removed import paths and examples.

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

The coverage badge measures executable source-line coverage. The documentation badge measures public API reference coverage. Neither badge guarantees correctness for every input. See the [development guide](https://github.com/fishgoldworks/go-fns/blob/master/CONTRIBUTING.md)
for coverage scope, exact-runtime checks, build recovery, local package use,
browser setup, release procedures and benchmark commands.

## Further reading

- [Full API documentation](docs/API.md): parameters, return values, errors, examples and shared contracts.
- [Development guide](https://github.com/fishgoldworks/go-fns/blob/master/CONTRIBUTING.md): contributor setup, verification, build, release and benchmark procedures.
- [Changelog](CHANGELOG.md): releases and migration notes.
- [Historical performance record](https://github.com/fishgoldworks/go-fns/blob/master/docs/performance.md): workloads and baseline results.

## Licence

Licensed under the [MIT licence](LICENSE.md).
