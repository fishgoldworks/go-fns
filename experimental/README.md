# Archived prototypes — unsupported

The three remaining files preserve distinct unfinished ideas from the original
archive: configurable memoisation, interval repetition and promise resolution.
They are references, not supported APIs. Several contain missing imports or
incomplete implementations; do not import or execute them. Promoting an idea
requires a separate API contract, implementation and regression tests.

They are excluded from the public entry point, coverage and generated package.
Supported sequential repetition and cancellable delay are available as
[`repeatAsync`](../docs/API.md#repeatasyncfn-count-args) and [`sleep`](../docs/API.md#sleepmilliseconds-options) in the public library.
