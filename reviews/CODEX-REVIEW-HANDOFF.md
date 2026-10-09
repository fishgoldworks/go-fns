# go-fns final progressive review handoff

Completed 2026-10-09 on Windows. All ten planned areas and the bounded final integration are complete, with the verification limits below. Ready for manual release review; nothing is committed, staged, tagged, pushed or published. Version remains **2.0.0**, licence MIT, with no runtime dependencies and unchanged consumer/runtime/compiler support floors.

## Candidate and baseline

The installable release candidate is [artifacts/go-fns-2.0.0.tgz](../artifacts/go-fns-2.0.0.tgz), with its adjacent SHA-256 record:

`fccb3a6a81109694750fba263e674bce0002b4548e3bb6ea731df63a4596b029`

It contains **80 files**, including **39 runtime modules** and **33 declarations**. The private source root is not the npm publication target. Its generated installable directory is package/. Tests exercised the exact tarball, installed offline into isolated consumers with scripts disabled.

The progressive baseline was the already-dirty working tree on master at HEAD `899830014c34549e3cddc780cfa077068c839564`, not HEAD itself. Its maintained-input fingerprint was `6c1b0f99548f0b66e4a9ffaf93901eed609e73092dfff03298e61ae753b07ec0` over 239 paths: 223 present and 16 previously deleted. Initial candidate SHA-256 was `588a3a023e2ce34d0053f8823e0db7d3f2617c7db076f093f9f7e83fdcd7d8e1`. The initial maintained files were reconstructed from preserved evidence and all their hashes verified before creating the cumulative patch.

The final candidate supersedes Area 9's `50c6c02ca8af18ef8739061bdc550fe449369578865e403b61faae00c2c56ef5`. Only package/docs/API.md changed from that candidate. The progressive cycle changed no runtime JavaScript; its consumer corrections were declaration and documentation changes. Earlier uncommitted work and all original deletions are preserved, and the Git index remains empty.

## Findings and corrections

All tracked findings are **fixed and verified**. GF-001 and GF-002 were already fixed before the progressive baseline and were rechecked, so their original edits are not part of this cumulative patch.

| ID     | Severity | Confirmed problem and correction                                                                                                                                           | Evidence                                                                                                                                                                   |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GF-001 | P2       | A callback's explicit receiver constraint disappeared when another callback used this:any. Normalize receiver constraints before intersecting them in 20 overloads.        | Original declarations failed receiver fixtures; individual reversions of all 20 fixes failed. Final installed strict positive/rejection fixtures pass four compilers.      |
| GF-002 | P2       | partialRight with differing saved-tuple lengths accepted calls missing required arguments. Distribute saved tuple alternatives before intersecting call requirements.      | Original compiler/runtime counterexample; final union, narrowed, rest and focused/alias controls pass four compilers.                                                      |
| GF-003 | P2       | spread declarations accepted primitive strings, which native invocation rejects. Restrict argument lists to supported object array-likes while preserving nullish inputs.  | Five installed negative cases failed to reject on the original declarations. Corrected fixtures preserve arrays, typed arrays, boxed strings and object inputs.            |
| GF-004 | P2       | exactOptionalPropertyTypes rejected explicit undefined timer options despite their documented runtime defaults. Add undefined to four optional property types.             | Original installed declarations failed 18 positive cases across CJS/ESM; corrected positive and invalid-type controls pass four compilers.                                 |
| GF-005 | P2       | Root cleanup that hung or exited zero could let the test runner report success. Register the completion guard after test-file discovery/cleanup registration.              | Six of ten new cases failed before the correction; all ten pass after, with asynchronous success/order controls and actual Node 22.16.0 verification.                      |
| GF-006 | P2       | Custom-destination verification used the default archive in nested release/tooling tests. Propagate the packed candidate and give nested consumers explicit tarball paths. | Four new regressions failed before and pass after. Real verify:all passed with no default archive, a stale inherited selection and a custom destination containing spaces. |
| GF-007 | P3       | sleep's API reference omitted the existing array-options rejection. Correct its canonical parameter description and regenerate documentation/package output.               | Independent object/array reproduction, 95 existing sleep tests and 123 documentation tests pass; runtime/declaration behavior is unchanged.                                |

The affected files and each missed test dimension are recorded in [REVIEW-LEDGER.md](REVIEW-LEDGER.md). No speculative API expansion, dependency migration or support-floor change was introduced.

## Review coverage

Areas 1–4 cover all **32 public functions**, **14 attached aliases**, returned scheduler methods and shared invocation/timer helpers. Areas 5–10 cover optional APIs and compatibility, every declaration/overload/helper type, scoped security and supply chain, test infrastructure, build/package/release behavior, and documentation/performance respectively. Every area has an outcome in the ledger; Area 7 has explicit unverified checks rather than a clean security certification.

Separate reviewers examined bounded runtime, declaration, tooling, packaging and documentation scopes. The parent performed integration and benchmark-evidence checks; these are not described as an independent second audit. Confirmation used contracts, counterexamples, failure-before regressions and valid-use controls, rather than test totals alone.

## Final verification

