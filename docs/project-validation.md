# go-fns validation and tooling

This guide owns go-fns contributor, validation and release procedures, and records deliberate tooling choices.
The [package manifest](../package.json) owns command composition and pinned dependency versions;
[`.nvmrc`](../.nvmrc) owns the development runtime. Contributor tools require Node.js 22.16.0 or later, excluding Node.js 23.
For consumer requirements, see [runtime support](../README.md#runtime-support).

## Development and release checks

Install dependencies with `npm ci`. Run `npm run verify` for the complete
non-browser gate or `npm run verify:all` for release checks including Chromium, Firefox and WebKit.
Supply the exact Node.js 8.0.0 executable through `GO_FNS_NODE8` or
`--node8 /path/to/node-8.0.0`. The gate fails if it is unavailable; a later Node 8
patch cannot verify the declared minimum.
The release orchestrator builds and packs once, records the candidate path and
SHA-256 digest, then passes that same tarball to the consumer checks. Browser
release checks use bundles from the installed candidate. CI carries those bytes
between jobs rather than rebuilding a separate candidate in each job.

## Build and local use

`npm run build` generates a complete, self-contained `package/` directory with
consumer metadata, entries, declarations, browser bundles and documentation.
The build first regenerates README/API Markdown from their canonical templates.
Generation, bundling, minification and smoke checks finish in a staging directory
before the previous package is replaced. A failed preparation preserves the old
package; replacement failures attempt rollback and report any retained backup.
The ignored generated directory must not be edited by hand.

The development root is private. Generated consumer metadata has no development dependencies or repository lifecycle hooks; internal packing disables lifecycle scripts so verification cannot recurse. To try the generated package in another project:

```sh
npm run build
# Run in the consuming project, using the actual checkout path:
npm install /path/to/go-fns/package
```

For linked development, run `npm link` inside the generated `package/` directory,
then `npm link go-fns` in the consumer. Rebuild after source changes. To test a
release candidate instead, install its tarball in the consumer:

```sh
npm install /path/to/go-fns/artifacts/go-fns-2.0.0.tgz
```

## Release candidate verification

`npm run pack:package` builds fresh output, packs `package/` once and records the
candidate at `artifacts/go-fns-2.0.0.tgz` with its SHA-256 digest. The ignored
`artifacts/` directory holds intentional release candidates. Packing alone is not
the full verification gate; use `npm run verify:all` to prepare and verify a
candidate for manual release review, supplying `--node8 /path/to/node-8.0.0`
or setting `GO_FNS_NODE8`.

Custom `--destination` paths must stay outside generated `package/`, including
when a symbolic link or Windows junction points into it. Existing aliases are
resolved before building; broken aliases are rejected. New directories beneath
a valid external destination are allowed. `npm run verify -- --destination /path/to/candidates`
also passes its selected tarball to the candidate-dependent tooling and release
regressions. For standalone `test:tooling` or `test:release` runs against a custom
candidate, set `GO_FNS_TEST_TARBALL` to that archive's path. Direct installed-package
checks select the archive with `npm run test:package -- --tarball /path/to/candidate.tgz`.

`npm run test:package` uses the recorded candidate by default. An explicit path
selects exact existing bytes without rebuilding or repacking:

```sh
npm run test:package -- --tarball /path/to/go-fns-2.0.0.tgz
```

A missing supplied tarball fails. The check inspects its inventory, installs it
in a clean temporary consumer, executes its runtime contract and compiles
TypeScript consumers, including default imports and public subpaths. Add
`--node /path/to/node` to run the consumer compatibility cases on another runtime;
the complete modern suite still runs. Node.js 8 checks CommonJS and compiled
CommonJS TypeScript consumers. Native ESM consumer checks additionally run on
Node.js 12.20.0+ within 12.x and on Node.js 14.13.0 or later, matching
[Runtime support](../README.md#runtime-support). Earlier 12.x versions, 13.x and
14.0–14.12 run the CommonJS checks only. The shared
[runtime selector](../scripts/runtime-support.js) owns this format selection;
the table below is regression-checked against it.

<!-- consumer-format-examples:start -->
<!-- prettier-ignore -->
| Example consumer runtime | Selected consumer formats |
| --- | --- |
| `8.0.0` | CommonJS |
| `12.19.0` | CommonJS |
| `12.20.0` | CommonJS and native ESM |
| `13.14.0` | CommonJS |
| `14.12.0` | CommonJS |
| `14.13.0` | CommonJS and native ESM |
| `22.16.0` | CommonJS and native ESM |

<!-- consumer-format-examples:end -->

These are selection examples, not a claim that every listed executable was run in
a particular review. Record the actual compiler/runtime versions and outcomes with
each candidate. Add `--browser` to check the same installed tarball in Chromium, Firefox and WebKit.

Root `npm pack` and `npm publish` lifecycle guards reject the wrong directory.
After reviewing the verification results and explicitly deciding to release,
publish the same verified tarball manually:

```sh
npm publish artifacts/go-fns-2.0.0.tgz
```

Do not rebuild or repack between verification and publication. Source, declarations,
bundles and consumer documentation ship to npm; maintainer guides, tests, tooling,
benchmark evidence and development dependencies stay in the repository.

## Validation scope

Run the focused checks listed in [package.json](../package.json), including `test:docs`, `test:types`, `test:build`, `test:artifacts`, `coverage` and `coverage:native`.

The source suite covers receiver and argument forwarding, callable proxies,
nullish stages, synchronous versus async outcomes, cached results, predicate
short-circuiting, timers, abort cleanup, scheduler reentrancy and monotonic clocks.
The runner requires completed tests and root cleanup hooks before accepting success.
Empty discovery, unmatched filters, abandoned async work and early zero exits fail;
the parent process enforces a deadline even for a blocked synchronous test.
`test:tooling` includes disposable failure fixtures and successful cleanup controls,
and every verification mode runs those harness regressions.
Clock regressions cover expiry failures, retry, retained results and cancellation/replacement
during expiry or flush, including preservation of newer timer ownership.
Fake timers keep scheduling tests deterministic; browser checks exercise host
timers, `document.all`, iframe values and Workers in both bundles.

Declaration fixtures cover CommonJS, NodeNext and browser consumers, including
optional/rest arguments, callback unions and receivers, including unions with an
unrestricted `this: any` receiver alongside a concrete requirement. They also check
every contextual pipeline length, synchronous conditional receiver composition and
saved-tuple unions in right partial application. These regression fixtures compile
against installed declarations in both CommonJS and native ESM modes. Installed-package checks
also compile and execute consumers, including default imports, named imports and
public source subpaths. Compatibility checks run installed files on the actual
declared minimum versions; modern source tooling does not substitute for them.

Artefact checks run the behavioural suite through both bundles via CommonJS, with
additional smoke checks for CommonJS, global, Worker-global, AMD and exports-only
loaders. Build checks cover preparation failures, invalid output, replacement
failure, rollback and cleanup errors. Source maps must contain mappings and embed
the current readable bundle; a corrupted embedded source regression proves the
check rejects drift.

## Native capability inventory and absence checks

The baseline remains Node.js 8.0.0 for CommonJS and the browser features in
[Runtime support](../README.md#runtime-support). The runtime uses ordinary ES5
object/array/function/error facilities (`Object.defineProperty`, `Array.isArray`,
`Function.prototype.call`/`bind`), `Reflect.apply`, `Number.isInteger`,
`Number.isFinite`, `Math.min`/`max`, `Date.now`, promises and async functions.
These are required baseline features, not optional APIs hidden behind feature checks.
No collection, typed-array, `Symbol`, `BigInt`, DOM or internationalisation constructor
is looked up by production code. Caller values remain opaque to these utilities.

| Capability                                             | Runtime paths and absence behaviour                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host aliases: `globalThis`, `self`, `global`, `window` | `util/getGlobal` selects lazily for `delay`, `sleep` and `util/createClock` → `util/createScheduler` → `debounce`/`throttle`. Each alias is optional; source needs one to resolve the host. Without any, requested host-dependent operations give an explicit error. Webpack may supply its own global resolver. Root/focused loading and unrelated functions do not need one. |
| `performance` object; its `now` method                 | `util/createClock` separately guards both. Missing/nullish object or missing/non-callable method uses `Date.now`. A present callable retains its receiver and is captured once per scheduler. Getter/call errors are not hidden. The `Performance` constructor is unused.                                                                                                      |
| `AbortController`, `AbortSignal`                       | Neither constructor, prototype nor static methods are accessed. `sleep` validates the supplied structural signal. Native constructors may be absent independently or together. Missing listener methods on that signal reject; pre-aborted signals preserve their reason without timers.                                                                                       |
| Host `setTimeout`, `clearTimeout`                      | Required only for requested timer work/cleanup. `delay` forwards to `setTimeout`; `sleep` uses both; scheduler registration/cancellation uses both. Missing timers cannot break imports or unrelated functions. Host errors follow the existing throw/rejection contract.                                                                                                      |
| Conditional transformations                            | No native conversions are required. `applyIf` and `when` use predicate truthiness and preserve skipped input identity. `whenAsync` awaits its decision and the selected result or original input.                                                                                                                                                                              |

[`test/helpers/capabilities.js`](../test/helpers/capabilities.js) evaluates fresh modules
in a new realm after removing capabilities. It covers independent constructor/global
and method absences, sole host aliases, clock/cancellation combinations and absent
host timers. It checks root and focused modules, unaffected operations, callback and
error identity, skipped transformations, scheduling, cancellation and clock selection.
Wrapped CommonJS evaluations use distinct virtual filenames so their wrapper offsets
cannot corrupt coverage collected from normally loaded source files. Source host tests
also remove aliases in fresh native CommonJS processes and check lazy lookup.

The normal `test` runner owns this matrix; `coverage` reuses it. `test:artifacts` runs it
against both bundles in CommonJS, global, Worker-global, AMD and exports-only modes.
`test:package` resolves public installed root/focused imports and both installed bundles,
then runs the matrix on each requested actual Node runtime, including the release gate's
exact minimum. Each consumer requires an explicit completion report. `verify` and
`verify:all` therefore include the checks without a separate opt-in command.

The browser suite additionally removes capabilities before loading each bundle into
fresh iframes in each browser engine, including native signal listener-method absences, and checks
native timers, available clocks and cancellation. The existing browser contracts also
run with native capabilities present. Simulated API absence establishes fallback
behaviour only: it does not prove historical-browser syntax, engine or module-resolution
compatibility. Record the actual Node and browser versions with each verification run;
no untested historical browser is implied by coverage or this matrix.

## Documentation generation

Edit `scripts/README.template.md` for the overview and `scripts/API.template.md` for the shared summary and full reference. `npm run build` regenerates `README.md` and `docs/API.md` before assembling the consumer package. Use `npm run docs` for documentation-only updates. Both generated documents ship in the consumer package; documentation checks validate local files and heading fragments, execute source and installed examples, and compile TypeScript snippets.

`npm run docs:html` renders the canonical `docs/API.md` into `docs/html/index.html`, preserving its linked API headings, parameter tables and examples. Regenerate Markdown before HTML. This optional output uses markdown-it and stays outside the npm package.

`npm run test:docs` checks README freshness, all root API sections
and scheduler method references, and runnable JavaScript examples. The existing
TypeScript parser identifies expressions with `// =>` expectations so results and
exceptions are asserted without guessing JavaScript syntax. Unsupported annotated
statements fail instead of being silently ignored. Expected results are aligned
within related examples; narrow Markdown `prettier-ignore` directives preserve that
alignment. Keep explanatory and type comments separate from result annotations.

The README coverage badge is executable source-line coverage from `npm run coverage`.
The documentation badge is reference coverage for public functions
and scheduler methods, including the returned schedulers' `cancel`, `flush` and `pending`.
It does not claim exhaustive behaviour or example coverage. c8 also reports
statements, branches and functions and enforces the configured per-file thresholds;
native V8 coverage provides a second measurement of the same runtime suite.

## Tooling choices

- Webpack remains the established UMD bundler; its Node API makes `webpack-cli`
  unnecessary. CommonJS, AMD, global, Worker and exports-only loaders are retained.
  ES module usage relies on verified CommonJS interoperability; public `src/`
  imports work with and without `.js` extensions.
- Terser matches the reference library's minifier. Its configuration preserves
  public function names and arities, property access effects and strict `document.all` distinctions.
- Node's built-in runner executes the existing TDD suite through a small adapter,
  including per-test timeouts. The same runner owns source, artefact and installed
  consumer checks, with no separate npm test-runner package. `coverage:native`
  retains the alternative V8 measurements; `verify:native` retains the other
  release checks while selecting that measurement.
- TypeScript checks declarations and parses documentation examples; production
  JavaScript is authored. Compiler fixtures stay separate from runtime discovery.
- markdown-it retains optional HTML reference generation via `docs:html`.
  The canonical README is generated from `scripts/README.template.md`.

## Browser tooling

Release browser checks use Python 3.13, matching CI. Upgrade the installer with
`python -m pip install --upgrade pip`, install Playwright with
`python -m pip install -r test/browser/requirements.txt`, then run
`python -m playwright install chromium firefox webkit`. `npm run test:browser`
runs Chromium, Firefox and WebKit against `package/` by default. Its
`--package-root /path/to/installed/go-fns` option selects an installed package;
`verify:all` passes the candidate to `test:package --browser`, which selects those
installed bytes. Every engine must complete the readable/minified contracts and
the HTML example extracted from that package's README. The example routes only
its exact-version jsDelivr bundle URLs to candidate files and blocks other
network requests. This checks the example before publication without claiming
that the future CDN URLs are already live.

Each engine runs in a separate worker with a 60-second deadline and process-tree
cleanup. Missing engines, incomplete reports, page failures and failed assertions
fail the gate. `--engine chromium|firefox|webkit` selects a single engine for
diagnostics only. `CHROMIUM_PATH` or `--chromium` overrides the Chromium executable;
it does not remove Firefox or WebKit from the default matrix.
A configured CI job is not evidence of a successful remote run.

## Python dependency assessment

Audit both the resolved browser requirements and the actual browser environment,
including its pip installer. Install `pip-audit` in a separate audit environment,
then run `python -m pip_audit --strict --requirement test/browser/requirements.txt`
and `python -m pip_audit --strict --path /path/to/browser-environment/site-packages`.
These are network advisory checks; an unavailable service is an uncompleted check,
not a clean audit. Record package versions, advisory results and the audit date
with release evidence. Keep auditor dependencies separate from browser-tool
requirements and retain TLS certificate verification.

## Benchmarks and historical evidence

Workloads and fingerprinted baselines live in `benchmarks/`; command entry points
live in `scripts/`. Run `npm run benchmark` or the specialised benchmark commands
in `package.json`. Write new results to a task-owned temporary path. Timing
assertions are intentionally absent from correctness gates.

The retained [performance record](performance.md) and historical samples explain
earlier optimisation decisions. Their original 2.0.x/2.2.x labels identify
unreleased development snapshots; they are not current release measurements or
published version history. Preserve those labels, inputs and recorded commands.

Runtime source, declarations, bundles, README, changelog and licence ship to npm.
Maintainer guides, tests, tooling, unfinished prototypes and benchmark evidence
stay in the repository. Keep disposable logs and results in temporary storage;
intentional release tarballs and their digest records remain in ignored `artifacts/`.

## Local experiments

Directories named `temp` or `.tmp` at any depth are reserved for local experiments.
They are preserved, ignored by Git and formatting/linting, and excluded from
runtime discovery, coverage inventory and package inputs. Keep maintained source
and regression fixtures outside these directories. Build/runner regressions
check that nested experiments remain untouched and do not execute or ship.

## Optional HTML tooling

The local [HTML renderer](../scripts/docs-html.js) uses markdown-it directly. The [manifest](../package.json) and [lockfile](../package-lock.json) own that dependency; the former documentation.js/Vue compiler chain is no longer installed. Generate HTML only from maintained local Markdown and reassess the input boundary before accepting untrusted documentation.

All verification modes, including `verify:native`, run lint and formatting checks before building and packing. Package archive inspection also requires the system `tar` command on `PATH`.

## Executable code quality

Run `npm run lint` and `npm run format:check`; `npm run format` applies the owned formatter configuration. Verification and CI run the read-only checks before the release gate. The [development manifest](../package.json) and [lockfile](../package-lock.json) own the ESLint, TypeScript ESLint, globals and Prettier versions; [ESLint configuration](../eslint.config.mjs) and [Prettier configuration](../.prettierrc.json) own their rules. The pinned tools support the documented contributor runtime; they do not change consumer compatibility.

The baseline checks maintained JavaScript, tooling and tests, with explicit module/host environments, and parses TypeScript declarations and consumer fixtures. Compiler checks remain responsible for declaration semantics. Intentional public `any` types, import-equals declarations, structural empty-object types and unused compiler-only bindings retain narrow TypeScript-scope exceptions: changing those contracts solely for lint would alter supported consumers or remove negative cases. JavaScript still checks undefined and unused bindings; caught error bindings remain allowed for old-runtime syntax compatibility. Review these scopes when the related contracts change.

Prettier formats maintained JavaScript/TypeScript, configuration, Markdown and documentation templates. [Formatter exclusions](../.prettierignore) cover generated distributions and documents, dependency/coverage output, locked or vendored data and historical evidence. Scoped `<!-- prettier-ignore -->` comments preserve aligned result examples; canonical documentation generation and executable-example checks still validate their results. Generated files must still pass their artefact freshness checks. No playbook modules or configuration dependency are imported.

## TypeScript compatibility

The TypeScript 5.4 intrinsic NoInfer preserves contextual callback parameter inference and rejection cases. A conditional-type substitute loses those guarantees, so the 5.4 requirement remains.

Run `npm run test:types -- --compiler /path/to/typescript/lib/tsc.js --package /path/to/installed/go-fns` to check an external compiler against a built or installed package. The default uses the pinned development compiler. The same inference and rejection fixtures are reused for the supported minimum (5.4.5) and the pinned compiler; CI checks the exact candidate tarball with both. Legacy checks adapt fixture extensions and import syntax only where needed. Node16/NodeNext, Bundler and exact optional properties remain enabled in the configurations that support them.

## Public function entries and coverage validation

The package-layout generator derives function entries from the root function
inventory and their source owners. Every function gets a callable CommonJS entry,
a native ES module with named/default exports, and declaration variants for modern
and legacy resolution. Installed checks exercise all entries before loading the
root, compare identity and alias absence, compile/execute consumers and remove
optional host capabilities before fresh root, source and function imports.
Existing public source paths remain compatible.

Native coverage uses source-relative experiment exclusions and a second silent
reporter to check Node's actual measured-file inventory. Loading a file alone does
not establish measurement. Empty or incomplete reports fail even with nominal
100% totals. Tooling regressions run from reserved-name ancestors, retain nested
experiments and distinguish uncovered branches from fully covered controls.

c8 12 retains the same source inventory, per-file thresholds and reporting as the
previous runner, while using maintained dependency APIs. The minimatch override
and test-exclude-scoped glob override resolve development advisories; the latter
is scoped to its modern namespace consumer. Consumer Node requirements are
unchanged; contributor tools remain supported on Node 22.16+.
