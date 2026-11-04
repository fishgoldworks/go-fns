'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
// Node flags must precede the runner path to support filters and coverage options.
const flags = process.argv.slice(2);
if (flags.includes('--experimental-test-coverage')) {
  const reporters = flags.filter((flag) => /^--test[-_]reporter(?:=|$)/.test(flag)).length;
  const destinations = flags.filter((flag) => /^--test[-_]reporter[-_]destination(?:=|$)/.test(flag)).length;
  // Node supplies one default reporter/destination; make these explicit before
  // adding our silent inventory reporter. Invalid caller pairs still fail in Node.
  if (!reporters && !destinations) {
    const modernDefault = Number(process.versions.node.split('.')[0]) >= 23;
    flags.push('--test-reporter=' + (modernDefault || process.stdout.isTTY ? 'spec' : 'tap'));
  }
  if (!destinations && reporters <= 1) flags.push('--test-reporter-destination=stdout');
  flags.push('--test-reporter=' + pathToFileURL(path.join(__dirname, 'native-coverage-reporter.js')).href);
  flags.push('--test-reporter-destination=stdout');
}
const env = {
  ...process.env,
  GO_FNS_CHECK_NATIVE_COVERAGE: flags.includes('--experimental-test-coverage') ? '1' : undefined
};
// Do not inherit the IPC context of an outer node:test worker.
delete env.NODE_TEST_CONTEXT;
let timeout = 120000;
for (let index = 0; index < flags.length; index++) {
  const match = /^--test[-_]timeout(?:=(.*))?$/.exec(flags[index]);
  if (match) {
    const value = Number(match[1] === undefined ? flags[++index] : match[1]);
    // Invalid options remain Node's responsibility and fail before running tests.
    if (Number.isFinite(value) && value >= 0) timeout = value;
  }
}
const child = spawn(process.execPath, ['--test', '--test-timeout=120000', ...flags, 'scripts/run-tests.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env,
  detached: process.platform !== 'win32'
});
let timer;
let stopped = false;
function stop(message) {
  if (stopped) return;
  stopped = true;
  process.exitCode = 1;
  console.error(message);
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      timeout: 5000,
      windowsHide: true
    });
    if (result.error || result.status !== 0) child.kill('SIGKILL');
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
// Recent Node versions enforce --test-timeout inside the worker. Keep this
// deadline in a separate process so a synchronous test cannot block its timer.
const deadline = Date.now() + timeout;
function watch() {
  const remaining = deadline - Date.now();
  if (remaining > 0) timer = setTimeout(watch, Math.min(remaining, 2147483647));
  else stop('Runtime test execution timed out after ' + timeout + 'ms.');
}
watch();
child.once('error', (error) => {
  clearTimeout(timer);
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  clearTimeout(timer);
  process.exitCode = stopped ? 1 : (code ?? 1);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => stop('Runtime test execution interrupted by ' + signal + '.'));
