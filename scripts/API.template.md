# Go Functions API reference

Version [{{VERSION}}](../CHANGELOG.md). Return to the [README](../README.md) for installation, runtime requirements and usage.

## Contents

{{TOC}}

## API summary

<!-- prettier-ignore-start -->

The 32 root exports, attached aliases and scheduler methods form the public API. The aliases are the same function objects as their named exports. A `?` marks an optional parameter. `T` denotes a callback or branch result and `V` the input value type; async result helpers await their results. Signatures summarise call shapes; the full declarations preserve argument and receiver constraints. `TimerHandle` follows the host timer type. See [TypeScript](#typescript) for inference and receiver requirements.

**Functions**

| API | Description | Returns |
| --- | --- | --- |
| [`pipe(...fns)`](#pipefns) | Creates a function that runs synchronous stages from left to right. | **`Function`** — `(...args) => T \| undefined`<br><br>A pipeline that returns the last stage result, or `undefined` when there are no stages. |
| [`pipeAsync(...fns)`](#pipeasyncfns) | Creates a function that runs stages from left to right, awaiting each result. | **`Function`** — `(...args) => Promise<Awaited<T> \| undefined>`<br><br>A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages. |
| [`spread(fn)`](#spreadfn) | Creates a function that passes an array-like input to its callback as individual arguments. | **`Function`** — `(args) => T`<br><br>A wrapper that spreads the supplied argument list and returns the callback result. |
| [`attempt(fn, ...args)`](#attemptfn-args) | Invokes a callback synchronously and returns its result or the exact value it throws. | **`unknown`**<br><br>The callback result, or the exact value thrown synchronously. |
| [`attemptResult(fn, ...args)`](#attemptresultfn-args) | Invokes a callback synchronously and reports success or failure in a result object. | **`Result<T>`**<br><br>A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw. |
| [`attemptResultAsync(fn, ...args)`](#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`tap(observer)`](#tapobserver) | Creates a function that calls an observer with one value and returns that value unchanged. | **`Function`** — `(value: V) => V`<br><br>A wrapper that calls the observer and returns the exact input value or reference. |
| [`tapAsync(observer)`](#tapasyncobserver) | Creates a function that awaits an observer before returning its input value. | **`Function`** — `(value: V) => Promise<Awaited<V>>`<br><br>A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped. |
| [`sleep(milliseconds?, options?)`](#sleepmilliseconds-options) | Creates a promise that resolves after a cancellable pause. | **`Promise<void>`**<br><br>A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted. |
| [`once(fn)`](#oncefn) | Creates a function that invokes its callback at most once and caches the first outcome. | **`Function`** — `(...args) => T`<br><br>A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls. |
| [`repeat(fn, count?, ...args)`](#repeatfn-count-args) | Invokes a callback a specified number of times synchronously and collects its results. | **`T[]`**<br><br>A fresh array containing each synchronous callback result in invocation order. |
| [`delay(fn, milliseconds?, ...args)`](#delayfn-milliseconds-args) | Schedules a callback through the host's `setTimeout` and returns its timer handle. | **`TimerHandle`**<br><br>The native timeout handle: a browser number or a Node.js `Timeout` object. |
| [`and(...fns)`](#andfns) | Creates a predicate that determines whether all supplied predicates return truthy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are truthy; otherwise `false`. |
| [`andAsync(...fns)`](#andasyncfns) | Creates a predicate that awaits results in order and determines whether all are truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if at least one predicate is supplied and all awaited results are truthy; otherwise `false`. |
| [`or(...fns)`](#orfns) | Creates a predicate that determines whether any supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if any result is truthy; otherwise `false`. |
| [`orAsync(...fns)`](#orasyncfns) | Creates a predicate that awaits results in order and determines whether any is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if any awaited result is truthy; otherwise `false`. |
| [`xor(...fns)`](#xorfns) | Creates a predicate that determines whether exactly one supplied predicate returns a truthy value. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if exactly one result is truthy; otherwise `false`. |
| [`xorAsync(...fns)`](#xorasyncfns) | Creates a predicate that awaits results in order and determines whether exactly one is truthy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` for exactly one truthy result; it stops at the second truthy result and otherwise resolves to `false`. |
| [`nor(...fns)`](#norfns) | Creates a predicate that determines whether all supplied predicates return falsy values. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if at least one predicate is supplied and all results are falsy; otherwise `false`. |
| [`norAsync(...fns)`](#norasyncfns) | Creates a predicate that awaits results in order and determines whether all are falsy. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` if at least one predicate is supplied and all awaited results are falsy; otherwise `false`. |
| [`not(fn)`](#notfn) | Creates a predicate that negates its callback's truthiness. | **`Function`** — `(...args) => boolean`<br><br>A predicate returning `true` if the callback result is falsy; otherwise `false`. |
| [`notAsync(fn)`](#notasyncfn) | Creates a predicate that awaits its callback result and negates its truthiness. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if the awaited callback result is falsy; otherwise `false`. |
| [`debounce(fn, milliseconds?, options?)`](#debouncefn-milliseconds-options) | Creates a function that combines a burst of calls using the latest arguments and receiver. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the last completed result or `undefined`, with `cancel`, `flush` and `pending` methods. |
| [`throttle(fn, milliseconds?, options?)`](#throttlefn-milliseconds-options) | Creates a function that limits callback invocation frequency while calls continue. | **`Function`** — `(...args) => T \| undefined`<br><br>A scheduled wrapper returning the last completed result or `undefined`, with `cancel`, `flush` and `pending` methods. |
| [`partial(fn, ...args)`](#partialfn-args) | Creates a function that prepends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after prepending the saved arguments. |
| [`partialRight(fn, ...args)`](#partialrightfn-args) | Creates a function that appends saved arguments to each call without binding its receiver. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after appending the saved arguments. |
| [`unary(fn)`](#unaryfn) | Creates a function that forwards exactly one argument to its callback. | **`Function`** — `(value) => T`<br><br>A wrapper returning the callback result after passing exactly one argument. |
| [`when(predicate, transform)`](#whenpredicate-transform) | Creates a function that transforms one value when a predicate is truthy and otherwise returns it unchanged. | **`Function`** — `(value: V) => V \| T`<br><br>A wrapper returning the transform result when the predicate is truthy; otherwise the original input. |
| [`whenAsync(predicate, transform)`](#whenasyncpredicate-transform) | Creates a function that awaits a predicate and conditionally transforms one input. | **`Function`** — `(value: V) => Promise<Awaited<V \| T>>`<br><br>A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. |
| [`ifElse(predicate, onTrue, onFalse)`](#ifelsepredicate-ontrue-onfalse) | Creates a function that evaluates a predicate once and calls the matching branch. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise. |
| [`ifElseAsync(predicate, onTrue, onFalse)`](#ifelseasyncpredicate-ontrue-onfalse) | Creates a function that awaits a predicate and runs only the matching branch. | **`Function`** — `(...args) => Promise<Awaited<T>>`<br><br>A wrapper resolving to the awaited result of `onTrue` for a truthy decision, or `onFalse` otherwise. |
| [`repeatAsync(fn, count?, ...args)`](#repeatasyncfn-count-args) | Invokes a callback a specified number of times sequentially, awaiting each result. | **`Promise<Awaited<T>[]>`**<br><br>A promise resolving to a fresh array of sequentially awaited callback results in invocation order. |

**Attached variants and scheduler methods**

| API | Description | Returns |
| --- | --- | --- |
| [`pipe.async(...fns)`](#pipeasyncfns) | Creates a function that runs stages from left to right, awaiting each result. Alias of `pipeAsync`. | **`Function`** — `(...args) => Promise<Awaited<T> \| undefined>`<br><br>A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages. |
| [`attempt.result(fn, ...args)`](#attemptresultfn-args) | Invokes a callback synchronously and reports success or failure in a result object. Alias of `attemptResult`. | **`Result<T>`**<br><br>A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw. |
| [`attempt.resultAsync(fn, ...args)`](#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. Alias of `attemptResultAsync`. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`attemptResult.async(fn, ...args)`](#attemptresultasyncfn-args) | Invokes a callback, awaits its result and reports success or failure in a result object. Alias of `attemptResultAsync`. | **`Promise<Result<Awaited<T>>>`**<br><br>A promise resolving to a success object with the awaited value, or a failure object with the thrown or rejected value. |
| [`tap.async(observer)`](#tapasyncobserver) | Creates a function that awaits an observer before returning its input value. Alias of `tapAsync`. | **`Function`** — `(value: V) => Promise<Awaited<V>>`<br><br>A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped. |
| [`and.async(...fns)`](#andasyncfns) | Creates a predicate that awaits results in order and determines whether all are truthy. Alias of `andAsync`. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if at least one predicate is supplied and all awaited results are truthy; otherwise `false`. |
| [`or.async(...fns)`](#orasyncfns) | Creates a predicate that awaits results in order and determines whether any is truthy. Alias of `orAsync`. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if any awaited result is truthy; otherwise `false`. |
| [`xor.async(...fns)`](#xorasyncfns) | Creates a predicate that awaits results in order and determines whether exactly one is truthy. Alias of `xorAsync`. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` for exactly one truthy result; it stops at the second truthy result and otherwise resolves to `false`. |
| [`nor.async(...fns)`](#norasyncfns) | Creates a predicate that awaits results in order and determines whether all are falsy. Alias of `norAsync`. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate resolving to `true` if at least one predicate is supplied and all awaited results are falsy; otherwise `false`. |
| [`not.async(fn)`](#notasyncfn) | Creates a predicate that awaits its callback result and negates its truthiness. Alias of `notAsync`. | **`Function`** — `(...args) => Promise<boolean>`<br><br>A predicate whose promise resolves to `true` if the awaited callback result is falsy; otherwise `false`. |
| [`partial.right(fn, ...args)`](#partialrightfn-args) | Creates a function that appends saved arguments to each call without binding its receiver. Alias of `partialRight`. | **`Function`** — `(...args) => T`<br><br>A wrapper returning the callback result after appending the saved arguments. |
| [`when.async(predicate, transform)`](#whenasyncpredicate-transform) | Creates a function that awaits a predicate and conditionally transforms one input. Alias of `whenAsync`. | **`Function`** — `(value: V) => Promise<Awaited<V \| T>>`<br><br>A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. |
| [`ifElse.async(predicate, onTrue, onFalse)`](#ifelseasyncpredicate-ontrue-onfalse) | Creates a function that awaits a predicate and runs only the matching branch. Alias of `ifElseAsync`. | **`Function`** — `(...args) => Promise<Awaited<T>>`<br><br>A wrapper resolving to the awaited result of `onTrue` for a truthy decision, or `onFalse` otherwise. |
| [`repeat.async(fn, count?, ...args)`](#repeatasyncfn-count-args) | Invokes a callback a specified number of times sequentially, awaiting each result. Alias of `repeatAsync`. | **`Promise<Awaited<T>[]>`**<br><br>A promise resolving to a fresh array of sequentially awaited callback results in invocation order. |
| [`debounce().cancel()`](#debouncecancel) | Discards pending calls and resets scheduling, retaining the last completed result. | **`undefined`**<br><br>`undefined` after discarding pending work; the last completed result is retained. |
| [`debounce().flush()`](#debounceflush) | Invokes eligible pending work immediately, or returns the last completed result. | **`T \| undefined`**<br><br>The result of eligible pending work run immediately, or the last completed result; `undefined` before any completion. |
| [`debounce().pending()`](#debouncepending) | Determines whether a callback invocation is scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |
| [`throttle().cancel()`](#throttlecancel) | Discards pending calls and resets scheduling, retaining the last completed result. | **`undefined`**<br><br>`undefined` after discarding pending work; the last completed result is retained. |
| [`throttle().flush()`](#throttleflush) | Invokes eligible pending work immediately, or returns the last completed result. | **`T \| undefined`**<br><br>The result of eligible pending work run immediately, or the last completed result; `undefined` before any completion. |
| [`throttle().pending()`](#throttlepending) | Determines whether a callback invocation is scheduled. | **`boolean`**<br><br>`true` if a callback invocation is scheduled; otherwise `false`, including a cooldown or in-flight promise alone. |

Examples containing `await` are intended for an async function or an ES module.
Examples use modern JavaScript syntax; the object-spread and native
`AbortController` examples need a host that supports those features even when the
library itself works on an older runtime.

**Attached variant identity**

```javascript
const {
  pipe, pipeAsync, attempt, attemptResult, attemptResultAsync,
  tap, tapAsync, and, andAsync, or, orAsync, not, notAsync,
  xor, xorAsync, nor, norAsync, when, whenAsync, ifElse, ifElseAsync,
  partial, partialRight, repeat, repeatAsync
} = require('go-fns');

pipe.async === pipeAsync;                    // => true
attempt.result === attemptResult;            // => true
attempt.resultAsync === attemptResultAsync;  // => true
attemptResult.async === attemptResultAsync;  // => true
tap.async === tapAsync;                      // => true
and.async === andAsync;                      // => true
or.async === orAsync;                        // => true
not.async === notAsync;                      // => true
xor.async === xorAsync;                      // => true
nor.async === norAsync;                      // => true
when.async === whenAsync;                    // => true
ifElse.async === ifElseAsync;                // => true
partial.right === partialRight;              // => true
repeat.async === repeatAsync;                // => true
```

<!-- prettier-ignore-end -->

## Utility

### `pipe(...fns)`

Creates a function that runs synchronous stages from left to right.

The first stage receives all call arguments; each later stage receives the preceding result. Stages share the caller's `this`. Nullish stages are skipped, and promises are passed through without awaiting.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Stages in left-to-right order. Nullish entries are skipped; other invalid entries throw immediately. |

**Returns:** `Function` with signature `(...args) => T | undefined`. A pipeline that returns the last stage result, or `undefined` when there are no stages.

**Errors:** `TypeError`: If a stage is neither a function, `null` nor `undefined`. Errors from later stage calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { pipe } = require('go-fns');

const floorThenRoot = pipe(Math.floor, Math.sqrt);
floorThenRoot(4.5);                                // => 2
pipe(Math.floor)(4.5);                             // => 4
pipe((a, b) => a + b, value => value * 2)(2, 3);   // => 10
pipe(null, value => value + 1, undefined)(2);      // => 3
pipe()(42);                                        // => undefined
pipe(123);                                         // => throws TypeError

const context = { multiplier: 3 };
const multiply = pipe(function (value) {
  return value * this.multiplier;
});
multiply.call(context, 4);                         // => 12
```

**Since:** 1.0.0.

---

### `spread(fn)`

Creates a function that passes an array-like input to its callback as individual arguments.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Arrays, typed arrays and array-like objects work; `null` or `undefined` supplies no arguments. Iterability alone does not expand a collection.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback. The returned function takes one array-like argument list; nullish input supplies no arguments. |

**Returns:** `Function` with signature `(args) => T`. A wrapper that spreads the supplied argument list and returns the callback result.

**Errors:** `TypeError`: If `fn` is not a function, or a later argument list is primitive and non-nullish. Argument-list getter and callback errors propagate unchanged.

**Examples**

<!-- prettier-ignore -->
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

### `attempt(fn, ...args)`

Invokes a callback synchronously and returns its result or the exact value it throws.

The callback itself is its receiver; bind it to supply another `this`. Returned and thrown values are indistinguishable. Promises are returned unchanged, and later rejections are not caught.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required synchronous callback; the callback itself is its receiver. |
| `...args` | Callback parameter types | Arguments passed to the callback. |

**Returns:** `unknown` — The callback result, or the exact value thrown synchronously.

**Errors:** `TypeError`: If `fn` is not a function; validation happens outside the catch.

**Examples**

<!-- prettier-ignore -->
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

**Errors:** `TypeError`: If `fn` is not a function or `count` is non-nullish and not a number. `RangeError`: If `count` is not an integer in the supported range. Callback errors stop further calls and propagate.

**Examples**

<!-- prettier-ignore -->
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

### `delay(fn, milliseconds?, ...args)`

Schedules a callback through the host's `setTimeout` and returns its timer handle.

Duration coercion, scheduling and the callback receiver follow the host timer. Use `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback synchronously.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback scheduled through the host timer. |
| `milliseconds?` | `number`, `null`, or `undefined` | Host default | Declaration input type. JavaScript values pass unchanged to native `setTimeout`; host coercion and clamping apply. |
| `...args` | Callback parameter types | — | Arguments supplied to the callback by the host timer. |

**Returns:** `TimerHandle` — The native timeout handle: a browser number or a Node.js `Timeout` object.

**Errors:** `TypeError`: If `fn` is not a function. Scheduling errors propagate; later callback errors are reported by the host.

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

### `pipeAsync(...fns)`

Creates a function that runs stages from left to right, awaiting each result.

The first stage receives all call arguments; each later stage receives one awaited result. Stages share the caller's `this`. Nullish stages are skipped. Construction validates immediately; calling the pipeline starts the first stage and returns a promise.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Sequential stages. All entries are validated at construction; nullish entries are skipped. |

**Returns:** `Function` with signature `(...args) => Promise<Awaited<T> | undefined>`. A pipeline whose promise resolves to the last awaited result, or `undefined` when there are no stages.

**Errors:** `TypeError`: If a stage is neither a function, `null` nor `undefined`. When called, the pipeline rejects with the original stage failure.

**Examples**

<!-- prettier-ignore -->
```javascript
const { pipeAsync } = require('go-fns');

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
```

**Notes**

The result is a function that always returns a promise. The first stage begins during
invocation; later stages wait for the previous result. A throw or rejection stops
the sequence and rejects with the original failure. Thenables are assimilated.
There is no automatic retry, parallel execution or cancellation of stages.

**Alias:** `pipe.async`. **Since:** 2.0.0.

---

### `attemptResult(fn, ...args)`

Invokes a callback synchronously and reports success or failure in a result object.

Check `ok` to distinguish a returned value from a thrown value. The callback itself is its receiver. Promises are successful values without awaiting; later rejections are not caught.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required synchronous callback; the callback itself is its receiver. |
| `...args` | Callback parameter types | Arguments passed to the callback. |

**Returns:** `Result<T>` — A fresh `{ ok: true, value }` object on success, or `{ ok: false, error }` on a synchronous throw.

**Errors:** `TypeError`: If `fn` is not a function; invalid callbacks throw instead of producing a failure result.

**Examples**

<!-- prettier-ignore -->
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

**Alias:** `attempt.result`. **Async variant:** `attemptResultAsync` or
`attemptResult.async`. **Since:** 2.0.0.

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

**Errors:** Rejects with `TypeError` if `fn` is not a function.

**Examples**

<!-- prettier-ignore -->
```javascript
const { attemptResultAsync } = require('go-fns');

const loadSettings = async userId => ({ userId, theme: 'dark' });
const result = await attemptResultAsync(loadSettings, 'user-42');
if (result.ok) {
  console.log(result.value.theme);                       // => 'dark'
} else {
  console.error('Loading settings failed:', result.error);
}

const reason = { code: 'SETTINGS_UNAVAILABLE' };
await attemptResultAsync(() => Promise.reject(reason));  // => { ok: false, error: reason }
```

**Notes**

Unlike callback failures, invalid callback
configuration rejects that promise with `TypeError`; it does not resolve to a failed
result. This operation is not a blanket never-rejects API.

**Aliases:** `attempt.resultAsync`, `attemptResult.async`. **Since:** 2.0.0.

---

### `tap(observer)`

Creates a function that calls an observer with one value and returns that value unchanged.

The observer receives the caller's `this`. Its return value is ignored without awaiting. Object identity is preserved, and mutations made by the observer remain visible.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `observer` | `Function` | Required observer. The wrapper forwards exactly one input and its caller’s receiver. |

**Returns:** `Function` with signature `(value: V) => V`. A wrapper that calls the observer and returns the exact input value or reference.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { pipe, tap } = require('go-fns');

const parsedPrices = [];
const priceInCents = pipe(
  Number,
  tap(price => parsedPrices.push(price)),
  price => Math.round(price * 100)
);

priceInCents('12.50');                                           // => 1250
parsedPrices;                                                    // => [12.5]

const listing = { title: 'Desk' };
tap(value => { value.reviewed = true; })(listing) === listing;   // => true
listing.reviewed;                                                // => true
```

**Notes**

Observer exceptions propagate. Observer
promises are not awaited or handled; use `tapAsync` for asynchronous side effects.

**Async variant:** `tapAsync` or `tap.async`. **Since:** 2.0.0.

---

### `tapAsync(observer)`

Creates a function that awaits an observer before returning its input value.

The observer receives exactly one input and the caller's `this`. A promise input reaches the observer unchanged, but the returned promise resolves to its awaited value.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `observer` | `Function` | Required synchronous or asynchronous observer; receives one input and the wrapper caller’s receiver. |

**Returns:** `Function` with signature `(value: V) => Promise<Awaited<V>>`. A wrapper whose promise resolves to the input after the observer completes; promise inputs are unwrapped.

**Errors:** `TypeError`: If `observer` is not a function. Later observer throws or rejections reject the wrapper promise.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { pipeAsync, tapAsync } = require('go-fns');

const audit = [];
const saveListing = async listing => ({ ...listing, id: 'listing-42' });
const recordAudit = async listing => { audit.push({ listingId: listing.id }); };

const publishListing = pipeAsync(
  saveListing,
  tapAsync(recordAudit),
  listing => listing.id
);

await publishListing({ title: 'Desk' });   // => 'listing-42'
audit;                                     // => [{ listingId: 'listing-42' }]
```

**Notes**

The promise resolves only after the
observer settles successfully. If called directly with a promise or thenable input,
the observer receives that input unchanged, but returning it from the async wrapper
naturally assimilates it: the final result is its resolved value, not the original
promise's identity. **Alias:** `tap.async`. **Since:** 2.0.0.

---

### `sleep(milliseconds?, options?)`

Creates a promise that resolves after a cancellable pause.

The host timer may run late. An already-aborted signal rejects without scheduling a timer. Later cancellation clears the timer; listener cleanup runs on success, cancellation or scheduling failure.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `milliseconds?` | `number` | `0` | Finite duration from 0 through 2147483647; omitted or `undefined` uses zero. Fractions use host timer precision; `null` is invalid. |
| `options?` | `object` | `undefined` | Optional non-null, non-array object. |
| `options.signal?` | `AbortSignalLike` | `undefined` | Optional structural signal with boolean `aborted`, `reason`, `addEventListener` and `removeEventListener`. |

**Returns:** `Promise<void>` — A promise resolving to `undefined` after the timer, or rejecting if the pause is aborted.

**Errors:** Rejects with `TypeError` for invalid argument types or `RangeError` for unsupported durations. Signal and host-timer errors also reject the promise.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { sleep } = require('go-fns');

// Resolves after a host timer.
await sleep(1);                    // => undefined

const controller = new AbortController();
const reason = new Error('The screen was closed');
const pending = sleep(1000, { signal: controller.signal });
controller.abort(reason);

try {
  await pending;
} catch (error) {
  console.log(error === reason);   // => true
}
```

**Notes**

Invalid arguments reject (`TypeError` for types,
`RangeError` for unsupported numeric durations). An already-aborted signal rejects
without starting a timer. Later cancellation rejects with the exact `signal.reason`
and clears the timer. The abort listener is removed after success, cancellation or
scheduling failure. Synthetic `abort` events do not cancel a still-live signal.

Cancelling a wait does not cancel an unrelated network request or callback. To cancel
another operation, that operation must separately support and receive a signal.
**Since:** 2.0.0.

---

### `once(fn)`

Creates a function that invokes its callback at most once and caches the first outcome.

The first call supplies the arguments and `this`; later calls ignore their inputs. Exact returned values, promise identity and thrown values are cached. Failures are not retried, and creating the wrapper does not invoke the callback.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback. The returned wrapper is an ordinary function, not a constructor. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper that caches the first returned value or promise, or rethrows the first thrown value on subsequent calls.

**Errors:** `TypeError`: If `fn` is not a function. `Error`: If the wrapper is called recursively before its first callback returns. An uncaught recursive-call error becomes the cached failure.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { once } = require('go-fns');

const getFormatter = once(() => new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD'
}));

getFormatter() === getFormatter();   // => true
getFormatter().format(12.5);         // => '$12.50'

let calls = 0;
const loadSettings = once(async () => {
  calls++;
  return { theme: 'dark' };
});

const first = loadSettings();
const second = loadSettings();
// The wrapper returns the exact same promise.
first === second;                    // => true
await first;
calls;                               // => 1
```

**Notes**

The result is a wrapper that caches exact returned values, including `undefined` and
promises. A synchronous throw is cached and rethrown unchanged. Rejected promises
remain cached too; `once` is not retry-until-success. The wrapper does not inspect
or attach handlers to returned promises, so callers still handle rejections.

Calling the wrapper recursively before the first callback returns throws a
descriptive reentrancy `Error`. If the callback does not catch it, that error becomes
the cached failure. Each wrapper has independent state. No `reset`, key-based cache,
retry or argument-specific memoisation is provided. **Since:** 2.0.0.

---

### `debounce(fn, milliseconds?, options?)`

Creates a function that combines a burst of calls using the latest arguments and receiver.

Defaults to trailing execution after calls stop. Optional `maxWait` limits postponement while calls continue, subject to host timer scheduling. Construction does not invoke the callback. `cancel()`, `flush()` and `pending()` manage scheduled calls; started asynchronous work continues.

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

**Returns:** `Function` with signature `(...args) => T | undefined`. A scheduled wrapper returning the last completed result or `undefined`, with `cancel`, `flush` and `pending` methods.

**Errors:** `TypeError`: If callback, duration or option types are invalid. `RangeError`: If a duration is outside its supported range. Immediate callback errors propagate; timer callback errors go to the host.

**Examples**

<!-- prettier-ignore -->
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

The methods below belong to the returned `debounce` wrapper. Each takes no
arguments and can be called separately from the wrapper. A completed callback
means the callback has returned; it does not mean a returned promise has settled.

---

### `debounce().cancel()`

Discards pending calls and resets scheduling, retaining the last completed result. Cancelling does not undo a completed callback.

**Parameters:** None.

**Returns:** `undefined` — `undefined` after discarding scheduled work. Work already started continues.

**Errors:** Host timer errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const scheduled = debounce(value => value, 100);
scheduled("pending");
scheduled.cancel();            // => undefined
scheduled.pending();           // => false
```

---

### `debounce().flush()`

Invokes eligible pending work immediately, or returns the last completed result. A leading-only cooldown remains active.

**Parameters:** None.

**Returns:** `T | undefined` — The callback result when pending work runs, or the previous result otherwise; `undefined` before any successful completion.

**Errors:** Callback, clock and host timer errors propagate. Returned promises are not awaited or caught.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const scheduled = debounce(value => value, 100);
scheduled("latest");
scheduled.flush();             // => "latest"
scheduled.pending();           // => false
```

---

### `debounce().pending()`

Determines whether a callback invocation is scheduled.

**Parameters:** None.

**Returns:** `boolean` — `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.

**Examples**

<!-- prettier-ignore -->
```javascript
const { debounce } = require('go-fns');

const scheduled = debounce(value => value, 100);
scheduled.pending();           // => false
scheduled("pending");
scheduled.pending();           // => true
scheduled.cancel();
```

See [scheduling and argument adaptation](#scheduling-and-argument-adaptation)
for timer and asynchronous-work rules.

---

### `throttle(fn, milliseconds?, options?)`

Creates a function that limits callback invocation frequency while calls continue.

Defaults to leading and trailing execution; a lone leading call is not repeated. Uses the latest arguments and receiver. `flush()` and `cancel()` can override ordinary spacing. Invocation starts are limited; asynchronous work is not serialised or cancelled.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `Function` | — | Required callback to schedule. |
| `milliseconds?` | `number` | `0` | Finite spacing from 0 through 2147483647. |
| `options?` | `object` | `undefined` | Optional non-null, non-array object. |
| `options.leading?` | `boolean` | `true` | Invoke on the leading edge. |
| `options.trailing?` | `boolean` | `true` | Invoke on the trailing edge. |

**Returns:** `Function` with signature `(...args) => T | undefined`. A scheduled wrapper returning the last completed result or `undefined`, with `cancel`, `flush` and `pending` methods.

**Errors:** `TypeError`: If callback, duration or option types are invalid. `RangeError`: If the duration is outside its supported range. Immediate callback errors propagate; timer callback errors go to the host.

**Examples**

<!-- prettier-ignore -->
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
savePosition(30); // Replaces the pending input, not the completed result.
console.log(savedPositions);         // => [10]

// A deliberate final flush, e.g. when finishing an interaction.
console.log(savePosition.flush());   // => 30
console.log(savedPositions);         // => [10, 30]
savePosition.cancel();
```

**Returned wrapper methods**

The methods below belong to the returned `throttle` wrapper. Each takes no
arguments and can be called separately from the wrapper. A completed callback
means the callback has returned; it does not mean a returned promise has settled.

---

### `throttle().cancel()`

Discards pending calls and resets scheduling, retaining the last completed result. Cancelling does not undo a completed callback.

**Parameters:** None.

**Returns:** `undefined` — `undefined` after discarding scheduled work. Work already started continues.

**Errors:** Host timer errors propagate.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const scheduled = throttle(value => value, 100, { leading: false });
scheduled("pending");
scheduled.cancel();            // => undefined
scheduled.pending();           // => false
```

---

### `throttle().flush()`

Invokes eligible pending work immediately, or returns the last completed result. A leading-only cooldown remains active.

**Parameters:** None.

**Returns:** `T | undefined` — The callback result when pending work runs, or the previous result otherwise; `undefined` before any successful completion.

**Errors:** Callback, clock and host timer errors propagate. Returned promises are not awaited or caught.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const scheduled = throttle(value => value, 100, { leading: false });
scheduled("latest");
scheduled.flush();             // => "latest"
scheduled.pending();           // => false
```

---

### `throttle().pending()`

Determines whether a callback invocation is scheduled.

**Parameters:** None.

**Returns:** `boolean` — `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.

**Examples**

<!-- prettier-ignore -->
```javascript
const { throttle } = require('go-fns');

const scheduled = throttle(value => value, 100, { leading: false });
scheduled.pending();           // => false
scheduled("pending");
scheduled.pending();           // => true
scheduled.cancel();
```

See [scheduling and argument adaptation](#scheduling-and-argument-adaptation)
for timer and asynchronous-work rules.

---

### `partial(fn, ...args)`

Creates a function that prepends saved arguments to each call without binding its receiver.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Saved values are retained by reference. There are no placeholders or constructor adaptations.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to specialise. |
| `...args` | Callback parameter types | Saved arguments prepended on every call. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the callback result after prepending the saved arguments.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

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

Creates a function that appends saved arguments to each call without binding its receiver.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. Saved values are retained by reference. Omitted inputs are not padded; supply optional prefix positions explicitly when needed to keep saved arguments in place.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to specialise. |
| `...args` | Callback parameter types | Saved arguments appended on every call. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the callback result after appending the saved arguments.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

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

**Alias:** `partial.right`.

---

### `unary(fn)`

Creates a function that forwards exactly one argument to its callback.

The returned function forwards its caller's `this` to the callback and returns promises unchanged. An omitted input becomes one explicit `undefined`; additional arguments are ignored.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Function` | Required callback to adapt. |

**Returns:** `Function` with signature `(value) => T`. A wrapper returning the callback result after passing exactly one argument.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { unary } = require('go-fns');

// Prevent map's index from being interpreted as parseInt's radix argument.
const numbers = ['10', '20', '30'].map(unary(parseInt));
console.log(numbers);          // => [10, 20, 30]
```

---

### `when(predicate, transform)`

Creates a function that transforms one value when a predicate is truthy and otherwise returns it unchanged.

When called, the wrapper evaluates the predicate once. Both callbacks receive exactly one input and the caller's `this`. Predicate promises are truthy without awaiting; a transform result or promise is returned unchanged.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required synchronous truthiness test. |
| `transform` | `Function` | Required transformation run only for a truthy test. |

**Returns:** `Function` with signature `(value: V) => V | T`. A wrapper returning the transform result when the predicate is truthy; otherwise the original input.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { pipe, when } = require('go-fns');

const normaliseTitle = pipe(
  title => title.trim(),
  when(title => title.length === 0, () => 'Untitled listing')
);
console.log(normaliseTitle('  Mountain bike  '));  // => 'Mountain bike'
console.log(normaliseTitle('   '));                // => 'Untitled listing'
```

---

### `whenAsync(predicate, transform)`

Creates a function that awaits a predicate and conditionally transforms one input.

The predicate starts immediately when the wrapper is called and its result is awaited once. A truthy result selects the transform; a falsy result skips it. Both callbacks receive exactly one argument and the caller's exact `this`. They receive the original input without awaiting it first; an omitted input is passed as an explicit `undefined`, and surplus arguments are ignored.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required truthiness test returning a value, promise or thenable. |
| `transform` | `Function` | Required transformation receiving the original input only after the predicate's awaited result is truthy. |

**Returns:** `Function` with signature `(value: V) => Promise<Awaited<V | T>>`. A wrapper resolving to the awaited transform result for a truthy decision, or the awaited original input otherwise. It always returns a promise, including for synchronous callbacks.

**Errors:** `TypeError` is thrown synchronously by the factory if either required callback is not a function, including a transform that would never run. Callback throws, rejected results and failed thenable assimilation reject the wrapper's promise with the exact failure value.

**Examples**

<!-- prettier-ignore -->
```javascript
const { when, whenAsync } = require('go-fns');
const normaliseTitle = whenAsync(
  async title => title.trim().length === 0,
  () => 'Untitled listing'
);
await normaliseTitle('   ');                   // => 'Untitled listing'
await normaliseTitle('Mountain bike');         // => 'Mountain bike'
when.async === whenAsync;                     // => true
whenAsync(() => false, null);                  // => throws TypeError

const input = Promise.resolve(42);
let receivedInput;
const keepInput = whenAsync(
  value => { receivedInput = value; return false; },
  () => 0
);
const output = keepInput(input);
receivedInput === input;                      // => true
output === input;                             // => false
await output;                                 // => 42

const argumentCounts = [];
const fillMissing = whenAsync(
  function (value) { argumentCounts.push(arguments.length); return value === undefined; },
  function (value) { argumentCounts.push(arguments.length); return this.fallback; }
);
await fillMissing.call({ fallback: 'missing' }); // => 'missing'
argumentCounts;                                // => [1, 1]
```

**Notes**

On the falsy path the async wrapper returns the original input, so promise and thenable inputs are assimilated by its returned promise. A non-thenable object keeps its identity after awaiting; a promise input does not retain its promise identity. The transform starts only after the predicate has been awaited, even for a synchronous result. Concurrent wrapper invocations remain independent. Async decisions do not provide TypeScript type-guard or complement narrowing.

**Since:** 2.0.0. **Alias:** [`when.async`](#whenasyncpredicate-transform), the same function object.

---

### `ifElse(predicate, onTrue, onFalse)`

Creates a function that evaluates a predicate once and calls the matching branch.

All call arguments and the caller's `this` reach the predicate and selected branch. The other branch is not called. Predicate promises are truthy without awaiting; the selected branch result is returned unchanged.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required synchronous truthiness test. |
| `onTrue` | `Function` | Required truthy branch. |
| `onFalse` | `Function` | Required falsy branch. |

**Returns:** `Function` with signature `(...args) => T`. A wrapper returning the result of `onTrue` for a truthy predicate result, or `onFalse` otherwise.

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
```javascript
const { ifElse } = require('go-fns');

const describeAvailability = ifElse(
  listing => listing.available,
  listing => `${listing.title} is available`,
  listing => `${listing.title} is no longer available`
);
const listing = { title: 'Mountain bike', available: false };
console.log(describeAvailability(listing));  // => 'Mountain bike is no longer available'
```

---

### `ifElseAsync(predicate, onTrue, onFalse)`

Creates a function that awaits a predicate and runs only the matching branch.

The predicate starts immediately when the wrapper is called. Its result is awaited once, then exactly one branch runs according to the result's truthiness. The predicate and selected branch receive all original call arguments and the caller's exact `this`; input arguments are not awaited. The unselected branch is never called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `predicate` | `Function` | Required truthiness test returning a value, promise or thenable. |
| `onTrue` | `Function` | Required branch called only for a truthy awaited predicate result. |
| `onFalse` | `Function` | Required branch called only for a falsy awaited predicate result. |

**Returns:** `Function` with signature `(...args) => Promise<Awaited<T>>`. A wrapper resolving to the awaited result of the selected branch. It always returns a promise, including for synchronous decisions, branch results and throws.

**Errors:** `TypeError` is thrown synchronously by the factory if any required callback is not a function, including an unselected branch. A predicate or selected-branch throw, rejected result or failed thenable assimilation rejects the wrapper's promise with the exact failure value; a failed predicate prevents both branches from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const { andAsync, ifElse, ifElseAsync, norAsync, whenAsync } = require('go-fns');
const canPublish = andAsync(
  listing => listing.title.length > 0,
  norAsync(async listing => listing.blocked, listing => listing.archived)
);
const addCategory = whenAsync(
  async listing => !listing.category,
  listing => ({ ...listing, category: 'general' })
);
const describeListing = ifElseAsync(
  canPublish,
  async listing => listing.title + ' ready in ' + listing.category,
  listing => listing.title + ' needs review'
);
const listing = await addCategory({ title: 'Mountain bike', blocked: false, archived: false });
await describeListing(listing);                          // => 'Mountain bike ready in general'
await describeListing({ ...listing, blocked: true });    // => 'Mountain bike needs review'
ifElse.async === ifElseAsync;                            // => true
ifElseAsync(() => true, () => 'yes', undefined);          // => throws TypeError

const calls = [];
const choose = ifElseAsync(
  function (left, right) { calls.push('predicate'); return left + right === this.total; },
  async function (left, right) { calls.push('yes'); return this.total + left + right; },
  function () { calls.push('no'); return -1; }
);
const result = choose.call({ total: 5 }, 2, 3);
calls;                                                  // => ['predicate']
await result;                                           // => 10
calls;                                                  // => ['predicate', 'yes']
```

**Notes**

The selected branch starts only after the predicate result has been awaited, even if that result is synchronous. Its result is also awaited. Concurrent wrapper invocations remain independent. Async decisions do not narrow branch input types; use explicit checks or typed adapters when a branch needs a narrower type.

**Since:** 2.0.0. **Alias:** [`ifElse.async`](#ifelseasyncpredicate-ontrue-onfalse), the same function object.

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

**Errors:** Rejects with `TypeError` for an invalid callback or non-nullish non-number count, `RangeError` for an unsupported count, or the original callback failure.

**Examples**

<!-- prettier-ignore -->
```javascript
const { repeatAsync } = require('go-fns');

// A stand-in for a stateful paginated reader: only one read may run at a time.
let page = 0;
async function readNextPage() {
  return { page: ++page };
}
const pages = await repeatAsync(readNextPage, 3);
console.log(pages);            // => [{ page: 1 }, { page: 2 }, { page: 3 }]
```

**Alias:** `repeat.async`.

## Logic

All logical helpers synchronously create predicate functions and validate every supplied entry before any callback runs. Synchronous predicates return `true` or `false` using JavaScript truthiness. `andAsync`, `orAsync`, `xorAsync`, `norAsync` and `notAsync` always return a promise for a boolean when their predicates are called, using the truthiness of awaited callback results. Multi-predicate helpers ignore `null` and `undefined`; `not` and `notAsync` require a function.

### `and(...fns)`

Creates a predicate that determines whether all supplied predicates return truthy values.

Stops at the first falsy result. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty list returns `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if at least one predicate is supplied and all results are truthy; otherwise `false`.

**Errors:** `TypeError`: If an entry is neither a function, `null` nor `undefined`. All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
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

**Errors:** `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier predicate would short-circuit. A callback throw or rejected result rejects the returned predicate's promise with the exact same value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const { and, andAsync } = require('go-fns');
const isPositive = value => value > 0;
const isBelowTen = async value => value < 10;

await andAsync(isPositive, isBelowTen)(3);       // => true
await andAsync(isPositive, isBelowTen)(12);      // => false
await andAsync(null, isPositive, undefined)(3);  // => true
await andAsync()();                              // => false
await andAsync(null, undefined)();               // => false
andAsync(() => false, 123);                      // => throws TypeError
and.async === andAsync;                          // => true

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
```

**Notes**

The first reached callback starts during invocation. Each later callback starts only after the preceding result has been awaited, even when it is a synchronous value. Calls within one evaluation are sequential; concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0. **Alias:** [`and.async`](#andasyncfns), the same function object.

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

**Errors:** `TypeError`: If an entry is neither a function, `null` nor `undefined`. All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
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

**Errors:** `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier predicate would short-circuit. A callback throw or rejected result rejects the returned predicate's promise with the exact same value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const { or, orAsync } = require('go-fns');
const isText = value => typeof value === 'string';
const isNumber = async value => typeof value === 'number';

await orAsync(isText, isNumber)(2);                // => true
await orAsync(isText, isNumber)(false);            // => false
await orAsync(null, isText, undefined)('hello');   // => true
await orAsync()();                                 // => false
await orAsync(null, undefined)();                  // => false
orAsync(() => true, 123);                          // => throws TypeError
or.async === orAsync;                              // => true

const calls = [];
const lookup = orAsync(
  () => { calls.push('cache'); return ''; },
  async () => { calls.push('remote'); return 'found'; },
  () => { calls.push('fallback'); return true; }
);
await lookup();                                    // => true
calls;                                             // => ['cache', 'remote']
```

**Notes**

The first reached callback starts during invocation. Each later callback starts only after the preceding result has been awaited, even when it is a synchronous value. Calls within one evaluation are sequential; concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0. **Alias:** [`or.async`](#orasyncfns), the same function object.

---

### `xor(...fns)`

Creates a predicate that determines whether exactly one supplied predicate returns a truthy value.

Stops at the second truthy result. Three truthy results still produce `false`; this is not odd-parity XOR. The returned predicate forwards all call arguments and the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty list returns `false` when called.

**Parameters**

<!-- prettier-ignore -->
| Parameter | Type | Description |
| --- | --- | --- |
| `...fns` | `Function`, `null`, or `undefined` | Predicates; nullish entries are skipped. All are validated before evaluation. |

**Returns:** `Function` with signature `(...args) => boolean`. A predicate returning `true` if exactly one result is truthy; otherwise `false`.

**Errors:** `TypeError`: If an entry is neither a function, `null` nor `undefined`. All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
<!-- prettier-ignore -->
```javascript
const { xor } = require('go-fns');

xor(() => false, () => true, () => false)();   // => true
xor(() => true, () => true)();                 // => false
xor(() => true, () => true, () => true)();     // => false
xor()();                                       // => false
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

**Errors:** `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier result would short-circuit. A callback throw or rejected result rejects the wrapper's promise with the exact failure value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const { xor, xorAsync } = require('go-fns');
await xorAsync(() => false, async () => true, () => false)(); // => true
await xorAsync(() => true, async () => true, () => true)();   // => false
await xorAsync(null, async () => 'selected', undefined)();   // => true
await xorAsync()();                                          // => false
await xorAsync(null, undefined)();                           // => false
xorAsync(() => true, () => true, 123);                       // => throws TypeError
xor.async === xorAsync;                                     // => true

const calls = [];
const exactlyOne = xorAsync(
  () => { calls.push('first'); return true; },
  async () => { calls.push('second'); return true; },
  () => { calls.push('third'); return true; }
);
const result = exactlyOne();
calls;                                                      // => ['first']
await result;                                               // => false
calls;                                                      // => ['first', 'second']
```

**Notes**

The first reached callback starts during invocation. Each later callback waits for the preceding result, including synchronous values. Concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for composition and synchronous callback API limitations.

**Since:** 2.0.0. **Alias:** [`xor.async`](#xorasyncfns), the same function object.

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

**Errors:** `TypeError`: If an entry is neither a function, `null` nor `undefined`. All entries are validated before evaluation; later callback errors propagate.

**Examples**

<!-- prettier-ignore -->
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

**Errors:** `TypeError` is thrown synchronously by the factory if an entry is neither a function, `null` nor `undefined`, even when an earlier result would short-circuit. A callback throw or rejected result rejects the wrapper's promise with the exact failure value and prevents later callbacks from running.

**Examples**

<!-- prettier-ignore -->
```javascript
const { nor, norAsync } = require('go-fns');
const isNeitherTextNorNumber = norAsync(
  value => typeof value === 'string',
  async value => typeof value === 'number'
);
await isNeitherTextNorNumber(false);                  // => true
await isNeitherTextNorNumber('hello');                // => false
await isNeitherTextNorNumber(1);                      // => false
await norAsync(null, async () => 0, undefined)();     // => true
await norAsync()();                                    // => false
await norAsync(null, undefined)();                     // => false
norAsync(() => true, 123);                            // => throws TypeError
nor.async === norAsync;                                // => true

const calls = [];
const neither = norAsync(
  () => { calls.push('first'); return false; },
  async () => { calls.push('second'); return 'found'; },
  () => { calls.push('third'); return false; }
);
const result = neither();
calls;                                                // => ['first']
await result;                                         // => false
calls;                                                // => ['first', 'second']
```

**Notes**

The first reached callback starts during invocation. Each later callback waits for the preceding result, including synchronous values. Concurrent wrapper invocations remain independent. See [Asynchronous predicates](#asynchronous-predicates) for composition and synchronous callback API limitations.

**Since:** 2.0.0. **Alias:** [`nor.async`](#norasyncfns), the same function object.

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

**Errors:** `TypeError`: If a required callback is not a function. Errors from later callback calls propagate unchanged.

**Examples**

<!-- prettier-ignore -->
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

**Errors:** `TypeError` is thrown synchronously by the factory if `fn` is not a function. A callback throw or rejected result rejects the returned predicate's promise with the exact same value.

**Examples**

<!-- prettier-ignore -->
```javascript
const { not, notAsync } = require('go-fns');
const isMissing = notAsync(async value => value);

await isMissing('present');                        // => false
await isMissing('');                               // => true
await notAsync(() => 0)();                         // => true
notAsync();                                        // => throws TypeError
notAsync(null);                                    // => throws TypeError
not.async === notAsync;                            // => true

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
```

**Notes**

The callback starts during invocation; the returned predicate always returns a promise, including for synchronous values and throws. See [Asynchronous predicates](#asynchronous-predicates) for use with synchronous callback APIs.

**Since:** 2.0.0. **Alias:** [`not.async`](#notasyncfn), the same function object.

## Behaviour

### Optional host capabilities

Importing root or focused modules does not read timers or optional clocks, construct
abort controllers, schedule work or access the DOM. `globalThis`, `self`, `global`
and `window` are alternative host aliases, checked in that order when a host is needed.
A source embedding with none of those aliases fails clearly when a timer function
needs the host; unrelated functions still work. Bundlers may also supply a host resolver.

`debounce` and `throttle` capture a callable `performance.now` with its native receiver.
If `performance` is missing, `null` or `undefined`, or its `now` method is missing or
not callable, they use `Date.now()` instead. This fallback remains sensitive to wall-clock
changes. A present clock getter or callable that throws keeps its original error.
Neither the `Performance` constructor nor its prototype is required.

`sleep` accepts a structural signal and does not look up native `AbortController` or
`AbortSignal` constructors, prototypes or static methods. The supplied signal still needs
its documented `aborted`, `addEventListener` and `removeEventListener` members; missing
listener methods reject with `TypeError`. Cancellation preserves the exact `reason`.

`delay` requires the host's `setTimeout` when called. `sleep` and active schedulers use
`setTimeout` and `clearTimeout`; missing timer methods fail when the operation needs
them, using the documented synchronous or promise error path. An already-aborted valid
signal rejects with its reason without scheduling a timer. These timer requirements do
not apply to composition, predicates or argument adapters.

No conditional value conversions are performed by the library. A skipped `when`
callback returns its input unchanged; `whenAsync` preserves the resolved input under
its documented promise-assimilation rules. Optional host capabilities do not change
these behaviours, callback receivers or value/error identity. The library installs
no polyfills; the baseline requirements in [Runtime support](../README.md#runtime-support)
remain required.

### Invalid arguments and callback errors

A required callback must have JavaScript type `function`. Other inputs produce a
`TypeError` before any callback runs. Synchronous operations and wrapper factories
(including `pipeAsync`, `tapAsync`, all async logical helpers, `whenAsync` and `ifElseAsync`) throw immediately. `attemptResultAsync` and
`sleep` and `repeatAsync` report invalid configuration by rejecting their returned promises.
Validation does not stringify invalid values or invoke their coercion hooks.
Classes and revoked callable proxies can pass that type check but still throw when
invoked; invocation failures follow the same error behaviour as other callbacks.

`pipe`, `pipeAsync`, and the synchronous and async multi-predicate logical helpers
skip actual `null` and `undefined` entries.
They validate every supplied entry up front, even when execution could later
short-circuit. Other non-functions are configuration errors, not false predicates.

`pipe`, `spread`, the synchronous logical helpers and `repeat` propagate callback exceptions.
All async logical helpers, `whenAsync` and `ifElseAsync` reject with the exact thrown or rejected value.
`attempt` returns the exact thrown value; the result variants report callback failures
in result objects. `once` caches callback failures and rethrows them on later calls.
`tap` propagates observer failures; async pipelines/observers reject. `delay` leaves later callback failures
to the timer host; it does not catch them.

### Receiver (`this`) behaviour

The functions returned by `pipe`, `pipeAsync`, `tap`, `tapAsync`, `once`, `spread`,
`and`, `andAsync`, `or`, `orAsync`, `xor`, `xorAsync`, `nor`, `norAsync`, `not`, `notAsync`,
`partial`, `partialRight`, `unary`, `when`, `whenAsync`, `ifElse` and `ifElseAsync`
forward their caller's receiver to callbacks. Strict wrappers preserve `undefined`,
`null` and primitive receivers rather than substituting the global object or boxing
values. A non-strict callback may still perform JavaScript's own receiver coercion.
Bound functions and arrow functions retain their normal JavaScript receiver rules.

`debounce` and `throttle` save the latest call's arguments and receiver for scheduled invocation.

For compatibility, `attempt`, `attemptResult`, `attemptResultAsync`, `repeat` and `repeatAsync` use the callback function itself as
its receiver. Use `fn.bind(context)` to supply a different receiver to those utilities.
`delay` uses the native timer's callback receiver, not the library namespace.

### Synchronous results and promises

The original synchronous utilities do not await promises. A promise is an ordinary
value in `pipe`, a truthy result in a synchronous logical predicate, and an array element in
`repeat`. `attempt` and `attemptResult` do not catch a promise's later rejection.
`tap` does not await its observer. `once` caches a returned promise without wrapping
it or handling its rejection.

Use `pipeAsync`, `attemptResultAsync`, `tapAsync`, `repeatAsync`, `andAsync`,
`orAsync`, `xorAsync`, `norAsync`, `notAsync`, `whenAsync` and `ifElseAsync` to await results explicitly.
`when`/`ifElse` predicates remain synchronous; promise predicates are truthy.
Argument adapters and scheduler callbacks return promises unchanged, without
awaiting, serialising, catching or cancelling their asynchronous work.
`sleep` always returns a promise. No existing operation automatically changes its
return type based on whether a callback happens to return a promise.

### Asynchronous predicates

`andAsync`, `orAsync`, `xorAsync`, `norAsync` and `notAsync` await callback results, including promises and
thenables, then convert their truthiness to booleans. Their factories remain
synchronous; the predicates they return always produce `Promise<boolean>`.
They pass input arguments unchanged and preserve the caller's receiver.
`andAsync`, `orAsync`, `xorAsync` and `norAsync` evaluate sequentially from left to right.
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
unchanged. `whenAsync` passes exactly one original input to both callbacks, while
`ifElseAsync` forwards the full argument list. Both preserve the caller's receiver,
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

`debounce` defaults to trailing-only execution. `throttle` defaults to both edges.
A lone leading invocation is not repeated on the trailing edge. With both edges
false the wrapper is inert: it schedules no timer and never invokes the callback.

Durations are finite numbers from 0 through 2147483647 milliseconds; omitted means
zero, not `null`. Fractional values are accepted subject to host timer resolution.
Options must be an object (not `null` or an array); `leading` and `trailing` must be booleans when
provided. Unknown properties are ignored. Debounce's optional `maxWait` is a
finite duration in the same range and must be at least the ordinary wait.
It caps postponement during continued activity, subject to event-loop availability.
A zero-wait trailing first call is still deferred; a reached `maxWait` can invoke
synchronously on a later call when timer dispatch has been delayed.

Every scheduler wrapper has detachable methods:

<!-- prettier-ignore -->
| Method | Contract |
| --- | --- |
| `pending()` | Determines whether an eligible callback invocation is scheduled. Returns `true` for pending work; a leading-only cooldown or an in-flight promise alone returns `false`. |
| `cancel()` | Discard scheduled work and reset suppression; retain the last successfully completed invocation's result. Does not stop work already started. |
| `flush()` | Execute eligible pending work now, otherwise return the last result. Does not release a pure leading-only cooldown. |

The wrapper and `flush()` return the last completed callback result, or `undefined`
before one exists. They do not create a promise for every scheduled call. Throttle
measures ordinary invocation spacing from the last actual invocation, including a
trailing one; explicit flush/cancel override normal rate control. It limits starts,
not concurrent asynchronous operations. Host timers can run late. Elapsed-time
calculations use a captured, receiver-bound `performance.now()` when available,
so system wall-clock adjustments do not move scheduling windows. Minimal hosts
without that method fall back to `Date.now()` and do not receive that guarantee.
Clock selection happens at wrapper construction, not import: install fake timers
and their monotonic clock before constructing wrappers in tests.

A clock failure during expiry or `flush()` discards that operation's pending work,
retains the last completed result and propagates the original error. Later calls
can schedule again. If clock instrumentation cancels or replaces the work during
the read, the interrupted operation leaves that newer state intact; it does not
invoke the replacement early or orphan its timer.

Immediate or flushed callback exceptions propagate to the caller. A timer-triggered
exception is reported by the host just as with `setTimeout`; returned rejected
promises are not intercepted. Handle asynchronous failures inside the callback or
on the returned promise. Dispose scheduled wrappers during application cleanup.

Partial application does not bind `this`, clone saved values, pad omitted slots,
interpret placeholders or adapt constructors. Saved object references remain live.
`partialRight` appends after however many inputs are actually supplied. When an
optional prefix slot precedes a bound suffix, explicitly supply that slot (possibly
as `undefined`) to avoid shifting arguments. Type declarations enforce this.
For a callback ending in a rest parameter, right-bound values must match its rest
item type; ambiguous variadic splitting needs a typed adapter. TypeScript callbacks
with overloads or high polymorphism may likewise need an explicit adapter.
A union of saved tuples must satisfy every possible binding. For a fixed-arity
callback, narrow differently sized tuples before binding so the remaining argument
count is known; equal-length alternatives and compatible rest suffixes remain usable.

## TypeScript

Declaration files are included; no runtime TypeScript dependency or source rewrite
is required. They target TypeScript 5.4+ and were checked with 5.8.3. They support
default and named imports, CommonJS imports, attached variants and public `src/` module paths.

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

Dense pipelines have contextual inference for up to eight stages. Longer typed
tuples and nullish gaps remain checked; annotate the affected stage parameters for
useful inference. Nested factories such as `tap`/`tapAsync` may also need an observer
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
Receiver requirements are retained. For `attempt`, the result type is `unknown`
because arbitrary thrown values cannot be distinguished from successful results.
`Result<T>` provides safe narrowing instead. Heterogeneous `spread` inputs require
correctly typed tuples, including any required prefix or suffix. Only homogeneous
variadic callbacks without required positional slots also accept typed object
array-likes. Primitive strings are rejected even though they satisfy TypeScript's
structural `ArrayLike<string>` type; boxed strings remain valid objects.

`once` exposes a stable captured-result type. A generic callback such as
`<T>(value: T) => T` produces an `unknown` cached result: a later numeric argument
cannot change a string cached by the first call. Concrete callbacks retain their
concrete return types. Unions of callbacks must satisfy every possible input and
receiver requirement; overloaded or highly polymorphic callbacks may need a typed
adapter rather than preserving an unsafe per-invocation relationship. For captured
callbacks in `once`, pipelines and `partialRight`, a union member with unrestricted
`this: any` does not remove another member's concrete receiver requirement. The
same rule applies between stages of a dense pipeline and between callbacks in
`when` and `ifElse`, including their synchronous type-guard overloads.

Logical composition supports compatible structural requirements, including optional
predicates. Every callback that might run contributes its required inputs and
receiver. Async logical composition preserves the same input and receiver
requirements and returns `Promise<boolean>`; it does not unwrap promise arguments
or narrow their types after awaiting. `whenAsync` and `ifElseAsync` retain original
callback input requirements and await their returned values; an awaited decision
does not create a type guard or complement narrowing for either branch. `ifElse`
supports synchronous single-value type guards and narrows both branches.

For `whenAsync` and `ifElseAsync`, an annotated callback supplies context for
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
need DOM declarations just to import the package. `delay` uses the ambient host's
timer-handle type (or `unknown` when no host timers are declared). Its callback's
platform-dependent `this` is not checked; bind callbacks that require a particular
receiver. Timer option properties accept explicit `undefined` to select their
defaults, including with `exactOptionalPropertyTypes` enabled.
