# Go Functions API

[← Back to README](../README.md)

Full API documentation for [go-fns {{VERSION}}](../CHANGELOG.md).

[Runtime support](../README.md#runtime-support)

## Contents

{{TOC}}

## API summary

<!-- prettier-ignore-start -->

**Composition and observation**

| API | Description | Returns |
| --- | --- | --- |
| [`pipe(...fns)`](#pipefns) | Creates a reusable pipeline that passes each stage's result directly to the next. | **`Function`** — `(...args) => T \| undefined`<br><br>A pipeline that returns the last stage result, or `undefined` when there are no stages. |
| [`pipeAsync(...fns)`](#pipeasyncfns) | Creates a reusable pipeline that awaits each stage's result before passing it onward. | **`Function`** — `(...args) => Promise<Awaited<T> \| undefined>`<br><br>A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages. |
| [`tap(observer)`](#tapobserver) | Creates a function that observes an intermediate value in a pipeline and passes the original input onward. | **`Function`** — `(value: V) => V`<br><br>A wrapper that calls the observer and returns the exact input value or reference. |
| [`tapAsync(observer)`](#tapasyncobserver) | Creates a function that awaits an observer before passing its input onward. | **`Function`** — `(value: V) => Promise<Awaited<V>>`<br><br>A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped. |

**Predicate logic**

| API | Description | Returns |
| --- | --- | --- |
| [`and(...fns)`](#andfns) | Creates a predicate that determines whether all supplied predicates return truthy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are truthy; otherwise `false`. |
| [`andAsync(...fns)`](#andasyncfns) | Creates a predicate that awaits results in order and determines whether all are truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if at least one predicate is supplied and all awaited results are truthy; otherwise `false`. |
| [`or(...fns)`](#orfns) | Creates a predicate that determines whether any supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if any result is truthy; otherwise `false`. |
| [`orAsync(...fns)`](#orasyncfns) | Creates a predicate that awaits results in order and determines whether any is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if any awaited result is truthy; otherwise `false`. |
| [`not(fn)`](#notfn) | Creates a predicate that negates its callback's truthiness. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if the callback result is falsy; otherwise `false`. |
| [`notAsync(fn)`](#notasyncfn) | Creates a predicate that awaits its callback result and negates its truthiness. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if the awaited callback result is falsy; otherwise `false`. |
| [`nor(...fns)`](#norfns) | Creates a predicate that determines whether all supplied predicates return falsy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are falsy; otherwise `false`. |
| [`norAsync(...fns)`](#norasyncfns) | Creates a predicate that awaits results in order and determines whether all are falsy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` if at least one predicate is supplied and all awaited results are falsy; otherwise `false`. |
| [`xor(...fns)`](#xorfns) | Creates a predicate that determines whether exactly one supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if exactly one result is truthy; otherwise `false`. |
| [`xorAsync(...fns)`](#xorasyncfns) | Creates a predicate that awaits results in order and determines whether exactly one is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` for exactly one truthy result; it stops at the second truthy result and otherwise resolves to `false`. |

**Conditional transformations**

| API | Description | Returns |
| --- | --- | --- |
| [`applyIf(value, condition, transform)`](#applyifvalue-condition-transform) | Applies a transformation immediately when a boolean flag is `true` or a predicate returns a truthy value. Otherwise, returns the original input. | **`T \| V`**<br><br>The exact transformation result or original input; promises are not awaited. |
| [`when(predicate, transform)`](#whenpredicate-transform) | Creates a reusable function that transforms an input when a predicate passes and otherwise passes the input through. | **`Function`** — `(value: V) => V \| T`<br><br>A wrapper returning the transform result for a truthy predicate result, or the original input otherwise. |
| [`whenAsync(predicate, transform)`](#whenasyncpredicate-transform) | Creates a conditional transformation that awaits the predicate before deciding whether to transform the input. | **`Function`** — `(value: V) => Promise<Awaited<V \| T>>`<br><br>A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. |
| [`ifElse(predicate, onTrue, onFalse)`](#ifelsepredicate-ontrue-onfalse) | Creates a reusable function that chooses between two callbacks based on a predicate result. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise. |
| [`ifElseAsync(predicate, onTrue, onFalse)`](#ifelseasyncpredicate-ontrue-onfalse) | Creates a reusable function that awaits a predicate, then runs and awaits the selected branch. | **`Function`** — `(...args) => Promise<Awaited<T>>`<br><br>A wrapper resolving to the awaited result of `onTrue` for a truthy decision, or `onFalse` otherwise. |

**Argument adaptation**

| API | Description | Returns |
| --- | --- | --- |
| [`spread(fn)`](#spreadfn) | Creates a wrapper that lets a callback take an array-like argument list in place of separate arguments. | **`Function`** — `(args) => T`<br><br>A wrapper that spreads the supplied argument list and returns the callback result. |
| [`partial(fn, ...args)`](#partialfn-args) | Creates a specialised function with leading arguments supplied in advance, without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after prepending the saved arguments. |
| [`partialRight(fn, ...args)`](#partialrightfn-args) | Creates a specialised function that appends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after appending the saved arguments. |
| [`withDefaultArgs(fn, ...defaultArgs)`](#withdefaultargsfn-defaultargs) | Supplies positional defaults to an existing function when arguments are omitted or `undefined`. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after substituting defaults. |
| [`unary(fn)`](#unaryfn) | Creates a wrapper that forwards exactly one argument, so extra arguments from callers such as `map` stay out of the callback. | **`Function`** — `(value) => T`<br><br>A wrapper returning the callback result after passing exactly one argument. |
| [`ary(fn, count)`](#aryfn-count) | Limits how many arguments a callback receives. | **`Function`** — `(...args) => T`<br><br>A wrapper that passes up to `count` supplied arguments and returns the callback result. |

**Execution and outcomes**

| API | Description | Returns |
| --- | --- | --- |
| [`result(value, ...args)`](#resultvalue-args) | Returns a fixed value unchanged or calls a supplied function once to compute the value. | **`T \| V`**<br><br>The exact callback result or original value; promises are not awaited. |
| [`attempt(fn, ...args)`](#attemptfn-args) | Invokes a callback synchronously and returns its result or the exact value it throws. | **`unknown`**<br><br>The callback result, or the exact value thrown synchronously. |
| [`attemptResult(fn, ...args)`](#attemptresultfn-args) | Invokes a callback synchronously and reports success or failure in a result object. | **`Result<T>`**<br><br>A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw. |
| [`attemptResultAsync(fn, ...args)`](#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`once(fn)`](#oncefn) | Creates a function that invokes its callback at most once and caches the first outcome. | **`Function`** — `(...args) => T`<br><br>A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls. |
| [`memoize(fn, options?)`](#memoizefn-options) | Reuses results for matching receivers and complete argument lists. | **`Function`** — `(...args) => T`<br><br>A wrapper that returns a cached or freshly computed result and provides [`clear()`](#memoizedfnclear). |
| [`memoizedFn.clear()`](#memoizedfnclear) | Clears all cached results from the function returned by `memoize`. | **`undefined`**<br><br>`undefined` after clearing the cache. |
| [`repeat(fn, count?, ...args)`](#repeatfn-count-args) | Invokes a callback a specified number of times synchronously and collects its results. | **`T[]`**<br><br>A fresh array containing each synchronous callback result in invocation order. |
| [`repeatAsync(fn, count?, ...args)`](#repeatasyncfn-count-args) | Invokes a callback a specified number of times sequentially, awaiting each result. | **`Promise<Awaited<T>[]>`**<br><br>A promise resolving to a fresh array of sequentially awaited callback results in invocation order. |

**Scheduling and cancellation**

| API | Description | Returns |
| --- | --- | --- |
| [`delay(fn, milliseconds?, ...args)`](#delayfn-milliseconds-args) | Schedules a callback to run later and returns a timer handle you can use to cancel it. | **`TimerHandle`**<br><br>The native timeout handle: a browser number or a Node.js `Timeout` object. |
| [`sleep(milliseconds?, options?)`](#sleepmilliseconds-options) | Creates a promise you can await to pause an asynchronous operation, with optional cancellation. | **`Promise<void>`**<br><br>A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted. |
| [`debounce(fn, milliseconds?, options?)`](#debouncefn-milliseconds-options) | Creates a function that combines a burst of calls, waiting for a pause by default. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](#debouncedfncancel), [`flush`](#debouncedfnflush) and [`pending`](#debouncedfnpending) methods. |
| [`debouncedFn.cancel()`](#debouncedfncancel) | Discards pending calls to the function returned by [`debounce`](#debouncefn-milliseconds-options) and resets its scheduling. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`debouncedFn.flush()`](#debouncedfnflush) | Immediately runs eligible work scheduled by the function returned by [`debounce`](#debouncefn-milliseconds-options), or returns the most recent callback result. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`debouncedFn.pending()`](#debouncedfnpending) | Checks whether the function returned by [`debounce`](#debouncefn-milliseconds-options) has a callback invocation scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |
| [`throttle(fn, milliseconds?, options?)`](#throttlefn-milliseconds-options) | Creates a function that limits how often repeated calls start work while calls continue. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](#throttledfncancel), [`flush`](#throttledfnflush) and [`pending`](#throttledfnpending) methods. |
| [`throttledFn.cancel()`](#throttledfncancel) | Discards pending calls to the function returned by [`throttle`](#throttlefn-milliseconds-options) and resets its scheduling. | **`undefined`**<br><br>`undefined` after discarding pending work; the most recent callback return value is retained. |
| [`throttledFn.flush()`](#throttledfnflush) | Immediately runs eligible work scheduled by the function returned by [`throttle`](#throttlefn-milliseconds-options), or returns the most recent callback result. | **`T \| undefined`**<br><br>The return value of eligible pending work run immediately, including a pending promise, or the previous value; `undefined` until the first successful return. |
| [`throttledFn.pending()`](#throttledfnpending) | Checks whether the function returned by [`throttle`](#throttlefn-milliseconds-options) has a callback invocation scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |

<!-- prettier-ignore-end -->

<!-- summary-notes:start -->

`memoizedFn`, `debouncedFn` and `throttledFn` refer to the functions returned by [`memoize`](#memoizefn-options), [`debounce`](#debouncefn-milliseconds-options) and [`throttle`](#throttlefn-milliseconds-options), respectively.

The public API includes standalone functions and the documented methods on returned wrappers. A `?` marks an optional parameter. `T` denotes a callback or branch result and `V` the input value type; async result helpers await their results. Signatures summarise call shapes; the full declarations preserve argument and receiver constraints. `TimerHandle` follows the host timer type. See [TypeScript](#typescript) for inference and receiver requirements.
<!-- summary-notes:end -->

## Composition and observation

### `pipe(...fns)`

Creates a reusable pipeline that passes each stage's result directly to the next.

The first stage receives all call arguments; each later stage receives the preceding result. Stages share the caller's `this`. Nullish stages are skipped, and promises are passed through without awaiting.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Stages in left-to-right order. Nullish entries are skipped; other invalid entries throw immediately. |

**Returns:** `Function` with signature `(...args) => T | undefined`. A pipeline that returns the last stage result, or `undefined` when there are no stages.

**Errors**

- `TypeError` if a stage is neither a function, `null` nor `undefined`.
- Errors thrown by any stage propagate unchanged when the pipeline runs.

**Examples**

**Basic usage**

<!-- prettier-ignore -->
```javascript
const { pipe } = require('go-fns');

const formatTag = pipe(tag => tag.trim().toLowerCase(), tag => '#' + tag);
formatTag('  Travel  ');                           // => '#travel'
```

**Additional behaviour**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { pipe } = require('go-fns');

pipe(Math.floor)(4.5);                             // => 4
pipe((a, b) => a + b, value => value * 2)(2, 3);   // => 10
pipe(null, value => value + 1, undefined)(2);      // => 3
pipe()(42);                                        // => undefined
assert.throws(() => pipe(123), TypeError);

const context = { multiplier: 3 };
const multiply = pipe(function (value) {
  return value * this.multiplier;
});
multiply.call(context, 4);                         // => 12
```

**Since:** 1.0.0.

---

### `pipeAsync(...fns)`

Creates a reusable pipeline that awaits each stage's result before passing it onward.

The first stage receives all call arguments; each later stage receives one awaited result. Stages share the caller's `this`. Nullish stages are skipped. Construction validates immediately; calling the pipeline starts the first stage and returns a promise.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Sequential stages. All entries are validated at construction; nullish entries are skipped. |

**Returns:** `Function` with signature `(...args) => Promise<Awaited<T> | undefined>`. A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages.

**Errors**

- `TypeError` if a stage is neither a function, `null` nor `undefined`.
- When called, the pipeline rejects with the original stage failure.

**Examples**

<!-- prettier-ignore -->
```javascript
const { pipeAsync } = require('go-fns');

async function main() {
  const loadTitles = pipeAsync(
    async forumId => [
      { forumId, title: 'Welcome to the community' },
      { forumId, title: 'Local recommendations' }
    ],
    threads => threads.map(thread => thread.title),
    titles => titles.sort()
  );

  await loadTitles('local-community');   // => ['Local recommendations', 'Welcome to the community']

  const doubleSum = pipeAsync(
    null, async (a, b) => a + b, undefined, n => n * 2
  );
  await doubleSum(2, 3);                 // => 10
  await pipeAsync()(42);                 // => undefined
}

main();
```

**Notes**

The result is a function that always returns a promise. The first stage begins during
invocation; later stages wait for the previous result. A throw or rejection stops
the sequence and rejects with the original failure. Thenables are assimilated.
There is no automatic retry, parallel execution or cancellation of stages.

**Since:** 2.0.0.

---

### `tap(observer)`

Creates a function that observes an intermediate value in a pipeline and passes the original input onward.

The observer receives the caller's `this`. Its return value is ignored without awaiting. Object identity is preserved, and mutations made by the observer remain visible.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `observer` | `Function` | Required observer. The wrapper forwards exactly one input and its caller’s receiver. |

**Returns:** `Function` with signature `(value: V) => V`. A wrapper that calls the observer and returns the exact input value or reference.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { pipe, tap } = require('go-fns');

const parsedPrices = [];
const priceInCents = pipe(
  Number,
  tap(price => parsedPrices.push(price)),
  price => Math.round(price * 100)
);

// The observer's push returns the array length. The next stage still receives 12.5.
priceInCents('12.50');                                           // => 1250
parsedPrices;                                                    // => [12.5]

const listing = { title: 'Desk' };
tap(value => { value.reviewed = true; })(listing) === listing;   // => true
listing.reviewed;                                                // => true
```

**Notes**

Observer exceptions propagate. Observer
promises are not awaited or handled; use [`tapAsync`](#tapasyncobserver) for asynchronous side effects.

**Async variant:** [`tapAsync`](#tapasyncobserver). **Since:** 2.0.0.

---

### `tapAsync(observer)`

Creates a function that awaits an observer before passing its input onward.

The observer receives exactly one input and the caller's `this`. A promise input reaches the observer unchanged, but the returned promise resolves to its awaited value.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `observer` | `Function` | Required synchronous or asynchronous observer; receives one input and the wrapper caller’s receiver. |

**Returns:** `Function` with signature `(value: V) => Promise<Awaited<V>>`. A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped.

**Errors**

- `TypeError` if `observer` is not a function.
- Later observer throws or rejections reject the wrapper promise.

**Examples**

#### Record an audit entry before continuing the pipeline

<!-- prettier-ignore -->
```javascript
const { pipeAsync, sleep, tapAsync } = require('go-fns');

async function main() {
  const audit = [];
  const saveListing = listing => Object.assign({}, listing, { id: 'listing-42' });
  const recordAudit = async listing => {
    await sleep(0); // Stand in for waiting for the audit write.
    audit.push(listing.id);
  };

  const publishListing = pipeAsync(
    saveListing,
    tapAsync(recordAudit),
    listing => ({ id: listing.id, recorded: audit.includes(listing.id) })
  );

  await publishListing({ title: 'Desk' });   // => { id: 'listing-42', recorded: true }
}

main();
```

**Notes**

The promise resolves only after the
observer settles successfully. If called directly with a promise or thenable input,
the observer receives that input unchanged, but returning it from the async wrapper
naturally assimilates it: the final result is its resolved value, not the original
promise's identity. **Since:** 2.0.0.

## Predicate logic

All logical helpers synchronously create predicate functions and validate every supplied entry during construction. Call the returned predicate to evaluate the callbacks with the same arguments and receiver. Synchronous predicates use the truthiness of each callback's return value. Async predicates await each reached callback result before testing its truthiness and resolve to a boolean.

Multi-predicate helpers evaluate from left to right and skip later callbacks once the outcome is decided.

<!-- prettier-ignore -->
| Helpers | Short-circuit trigger | Result |
| --- | --- | --- |
| [`and`](#andfns), [`andAsync`](#andasyncfns) | First falsy result | `false` |
| [`or`](#orfns), [`orAsync`](#orasyncfns) | First truthy result | `true` |
| [`nor`](#norfns), [`norAsync`](#norasyncfns) | First truthy result | `false` |
| [`xor`](#xorfns), [`xorAsync`](#xorasyncfns) | Second truthy result | `false` |

[`xor`](#xorfns) and [`xorAsync`](#xorasyncfns) succeed only when **exactly one** result is truthy. For all four pairs, an empty or all-nullish list produces a predicate that returns or resolves to `false`. The factories skip `null` and `undefined` entries. [`not`](#notfn) and [`notAsync`](#notasyncfn) require a callback and negate its result's truthiness.

### `and(...fns)`

Creates a predicate that determines whether all supplied predicates return truthy values.

Stops at the first falsy result. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty list returns `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if at least one predicate is supplied and all results are truthy; otherwise `false`.

**Errors**

- `TypeError` if an entry is neither a function, `null` nor `undefined`.
- All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { and } = require('go-fns');
const isNumber = value => typeof value === 'number';
const isPositive = value => value > 0;

const isPositiveNumber = and(isNumber, isPositive);
isPositiveNumber(3);                   // => true
and(isNumber, isPositive)(-3);         // => false
and(null, isPositive, undefined)(3);   // => true
and()();                               // => false
```

**Since:** 1.0.0.

---

### `andAsync(...fns)`

Creates a predicate that awaits results in order and determines whether all are truthy.

The returned predicate awaits each callback result from left to right, stopping at the first falsy result. Every reached callback receives the same call arguments and caller's `this`; input arguments are not awaited. Nullish predicates are skipped. An empty or all-nullish list resolves to `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates returning values, promises or thenables. Nullish entries are skipped; every supplied entry is validated synchronously when the wrapper is created. |

**Returns:** `Function` with signature `(...args) => Promise<boolean>`. A predicate whose promise resolves to `true` if at least one predicate is supplied and all awaited results are truthy; otherwise `false`.

**Errors**

- `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier predicate would short-circuit.
- A callback throw or rejected result rejects the returned predicate's promise with the exact same value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { and, andAsync } = require('go-fns');

async function main() {
  const isPositive = value => value > 0;
  const isBelowTen = async value => value < 10;

  await andAsync(isPositive, isBelowTen)(3);       // => true
  await andAsync(isPositive, isBelowTen)(12);      // => false
  await andAsync(null, isPositive, undefined)(3);  // => true
  await andAsync()();                              // => false
  await andAsync(null, undefined)();               // => false
  assert.throws(() => andAsync(() => false, 123), TypeError);

  const calls = [];
  const check = andAsync(
    value => { calls.push('first'); return value > 0; },
    async value => { calls.push('second'); return value < 10; },
    () => { calls.push('third'); return true; }
  );
  const outcome = check(12);
  calls;                                           // => ['first']
  await outcome;                                   // => false
  calls;                                           // => ['first', 'second']

  const sameArguments = andAsync(
    function (left, right) { return left + right === this.total; },
    async function (left, right) { return left < this.total && right < this.total; }
  );
  await sameArguments.call({ total: 5 }, 2, 3);    // => true
}

main();
```

**Notes**

The first reached callback starts during invocation. Each later callback starts only after the preceding result has been awaited, even when it is a synchronous value. Calls within one evaluation are sequential; concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0.

---

### `or(...fns)`

Creates a predicate that determines whether any supplied predicate returns a truthy value.

Stops at the first truthy result. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty list returns `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if any result is truthy; otherwise `false`.

**Errors**

- `TypeError` if an entry is neither a function, `null` nor `undefined`.
- All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { or } = require('go-fns');
const isString = value => typeof value === 'string';
const isNumber = value => typeof value === 'number';

const isTextOrNumber = or(isString, isNumber);
isTextOrNumber('abc');           // => true
or(isString, isNumber)(2);       // => true
or(isString, isNumber)(false);   // => false
or()();                          // => false
```

**Since:** 1.0.0.

---

### `orAsync(...fns)`

Creates a predicate that awaits results in order and determines whether any is truthy.

The returned predicate awaits each callback result from left to right, stopping at the first truthy result. Every reached callback receives the same call arguments and caller's `this`; input arguments are not awaited. Nullish predicates are skipped. An empty or all-nullish list resolves to `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates returning values, promises or thenables. Nullish entries are skipped; every supplied entry is validated synchronously when the wrapper is created. |

**Returns:** `Function` with signature `(...args) => Promise<boolean>`. A predicate whose promise resolves to `true` if any awaited result is truthy; otherwise `false`.

**Errors**

- `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier predicate would short-circuit.
- A callback throw or rejected result rejects the returned predicate's promise with the exact same value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { or, orAsync } = require('go-fns');

async function main() {
  const isText = value => typeof value === 'string';
  const isNumber = async value => typeof value === 'number';

  await orAsync(isText, isNumber)(2);                // => true
  await orAsync(isText, isNumber)(false);            // => false
  await orAsync(null, isText, undefined)('hello');   // => true
  await orAsync()();                                 // => false
  await orAsync(null, undefined)();                  // => false
  assert.throws(() => orAsync(() => true, 123), TypeError);

  const calls = [];
  const lookup = orAsync(
    () => { calls.push('cache'); return ''; },
    async () => { calls.push('remote'); return 'found'; },
    () => { calls.push('fallback'); return true; }
  );
  await lookup();                                    // => true
  calls;                                             // => ['cache', 'remote']
}

main();
```

**Notes**

The first reached callback starts during invocation. Each later callback starts only after the preceding result has been awaited, even when it is a synchronous value. Calls within one evaluation are sequential; concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0.

---

### `not(fn)`

Creates a predicate that negates its callback's truthiness.

Unlike the multi-predicate helpers, a missing or nullish callback is invalid. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required predicate; nullish values are invalid. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if the callback result is falsy; otherwise `false`.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { not } = require('go-fns');
const isString = value => typeof value === 'string';

const isNotString = not(isString);
isNotString(1);                                            // => true
not(isString)('abc');                                      // => false
[1, 2, 3.1].filter(not(Number.isInteger));                 // => [3.1]

const context = { enabled: true };
not(function () { return this.enabled; }).call(context);   // => false
```

**Since:** 1.0.0.

---

### `notAsync(fn)`

Creates a predicate that awaits its callback result and negates its truthiness.

The returned predicate forwards all call arguments and the caller's `this`, awaits the callback result and negates its JavaScript truthiness. Input arguments are not awaited. A missing or nullish callback is invalid.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required predicate returning a value, promise or thenable. Nullish values are invalid. |

**Returns:** `Function` with signature `(...args) => Promise<boolean>`. A predicate whose promise resolves to `true` if the awaited callback result is falsy; otherwise `false`.

**Errors**

- `TypeError` is thrown synchronously by the factory if `fn` is not a function.
- A callback throw or rejected result rejects the returned predicate's promise with the exact same value.

**Examples**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { not, notAsync } = require('go-fns');

async function main() {
  const isMissing = notAsync(async value => value);

  await isMissing('present');                        // => false
  await isMissing('');                               // => true
  await notAsync(() => 0)();                         // => true
  assert.throws(() => notAsync(), TypeError);
  assert.throws(() => notAsync(null), TypeError);

  const thenable = { then(resolve) { resolve(false); } };
  await notAsync(() => thenable)();                  // => true

  const input = Promise.resolve(false);
  const seesInput = notAsync(value => value === input);
  await seesInput(input);                            // => false

  const isDisabled = notAsync(function () { return this.enabled; });
  await isDisabled.call({ enabled: true });          // => false

  const reason = { message: 'unavailable' };
  const throws = notAsync(() => { throw reason; });
  const rejects = notAsync(() => Promise.reject(reason));
  await throws().catch(error => error === reason);   // => true
  await rejects().catch(error => error === reason);  // => true
}

main();
```

**Notes**

The callback starts during invocation; the returned predicate always returns a promise, including for synchronous values and throws. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0.

---

### `nor(...fns)`

Creates a predicate that determines whether all supplied predicates return falsy values.

Stops at the first truthy result. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty list returns `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if at least one predicate is supplied and all results are falsy; otherwise `false`.

**Errors**

- `TypeError` if an entry is neither a function, `null` nor `undefined`.
- All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { nor } = require('go-fns');
const isString = value => typeof value === 'string';
const isNumber = value => typeof value === 'number';

const isNeitherTextNorNumber = nor(isString, isNumber);
isNeitherTextNorNumber(true);    // => true
nor(isString, isNumber)('abc');  // => false
nor(isString, isNumber)(1);      // => false
nor()();                         // => false
```

**Since:** 1.0.0.

---

### `norAsync(...fns)`

Creates a predicate that awaits results in order and determines whether all are falsy.

The returned predicate awaits each callback result from left to right and stops at the first truthy result. Every reached callback receives all original call arguments and the caller's exact `this`; input arguments are not awaited. Actual `null` and `undefined` entries are skipped. An empty or all-nullish list resolves to `false`.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates returning values, promises or thenables. Nullish entries are skipped; every supplied entry is validated synchronously when the wrapper is created. |

**Returns:** `Function` with signature `(...args) => Promise<boolean>`. A predicate resolving to `true` if at least one predicate is supplied and all awaited results are falsy; otherwise `false`.

**Errors**

- `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier result would short-circuit.
- A callback throw or rejected result rejects the wrapper's promise with the exact failure value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { nor, norAsync } = require('go-fns');

async function main() {
  const isNeitherTextNorNumber = norAsync(
    value => typeof value === 'string',
    async value => typeof value === 'number'
  );
  await isNeitherTextNorNumber(false);               // => true
  await isNeitherTextNorNumber('hello');             // => false
  await isNeitherTextNorNumber(1);                   // => false
  await norAsync(null, async () => 0, undefined)();  // => true
  await norAsync()();                                // => false
  await norAsync(null, undefined)();                 // => false
  assert.throws(() => norAsync(() => true, 123), TypeError);

  const calls = [];
  const neither = norAsync(
    () => { calls.push('first'); return false; },
    async () => { calls.push('second'); return 'found'; },
    () => { calls.push('third'); return false; }
  );
  const result = neither();
  calls;                                             // => ['first']
  await result;                                      // => false
  calls;                                             // => ['first', 'second']
}

main();
```

**Notes**

The first reached callback starts during invocation. Each later callback waits for the preceding result, including synchronous values. Concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for composition and synchronous callback API limitations.

**Since:** 2.0.0.

---

### `xor(...fns)`

Creates a predicate that determines whether exactly one supplied predicate returns a truthy value.

Stops at the second truthy result. Even if all three supplied predicates would return truthy values, the result is `false` and the third predicate is skipped. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped. With no remaining predicates, the returned predicate returns `false`.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if exactly one result is truthy; otherwise `false`.

**Errors**

- `TypeError` if an entry is neither a function, `null` nor `undefined`.
- All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { xor } = require('go-fns');

const exactlyOne = xor(value => value < 5, value => value % 2 === 0);
exactlyOne(3);                               // => true
exactlyOne(4);                               // => false
xor(() => true, () => true)();               // => false
xor(() => true, () => true, () => true)();   // => false
xor()();                                     // => false
```

**Since:** 1.0.0.

---

### `xorAsync(...fns)`

Creates a predicate that awaits results in order and determines whether exactly one is truthy.

The returned predicate awaits each callback result from left to right and stops at the second truthy result. This is an exactly-one test: three truthy results still produce `false`. Every reached callback receives all original call arguments and the caller's exact `this`; input arguments are not awaited. Actual `null` and `undefined` entries are skipped. An empty or all-nullish list resolves to `false`.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates returning values, promises or thenables. Nullish entries are skipped; every supplied entry is validated synchronously when the wrapper is created. |

**Returns:** `Function` with signature `(...args) => Promise<boolean>`. A predicate resolving to `true` if exactly one awaited result is truthy; otherwise `false`.

**Errors**

- `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier result would short-circuit.
- A callback throw or rejected result rejects the wrapper's promise with the exact failure value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { xor, xorAsync } = require('go-fns');

async function main() {
  await xorAsync(() => false, async () => true, () => false)();  // => true
  await xorAsync(() => true, async () => true, () => true)();    // => false
  await xorAsync(null, async () => 'selected', undefined)();     // => true
  await xorAsync()();                                            // => false
  await xorAsync(null, undefined)();                             // => false
  assert.throws(() => xorAsync(() => true, () => true, 123), TypeError);

  const calls = [];
  const exactlyOne = xorAsync(
    () => { calls.push('first'); return true; },
    async () => { calls.push('second'); return true; },
    () => { calls.push('third'); return true; }
  );
  const result = exactlyOne();
  calls;                                                         // => ['first']
  await result;                                                  // => false
  calls;                                                         // => ['first', 'second']
}

main();
```

**Notes**

The first reached callback starts during invocation. Each later callback waits for the preceding result, including synchronous values. Concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for composition and synchronous callback API limitations.

**Since:** 2.0.0.

## Conditional transformations

### `applyIf(value, condition, transform)`

Applies a transformation immediately when a boolean flag is `true` or a predicate returns a truthy value. Otherwise, returns the original input.

Use a flag for a setting you already know. Use a predicate when the decision depends on the input. To build a reusable transformation, use [`when`](#whenpredicate-transform).

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Input passed unchanged to the predicate and transformation. |
| `condition` | `boolean \| Function` | Required flag or predicate. Predicate results use truthiness. |
| `transform` | `Function` | Required transformation, validated even when the condition is false. |

**Returns:** `T | V` — The transformation result for a truthy decision; otherwise the exact original input. Objects, functions, promises and thenables retain identity.

**Errors**

- `TypeError` if the condition is neither a primitive boolean nor a function, or the transform is not a function. Both are validated before callbacks run.
- Predicate and transformation errors propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
import { applyIf } from 'go-fns';

const trimTitles = true;
const trimTitle = title => title.trim();
const isBlank = title => title.trim() === '';
const defaultTitle = () => 'Untitled';

applyIf('  Draft  ', trimTitles, trimTitle);         // => 'Draft'
applyIf('  Draft  ', false, trimTitle);              // => '  Draft  '
applyIf('   ', isBlank, defaultTitle);               // => 'Untitled'

const settings = { theme: 'dark' };
applyIf(settings, false, () => ({})) === settings;   // => true
```

**Callback behaviour**

A predicate runs once with the original value. The transform runs once only for a truthy decision. Both receive exactly one argument and the caller's exact `this`; bound callbacks retain their bound receiver. A skipped transformation does not inspect or coerce the input. Mutations made by a predicate remain visible to the transform.

Predicate promises are truthy and are not awaited. A transformation's result is returned unchanged without awaiting it or calling a returned function. Use [`whenAsync`](#whenasyncpredicate-transform) for awaited decisions.

**TypeScript**

Literal `true` selects the transformation result type; literal `false` preserves the input type. A dynamic boolean or predicate includes both possible results. Callbacks retain the input type and explicit receiver requirements.

---

### `when(predicate, transform)`

Creates a reusable function that transforms an input when a predicate passes and otherwise passes the input through.

Use it as a mapping callback or a pipeline stage. When called, the wrapper evaluates the predicate once. Both callbacks receive exactly one input and the caller's `this`. Predicate promises are truthy without awaiting. The wrapper returns a transform result or promise unchanged.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required synchronous truthiness test. |
| `transform` | `Function` | Required transformation run only for a truthy test. |

**Returns:** `Function` with signature `(value: V) => V | T`. A wrapper returning the transform result when the predicate is truthy; otherwise the original input.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { when } = require('go-fns');

const isBlank = title => title.trim() === '';
const defaultTitle = () => 'Untitled';
const fillBlankTitle = when(isBlank, defaultTitle);

fillBlankTitle('  Draft  ');                   // => '  Draft  '
['Welcome', '', 'Notes'].map(fillBlankTitle);  // => ['Welcome', 'Untitled', 'Notes']
```

---

### `whenAsync(predicate, transform)`

Creates a conditional transformation that awaits the predicate before deciding whether to transform the input.

The predicate starts immediately when the wrapper is called and its result is awaited once. A truthy result selects the transform; a falsy result skips it. Both callbacks receive exactly one argument and the caller's exact `this`. They receive the original input without awaiting it first; an omitted input is passed as an explicit `undefined`, and surplus arguments are ignored.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required truthiness test returning a value, promise or thenable. |
| `transform` | `Function` | Required transformation receiving the original input only after the predicate's awaited result is truthy. |

**Returns:** `Function` with signature `(value: V) => Promise<Awaited<V | T>>`. A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. It always returns a promise, including for synchronous callbacks.

**Errors**

- `TypeError` is thrown synchronously by the factory if either required callback is not a function, including a transform that would never run.
- Callback throws, rejected results and failed thenable assimilation reject the wrapper's promise with the exact failure value.

**Examples**

**Basic usage**

<!-- prettier-ignore -->
```javascript
const { sleep, whenAsync } = require('go-fns');

async function main() {
  async function loadTitlePolicy() {
    await sleep(0); // Stand in for loading a saved preference.
    return { fillBlanks: true };
  }

  const fillBlankTitle = whenAsync(
    async title => title.trim() === '' && (await loadTitlePolicy()).fillBlanks,
    () => 'Untitled'
  );
  await fillBlankTitle('   ');                       // => 'Untitled'
  await fillBlankTitle('  Draft  ');                 // => '  Draft  '
}

main();
```

**Additional behaviour**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { whenAsync } = require('go-fns');

async function main() {
  assert.throws(() => whenAsync(() => false, null), TypeError);

  const input = Promise.resolve(42);
  let receivedInput;
  const keepInput = whenAsync(
    value => { receivedInput = value; return false; },
    () => 0
  );
  const output = keepInput(input);
  receivedInput === input;                           // => true
  output === input;                                  // => false
  await output;                                      // => 42

  const argumentCounts = [];
  const fillMissing = whenAsync(
    function (value) { argumentCounts.push(arguments.length); return value === undefined; },
    function (value) { argumentCounts.push(arguments.length); return this.fallback; }
  );
  await fillMissing.call({ fallback: 'missing' });   // => 'missing'
  argumentCounts;                                    // => [1, 1]
}

main();
```

**Notes**

On the falsy path the async wrapper returns the original input, so promise and thenable inputs are assimilated by its returned promise. A non-thenable object keeps its identity after awaiting; a promise input does not retain its promise identity. The transform starts only after the predicate has been awaited, even for a synchronous result. Concurrent wrapper invocations remain independent. Async decisions do not provide TypeScript type-guard or complement narrowing.

**Since:** 2.0.0.

---

### `ifElse(predicate, onTrue, onFalse)`

Creates a reusable function that chooses between two callbacks based on a predicate result.

All call arguments and the caller's `this` reach the predicate and selected branch. The other branch is not called. Predicate promises are truthy without awaiting; the selected branch result is returned unchanged.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required synchronous truthiness test. |
| `onTrue` | `Function` | Required truthy branch. |
| `onFalse` | `Function` | Required falsy branch. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { ifElse } = require('go-fns');

const isBlank = title => title.trim() === '';
const defaultTitle = () => 'Untitled';
const trimTitle = title => title.trim();
const formatTitle = ifElse(isBlank, defaultTitle, trimTitle);

formatTitle('  Draft  ');      // => 'Draft'
formatTitle('   ');            // => 'Untitled'
```

---

### `ifElseAsync(predicate, onTrue, onFalse)`

Creates a reusable function that awaits a predicate, then runs and awaits the selected branch.

The predicate starts immediately when the wrapper is called. Its result is awaited once, then exactly one branch runs according to the result's truthiness. The predicate and selected branch receive all original call arguments and the caller's exact `this`; input arguments are not awaited. The unselected branch is never called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required truthiness test returning a value, promise or thenable. |
| `onTrue` | `Function` | Required branch called only for a truthy awaited predicate result. |
| `onFalse` | `Function` | Required branch called only for a falsy awaited predicate result. |

**Returns:** `Function` with signature `(...args) => Promise<Awaited<T>>`. A wrapper resolving to the awaited result of the selected branch. It always returns a promise, including for synchronous decisions, branch results and throws.

**Errors**

- `TypeError` is thrown synchronously by the factory if any required callback is not a function, including an unselected branch.
- A predicate or selected-branch throw, rejected result or failed thenable assimilation rejects the wrapper's promise with the exact failure value; a failed predicate prevents both branches from running.

**Examples**

**Basic usage**

<!-- prettier-ignore -->
```javascript
const { ifElseAsync, sleep } = require('go-fns');

async function isBlocked(listing) {
  await sleep(0); // Stand in for checking the review queue.
  return listing.blocked;
}

const describeListing = ifElseAsync(
  isBlocked,
  listing => listing.title + ' needs review',
  listing => listing.title + ' is ready'
);

async function main() {
  await describeListing({ title: 'Desk', blocked: false });              // => 'Desk is ready'
  await describeListing({ title: 'Desk', blocked: true });               // => 'Desk needs review'
}

main();
```

**Compose async helpers**

<!-- prettier-ignore -->
```javascript
const { andAsync, ifElseAsync, norAsync, sleep, whenAsync } = require('go-fns');

async function main() {
  const canPublish = andAsync(
    listing => listing.title.length > 0,
    norAsync(
      async listing => {
        await sleep(0); // Stand in for checking the review queue.
        return listing.blocked;
      },
      listing => listing.archived
    )
  );
  const addCategory = whenAsync(
    async listing => !listing.category,
    listing => Object.assign({}, listing, { category: 'general' })
  );
  const describeListing = ifElseAsync(
    canPublish,
    async listing => listing.title + ' ready in ' + listing.category,
    listing => listing.title + ' needs review'
  );
  const listing = await addCategory({ title: 'Mountain bike', blocked: false, archived: false });
  await describeListing(listing);                                        // => 'Mountain bike ready in general'
  await describeListing(Object.assign({}, listing, { blocked: true }));  // => 'Mountain bike needs review'
}

main();
```

**Additional behaviour**

<!-- prettier-ignore -->
```javascript
const assert = require('assert');
const { ifElseAsync } = require('go-fns');

async function main() {
  assert.throws(() => ifElseAsync(() => true, () => 'yes', undefined), TypeError);

  const calls = [];
  const choose = ifElseAsync(
    function (left, right) { calls.push('predicate'); return left + right === this.total; },
    async function (left, right) { calls.push('yes'); return this.total + left + right; },
    function () { calls.push('no'); return -1; }
  );
  const result = choose.call({ total: 5 }, 2, 3);
  calls;                                                                 // => ['predicate']
  await result;                                                          // => 10
  calls;                                                                 // => ['predicate', 'yes']
}

main();
```

**Notes**

The selected branch starts only after the predicate result has been awaited, even if that result is synchronous. Its result is also awaited. Concurrent wrapper invocations remain independent. Async decisions do not narrow branch input types; use explicit checks or typed adapters when a branch needs a narrower type.

**Since:** 2.0.0.

## Argument adaptation

### `spread(fn)`

Creates a wrapper that lets a callback take an array-like argument list in place of separate arguments.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Arrays, typed arrays and array-like objects work; `null` or `undefined` supplies no arguments. Iterability alone does not expand a collection.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback. The returned function takes one array-like argument list; nullish input supplies no arguments. |

**Returns:** `Function` with signature `(args) => T`. A wrapper that spreads the supplied argument list and returns the callback result.

**Errors**

- `TypeError` if `fn` is not a function, or a later argument list is primitive and non-nullish.
- Argument-list getter and callback errors propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { spread } = require('go-fns');
const sum = spread((a, b) => a + b);

sum([1, 2]);                     // => 3
sum(new Uint8Array([2, 3]));     // => 5
sum({ 0: 4, 1: 5, length: 2 });  // => 9
const countArgs = spread(function () { return arguments.length; });
countArgs(null);                 // => 0

const context = { offset: 10 };
const addOffset = spread(function (value) { return this.offset + value; });
addOffset.call(context, [2]);    // => 12
```

**Notes**

Input arrays are not mutated. Accessing an array-like input can invoke getters;
getter failures propagate. **Since:** 1.0.0.

---

### `partial(fn, ...args)`

Creates a specialised function with leading arguments supplied in advance, without binding its receiver.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Saved values are retained by reference. There are no placeholders or constructor adaptations.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to specialise. |
| `...args` | Callback parameter types | Saved arguments prepended on every call. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the callback result after prepending the saved arguments.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { partial } = require('go-fns');

function logEvent(area, event, details) {
  return { area, event, details };
}
const logListingEvent = partial(logEvent, 'listings');
const details = { listingId: 'listing-104' };
console.log(logListingEvent('created', details));  // => { area: 'listings', event: 'created', details: { listingId: 'listing-104' } }
```

---

### `partialRight(fn, ...args)`

Creates a specialised function that appends saved arguments to each call without binding its receiver.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Saved values are retained by reference. Omitted inputs are not padded; supply optional prefix positions explicitly when needed to keep saved arguments in place.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to specialise. |
| `...args` | Callback parameter types | Saved arguments appended on every call. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the callback result after appending the saved arguments.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { partialRight, unary } = require('go-fns');

const prettyJson = partialRight(JSON.stringify, null, 2);
console.log(prettyJson({ title: 'Mountain bike' }));
// A JSON string formatted with two-space indentation.

// Array.map supplies index/array as extra inputs; strip them before appending.
const formattedListings = [{ title: 'Bicycle' }, { title: 'Helmet' }]
  .map(unary(prettyJson));
console.log(formattedListings.length);   // => 2
```

---

### `withDefaultArgs(fn, ...defaultArgs)`

Creates a wrapper that supplies positional defaults when arguments are omitted or `undefined`.

Use it to adapt an existing function without changing its declaration. Each default belongs to one argument position: callers can override it with any defined value, including `null`, `false`, `0` or an empty string. Defaults are captured once and retained by reference; function defaults are values, not factories.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to adapt. |
| `...defaultArgs` | Any values | Fallback values for consecutive argument positions, starting at the first. |

**Returns:** `Function` with signature `(...args) => T`. A fresh wrapper that forwards its caller's exact `this` and returns the callback result unchanged, including promises and iterators.

**Errors**

- `TypeError` if `fn` is not a function. Validation does not invoke it or inspect its metadata.
- Errors from later callback calls propagate unchanged. Class constructors and revoked callable proxies pass function validation but fail when called normally.

**Examples**

<!-- prettier-ignore -->
```javascript
const { withDefaultArgs } = require('go-fns');

const createEntry = (count, level) => ({ count, level });
const createEntryWithDefaults = withDefaultArgs(createEntry, 1, 'info');

createEntryWithDefaults();                    // => { count: 1, level: 'info' }
createEntryWithDefaults(5);                   // => { count: 5, level: 'info' }
createEntryWithDefaults(undefined, 'error');  // => { count: 1, level: 'error' }
createEntryWithDefaults(0, '');               // => { count: 0, level: '' }
```

**Notes**

The callback receives the greater of the supplied argument count and the default count. Explicit `undefined` defaults still create argument slots; extra caller arguments are forwarded. With no defaults, the wrapper simply forwards each call.

This shares JavaScript default parameters' `undefined`-only fallback rule, but defaults are supplied when the wrapper is created, rather than evaluated inside the callback on each call. The callback's own default initialisers still run for any `undefined` left after substitution. Its `arguments.length` can therefore differ from a direct call. No values are cloned, merged or awaited.

Unlike [`partial`](#partialfn-args), this helper substitutes values at their original positions instead of inserting arguments before the caller's inputs. It adapts ordinary calls only: constructor behaviour, callback name, length and custom properties are not preserved. See [the typing limits](#positional-default-arguments) for TypeScript inference and supported default tuples.

---

### `unary(fn)`

Creates a wrapper that forwards exactly one argument, so extra arguments from callers such as `map` stay out of the callback.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. An omitted input becomes one explicit `undefined`; additional arguments are ignored.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to adapt. |

**Returns:** `Function` with signature `(value) => T`. A wrapper returning the callback result after passing exactly one argument.

**Errors**

- `TypeError` if a required callback is not a function.
- Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { unary } = require('go-fns');

// Prevent map's index from being interpreted as parseInt's radix argument.
const numbers = ['10', '20', '30'].map(unary(parseInt));
console.log(numbers);          // => [10, 20, 30]
```

---

### `ary(fn, count)`

Creates a wrapper that forwards up to `count` arguments and passes through its caller's receiver. A cap of zero forwards no arguments. Omitted arguments stay omitted. [`unary`](#unaryfn) always forwards exactly one argument.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to adapt. |
| `count` | `number` | Required integer from 0 through 4294967295. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the exact callback result, including a promise, after forwarding the leading arguments.

**Errors**

- `TypeError` if `fn` is not a function or `count` is not a number.
- `RangeError` if `count` is not an integer in range. Callback errors propagate unchanged.

**Examples**

`map` passes the value, index and array. `ary(label, 2)` keeps the value and index, so `label` uses its default prefix. `unary(label)` would drop the index.

<!-- prettier-ignore -->
```javascript
const { ary } = require('go-fns');

const label = (value, index, prefix = 'Item') => `${prefix} ${index}: ${value}`;
const labelItems = ary(label, 2);
['a', 'b'].map(labelItems);     // => ['Item 0: a', 'Item 1: b']
```

**Notes**

The cap is explicit, independent of the callback's declared length. TypeScript preserves the callback parameter types and requires a cap that leaves room for required inputs. A `number` without a known literal cap is supported for callbacks that can take zero arguments. Wrap callbacks with a required suffix after an open rest parameter in a fixed signature before adapting them. **Since:** 2.0.0.

## Execution and outcomes

### `result(value, ...args)`

Returns a fixed value unchanged or calls a supplied function once to compute the value.

Use this for options that accept a fixed value or a function that computes one. A value whose JavaScript type is `function` is invoked once. Other values, including `null`, `undefined`, objects and promises, are returned unchanged; extra arguments are ignored for those values.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `Function` or any value | A callback to invoke once, or a non-function value to return unchanged. |
| `...args` | any values | Raw positional arguments passed to the callback. |

**Returns:** The exact callback result or original value. Objects, promises and returned functions preserve identity. Neither input arguments nor callback results are awaited, and returned functions are not invoked again.

**Errors**

- Propagates the exact value thrown by a callback.
- Classes and revoked callable proxies fail when invoked.
- Non-function values are valid inputs.

**Examples**

<!-- prettier-ignore -->
```javascript
const { result } = require('go-fns');
const user = { name: 'Ada' };

result('Hello', user);                       // => 'Hello'
result(user => 'Hello ' + user.name, user);  // => 'Hello Ada'
result((a, b) => a + b, 2, 3);               // => 5
result(null);                                // => null

const promise = Promise.resolve(7);
result(promise) === promise;                 // => true
result(() => promise) === promise;           // => true
const inner = () => 7;
result(() => inner) === inner;               // => true
```

**Notes**

Callbacks are ordinary function calls: the caller's receiver is not forwarded. Strict callbacks receive `undefined`; non-strict callbacks retain JavaScript's normal receiver coercion. Bind methods that require an object receiver. Use `result(() => method.call(owner))` when explicit invocation is clearer.

[`result`](#resultvalue-args) returns a raw value and propagates errors. [`attemptResult`](#attemptresultfn-args) instead requires a callback and returns a success/failure object. TypeScript checks the callable branches of value/function unions; overloaded or structurally complex callbacks may need a single-signature wrapper. When explicitly passing `undefined` to a defaulted parameter, annotate any required callback parameters if inference cannot establish their types. Constructor-only values and unbound callbacks with explicit receiver requirements are rejected by the declarations. **Since:** 2.0.0.

---

### `attempt(fn, ...args)`

Invokes a callback synchronously and returns its result or the exact value it throws.

The callback itself is its receiver; bind it to supply another `this`. Returned and thrown values are indistinguishable. Promises are returned unchanged, and later rejections are not caught.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback, invoked synchronously with itself as the receiver. |
| `...args` | Callback parameter types | Arguments passed to the callback. |

**Returns:** `unknown` — The callback result, or the exact value thrown synchronously.

**Errors**

- `TypeError` if `fn` is not a function; validation happens outside the catch.

**Examples**

<!-- prettier-ignore -->
```javascript
const { attempt } = require('go-fns');

attempt(JSON.parse, '1');                                    // => 1
attempt(JSON.parse, '') instanceof SyntaxError;              // => true
attempt(() => { throw 'failed'; });                          // => 'failed'
attempt((a, b) => a + b, 2, 3);                              // => 5

const context = { value: 7 };
attempt(function () { return this.value; }.bind(context));   // => 7
```

A returned `Error` and a thrown `Error` cannot be distinguished using the result
alone. A promise is returned unchanged, including one that later rejects.

**Since:** 1.0.0.

---

### `attemptResult(fn, ...args)`

Invokes a callback synchronously and reports success or failure in a result object.

Check `ok` to distinguish a returned value from a thrown value. The callback itself is its receiver. Promises are successful values without awaiting; later rejections are not caught.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback, invoked synchronously with itself as the receiver. |
| `...args` | Callback parameter types | Arguments passed to the callback. |

**Returns:** `Result<T>` — A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw.

**Errors**

- `TypeError` if `fn` is not a function; invalid callbacks throw instead of producing a failure result.

**Examples**

<!-- prettier-ignore -->
```javascript
const { attemptResult } = require('go-fns');

const result = attemptResult(JSON.parse, '{"theme":"dark","pageSize":20}');
if (result.ok) {
  console.log(result.value.theme);           // => 'dark'
} else {
  console.error('Invalid settings:', result.error);
}

attemptResult(() => undefined);              // => { ok: true, value: undefined }
attemptResult(() => { throw undefined; });   // => { ok: false, error: undefined }

const error = new Error('example');
attemptResult(() => error);                  // => { ok: true, value: error }
attemptResult(() => { throw error; });       // => { ok: false, error: error }
```

**Notes**

A returned promise is the successful
`value` itself; it is not awaited, and its later rejection is not caught. An invalid
callback throws `TypeError` rather than becoming `{ ok: false }`.

**Async variant:** [`attemptResultAsync`](#attemptresultasyncfn-args). **Since:** 2.0.0.

---

### `attemptResultAsync(fn, ...args)`

Invokes a callback, awaits its result and reports success or failure in a result object.

The callback itself is its receiver. Callback throws, promise rejections and failures while awaiting thenables are captured without replacing the original failure. Invalid callbacks reject instead of producing a failure result.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required synchronous or asynchronous callback; the callback itself is its receiver. |
| `...args` | Callback parameter types | Arguments passed to the callback. |

**Returns:** `Promise<Result<Awaited<T>>>` — A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value.

**Errors**

- Rejects with `TypeError` if `fn` is not a function.

**Examples**

<!-- prettier-ignore -->
```javascript
const { attemptResultAsync } = require('go-fns');

async function main() {
  const loadSettings = async userId => ({ userId, theme: 'dark' });
  const result = await attemptResultAsync(loadSettings, 'user-42');
  if (result.ok) {
    console.log(result.value.theme);                       // => 'dark'
  } else {
    console.error('Loading settings failed:', result.error);
  }

  const reason = { code: 'SETTINGS_UNAVAILABLE' };
  await attemptResultAsync(() => Promise.reject(reason));  // => { ok: false, error: reason }
}

main();
```

**Notes**

Unlike callback failures, invalid callback
configuration rejects that promise with `TypeError`; it does not resolve to a failed
result. This operation is not a blanket never-rejects API.

**Since:** 2.0.0.

---

### `once(fn)`

Creates a function that invokes its callback at most once and caches the first outcome.

The first call supplies the arguments and `this`; later calls ignore their inputs. Exact returned values, promise identity and thrown values are cached. Failures are not retried, and creating the wrapper does not invoke the callback.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls.

**Errors**

- `TypeError` if `fn` is not a function.
- `Error`: If the wrapper is called recursively before its first callback returns.
- An uncaught recursive-call error becomes the cached failure.

**Examples**

<!-- prettier-ignore -->
```javascript
const { once } = require('go-fns');

async function main() {
  const getFormatter = once(() => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD'
  }));

  getFormatter() === getFormatter();           // => true
  getFormatter().resolvedOptions().currency;   // => 'NZD'

  let calls = 0;
  const loadSettings = once(async () => {
    calls++;
    return { theme: 'dark' };
  });

  const first = loadSettings();
  const second = loadSettings();
  // The wrapper returns the exact same promise.
  first === second;                            // => true
  await first;
  calls;                                       // => 1
}

main();
```

**Notes**

The result is a wrapper that caches exact returned values, including `undefined` and
promises. A synchronous throw is cached and rethrown unchanged. Rejected promises
remain cached too; [`once`](#oncefn) is not retry-until-success. The wrapper does not inspect
or attach handlers to returned promises, so callers still handle rejections.

Calling the wrapper recursively before the first callback returns throws a
descriptive reentrancy `Error`. If the callback does not catch it, that error becomes
the cached failure. Each wrapper has independent state. No `reset`, key-based cache,
retry or argument-specific memoisation is provided. **Since:** 2.0.0.

---

### `memoize(fn, options?)`

Creates a wrapper that caches callback results by receiver and complete argument list. Use it for computations whose results can be reused while the inputs remain unchanged.

The cache compares objects and functions by reference. It distinguishes `0` from `-0`, treats `NaN` as matching `NaN`, and distinguishes an omitted argument from an explicitly supplied `undefined`. Each wrapper has its own cache.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback. |
| `options?` | `object` | `undefined` | Optional cache options. |
| `options.maxSize?` | `number` | `128` | Maximum number of entries, an integer from 1 through 4294967295. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper that returns the exact computed or cached result. Use [`clear()`](#memoizedfnclear) to discard its cache.

**Errors**

- `TypeError` if `fn` is not a function, `options` is null, an array or a non-object, or a supplied size is not a number.
- `RangeError` if the size is not an integer in range. Synchronous callback throws propagate unchanged and are not cached.

**Examples**

<!-- prettier-ignore -->
```javascript
const { memoize } = require('go-fns');

const range = memoize((start, end) => ({ start, end }));
const first = range(1, 3);
range(1, 3) === first;          // => true
range(1, 4) === first;          // => false
```

**Notes**

When the cache fills, a new result evicts the least recently used entry. Keys and results are retained by reference until eviction or clearing. Clear the cache if changes to a receiver, input object or external state would make a cached result stale. Results enter the cache when the callback returns. Calls made before a synchronous callback returns cannot reuse that unreturned result.

Returned promises, including rejected ones, stay in the cache until eviction or clearing. The wrapper neither awaits them nor adds rejection handlers. **Since:** 2.0.0.

---

<a name="memoizedclear"></a>

### `memoizedFn.clear()`

Clears all cached results from the function returned by [`memoize`](#memoizefn-options). A synchronous callback that called `clear()` before returning does not insert its result into the newly cleared cache.

**Parameters**

No parameters.

**Returns:** `undefined` — `undefined` after clearing the cache.

**Examples**

<!-- prettier-ignore -->
```javascript
const { memoize } = require('go-fns');

const compute = value => ({ value });
const memoizedFn = memoize(compute);
const first = memoizedFn('a');
memoizedFn.clear();            // => undefined
memoizedFn('a') === first;     // => false
```

---

### `repeat(fn, count?, ...args)`

Invokes a callback a specified number of times synchronously and collects its results.

Each call receives the same arguments with the callback itself as its receiver; no index is added. Nullish counts mean zero. Promises are collected without awaiting. Large counts still require practical memory limits.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback; the callback itself is its receiver. |
| `count?` | `number`, `null`, or `undefined` | `0` | Integer from 0 through 4294967295. Omitted, `null` and `undefined` mean zero. |
| `...args` | Callback parameter types | — | Arguments passed unchanged on every invocation; no index is added. |

**Returns:** `T[]` — A fresh array containing each synchronous callback result in invocation order.

**Errors**

- `TypeError` if `fn` is not a function or `count` is non-nullish and not a number.
- `RangeError` if `count` is not an integer in the supported range.
- Callback errors stop further calls and propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { repeat } = require('go-fns');

repeat(Math.floor, 3, 1.5);        // => [1, 1, 1]
repeat((a, b) => a + b, 2, 2, 3);  // => [5, 5]
repeat(() => 'value');             // => []
repeat(() => 'value', null);       // => []

let sequence = 0;
repeat(() => ++sequence, 3);       // => [1, 2, 3]
```

A non-nullish, non-number count throws `TypeError`. Negative, fractional, infinite,
`NaN` and out-of-range numeric counts throw `RangeError`, before execution begins.
The array-length limit is not a memory budget: callers must still choose practical
counts. Callback exceptions stop execution immediately. Promise results are
collected without awaiting; use `Promise.all` explicitly when appropriate.

**Since:** 1.0.0.

---

### `repeatAsync(fn, count?, ...args)`

Invokes a callback a specified number of times sequentially, awaiting each result.

Each call receives the same arguments with the callback itself as its receiver; no index is added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is not undone.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback; the callback itself is its receiver. |
| `count?` | `number`, `null`, or `undefined` | `0` | Integer from 0 through 4294967295. Omitted, `null` and `undefined` mean zero. |
| `...args` | Callback parameter types | — | Arguments passed unchanged on every invocation; no index is added. |

**Returns:** `Promise<Awaited<T>[]>` — A promise resolving to a fresh array of sequentially awaited callback results in invocation order.

**Errors**

- Rejects with `TypeError` for an invalid callback or non-nullish non-number count, `RangeError` for an unsupported count, or the original callback failure.

**Examples**

<!-- prettier-ignore -->
```javascript
const { repeatAsync } = require('go-fns');

async function main() {
  // A stand-in for a stateful paginated reader: only one read may run at a time.
  let page = 0;
  async function readNextPage() {
    return { page: ++page };
  }
  const pages = await repeatAsync(readNextPage, 3);
  console.log(pages);          // => [{ page: 1 }, { page: 2 }, { page: 3 }]
}

main();
```

## Scheduling and cancellation

### `delay(fn, milliseconds?, ...args)`

Schedules a callback to run later and returns a timer handle you can use to cancel it.

Uses the host's `setTimeout` for duration coercion, scheduling and the callback receiver. Use `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback synchronously.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback scheduled through the host timer. |
| `milliseconds?` | `number`, `null`, or `undefined` | Host default | Declaration input type. JavaScript values pass unchanged to native `setTimeout`; host coercion and clamping apply. |
| `...args` | Callback parameter types | — | Arguments supplied to the callback by the host timer. |

**Returns:** `TimerHandle` — The native timeout handle: a browser number or a Node.js `Timeout` object.

**Errors**

- `TypeError` if `fn` is not a function.
- Scheduling errors propagate; later callback errors are reported by the host.

**Examples**

```javascript
const { delay } = require('go-fns');

const timer = delay(console.log, 100, 'hello');
clearTimeout(timer); // cancel before it fires

const context = { name: 'Michael' };
const boundTimer = delay(
  function () {
    console.log(this.name);
  }.bind(context),
  100
);
clearTimeout(boundTimer);
```

**Notes**

The result is a number in browsers, or a `Timeout` object in Node.js. Namespace,
detached and explicit-receiver calls are supported. The callback is never invoked
synchronously by this wrapper. **Since:** 1.0.0.

---

### `sleep(milliseconds?, options?)`

Creates a promise you can await to pause an asynchronous operation, with optional cancellation.

The host timer may run late. An already-aborted signal rejects without scheduling a timer. Later cancellation clears the timer; listener cleanup runs on success, cancellation or scheduling failure.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `milliseconds?` | `number` | `0` | Finite duration from 0 through 2147483647; omitted or `undefined` uses zero. Fractions use host timer precision; `null` is invalid. |
| `options?` | `object` | `undefined` | Optional non-null, non-array object. |
| `options.signal?` | `AbortSignalLike` | `undefined` | Optional structural signal with boolean `aborted`, `reason`, `addEventListener` and `removeEventListener`. |

**Returns:** `Promise<void>` — A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted.

**Errors**

- Rejects with `TypeError` for invalid argument types or `RangeError` for unsupported durations.
- Signal and host-timer errors also reject the promise.

**Examples**

<!-- prettier-ignore -->
```javascript
const { sleep } = require('go-fns');

async function main() {
  await sleep(1);                                              // => undefined
}

main();
```

This ES module example uses a host with `AbortController` and support for `abort(reason)`.

<!-- prettier-ignore -->
```javascript
import { sleep } from 'go-fns';

const controller = new AbortController();
const reason = new Error('The screen was closed');
const pending = sleep(1000, { signal: controller.signal });
controller.abort(reason);
console.log(await pending.catch(error => error === reason));   // => true
```

**Notes**

Invalid arguments reject (`TypeError` for types,
`RangeError` for unsupported numeric durations). An already-aborted signal rejects
without starting a timer. Later cancellation rejects with the exact `signal.reason`
and clears the timer. The abort listener is removed after success, cancellation or
scheduling failure. Synthetic `abort` events do not cancel a still-live signal. If an earlier listener suppresses the abort event, cancellation is detected when the timer fires and the wait still rejects with the exact reason. Cleanup failures do not replace an existing cancellation reason.

Cancelling a wait does not cancel an unrelated network request or callback. To cancel
another operation, that operation must separately support and receive a signal.
**Since:** 2.0.0.

---

### `debounce(fn, milliseconds?, options?)`

Creates a function that combines a burst of calls, waiting for a pause by default.

It uses the latest arguments and receiver. Optional `maxWait` limits postponement while calls continue, subject to host timer scheduling. Construction does not invoke the callback. [`cancel()`](#debouncedfncancel), [`flush()`](#debouncedfnflush) and [`pending()`](#debouncedfnpending) manage scheduled calls. Started asynchronous work continues.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback to schedule. |
| `milliseconds?` | `number` | `0` | Finite wait from 0 through 2147483647. |
| `options?` | `object` | `undefined` | Optional non-null, non-array object. |
| `options.leading?` | `boolean` | `false` | Invoke on the leading edge. |
| `options.trailing?` | `boolean` | `true` | Invoke after activity stops. |
| `options.maxWait?` | `number` | `undefined` | Optional finite duration at least `milliseconds` that caps postponement. |

**Returns:** `Function` with signature `(...args) => T | undefined`. A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](#debouncedfncancel), [`flush`](#debouncedfnflush) and [`pending`](#debouncedfnpending) methods.

**Errors**

- `TypeError` if callback, duration or option types are invalid.
- `RangeError` if a duration is outside its supported range.
- Immediate callback errors propagate; timer callback errors go to the host.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const appliedQueries = [];
const updateSearch = debounce(query => {
  appliedQueries.push(query);
  return query;
}, 250, { maxWait: 1000 });

updateSearch('re');
updateSearch('rea');
updateSearch('react');
console.log(updateSearch.pending());   // => true

// For example, apply pending input immediately when the user presses Enter.
console.log(updateSearch.flush());     // => 'react'
console.log(appliedQueries);           // => ['react']
console.log(updateSearch.pending());   // => false
updateSearch.cancel(); // Cleanup; does not undo a completed callback.
```

**Returned wrapper methods**

The methods below belong to the returned [`debounce`](#debouncefn-milliseconds-options) wrapper. Each takes no
arguments and can be called separately from the wrapper. A callback return value is available as soon as the callback returns, even when it is a promise that has not settled.

---

<a name="debouncedcancel"></a>

### `debouncedFn.cancel()`

Discards pending calls and resets scheduling, retaining the most recent callback return value. Cancelling does not undo a completed callback.

**Parameters**

No parameters.

**Returns:** `undefined` — `undefined` after discarding scheduled work. Work already started continues.

**Errors**

- Host timer errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const debouncedFn = debounce(value => value, 100);
debouncedFn("pending");
debouncedFn.cancel();          // => undefined
debouncedFn.pending();         // => false
```

---

<a name="debouncedflush"></a>

### `debouncedFn.flush()`

Invokes eligible pending work immediately, or returns the most recent callback return value. A leading-only cooldown remains active.

**Parameters**

No parameters.

**Returns:** `T | undefined` — The callback return value when pending work runs, including a pending promise, or the previous value otherwise; `undefined` until the first successful return.

**Errors**

- Callback, clock and host timer errors propagate.
- Returned promises are not awaited or caught.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const debouncedFn = debounce(value => value, 100);
debouncedFn("latest");
debouncedFn.flush();           // => "latest"
debouncedFn.pending();         // => false
```

---

<a name="debouncedpending"></a>

### `debouncedFn.pending()`

Checks whether a callback invocation is scheduled.

**Parameters**

No parameters.

**Returns:** `boolean` — `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const debouncedFn = debounce(value => value, 100);
debouncedFn.pending();         // => false
debouncedFn("pending");
debouncedFn.pending();         // => true
debouncedFn.cancel();
```

See [scheduling and argument adaptation](#scheduling-and-argument-adaptation)
for timer and asynchronous-work rules.

---

### `throttle(fn, milliseconds?, options?)`

Creates a function that limits how often repeated calls start work while calls continue.

Defaults to leading and trailing execution; a lone leading call is not repeated. Uses the latest arguments and receiver. [`flush()`](#throttledfnflush) and [`cancel()`](#throttledfncancel) can override ordinary spacing. Invocation starts are limited; asynchronous work is not serialised or cancelled.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback to schedule. |
| `milliseconds?` | `number` | `0` | Finite spacing from 0 through 2147483647. |
| `options?` | `object` | `undefined` | Optional non-null, non-array object. |
| `options.leading?` | `boolean` | `true` | Invoke on the leading edge. |
| `options.trailing?` | `boolean` | `true` | Invoke on the trailing edge. |

**Returns:** `Function` with signature `(...args) => T | undefined`. A scheduled wrapper returning the most recent callback return value, including a pending promise, or `undefined` until the first successful return. Includes [`cancel`](#throttledfncancel), [`flush`](#throttledfnflush) and [`pending`](#throttledfnpending) methods.

**Errors**

- `TypeError` if callback, duration or option types are invalid.
- `RangeError` if the duration is outside its supported range.
- Immediate callback errors propagate; timer callback errors go to the host.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const savedPositions = [];
const savePosition = throttle(position => {
  savedPositions.push(position);
  return position;
}, 200);

savePosition(10); // Runs on the leading edge.
savePosition(20);
savePosition(30); // Replaces the pending input, not the previous return value.
console.log(savedPositions);         // => [10]

// A deliberate final flush, e.g. when finishing an interaction.
console.log(savePosition.flush());   // => 30
console.log(savedPositions);         // => [10, 30]
savePosition.cancel();
```

**Returned wrapper methods**

The methods below belong to the returned [`throttle`](#throttlefn-milliseconds-options) wrapper. Each takes no
arguments and can be called separately from the wrapper. A callback return value is available as soon as the callback returns, even when it is a promise that has not settled.

---

<a name="throttledcancel"></a>

### `throttledFn.cancel()`

Discards pending calls and resets scheduling, retaining the most recent callback return value. Cancelling does not undo a completed callback.

**Parameters**

No parameters.

**Returns:** `undefined` — `undefined` after discarding scheduled work. Work already started continues.

**Errors**

- Host timer errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const throttledFn = throttle(value => value, 100, { leading: false });
throttledFn("pending");
throttledFn.cancel();          // => undefined
throttledFn.pending();         // => false
```

---

<a name="throttledflush"></a>

### `throttledFn.flush()`

Invokes eligible pending work immediately, or returns the most recent callback return value. A leading-only cooldown remains active.

**Parameters**

No parameters.

**Returns:** `T | undefined` — The callback return value when pending work runs, including a pending promise, or the previous value otherwise; `undefined` until the first successful return.

**Errors**

- Callback, clock and host timer errors propagate.
- Returned promises are not awaited or caught.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const throttledFn = throttle(value => value, 100, { leading: false });
throttledFn("latest");
throttledFn.flush();           // => "latest"
throttledFn.pending();         // => false
```

---

<a name="throttledpending"></a>

### `throttledFn.pending()`

Checks whether a callback invocation is scheduled.

**Parameters**

No parameters.

**Returns:** `boolean` — `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const throttledFn = throttle(value => value, 100, { leading: false });
throttledFn.pending();         // => false
throttledFn("pending");
throttledFn.pending();         // => true
throttledFn.cancel();
```

See [scheduling and argument adaptation](#scheduling-and-argument-adaptation)
for timer and asynchronous-work rules.

## Behaviour

### Optional host capabilities

Importing root or focused modules does not read timers or optional clocks, construct
abort controllers, schedule work or access the DOM. `globalThis`, `self`, `global`
and `window` are alternative host aliases, checked in that order when a host is needed.
A source embedding with none of those aliases fails clearly when a timer function
needs the host; unrelated functions still work. Bundlers may also supply a host resolver.

[`debounce`](#debouncefn-milliseconds-options) and [`throttle`](#throttlefn-milliseconds-options) capture a callable `performance.now` with its native receiver.
If `performance` is missing, `null` or `undefined`, or its `now` method is missing or
not callable, they use `Date.now()` instead. This fallback remains sensitive to wall-clock
changes. A present clock getter or callable that throws keeps its original error.
Neither the `Performance` constructor nor its prototype is required.

[`sleep`](#sleepmilliseconds-options) accepts a structural signal and does not look up native `AbortController` or
`AbortSignal` constructors, prototypes or static methods. The supplied signal still needs
its documented `aborted`, `addEventListener` and `removeEventListener` members; missing
listener methods reject with `TypeError`. Cancellation preserves the exact `reason`.

[`delay`](#delayfn-milliseconds-args) requires the host's `setTimeout` when called. [`sleep`](#sleepmilliseconds-options) and active schedulers use
`setTimeout` and `clearTimeout`; missing timer methods fail when the operation needs
them, using the documented synchronous or promise error path. An already-aborted valid
signal rejects with its reason without scheduling a timer. These timer requirements do
not apply to composition, predicates or argument adapters.

No conditional value conversions are performed by the library. A skipped [`when`](#whenpredicate-transform)
callback returns its input unchanged; [`whenAsync`](#whenasyncpredicate-transform) preserves the resolved input under
its documented promise-assimilation rules. Optional host capabilities do not change
these behaviours, callback receivers or value/error identity. The library installs
no polyfills; the baseline requirements in [Runtime support](../README.md#runtime-support)
remain required.

### Invalid arguments and callback errors

[`result`](#resultvalue-args) deliberately accepts both values and functions; non-function inputs pass through unchanged.

A required callback must have JavaScript type `function`. Other inputs produce a
`TypeError` before any callback runs. Synchronous operations and wrapper factories
(including [`pipeAsync`](#pipeasyncfns), [`tapAsync`](#tapasyncobserver), all async logical helpers, [`whenAsync`](#whenasyncpredicate-transform) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse))
throw immediately. [`attemptResultAsync`](#attemptresultasyncfn-args), [`repeatAsync`](#repeatasyncfn-count-args) and [`sleep`](#sleepmilliseconds-options) reject their
returned promises for invalid configuration.
Validation does not stringify invalid values or invoke their coercion hooks.
Classes and revoked callable proxies can pass that type check but still throw when
invoked; invocation failures follow the same error behaviour as other callbacks.

[`pipe`](#pipefns), [`pipeAsync`](#pipeasyncfns), and the synchronous and async multi-predicate logical helpers
skip actual `null` and `undefined` entries.
They validate every supplied entry up front, even when execution could later
short-circuit. Other non-functions are configuration errors, not false predicates.

[`pipe`](#pipefns), [`spread`](#spreadfn), the synchronous logical helpers and [`repeat`](#repeatfn-count-args) propagate callback exceptions.
All async logical helpers, [`whenAsync`](#whenasyncpredicate-transform) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse) reject with the exact thrown or rejected value.
[`attempt`](#attemptfn-args) returns the exact thrown value; the result variants report callback failures
in result objects. [`once`](#oncefn) caches synchronous throws and rethrows the same value on later calls.
[`tap`](#tapobserver) propagates observer failures; async pipelines/observers reject. [`delay`](#delayfn-milliseconds-args) leaves later callback failures
to the timer host; it does not catch them.

### Receiver (`this`) behaviour

The functions returned by [`pipe`](#pipefns), [`pipeAsync`](#pipeasyncfns), [`tap`](#tapobserver), [`tapAsync`](#tapasyncobserver), [`once`](#oncefn), [`spread`](#spreadfn),
[`and`](#andfns), [`andAsync`](#andasyncfns), [`or`](#orfns), [`orAsync`](#orasyncfns), [`xor`](#xorfns), [`xorAsync`](#xorasyncfns), [`nor`](#norfns), [`norAsync`](#norasyncfns), [`not`](#notfn), [`notAsync`](#notasyncfn),
[`partial`](#partialfn-args), [`partialRight`](#partialrightfn-args), [`unary`](#unaryfn), [`when`](#whenpredicate-transform), [`whenAsync`](#whenasyncpredicate-transform), [`ifElse`](#ifelsepredicate-ontrue-onfalse) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse)
forward their caller's receiver to callbacks. Strict wrappers preserve `undefined`,
`null` and primitive receivers rather than substituting the global object or boxing
values. A non-strict callback may still perform JavaScript's own receiver coercion.
Bound functions and arrow functions retain their normal JavaScript receiver rules.

[`debounce`](#debouncefn-milliseconds-options) and [`throttle`](#throttlefn-milliseconds-options) save the latest call's arguments and receiver for scheduled invocation.

For compatibility, [`attempt`](#attemptfn-args), [`attemptResult`](#attemptresultfn-args), [`attemptResultAsync`](#attemptresultasyncfn-args), [`repeat`](#repeatfn-count-args) and [`repeatAsync`](#repeatasyncfn-count-args) use the callback function itself as
its receiver. Use `fn.bind(context)` to supply a different receiver to those utilities.
[`delay`](#delayfn-milliseconds-args) uses the native timer's callback receiver. [`applyIf`](#applyifvalue-condition-transform) forwards its caller's
receiver to the predicate and transform. [`result`](#resultvalue-args) calls its callback without
forwarding a receiver. Bind methods that require a particular receiver.

### Synchronous results and promises

The original synchronous utilities do not await promises. A promise is an ordinary
value in [`pipe`](#pipefns), a truthy result in a synchronous logical predicate, and an array element in
[`repeat`](#repeatfn-count-args). [`attempt`](#attemptfn-args) and [`attemptResult`](#attemptresultfn-args) do not catch a promise's later rejection.
[`tap`](#tapobserver) does not await its observer. [`once`](#oncefn) caches a returned promise without wrapping
it or handling its rejection. [`result`](#resultvalue-args) preserves direct and returned promises and thenables without assimilation.

Use [`pipeAsync`](#pipeasyncfns), [`attemptResultAsync`](#attemptresultasyncfn-args), [`tapAsync`](#tapasyncobserver), [`repeatAsync`](#repeatasyncfn-count-args), [`andAsync`](#andasyncfns),
[`orAsync`](#orasyncfns), [`xorAsync`](#xorasyncfns), [`norAsync`](#norasyncfns), [`notAsync`](#notasyncfn), [`whenAsync`](#whenasyncpredicate-transform) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse) to await results explicitly.
[`when`](#whenpredicate-transform)/[`ifElse`](#ifelsepredicate-ontrue-onfalse) predicates remain synchronous; promise predicates are truthy.
Argument adapters and scheduler callbacks return promises unchanged, without
awaiting, serialising, catching or cancelling their asynchronous work.
[`sleep`](#sleepmilliseconds-options) always returns a promise. Each helper has a fixed awaiting policy regardless
of what its callbacks return.

### Asynchronous predicates

[`andAsync`](#andasyncfns), [`orAsync`](#orasyncfns), [`xorAsync`](#xorasyncfns), [`norAsync`](#norasyncfns) and [`notAsync`](#notasyncfn) await callback results, including promises and
thenables, then convert their truthiness to booleans. Their factories remain
synchronous; the predicates they return always produce `Promise<boolean>`.
They pass input arguments unchanged and preserve the caller's receiver.
[`andAsync`](#andasyncfns), [`orAsync`](#orasyncfns), [`xorAsync`](#xorasyncfns) and [`norAsync`](#norasyncfns) evaluate sequentially from left to right.
They short-circuit on the first falsy, first truthy, second truthy and first truthy
result respectively. All four resolve to `false` for an empty or all-nullish list.
The first reached callback starts during the call; later callbacks wait for the
previous result, including a synchronous value. Throws and rejections stop
execution and reject with the original value.

Use these wrappers where the caller awaits the predicate. `Array.prototype.filter`
and synchronous go-types matcher callbacks do not await results: a promise is
truthy, even if it resolves to `false`. Async wrappers cannot be used as predicates
for those synchronous APIs. The synchronous logical helpers retain their
existing promise-as-truthy behaviour.

Use [`whenAsync`](#whenasyncpredicate-transform) or
[`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse) to select work using these
awaited decisions. Their factories validate every required callback immediately.
Each call starts its predicate immediately and waits before starting the selected
transform or branch, even for a synchronous decision. Call arguments are passed
unchanged. [`whenAsync`](#whenasyncpredicate-transform) passes exactly one original input to both callbacks, while
[`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse) forwards the full argument list. Both preserve the caller's receiver,
await the selected result and return a promise on every call. Concurrent calls
are independent; failures reject with the original thrown or rejected value.

### Empty inputs

<!-- prettier-ignore -->
| Expression | Result |
| --- | --- |
| `pipe()(value)` | `undefined`, not identity |
| `pipeAsync()(value)` | A promise resolving to `undefined` |
| `sleep()` | A promise resolving to `undefined` after a host timer |
| `and()()` | `false` |
| `or()()` | `false` |
| `andAsync()()` / `orAsync()()` / `xorAsync()()` / `norAsync()()` | A promise resolving to `false` |
| `xor()()` | `false` |
| `nor()()` | `false` |
| `repeat(fn)` / `repeat(fn, null)` | A new empty array |
| `spread(fn)()` / `spread(fn)(null)` | Calls `fn` with no arguments |
| `not()` / `notAsync()` | Throws `TypeError` synchronously |

The same empty-input results apply after nullish function entries are removed.

### Scheduling and argument adaptation

[`debounce`](#debouncefn-milliseconds-options) defaults to trailing-only execution. [`throttle`](#throttlefn-milliseconds-options) defaults to both edges.
A lone leading invocation is not repeated on the trailing edge. With both edges
false the wrapper is inert: it schedules no timer and never invokes the callback.

[`debounce`](#debouncefn-milliseconds-options) and [`throttle`](#throttlefn-milliseconds-options) accept finite durations from 0 through 2147483647 milliseconds.
An omitted duration or `undefined` uses zero. Fractional values are accepted subject to
host timer resolution. See [`delay`](#delayfn-milliseconds-args) for host timer coercion.
Options must be an object (not `null` or an array); `leading` and `trailing` must be booleans when
provided. Unknown properties are ignored. The optional `maxWait` for [`debounce`](#debouncefn-milliseconds-options) is a
finite duration in the same range and must be at least the ordinary wait.
It caps postponement during continued activity, subject to event-loop availability.
A zero-wait trailing first call is still deferred; a reached `maxWait` can invoke
synchronously on a later call when timer dispatch has been delayed.

Every scheduler wrapper has detachable methods:

<!-- prettier-ignore -->
| Method | Contract |
| --- | --- |
| [`debouncedFn.pending()`](#debouncedfnpending) / [`throttledFn.pending()`](#throttledfnpending) | Checks whether an eligible callback invocation is scheduled. Returns `true` for pending work; a leading-only cooldown or an in-flight promise alone returns `false`. |
| [`debouncedFn.cancel()`](#debouncedfncancel) / [`throttledFn.cancel()`](#throttledfncancel) | Discard scheduled work and reset suppression; retain the most recent callback return value. Does not stop work already started. |
| [`debouncedFn.flush()`](#debouncedfnflush) / [`throttledFn.flush()`](#throttledfnflush) | Execute eligible pending work now, otherwise return the last result. Does not release a pure leading-only cooldown. |

Calling or flushing the wrapper returns the most recent callback return value, including a pending promise, or `undefined` until the first successful return. For example, `await debouncedSave(value)` may await the promise from a previous invocation or complete before the scheduled callback starts. Handle promise rejections inside the callback or track completion separately. [`throttle`](#throttlefn-milliseconds-options)
measures ordinary invocation spacing from the last actual invocation, including a
trailing one; explicit flush/cancel override normal rate control. It limits starts,
not concurrent asynchronous operations. Host timers can run late. Elapsed-time
calculations use a captured, receiver-bound `performance.now()` when available,
so system wall-clock adjustments do not move scheduling windows. Minimal hosts
without that method fall back to `Date.now()` and do not receive that guarantee.
Clock selection happens at wrapper construction, not import: install fake timers
and their monotonic clock before constructing wrappers in tests.

A clock failure during expiry or while flushing discards that operation's pending work,
retains the most recent callback return value and propagates the original error. Later calls
can schedule again. If clock instrumentation cancels or replaces the work during
the read, the interrupted operation leaves that newer state intact; it does not
invoke the replacement early or orphan its timer.

Immediate or flushed callback exceptions propagate to the caller. A timer-triggered
exception is reported by the host just as with `setTimeout`; returned rejected
promises are not intercepted. Handle asynchronous failures inside the callback or
on the returned promise. Dispose scheduled wrappers during application cleanup.

Partial application does not bind `this`, clone saved values, pad omitted slots,
interpret placeholders or adapt constructors. Saved object references remain live.
[`partialRight`](#partialrightfn-args) appends after however many inputs are actually supplied. When an
optional prefix slot precedes a bound suffix, explicitly supply that slot (possibly
as `undefined`) to avoid shifting arguments. Type declarations enforce this.
For a callback ending in a rest parameter, right-bound values must match its rest
item type; ambiguous variadic splitting needs a typed adapter. TypeScript callbacks
with overloads or high polymorphism may likewise need an explicit adapter.
A union of saved tuples must satisfy every possible binding. For a fixed-arity
callback, narrow differently sized tuples before binding so the remaining argument
count is known; equal-length alternatives and compatible rest suffixes remain usable.

## TypeScript

Each top-level function has a `go-fns/<exportName>` entry sharing its root export's identity and contract. CommonJS returns the callable directly; ES modules supply named and default exports. Named function imports require `Node16`, `NodeNext` or `Bundler` resolution. Legacy `Node` resolution supports CommonJS and default function imports with interop; named root imports remain available.

TypeScript declarations are included; no separate `@types` package is required.

Consumer declarations support TypeScript 5.4 or later and are checked with 5.4.5 and 5.8.3. The 5.4 inference controls preserve callback parameter and argument checking. They support default and named imports, CommonJS imports, function subpaths and existing public `src/` module paths.

For mixed `import`/`require` projects using `module: "preserve"` and
`moduleResolution: "bundler"`, use TypeScript 5.8.3 or later. TypeScript 5.4.5 can
resolve a named function-subpath import through its CommonJS declaration when a
`require` import appears first. Both import orders are checked with 5.8.3. With
5.4.5, use NodeNext resolution or an ESM-only Bundler project; those configurations
retain callback and argument checking.

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

### Positional default arguments

[`withDefaultArgs`](#withdefaultargsfn-defaultargs) takes its parameter, receiver and result types from the callback. Defaults must fit those types and cannot widen them. A defined default makes a position omittable only when no later required position needs its slot. An `undefined` or possibly `undefined` default does not satisfy a required defined input. Supplied defaults also materialise rest positions, so a rest parameter can acquire a required input.

```typescript
import { withDefaultArgs } from 'go-fns';

const createEntry = (count: number, level: 'info' | 'error') => ({ count, level });
const createEntryWithDefaults = withDefaultArgs(createEntry, 1, 'info');
const entry = createEntryWithDefaults(undefined, 'error'); // { count: number; level: 'info' | 'error' }

const needsLevel = withDefaultArgs(createEntry, 1);
needsLevel(undefined, 'error'); // Keep the required second argument in its own position.

const sum = (...values: number[]) => values.reduce((total, value) => total + value, 0);
const sumWithDefaults = withDefaultArgs(sum, undefined, 2);
sumWithDefaults(3); // The first position still requires a number.
```

Defaults must form a finite tuple; unknown-length arrays are rejected. Optional tuple spreads are treated conservatively: a possibly missing default does not establish a defined fallback. Callback unions, parameter-tuple unions and default-tuple unions must be narrowed or adapted first. Concrete fixed, optional and homogeneous-rest parameter types retain their useful inference; a required suffix after an open rest list needs a concrete typed adapter. Overloaded callbacks use one coherent final signature. Generic relationships are erased conservatively, so a generic identity callback returns `unknown`; use a typed adapter such as `(value: string) => identity(value)` when a specific signature is needed. Type predicates become ordinary `boolean` results and assertion signatures become `void`: substituting an input cannot safely narrow the caller's original value. Construct signatures are not carried over.

### Other inference limits

Dense pipelines have contextual inference for up to eight stages. Longer typed
tuples and nullish gaps remain checked; annotate the affected stage parameters for
useful inference. Nested factories such as [`tap`](#tapobserver)/[`tapAsync`](#tapasyncobserver) may also need an observer
parameter annotation: `tap((title: string) => console.log(title))`. A conditional
stage includes both execution paths in its types.
Runtime-length function arrays include `undefined` in their output because the
array could be empty. Their inputs and receivers must satisfy every possible stage. Highly polymorphic/overloaded callbacks may need a typed
adapter; declarations cannot prove the behaviour of arbitrary dynamic JavaScript.
For captured overloaded callbacks, accepted arguments and the result follow the
same final signature. Wrap a different overload in an explicitly typed callback.

Direct execution helpers infer callback inputs from supplied arguments. When
explicit `undefined` triggers a default alongside other supplied arguments, annotate
that defaulted parameter, for example `(value: number = 1, suffix)`. This keeps
ordinary `undefined` inputs accurately typed while checking the callback body.

Unions passed to direct execution helpers must satisfy every possible callback's
arguments; a valid union member cannot hide an invalid alternative.
Receiver requirements are retained. For [`attempt`](#attemptfn-args), the result type is `unknown`
because arbitrary thrown values cannot be distinguished from successful results.
`Result<T>` provides safe narrowing instead. Heterogeneous [`spread`](#spreadfn) inputs require
correctly typed tuples, including any required prefix or suffix. Only homogeneous
variadic callbacks without required positional slots also accept typed object
array-likes. Primitive strings are rejected even though they satisfy TypeScript's
structural `ArrayLike<string>` type; boxed strings remain valid objects.

[`once`](#oncefn) exposes a stable captured-result type. A generic callback such as
`<T>(value: T) => T` produces an `unknown` cached result: a later numeric argument
cannot change a string cached by the first call. Concrete callbacks retain their
concrete return types. Unions of callbacks must satisfy every possible input and
receiver requirement; overloaded or highly polymorphic callbacks may need a typed
adapter rather than preserving an unsafe per-invocation relationship. For captured
callbacks in [`once`](#oncefn), pipelines and [`partialRight`](#partialrightfn-args), a union member with unrestricted
`this: any` does not remove another member's concrete receiver requirement. The
same rule applies between stages of a dense pipeline and between callbacks in
[`when`](#whenpredicate-transform) and [`ifElse`](#ifelsepredicate-ontrue-onfalse), including their synchronous type-guard overloads.

Logical composition supports compatible structural requirements, including optional
predicates. Every callback that might run contributes its required inputs and
receiver. Async logical composition preserves the same input and receiver
requirements and returns `Promise<boolean>`; it does not unwrap promise arguments
or narrow their types after awaiting. [`whenAsync`](#whenasyncpredicate-transform) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse) retain original
callback input requirements and await their returned values; an awaited decision
does not create a type guard or complement narrowing for either branch. [`ifElse`](#ifelsepredicate-ontrue-onfalse)
supports synchronous single-value type guards and narrows both branches.

For [`whenAsync`](#whenasyncpredicate-transform) and [`ifElseAsync`](#ifelseasyncpredicate-ontrue-onfalse), an annotated callback supplies context for
compatible unannotated callbacks, including the predicate. If callback inputs or
receivers cannot share a context, annotate the affected parameters and `this`
explicitly. Unannotated callbacks without a known input type cannot access
arbitrary input members.

<!-- prettier-ignore -->
```typescript
import { and, andAsync, ifElse, partialRight } from 'go-fns';

const canPublish = and(
  (user: { active: boolean }) => user.active,
  (user: { verified: boolean }) => user.verified
);
canPublish({ active: true, verified: true });

const canPublishAsync = andAsync(
  (user: { active: boolean }) => user.active,
  async (user: { verified: boolean }) => user.verified
);
const permitted: Promise<boolean> = canPublishAsync({ active: true, verified: true });

const format = ifElse(
  (value: string | number): value is string => typeof value === 'string',
  value => value.toUpperCase(),
  value => value.toFixed(2)
);
format(12.5);                  // => '12.50'

const withFlag = partialRight(
  (label: string, count?: number, ...flags: boolean[]) => ({ label, count, flags }),
  true
);
withFlag('export', undefined); // Keep the optional position before the saved flag.
```

The signal interface is structural, so pure ES-library type configurations do not
need DOM declarations just to import the package. [`delay`](#delayfn-milliseconds-args) uses the ambient host's
timer-handle type (or `unknown` when no host timers are declared). Its callback's
platform-dependent `this` is not checked; bind callbacks that require a particular
receiver. Timer option properties accept explicit `undefined` to select their
defaults, including with `exactOptionalPropertyTypes` enabled.
