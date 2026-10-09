# Go Functions

**Utility functions for composing, scheduling and adapting functions.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)
[![Donate](https://img.shields.io/badge/donate-blue.svg)](https://www.paypal.com/donate/?business=T7Q29NNMZVW98&no_recurring=0&item_name=Support+Go+Functions&currency_code=USD)

- **Version:** [{{VERSION}}](CHANGELOG.md)
- **Licence:** [{{LICENSE}}](LICENSE.md)

Compose synchronous or asynchronous pipelines, combine predicates, adapt callback arguments and control invocation with timers, cancellation, debouncing and throttling.

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
| CommonJS | Node.js 8.0.0 or later, including public `src/` imports. |
| ES modules | Native default and named imports work on Node.js 14.13.0 or later, or Node.js 12.20.0+ within 12.x, through CommonJS interoperability. |
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
import Functions from 'go-fns';

Functions.pipe(Math.floor, Math.sqrt)(4.5);            // => 2
[1, 2, 3.1].filter(Functions.not(Number.isInteger));   // => [3.1]
```

Or import individual functions:

<!-- prettier-ignore -->
```javascript
import { pipe, not } from 'go-fns';

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

The default import is the complete public API object. The package entry is
CommonJS; Node loads these ES module imports through its CommonJS interoperability.

### CommonJS

<!-- prettier-ignore -->
```javascript
const { pipe, not } = require('go-fns');

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

Public `src/` imports remain available with or without the `.js` extension:

<!-- prettier-ignore -->
```javascript
const pipe = require('go-fns/src/pipe');
const not = require('go-fns/src/logic/not.js');

pipe(Math.floor, Math.sqrt)(4.5);                      // => 2
[1, 2, 3.1].filter(not(Number.isInteger));             // => [3.1]
```

These CommonJS paths follow the [runtime support](#runtime-support) requirements
above. Their companion declarations support TypeScript consumers.

### Browser

Copy the distribution into your application and load it locally:

<!-- prettier-ignore -->
```html
<script src="./dist/go-fns.min.js"></script>
<script>
  const { pipe, not } = Functions;
  console.log(pipe(Math.floor, Math.sqrt)(4.5));           // => 2
  console.log([1, 2, 3.1].filter(not(Number.isInteger)));  // => [3.1]

  // Namespace calls work too; the timer is invoked with the host global.
  Functions.delay(console.log, 100, 'hello');
</script>
```

Both `dist/go-fns.js` and `dist/go-fns.min.js` expose the `Functions` UMD namespace.
The bundles also support CommonJS, AMD and Workers. A source checkout generates
these files in `package/dist/`; installed packages contain them in `dist/`.
Importing the library does not start timers, make network requests or access the DOM.

## API summary

See the **[full API documentation](docs/API.md)** for parameters, return values, errors and examples.

{{API_SUMMARY}}

`T` denotes a callback or branch result and `V` the input value type. Signatures summarise call shapes; see [TypeScript](#typescript) for inference and receiver requirements, and the full declarations for overloads.

## Behaviour

Synchronous helpers treat promises as ordinary values. Use `pipeAsync`,
`attemptResultAsync`, `tapAsync` and `repeatAsync` when results must be awaited.
For predicates, `andAsync`, `orAsync`, `xorAsync`, `norAsync` and `notAsync` create wrappers that always
return `Promise<boolean>`, awaiting callback results while passing arguments unchanged.
The multi-predicate variants run callbacks sequentially and short-circuit;
`xorAsync` tests for exactly one truthy result. `whenAsync` and `ifElseAsync`
await their predicates before running the selected transform or branch, then
await its result. Their factories validate all required callbacks immediately.

<!-- prettier-ignore -->
```javascript
const { andAsync, ifElseAsync } = require('go-fns');
const isInRange = andAsync(value => value > 0, async value => value < 10);
const describe = ifElseAsync(
  isInRange,
  async value => 'Accepted: ' + value,
  value => 'Outside range: ' + value
);

await describe(3);             // => 'Accepted: 3'
await describe(12);            // => 'Outside range: 12'
```

Async predicate wrappers cannot be used with `Array.prototype.filter` or synchronous
go-types matcher callbacks: those APIs treat their promises as truthy. The original
synchronous predicates retain that behaviour. Schedulers limit invocation starts,
not concurrent asynchronous work.

Returned wrappers forward the caller's receiver. `attempt`, its result variants,
`repeat` and `repeatAsync` instead use the callback itself as its receiver;
bind the callback when another receiver is needed. Required callbacks are validated
before execution. `pipe` and logical combinators skip nullish entries; empty
pipelines return `undefined`. Empty logical predicates return `false`, or resolve to
`false` for async variants.

`debounce` defaults to trailing-only execution; `throttle` defaults to both edges.
Host timers may run late. `cancel()` discards pending invocation, and `flush()`
runs eligible work immediately. Neither stops asynchronous work already started.
Handle callback errors and rejected promises, and cancel scheduled wrappers during cleanup.

See [Behaviour in the full reference](docs/API.md#behaviour) for validation, receiver,
empty-input, timing and argument-adaptation contracts.

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

The ten original export names and established empty-input results remain
available. Version 2.0.0 adds asynchronous composition, structured attempt results,
observers, cancellable waits, cached invocation, scheduling, argument adapters and
conditional composition, with TypeScript declarations for all 32 exports.

Returned wrappers now forward the caller's exact receiver, including `undefined`,
`null` and primitive values. `and` and `not` no longer use the callback as its own
receiver; bind a callback explicitly if it needs that behaviour. `attempt` and
`repeat` retain their original callback-as-receiver convention.

`repeat` rejects string/boolean, fractional, negative, infinite, `NaN` and
non-array-representable counts before invoking the callback. `null` and `undefined`
still mean zero. Invalid callback values produce `TypeError` without coercion.
Unfinished deep-import prototypes are outside the public package; use the
documented root exports or public `src/` modules.

The package remains CommonJS, with default and named ES module interoperability.
See [CHANGELOG.md](CHANGELOG.md) for release and migration details. The 2.1.x and
2.2.x labels in earlier development material were unreleased snapshots, now
consolidated into version 2.0.0.

## Development

Use Node.js 22.16 or later for contributor commands. This is separate from
[consumer runtime support](#runtime-support).

```sh
npm ci
npm run docs
npm run build
npm test
```

Edit `scripts/README.template.md` for the overview and `scripts/API.template.md`
for the shared API summary and full reference, then run `npm run docs`.
`npm run test:docs` checks both generated files, links, public API coverage,
executable examples and TypeScript snippets. Both documents ship with the package.

Run the complete standard gate with the exact Node.js 8.0.0 consumer executable:

```sh
npm run verify -- --node8 /path/to/node-8.0.0
```

The build assembles the complete consumer package under `package/`, including
the browser bundles in `package/dist/`. `verify` builds and packs one candidate,
then checks documentation, source coverage, declarations, build failures, tooling,
artefacts and installed consumers. `verify:all` adds Chromium checks of that same
tarball. `GO_FNS_NODE8` can supply the exact executable instead of `--node8`.

The coverage badge measures executable source-line coverage; the docs badge
measures checked public API reference coverage. Neither guarantees correctness
for every input. See the [development guide](https://github.com/koyote130708/go-fns/blob/master/docs/project-validation.md)
for coverage scope, exact-runtime checks, build recovery, local package use,
browser setup, release procedures and benchmark commands.

## Further reading

- [Full API documentation](docs/API.md): parameters, return values, errors, examples and shared contracts.
- [Development guide](https://github.com/koyote130708/go-fns/blob/master/docs/project-validation.md): contributor setup, verification, build, release and benchmark procedures.
- [Changelog](CHANGELOG.md): releases and migration notes.
- [Historical performance record](https://github.com/koyote130708/go-fns/blob/master/docs/performance.md): workloads and baseline results.

## Licence

MIT. See [LICENSE.md](LICENSE.md).
