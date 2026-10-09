"""Run Chromium window, iframe and Worker contracts with a parent-process deadline.

Requires Python Playwright and Chromium for real browser checks. The supervisor
and its self-tests use the Python standard library only.
"""
import argparse
import json
import math
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

BUNDLES = ('go-fns.js', 'go-fns.min.js')


def positive_timeout(value):
    seconds = float(value)
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError('Timeout must be a finite positive number of seconds.')
    return seconds


class WindowsJob:
    """Own descendants even if their original worker has already exited."""
    def __init__(self):
        import ctypes
        from ctypes import wintypes

        class BasicLimits(ctypes.Structure):
            _fields_ = [('process_time', ctypes.c_longlong), ('job_time', ctypes.c_longlong),
                        ('flags', wintypes.DWORD), ('minimum_working_set', ctypes.c_size_t),
                        ('maximum_working_set', ctypes.c_size_t), ('active_processes', wintypes.DWORD),
                        ('affinity', ctypes.c_size_t), ('priority', wintypes.DWORD),
                        ('scheduling', wintypes.DWORD)]

        class ExtendedLimits(ctypes.Structure):
            _fields_ = [('basic', BasicLimits), ('io_counters', ctypes.c_ulonglong * 6),
                        ('process_memory', ctypes.c_size_t), ('job_memory', ctypes.c_size_t),
                        ('peak_process_memory', ctypes.c_size_t), ('peak_job_memory', ctypes.c_size_t)]

        self.api = ctypes.WinDLL('kernel32', use_last_error=True)
        self.api.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        self.api.CreateJobObjectW.restype = wintypes.HANDLE
        self.api.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        self.api.SetInformationJobObject.restype = wintypes.BOOL
        self.api.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        self.api.OpenProcess.restype = wintypes.HANDLE
        self.api.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        self.api.AssignProcessToJobObject.restype = wintypes.BOOL
        self.api.CloseHandle.argtypes = [wintypes.HANDLE]
        self.api.CloseHandle.restype = wintypes.BOOL
        self.handle = self.api.CreateJobObjectW(None, None)
        if not self.handle:
            raise ctypes.WinError(ctypes.get_last_error())
        limits = ExtendedLimits()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not self.api.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            error = ctypes.WinError(ctypes.get_last_error())
            self.close()
            raise error

    def attach(self, pid):
        import ctypes
        # The launch wrapper waits on stdin until ownership is established.
        process = self.api.OpenProcess(0x0101, False, pid)  # SET_QUOTA | TERMINATE
        if not process:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            if not self.api.AssignProcessToJobObject(self.handle, process):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            self.api.CloseHandle(process)

    def close(self):
        if self.handle:
            self.api.CloseHandle(self.handle)
            self.handle = None


def stop_worker(process, job=None):
    """Stop only the process tree started by this supervisor."""
    if job is not None:
        job.close()
    elif os.name == 'posix':
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process.poll() is None:
        process.kill()


def drain_worker(process):
    # A cleanup failure must not turn the failure-reporting path into a hang.
    try:
        return process.communicate(timeout=5)
    except subprocess.TimeoutExpired as error:
        def text(value):
            return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''
        return text(error.output), text(error.stderr)


def supervise(command, timeout):
    job = WindowsJob() if os.name == 'nt' else None
    process = None
    try:
        # Resolve before wrapping, preserving the missing-executable error contract.
        if job is not None:
            executable = shutil.which(command[0])
            if executable is None:
                raise FileNotFoundError('Browser worker executable not found: ' + command[0])
            command = [sys.executable, str(Path(__file__).resolve()), '--job-worker', executable, *command[1:]]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   stdin=subprocess.PIPE if job is not None else subprocess.DEVNULL,
                                   text=True, encoding='utf-8', start_new_session=os.name == 'posix')
        if job is not None:
            job.attach(process.pid)
        try:
            output, diagnostics = process.communicate(input='1' if job is not None else None, timeout=timeout)
        except subprocess.TimeoutExpired:
            stop_worker(process, job)
            output, diagnostics = drain_worker(process)
            raise RuntimeError('Browser worker timed out after ' + str(timeout) + ' seconds.\n' + diagnostics + output)
        if process.returncode != 0:
            raise RuntimeError('Browser worker failed with exit ' + str(process.returncode) + ':\n' + diagnostics + output)
        return output
    finally:
        if process is not None:
            stop_worker(process, job)
            drain_worker(process)
        elif job is not None:
            job.close()


def validate_results(results):
    if not isinstance(results, list) or len(results) != len(BUNDLES):
        raise ValueError('Incomplete browser report: expected both bundles.')
    for expected, result in zip(BUNDLES, results):
        if not isinstance(result, dict) or result.get('bundle') != expected:
            raise ValueError('Incomplete browser report: wrong or duplicate bundle.')
        if result.get('status') != 'passed':
            raise ValueError('Browser checks failed: ' + str(result))
        for field in ('cases', 'assertions'):
            if type(result.get(field)) is not int or result[field] <= 0:
                raise ValueError('Incomplete browser report: no ' + field + ' for ' + expected)
    return results


def worker(args):
    from playwright.sync_api import sync_playwright
    root = Path(__file__).resolve().parents[1]
    results = []
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--no-sandbox']}
        if args.chromium:
            options['executable_path'] = args.chromium
        browser = p.chromium.launch(**options)
        for name in ['go-fns.js', 'go-fns.min.js']:
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                page.set_content('<!doctype html><html><head><title>go-fns browser tests</title></head><body></body></html>')
                page.add_script_tag(path=str(args.package_root / 'dist' / name))
                page.add_script_tag(path=str(root / 'test/helpers/clock.js'))
                page.add_script_tag(path=str(root / 'test/browser/contracts.js'))
                result = page.evaluate('''source => Promise.race([
                    window.runGoFnsBrowserContracts(source),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Browser tests timed out')), 10000))
                ])''', (args.package_root / 'dist' / name).read_text())
                if errors:
                    raise AssertionError('Unexpected browser errors: ' + '; '.join(errors))
                results.append({'bundle': name, 'chromium': browser.version, **result})
            except Exception as error:
                results.append({'bundle': name, 'chromium': browser.version, 'status': 'failed', 'error': str(error)})
            finally:
                page.close()
        browser.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'))
    parser.add_argument('--output', type=Path)
    parser.add_argument('--package-root', type=Path, default=Path(__file__).resolve().parents[1] / 'package')
    parser.add_argument('--timeout', type=positive_timeout, default=60.0,
                        help='Whole browser-worker deadline in seconds (default: 60).')
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.worker:
            results = worker(args)
        else:
            command = [sys.executable, str(Path(__file__).resolve()), '--worker',
                       '--package-root', str(args.package_root.resolve())]
            if args.chromium:
                command += ['--chromium', args.chromium]
            results = validate_results(json.loads(supervise(command, args.timeout)))
    except Exception as error:
        results = [{'status': 'failed', 'error': str(error)}]
    output = json.dumps(results, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output + '\n', encoding='utf-8')
    print(output)
    return 0 if results and all(result.get('status') == 'passed' for result in results) else 1


if __name__ == '__main__':
    if sys.argv[1:2] == ['--job-worker']:
        # Do not start any descendants before the supervisor has assigned this
        # wrapper to its job. EOF means setup failed; no command should run.
        if sys.stdin.read(1) != '1':
            raise SystemExit(1)
        raise SystemExit(subprocess.call(sys.argv[2:], stdin=subprocess.DEVNULL))
    raise SystemExit(main())
