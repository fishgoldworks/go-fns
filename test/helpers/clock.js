'use strict';

// Deterministic host clock; exercises real wrappers, not mocked wrapper behavior.
function withClock(run) {
  const original = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    now: Date.now,
    performance: Object.getOwnPropertyDescriptor(globalThis, 'performance')
  };
  let now = 1000,
    nextId = 0,
    wallOffset = 0;
  const tasks = new Map();
  const clock = {
    tasks,
    now: () => now,
    wallJump: (milliseconds) => {
      wallOffset += milliseconds;
    },
    jump: (milliseconds) => {
      now += milliseconds;
    },
    setTime: (value) => {
      now = value;
    },
    tick(milliseconds) {
      const end = now + milliseconds;
      let count = 0;

      while (true) {
        const ready = [...tasks]
          .filter(([, task]) => task.time <= end)
          .sort((a, b) => a[1].time - b[1].time || a[0] - b[0])[0];

        if (!ready) break;
        if (++count > 5000) throw new Error('Unbounded timer loop in test');
        now = Math.max(now, ready[1].time);
        tasks.delete(ready[0]);
        ready[1].fn();
      }

      now = end;
    }
  };

  globalThis.setTimeout = (fn, wait) => {
    const id = nextId++;

    tasks.set(id, { fn, time: now + Math.max(0, wait) });

    return id;
  };

  globalThis.clearTimeout = (id) => {
    tasks.delete(id);
  };

  Date.now = () => now + wallOffset;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    return run(clock);
  } finally {
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    Date.now = original.now;
    if (original.performance) Object.defineProperty(globalThis, 'performance', original.performance);
    else delete globalThis.performance;
  }
}

if (typeof module === 'object' && module.exports) module.exports = withClock;
else globalThis.goFnsTestClock = withClock;
