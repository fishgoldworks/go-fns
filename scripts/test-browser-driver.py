"""Supervisor regressions; no Playwright installation or browser is needed."""
import copy
import os
import subprocess
import tempfile
import importlib.util
from pathlib import Path
import sys
import time
import unittest

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

    def valid(self):
        return [{'bundle': name, 'status': 'passed', 'cases': 1, 'assertions': 2} for name in driver.BUNDLES]

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


if __name__ == '__main__':
    unittest.main()
