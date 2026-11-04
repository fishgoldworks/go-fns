"""Run real-browser window, iframe, Worker and documented-example contracts.

Requires Python Playwright and its Chromium, Firefox and WebKit browsers. Each
engine has a parent-process deadline. Supervisor self-tests use the standard library.
"""
import argparse
import json
import math
import os
import re
import shutil
import signal
import subprocess
import sys
from pathlib import Path
from html.parser import HTMLParser

BUNDLES = ('go-fns.js', 'go-fns.min.js')
ENGINES = ('chromium', 'firefox', 'webkit')


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


def validate_results(results, engines=ENGINES):
    # Preserve each worker's bundle/example order in the aggregate report.
    expected = [entry for engine in engines for entry in
                [(engine, 'bundle', bundle) for bundle in BUNDLES] + [(engine, 'example', 'README.md')]]
    if not isinstance(results, list) or len(results) != len(expected):
        raise ValueError('Incomplete browser report: expected both bundles and README example for every engine.')
    for (engine, kind, name), result in zip(expected, results):
        if not isinstance(result, dict) or result.get('engine') != engine or result.get(kind) != name:
            raise ValueError('Incomplete browser report: wrong or duplicate engine, bundle or example.')
        if result.get('status') != 'passed':
            raise ValueError('Browser checks failed: ' + str(result))
        if not isinstance(result.get('version'), str) or not result['version'].strip():
            raise ValueError('Incomplete browser report: missing engine version for ' + engine)
        for field in ('cases', 'assertions'):
            if type(result.get(field)) is not int or result[field] <= 0:
                raise ValueError('Incomplete browser report: no ' + field + ' for ' + engine + ': ' + name)
    return results


def run_matrix(package_root, chromium, timeout, engines=ENGINES):
    results = []
    for engine in engines:
        command = [sys.executable, str(Path(__file__).resolve()), '--worker', '--engine', engine,
                   '--package-root', str(package_root.resolve())]
        if chromium and engine == 'chromium':
            command += ['--chromium', chromium]
        report = json.loads(supervise(command, timeout))
        results.extend(validate_results(report, (engine,)))
    return validate_results(results, engines)


def read_example(package_root):
    metadata = json.loads((package_root / 'package.json').read_text(encoding='utf-8'))
    readme = (package_root / 'README.md').read_text(encoding='utf-8')
    examples = re.findall(r'```html\s*\n([\s\S]*?)```', readme)
    if len(examples) != 1:
        raise ValueError('The packaged README must contain one runnable script-tag example.')

    class Scripts(HTMLParser):
        def __init__(self):
            super().__init__()
            self.sources = []

        def handle_starttag(self, tag, attrs):
            if tag == 'script':
                self.sources.extend(value for key, value in attrs if key == 'src')

    scripts = Scripts()
    scripts.feed(examples[0])
    prefix = 'https://cdn.jsdelivr.net/npm/' + metadata['name'] + '@' + metadata['version'] + '/dist/'
    allowed = {prefix + name: package_root / 'dist' / name for name in BUNDLES}
    if len(scripts.sources) != 1 or scripts.sources[0] not in allowed:
        raise ValueError('The README example must load this candidate\'s exact versioned CDN bundle URL.')
    bundle_url = scripts.sources[0]
    expected = []

    def record_result(match):
        # These compact examples annotate expression statements with JSON values.
        # Capture the expression's actual value without requiring console output.
        expected.append(json.loads(match[3]))
        return match[1] + 'window.__goFnsExampleOutput.push(' + match[2] + ');'

    def record_script(match):
        script = re.sub(r'^([ \t]*)([^\n]+?);[ \t]+// => ([^\n]+)$', record_result,
                        match[2], flags=re.MULTILINE)
        return match[1] + script + match[3]

    html = re.sub(r'(<script>)([\s\S]*?)(</script>)', record_script, examples[0])
    return {'html': '<!doctype html><html><body>' + html + '</body></html>',
            'expected': expected, 'bundle_url': bundle_url,
            'bundle_bytes': allowed[bundle_url].read_bytes()}


def check_example(browser, package_root):
    example = read_example(package_root)
    page = browser.new_page()
    errors, unexpected_requests, bundles_loaded = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    address = 'http://go-fns.invalid/documented-example'

    def route_request(route):
        url = route.request.url
        if url == address:
            route.fulfill(body=example['html'], content_type='text/html')
        elif url == example['bundle_url']:
            bundles_loaded.append(url)
            route.fulfill(body=example['bundle_bytes'], content_type='text/javascript')
        else:
            unexpected_requests.append(url)
            route.abort()

    try:
        # Only this candidate's exact CDN URL is mapped to local bytes. No
        # public CDN or different package/version can make the example pass.
        page.route('**/*', route_request)
        if example['expected'] != [2, [3.1]]:
            raise AssertionError('README example must retain both documented result assertions.')
        page.add_init_script('window.__goFnsExampleOutput = [];')
        page.goto(address, timeout=10000)
        page.wait_for_function('window.__goFnsExampleOutput.length >= 2', timeout=10000)
        output = page.evaluate('window.__goFnsExampleOutput')
        if errors:
            raise AssertionError('README example browser errors: ' + '; '.join(errors))
        if unexpected_requests:
            raise AssertionError('README example requested unexpected URLs: ' + '; '.join(unexpected_requests))
        if bundles_loaded != [example['bundle_url']]:
            raise AssertionError('README example did not load exactly one candidate bundle.')
        if output != example['expected']:
            raise AssertionError('README example returned unexpected values: ' + repr(output))
        return {'example': 'README.md', 'status': 'passed', 'cases': 1, 'assertions': 4}
    finally:
        page.close()


def worker(args):
    from playwright.sync_api import sync_playwright
    root = Path(__file__).resolve().parents[1]
    results = []
    with sync_playwright() as p:
        options = {'headless': True}
        if args.engine == 'chromium':
            options['args'] = ['--no-sandbox']
            if args.chromium:
                options['executable_path'] = args.chromium
        browser = getattr(p, args.engine).launch(**options)
        identity = {'engine': args.engine, 'version': browser.version}
        for name in BUNDLES:
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
                results.append({**identity, 'bundle': name, **result})
            except Exception as error:
                results.append({**identity, 'bundle': name, 'status': 'failed', 'error': str(error)})
            finally:
                page.close()
        try:
            results.append({**identity, **check_example(browser, args.package_root)})
        except Exception as error:
            results.append({**identity, 'example': 'README.md', 'status': 'failed', 'error': str(error)})
        browser.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'))
    parser.add_argument('--engine', choices=ENGINES,
                        help='Run one engine for diagnosis; release verification requires the default full matrix.')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--package-root', type=Path, default=Path(__file__).resolve().parents[1] / 'package')
    parser.add_argument('--timeout', type=positive_timeout, default=60.0,
                        help='Deadline for each engine worker in seconds (default: 60).')
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.worker:
            if not args.engine:
                raise ValueError('A browser worker requires an explicit engine.')
            results = worker(args)
        else:
            results = run_matrix(args.package_root, args.chromium, args.timeout,
                                 (args.engine,) if args.engine else ENGINES)
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
