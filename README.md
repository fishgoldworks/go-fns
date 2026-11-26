# Go Functions

**A collection of JavaScript utilities for working with functions and their results.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)

- **Version:** [2.0.0](CHANGELOG.md)
- **Licence:** [MIT](LICENSE.md)

Build synchronous or asynchronous pipelines, observe intermediate values, and combine predicates. Adapt callback arguments, capture success or failure, and reuse results from matching calls. Schedule callbacks and control how often they run.

No runtime dependencies. TypeScript declarations included.

**[View full API documentation](docs/API.md)**

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Common tasks](#common-tasks)
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

- [Minified bundle](https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js)
- [Readable bundle](https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.js)

The bundle exposes `Functions`:

<!-- prettier-ignore -->
```html
<script src="https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js"></script>
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

[Composition and observation](#composition-and-observation) · [Predicate logic](#predicate-logic) · [Conditional transformations](#conditional-transformations) · [Argument adaptation](#argument-adaptation) · [Execution and outcomes](#execution-and-outcomes) · [Scheduling and cancellation](#scheduling-and-cancellation)

### Composition and observation

| API | Description | Returns |
| --- | --- | --- |
| [`pipe(...fns)`](docs/API.md#pipefns) | Creates a reusable pipeline that passes each stage's result directly to the next. | **`Function`** — `(...args) => T \| undefined`<br><br>A pipeline that returns the last stage result, or `undefined` when there are no stages. |
| [`pipeAsync(...fns)`](docs/API.md#pipeasyncfns) | Creates a reusable pipeline that awaits each stage's result before passing it onward. | **`Function`** — `(...args) => Promise<Awaited<T> \| undefined>`<br><br>A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages. |
| [`tap(observer)`](docs/API.md#tapobserver) | Creates a function that observes an intermediate value in a pipeline and passes the original input onward. | **`Function`** — `(value: V) => V`<br><br>A wrapper that calls the observer and returns the exact input value or reference. |
| [`tapAsync(observer)`](docs/API.md#tapasyncobserver) | Creates a function that awaits an observer before passing its input onward. | **`Function`** — `(value: V) => Promise<Awaited<V>>`<br><br>A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped. |

### Predicate logic

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

### Conditional transformations

| API | Description | Returns |
| --- | --- | --- |
| [`applyIf(value, condition, transform)`](docs/API.md#applyifvalue-condition-transform) | Applies a transformation immediately when a boolean flag is `true` or a predicate returns a truthy value. Otherwise, returns the original input. | **`T \| V`**<br><br>The exact transformation result or original input; promises are not awaited. |
| [`when(predicate, transform)`](docs/API.md#whenpredicate-transform) | Creates a reusable function that transforms an input when a predicate passes and otherwise passes the input through. | **`Function`** — `(value: V) => V \| T`<br><br>A wrapper returning the transform result for a truthy predicate result, or the original input otherwise. |
| [`whenAsync(predicate, transform)`](docs/API.md#whenasyncpredicate-transform) | Creates a conditional transformation that awaits the predicate before deciding whether to transform the input. | **`Function`** — `(value: V) => Promise<Awaited<V \| T>>`<br><br>A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. |
| [`ifElse(predicate, onTrue, onFalse)`](docs/API.md#ifelsepredicate-ontrue-onfalse) | Creates a reusable function that chooses between two callbacks based on a predicate result. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise. |
| [`ifElseAsync(predicate, onTrue, onFalse)`](docs/API.md#ifelseasyncpredicate-ontrue-onfalse) | Creates a reusable function that awaits a predicate, then runs and awaits the selected branch. | **`Function`** — `(...args) => Promise<Awaited<T>>`<br><br>A wrapper resolving to the awaited result of `onTrue` for a truthy decision, or `onFalse` otherwise. |

### Argument adaptation

| API | Description | Returns |
| --- | --- | --- |
| [`spread(fn)`](docs/API.md#spreadfn) | Creates a wrapper that lets a callback take an array-like argument list in place of separate arguments. | **`Function`** — `(args) => T`<br><br>A wrapper that spreads the supplied argument list and returns the callback result. |
| [`partial(fn, ...args)`](docs/API.md#partialfn-args) | Creates a specialised function with leading arguments supplied in advance, without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after prepending the saved arguments. |
| [`partialRight(fn, ...args)`](docs/API.md#partialrightfn-args) | Creates a specialised function that appends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after appending the saved arguments. |
| [`withDefaultArgs(fn, ...defaultArgs)`](docs/API.md#withdefaultargsfn-defaultargs) | Supplies positional defaults to an existing function when arguments are omitted or `undefined`. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after substituting defaults. |
| [`unary(fn)`](docs/API.md#unaryfn) | Creates a wrapper that forwards exactly one argument, so extra arguments from callers such as `map` stay out of the callback. | **`Function`** — `(value) => T`<br><br>A wrapper returning the callback result after passing exactly one argument. |
| [`ary(fn, count)`](docs/API.md#aryfn-count) | Limits how many arguments a callback receives. | **`Function`** — `(...args) => T`<br><br>A wrapper that passes up to `count` supplied arguments and returns the callback result. |

### Execution and outcomes

| API | Description | Returns |
| --- | --- | --- |
| [`result(value, ...args)`](docs/API.md#resultvalue-args) | Returns a fixed value unchanged or calls a supplied function once to compute the value. | **`T \| V`**<br><br>The exact callback result or original value; promises are not awaited. |
| [`attempt(fn, ...args)`](docs/API.md#attemptfn-args) | Invokes a callback synchronously and returns its result or the exact value it throws. | **`unknown`**<br><br>The callback result, or the exact value thrown synchronously. |
| [`attemptResult(fn, ...args)`](docs/API.md#attemptresultfn-args) | Invokes a callback synchronously and reports success or failure in a result object. | **`Result<T>`**<br><br>A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw. |
| [`attemptResultAsync(fn, ...args)`](docs/API.md#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`once(fn)`](docs/API.md#oncefn) | Creates a function that invokes its callback at most once and caches the first outcome. | **`Function`** — `(...args) => T`<br><br>A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls. |
| [`memoize(fn, options?)`](docs/API.md#memoizefn-options) | Reuses results for matching receivers and complete argument lists. | **`Function`** — `(...args) => T`<br><br>A wrapper that returns a cached or freshly computed result and provides [`clear()`](docs/API.md#memoizedfnclear). |
| [`memoizedFn.clear()`](docs/API.md#memoizedfnclear) | Clears all cached results from the function returned by `memoize`. | **`undefined`**<br><br>`undefined` after clearing the cache. |
| [`repeat(fn, count?, ...args)`](docs/API.md#repeatfn-count-args) | Invokes a callback a specified number of times synchronously and collects its results. | **`T[]`**<br><br>A fresh array containing each synchronous callback result in invocation order. |
| [`repeatAsync(fn, count?, ...args)`](docs/API.md#repeatasyncfn-count-args) | Invokes a callback a specified number of times sequentially, awaiting each result. | **`Promise<Awaited<T>[]>`**<br><br>A promise resolving to a fresh array of sequentially awaited callback results in invocation order. |

### Scheduling and cancellation

| API | Description | Returns |
| --- | --- | --- |
| [`delay(fn, milliseconds?, ...args)`](docs/API.md#delayfn-milliseconds-args) | Schedules a callback to run later and returns a timer handle you can use to cancel it. | **`TimerHandle`**<br><br>The native timeout handle: a browser number or a Node.js `Timeout` object. |
| [`sleep(milliseconds?, options?)`](docs/API.md#sleepmilliseconds-options) | Creates a promise you can await to pause an asynchronous operation, with optional cancellation. | **`Promise<void>`**<br><br>A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted. |
| [`debounce(fn, milliseconds?, options?)`](docs/API.md#debouncefn-milliseconds-options) | Creates a function that combines a burst of calls, waiting for a pause by default. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](docs/API.md#debouncedfncancel), [`flush`](docs/API.md#debouncedfnflush) and [`pending`](docs/API.md#debouncedfnpending) methods. |
| [`debouncedFn.cancel()`](docs/API.md#debouncedfncancel) | Discards pending calls to the function returned by [`debounce`](docs/API.md#debouncefn-milliseconds-options) and resets its scheduling. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`debouncedFn.flush()`](docs/API.md#debouncedfnflush) | Immediately runs eligible work scheduled by the function returned by [`debounce`](docs/API.md#debouncefn-milliseconds-options), or returns the most recent callback result. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`debouncedFn.pending()`](docs/API.md#debouncedfnpending) | Checks whether the function returned by [`debounce`](docs/API.md#debouncefn-milliseconds-options) has a callback invocation scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |
| [`throttle(fn, milliseconds?, options?)`](docs/API.md#throttlefn-milliseconds-options) | Creates a function that limits how often repeated calls start work while calls continue. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](docs/API.md#throttledfncancel), [`flush`](docs/API.md#throttledfnflush) and [`pending`](docs/API.md#throttledfnpending) methods. |
| [`throttledFn.cancel()`](docs/API.md#throttledfncancel) | Discards pending calls to the function returned by [`throttle`](docs/API.md#throttlefn-milliseconds-options) and resets its scheduling. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`throttledFn.flush()`](docs/API.md#throttledfnflush) | Immediately runs eligible work scheduled by the function returned by [`throttle`](docs/API.md#throttlefn-milliseconds-options), or returns the most recent callback result. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`throttledFn.pending()`](docs/API.md#throttledfnpending) | Checks whether the function returned by [`throttle`](docs/API.md#throttlefn-milliseconds-options) has a callback invocation scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |

`memoizedFn`, `debouncedFn` and `throttledFn` refer to the functions returned by [`memoize`](docs/API.md#memoizefn-options), [`debounce`](docs/API.md#debouncefn-milliseconds-options) and [`throttle`](docs/API.md#throttlefn-milliseconds-options), respectively.

The public API includes standalone functions and the documented methods on returned wrappers. A `?` marks an optional parameter. `T` denotes a callback or branch result and `V` the input value type; async result helpers await their results. Signatures summarise call shapes; the full declarations preserve argument and receiver constraints. `TimerHandle` follows the host timer type. See [TypeScript](docs/API.md#typescript) for inference and receiver requirements.

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
