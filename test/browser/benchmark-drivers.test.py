"""Benchmark driver controls with a fake browser; no Playwright dependency."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

PROJECT = Path(__file__).resolve().parents[2]
FAKE_PLAYWRIGHT = r'''
from pathlib import Path
from types import SimpleNamespace
import os

class Page:
    def on(self, *args): pass
    def set_content(self, *args): pass
    def add_script_tag(self, path):
        filename = Path(path)
        filename.read_bytes()
        if os.environ.get('MUTATE_FILE') == str(filename.resolve()):
            filename.write_text(filename.read_text() + '\n// changed during loading\n')
    def evaluate(self, expression, *args):
        if expression.startswith('window.reviewBaseline'):
            return None
        if 'runReviewAdapterBenchmark' in expression:
            return {'samples': 11, 'warmupMs': 40, 'targetMs': 8, 'sink': 0, 'cases': []}
        return {'cases': [{'name': 'fixture', 'probe': 1, 'nsPerOperation': [1.0], 'iterations': 16}], 'sink': 1}

class Context:
    def new_page(self): return Page()
    def close(self): pass

class Browser:
    version = 'fixture chromium'
    def new_context(self): return Context()
    def new_page(self): return Page()
    def close(self): pass

class Playwright:
    def __enter__(self):
        return SimpleNamespace(chromium=SimpleNamespace(launch=lambda **kwargs: Browser()))
    def __exit__(self, *args): pass

def sync_playwright(): return Playwright()
'''


class BenchmarkDriverTests(unittest.TestCase):
    def run_driver(self, adapter, mutate=False):
        with tempfile.TemporaryDirectory(prefix='go-fns-benchmark-driver-') as temporary:
            root = Path(temporary)
            scripts = root / 'scripts'
            scripts.mkdir()

            name = 'benchmark-adapters-browser.py' if adapter else 'benchmark-browser.py'
            shutil.copyfile(PROJECT / 'scripts' / name, scripts / name)
            helper = PROJECT / 'scripts/benchmark_inputs.py'
            if helper.exists():
                shutil.copyfile(helper, scripts / helper.name)
            files = {
                'package.json': '{"version":"2.0.0"}',
                'package/dist/go-fns.min.js': 'globalThis.Functions = {};',
                'benchmarks/baseline-2.0.0/dist/go-fns.min.js': 'globalThis.Functions = {};',
                'benchmarks/baseline-2.2.0/dist/go-fns.min.js': 'globalThis.Functions = {};',
                'benchmarks/scenarios.js': '// fixture workload',
                'benchmarks/adapters/measure.js': '// fixture adapter workload',
                'fake/playwright/__init__.py': '',
                'fake/playwright/sync_api.py': FAKE_PLAYWRIGHT
            }
            for relative, content in files.items():
                filename = root / relative
                filename.parent.mkdir(parents=True, exist_ok=True)
                filename.write_text(content)

            output = root / 'report.json'
            output.write_text('{"previous":true}\n')
            env = os.environ.copy()
            env['PYTHONPATH'] = str(root / 'fake')
            env['PYTHONDONTWRITEBYTECODE'] = '1'
            candidate = root / 'package/dist/go-fns.min.js'
            if mutate:
                env['MUTATE_FILE'] = str(candidate.resolve())
            else:
                env.pop('MUTATE_FILE', None)
            args = [sys.executable, str(scripts / name)]
            args += [str(output)] if adapter else [
                '--rounds', '1', '--samples', '1', '--target-ms', '1', '--warmup-ms', '1', '--output', str(output)
            ]

            result = subprocess.run(args, cwd=root, env=env, capture_output=True, text=True, timeout=20)

            if mutate:
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('Benchmark inputs changed during measurement', result.stderr)
                self.assertEqual(output.read_text(), '{"previous":true}\n')
            else:
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                report = json.loads(output.read_text())
                self.assertIn('harness', report)
                self.assertIn('artifacts', report)
                self.assertEqual(report['artifacts']['candidate']['sha256'], hashlib.sha256(candidate.read_bytes()).hexdigest())
                workload = root / ('benchmarks/adapters/measure.js' if adapter else 'benchmarks/scenarios.js')
                self.assertEqual(report['harness']['workload']['sha256'], hashlib.sha256(workload.read_bytes()).hexdigest())

    def test_comparison_records_inputs(self):
        self.run_driver(False)

    def test_adapter_records_inputs(self):
        self.run_driver(True)

    def test_comparison_rejects_changed_inputs(self):
        self.run_driver(False, True)

    def test_adapter_rejects_changed_inputs(self):
        self.run_driver(True, True)


if __name__ == '__main__':
    unittest.main()
