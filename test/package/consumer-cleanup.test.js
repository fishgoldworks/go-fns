'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../..');

for (const kind of ['package', 'types', 'documentation']) {
  for (const mode of ['primary-only', 'cleanup-only', 'combined']) {
    test(`${kind} consumer retains ${mode} failures through cleanup`, (context) => {
      const temporaryRoot = fs.realpathSync(os.tmpdir());
      const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'go-fns-cleanup-control-'));

      context.after(() => {
        const resolved = fs.realpathSync(temporary);

        assert.equal(resolved, path.resolve(temporary));
        assert.ok(resolved.startsWith(temporaryRoot + path.sep));
        assert.ok(path.basename(resolved).startsWith('go-fns-cleanup-control-'));
        fs.rmSync(resolved, { recursive: true, force: true });
      });

      const journal = path.join(temporary, 'journal.jsonl');
      const archive = path.resolve(
        process.env.GO_FNS_TEST_TARBALL || require('../../scripts/package-layout').artifactPath()
      );
      const env = {
        ...process.env,
        NODE_OPTIONS: '',
        TMP: temporary,
        TEMP: temporary,
        TMPDIR: temporary,
        GO_FNS_CLEANUP_MODE: mode,
        GO_FNS_CLEANUP_KIND: kind,
        GO_FNS_CLEANUP_JOURNAL: journal
      };

      delete env.NODE_TEST_CONTEXT;
      assert.ok(env.npm_execpath, 'Run through npm run test:release.');
      const command =
        kind === 'documentation'
          ? ['-e', 'require("./scripts/documentation-types")(require("node:path").resolve("package"));']
          : ['scripts/test-' + kind + '.js', ...(kind === 'package' ? ['--tarball', archive] : [])];
      const result = spawnSync(
        process.execPath,
        ['--require', path.join(__dirname, 'fixtures/consumer-cleanup.cjs'), ...command],
        { cwd: root, env, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 }
      );

      assert.equal(
        result.error,
        undefined,
        [result.error?.stack, result.stdout, result.stderr].filter(Boolean).join('\n')
      );
      assert.notEqual(result.status, 0, 'A failing check or cleanup must fail the command.');
      const events = fs.readFileSync(journal, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
      const created = events.find(({ event }) => event === 'created');
      const failure = events.find(({ event }) => event === 'failure');

      assert.ok(created && failure, result.stdout + result.stderr);
      assert.equal(events.filter(({ event }) => event === 'cleanup').length, 1);
      if (mode === 'primary-only') {
        assert.equal(failure.primaryIdentity, true, result.stderr);
        assert.equal(fs.existsSync(created.directory), false);
        assert.match(result.stderr, /PRIMARY_CONSUMER_CHECK_FAILED/);
      } else {
        assert.equal(failure.aggregate, true, result.stderr);
        assert.equal(failure.cleanupRetained, true);
        assert.equal(failure.errorCount, mode === 'cleanup-only' ? 1 : 2, result.stdout + result.stderr);
        assert.ok(failure.message.includes(created.directory), failure.message);
        assert.equal(fs.existsSync(created.directory), true);
        assert.match(result.stderr, /CONSUMER_CLEANUP_FAILED/);
      }

      if (mode === 'combined') {
        assert.equal(failure.primaryRetained, true);
        assert.equal(failure.combinedOrder, true);
        assert.match(result.stderr, /PRIMARY_CONSUMER_CHECK_FAILED/);
      }
    });
  }
}