The final npm run verify:all passed on **Node 24.20.0 / npm 11.19.0**, with actual **Node 8.0.0**, **Python 3.13.3** and **Playwright 1.57.0** available. It ran lint/format, a clean staged build/pack, generated consistency, documentation checks, source coverage, strict types, build/tooling/release regressions, distributed bundles and installed consumers.

| Final check                                                 | Observed result                                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source, readable bundle, minified bundle, installed package | **6,888 tests per implementation**, all passing                                                                                                           |
| c8 coverage                                                 | **Lines 1731/1731; branches 391/391; functions 54/54 — all 100%**; statements 1731/1731                                                                   |
| Build / tooling / release regressions                       | **22 / 97 / 41 passed**                                                                                                                                   |
| Documentation                                               | **13 generator/HTML tests and 123 executable reference/JSDoc tests passed**; all public reference entries covered                                         |
| Package                                                     | 80-file inventory, 76 source-backed matches, source map, five bundle loaders, installed links/examples, strict types and emitted CJS/ESM consumers passed |
| Actual installed Node versions                              | **8.0.0, 12.20.0, 13.0.0, 14.13.0, 18.20.8, 20.19.0, 22.16.0, 24.20.0**; each passed 91 consumer checks and 276 before-load capability cases              |
| Native ESM                                                  | The six listed versions within the documented ESM contract each passed 147 import/behavior assertions; Node 8 and 13 excluded by that contract            |
| Actual browser engines                                      | **Chromium 143.0.7499.4, Firefox 144.0.2, WebKit 26.0**; 785 cases and 2,554 assertions per readable/minified bundle on each engine                       |
| Fresh installed TypeScript fixtures                         | **5.4.5, 5.8.3, 6.0.3, 7.0.2**, each with ES2020-only and ES2020+DOM libraries; full maintained .cts/.mts fixtures passed eight configurations            |
| Dependencies                                                | npm ls passed; fresh npm audit reported **zero advisories across 224 development packages**; no runtime dependencies                                      |
| Historical performance records                              | 19 baseline file hashes verified; all 55 general table rows per runtime and 24 adapter ranges per runtime match raw medians/ratios                        |
| Benchmark command smokes                                    | Node/Chromium each completed 55 general and 24 adapter workloads with checksums; no current speedup claim made                                            |

Fresh strict installed compiler checks retain skipLibCheck:false, exactOptionalPropertyTypes, noUncheckedIndexedAccess, isolatedModules and the paired negative cases. Broader Area 6 Node16/NodeNext/Bundler/UMD/Node-ambient checks, emitted programs and Area 8 native V8 coverage are reused evidence for unchanged code/declarations, not fresh final executions. Area 9 additionally established actual Node 22.16.0 development-floor verification and byte-reproducible builds before the final prose-only correction.

Detailed commands, original failures, environments and evidence paths are in the ledger. Current final raw logs and reports are at C:/Users/koyot/AppData/Local/Temp/go-fns-area10-r8q2sk7d. Those logs are disposable local evidence; the repository records preserve decisions and outcomes.

## Remaining limitations and release decision

- Automatic approval review rejected the Python advisory metadata transfer. Specific authorization remains unanswered; that query was not retried. Playwright's complete Python dependency advisory status is unverified. The npm authorization was honored separately, using TLS verification with the system CA store.
- No historical browser, Safari/iOS product/device, Linux/macOS or hosted-CI execution occurred. Current WebKit is an engine check, not a Safari-product guarantee. Simulated API absence and 100% coverage do not establish historical compatibility.
- Security review was scoped to reachable library/tooling boundaries. There was no exhaustive third-party source audit, full-history secret scan or exhaustive mutation campaign. A zero-advisory response does not guarantee no vulnerabilities.
- Benchmark records describe historical unpublished snapshots. Raw arithmetic and retained fixture hashes were checked; original archive/candidate provenance cannot all be independently reconstructed. Current benchmark smokes are not controlled performance measurements or allocation profiling.
- Final verification reused installed pinned development dependencies; it was not a fresh npm ci. No publication or registry-release behavior was exercised.

No confirmed library defect remains open. Manual release review should account for these limits and resolve the Python advisory check if it is required for release approval. Changing code, dependencies or consumer documentation after this handoff requires rebuilding and identifying a new candidate and rerunning affected gates.

## Delivered files

- [Complete reviewed source, generated package and exact candidate](../artifacts/reviews/go-fns-final-reviewed.zip).
- [Cumulative progressive patch](../artifacts/reviews/go-fns-progressive-changes.patch), relative to the initial working tree described above.
- [Area 10 patch](../artifacts/reviews/go-fns-area-10-changes.patch), relative to the Area 9 result.
- [Cumulative review ledger](REVIEW-LEDGER.md).

Patches include maintained source/test/documentation changes and the review records. Generated package/HTML and candidate bytes are in the ZIP; regenerate them with npm run docs:html and npm run pack:package after applying a patch elsewhere. Do not apply either patch to the already-updated checkout. The ZIP excludes dependencies, Git internals, disposable logs/caches and older nested review archives; intentional earlier artifacts remain in the workspace.
