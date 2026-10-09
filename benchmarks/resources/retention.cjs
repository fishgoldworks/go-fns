'use strict';
// Diagnostic, not a timing-sensitive unit test. Requires --expose-gc on Node 22+.
const path = require('node:path'),
  fs = require('node:fs');
const { values, positionals } = require('node:util').parseArgs({
  allowPositionals: true,
  options: { 'require-release': { type: 'boolean' } }
});
if (positionals.length > 2) throw Error('Expected at most a library root and output path');
const root = path.resolve(positionals[0] || path.join(__dirname, '../..'));
const output = positionals[1];
if (typeof global.gc !== 'function') throw Error('Run with node --expose-gc');
const api = require(root);
const withClock = require(path.join(root, 'test/helpers/clock'));
function setup(name, action) {
  return withClock((clock) => {
    let calls = 0;
    const fn = api[name](
      () => {
        calls++;
      },
      100,
      { leading: true, trailing: action === 'pending' }
    );
    fn('first');
    clock.jump(1);
    const input = { label: name + '-' + action, data: new Array(16384).fill(17) },
      receiver = { label: 'receiver' };
    const refs = [new WeakRef(input), new WeakRef(receiver)];
    Reflect.apply(fn, receiver, [input]);
    if (action === 'cancelled') fn.cancel();
    if (action === 'expired') clock.tick(200);
    return { name, action, refs, keep: fn, clock, pending: fn.pending(), calls: () => calls };
  });
}
(async () => {
  const cases = [];
  for (const name of ['debounce', 'throttle'])
    for (const action of ['suppressed', 'pending', 'cancelled', 'expired']) cases.push(setup(name, action));
  // WeakRef targets remain alive in their construction job. Yield before collecting.
  for (let round = 0; round < 12; round++) {
    await new Promise(setImmediate);
    global.gc();
  }
  const rows = cases.map((x) => ({
    name: x.name,
    action: x.action,
    pending: x.pending,
    calls: x.calls(),
    alive: x.refs.map((r) => r.deref() !== undefined)
  }));
  // Keep all wrappers observably reachable until AFTER examining their inputs.
  for (const x of cases) if (typeof x.keep.cancel !== 'function') throw Error('Missing wrapper');
  const report = {
    node: process.version,
    v8: process.versions.v8,
    gcRounds: 12,
    rows,
    caveat:
      'Observed collection is not a portable deadline or proof for all object graphs. Pending controls must remain alive; completed unused values may be collected.'
  };
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.table(rows);
  if (values['require-release']) {
    for (const row of rows) {
      const expectedAlive = row.action === 'pending';
      if (row.alive.some((alive) => alive !== expectedAlive)) {
        console.error('Retention expectation failed: ' + row.name + '/' + row.action);
        process.exitCode = 1;
      }
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
