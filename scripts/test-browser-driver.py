"""Supervisor regressions; no Playwright installation or browser is needed."""
import copy
import os
import subprocess
import tempfile
import importlib.util
import json
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('browser_driver', Path(__file__).with_name('test-browser.py'))
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)


class SupervisorTests(unittest.TestCase):
    def test_accepts_completed_worker(self):
        self.assertEqual(driver.supervise([sys.executable, '-c', 'print("complete")'], 3).strip(), 'complete')

    def test_preserves_failure_diagnostics(self):
        with self.assertRaisesRegex(RuntimeError, 'exit 7') as caught:
            driver.supervise([sys.executable, '-c', 'import sys; print("worker sentinel",file=sys.stderr); sys.exit(7)'], 3)
        self.assertIn('worker sentinel', str(caught.exception))

    def test_bounds_blocked_worker(self):
        start = time.monotonic()
        with self.assertRaisesRegex(RuntimeError, 'timed out'):
            driver.supervise([sys.executable, '-c', 'while True: pass'], .3)
        self.assertLess(time.monotonic() - start, 5)

    def descendant_fixture(self, exit_code, inherited_pipes):
        with tempfile.TemporaryDirectory(prefix='go-fns-browser-tree-') as directory:
            marker = Path(directory) / 'survived'
            pidfile = Path(directory) / 'child.pid'
            child = 'import pathlib,time; time.sleep(2); pathlib.Path(' + repr(str(marker)) + ').write_text("alive")'
            redirect = '' if inherited_pipes else ',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL'
            command = ('import pathlib,subprocess,sys; child=subprocess.Popen([sys.executable,"-c",' +
                       repr(child) + ']' + redirect + '); pathlib.Path(' + repr(str(pidfile)) +
                       ').write_text(str(child.pid)); sys.exit(' + str(exit_code) + ')')
            try:
                start = time.monotonic()
                if exit_code or inherited_pipes:
                    with self.assertRaisesRegex(RuntimeError, 'failed|timed out'):
                        driver.supervise([sys.executable, '-c', command], .3)
                else:
                    driver.supervise([sys.executable, '-c', command], 3)
                self.assertLess(time.monotonic() - start, 1.5, 'Descendant pipes defeated the deadline')
                time.sleep(2.1)
                self.assertFalse(marker.exists(), 'Worker descendant survived supervisor cleanup')
            finally:
                if pidfile.exists():
                    pid = int(pidfile.read_text())
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/PID', str(pid), '/T', '/F'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    else:
                        try:
                            os.kill(pid, 9)
                        except ProcessLookupError:
                            pass

    def test_failed_worker_does_not_leave_descendants(self):
        self.descendant_fixture(7, False)

    def test_dead_worker_descendant_pipes_cannot_defeat_deadline(self):
        self.descendant_fixture(7, True)

    def test_successful_worker_does_not_leave_descendants(self):
        self.descendant_fixture(0, False)

    def test_missing_executable_is_not_success(self):
        with self.assertRaises(OSError):
            driver.supervise([str(Path(__file__).with_name('missing-browser-command'))], 1)

    def test_timeout_validation(self):
        self.assertEqual(driver.positive_timeout('1.5'), 1.5)
        for value in ['0', '-1', 'nan', 'inf', '-inf']:
            with self.subTest(value=value), self.assertRaises(Exception):
                driver.positive_timeout(value)

    def valid(self, engines=('chromium', 'firefox', 'webkit')):
        results = []
        for engine in engines:
            for bundle in ['go-fns.js', 'go-fns.min.js']:
                results.append({'engine': engine, 'version': '123.4', 'bundle': bundle,
                                'status': 'passed', 'cases': 1, 'assertions': 2})
            results.append({'engine': engine, 'version': '123.4', 'example': 'README.md',
                            'status': 'passed', 'cases': 1, 'assertions': 4})
        return results

    def test_validates_complete_results(self):
        self.assertEqual(driver.validate_results(self.valid()), self.valid())

    def test_rejects_missing_or_extra_bundle(self):
        for data in [None, {}, [], self.valid()[:1], self.valid()+self.valid()]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                driver.validate_results(data)

    def test_rejects_duplicate_bundle(self):
        data = self.valid();data[1]['bundle'] = data[0]['bundle']
        with self.assertRaises(ValueError):
            driver.validate_results(data)

    def test_rejects_empty_or_invalid_counts(self):
        for field in ['cases', 'assertions']:
            for value in [0, -1, None, True, '1', 1.5]:
                data = copy.deepcopy(self.valid());data[0][field] = value
                with self.subTest(field=field,value=value), self.assertRaises(ValueError):
                    driver.validate_results(data)

    def test_rejects_failed_bundle(self):
        data = self.valid();data[1]['status']='failed';data[1]['error']='sentinel'
        with self.assertRaisesRegex(ValueError,'sentinel'):
            driver.validate_results(data)

    def test_rejects_missing_engine_and_documented_example(self):
        for data in [self.valid(('chromium',))[:2], self.valid(('chromium',)), self.valid()[:6],
                     [row for row in self.valid() if 'example' not in row]]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                driver.validate_results(data)

    def test_rejects_mislabeled_engine_or_missing_version(self):
        for field, value in [('engine', 'chromium'), ('version', ''), ('version', None)]:
            data = self.valid()
            data[3][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                driver.validate_results(data)

    def test_rejects_incomplete_example(self):
        for field, value in [('status', 'failed'), ('cases', 0), ('assertions', 0), ('example', 'other')]:
            data = self.valid()
            data[2][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                driver.validate_results(data)

    def test_default_run_requires_three_completed_engines(self):
        def completed(command, timeout):
            engine = command[command.index('--engine') + 1]
            return json.dumps(self.valid((engine,)))
        with patch.object(driver, 'supervise', side_effect=completed):
            self.assertEqual(driver.run_matrix(Path('candidate'), None, 60), self.valid())

    def test_unavailable_engine_is_a_release_failure(self):
        def unavailable(command, timeout):
            engine = command[command.index('--engine') + 1]
            if engine == 'firefox':
                raise RuntimeError('Firefox executable missing')
            return json.dumps(self.valid((engine,)))
        with patch.object(driver, 'supervise', side_effect=unavailable):
            with self.assertRaisesRegex(RuntimeError, 'Firefox executable missing'):
                driver.run_matrix(Path('candidate'), None, 60)

    def test_worker_cannot_claim_another_engine_or_omit_example(self):
        for rows in [self.valid(('firefox',)), self.valid(('chromium',))[:2]]:
            with patch.object(driver, 'supervise', return_value=json.dumps(rows)):
                with self.subTest(rows=rows), self.assertRaises(ValueError):
                    driver.run_matrix(Path('candidate'), None, 60)

    def test_chromium_override_does_not_replace_other_engines(self):
        def completed(command, timeout):
            engine = command[command.index('--engine') + 1]
            self.assertEqual(timeout, 7.5)
            self.assertEqual(command[command.index('--package-root') + 1], str(Path('candidate').resolve()))
            if engine == 'chromium':
                self.assertEqual(command[command.index('--chromium') + 1], 'custom-chromium')
            else:
                self.assertNotIn('--chromium', command)
            return json.dumps(self.valid((engine,)))
        with patch.object(driver, 'supervise', side_effect=completed):
            self.assertEqual(driver.run_matrix(Path('candidate'), 'custom-chromium', 7.5), self.valid())

    def test_diagnostic_engine_still_requires_both_bundles_and_example(self):
        with patch.object(driver, 'supervise', return_value=json.dumps(self.valid(('webkit',)))):
            self.assertEqual(driver.run_matrix(Path('candidate'), None, 60, ('webkit',)), self.valid(('webkit',)))


class DocumentedExampleTests(unittest.TestCase):
    def read_example(self, url, inline='console.log(2);'):
        with tempfile.TemporaryDirectory(prefix='go-fns-browser-example-') as directory:
            root = Path(directory)
            (root / 'dist').mkdir()
            (root / 'dist/go-fns.min.js').write_bytes(b'candidate bytes')
            (root / 'package.json').write_text(json.dumps({'name': 'go-fns', 'version': '2.0.0'}))
            (root / 'README.md').write_text(
                '```html\n<script src="' + url + '"></script>\n<script>' + inline + '</script>\n```')
            return driver.read_example(root)

    def test_loads_only_own_exact_versioned_candidate_bytes(self):
        example = self.read_example('https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js')
        self.assertEqual(example['bundle_url'],
                         'https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js')
        self.assertEqual(example['bundle_bytes'], b'candidate bytes')
        self.assertIn('<script>console.log(2);</script>', example['html'])

    def test_captures_annotated_expression_results_without_console_output(self):
        example = self.read_example('https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js',
                                    inline='prepareTitle("  Draft  ");  // => "Draft"\n'
                                           'prepareTitle("   ");  // => "Untitled"')
        self.assertEqual(example['expected'], ['Draft', 'Untitled'])
        self.assertIn('window.__goFnsExampleOutput.push(prepareTitle("  Draft  "));', example['html'])
        self.assertIn('window.__goFnsExampleOutput.push(prepareTitle("   "));', example['html'])

    def test_rejects_other_versions_packages_hosts_and_paths(self):
        for url in ['https://cdn.jsdelivr.net/npm/go-fns@1.0.0/dist/go-fns.min.js',
                    'https://cdn.jsdelivr.net/npm/other@2.0.0/dist/go-fns.min.js',
                    'https://example.com/npm/go-fns@2.0.0/dist/go-fns.min.js',
                    'https://cdn.jsdelivr.net/npm/go-fns@2.0.0/../dist/go-fns.min.js',
                    'https://cdn.jsdelivr.net/npm/go-fns@2.0.0/dist/go-fns.min.js?version=1']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.read_example(url)


benchmark_spec = importlib.util.spec_from_file_location(
    'benchmark_driver_tests',
    Path(__file__).resolve().parents[1] / 'test/browser/benchmark-drivers.test.py'
)
benchmark_tests = importlib.util.module_from_spec(benchmark_spec)
benchmark_spec.loader.exec_module(benchmark_tests)
BenchmarkDriverTests = benchmark_tests.BenchmarkDriverTests


if __name__ == '__main__':
    unittest.main()
