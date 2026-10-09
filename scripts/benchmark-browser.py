"""Compare the retained 2.0.0 and candidate minified bundles in fresh Chromium pages."""
import argparse
import json
import hashlib
import os
import platform
import shutil
import statistics
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'))
parser.add_argument('--baseline', type=Path, default=root / 'benchmarks/baseline-2.0.0/dist/go-fns.min.js')
parser.add_argument('--candidate', type=Path, default=root / 'package/dist/go-fns.min.js')
parser.add_argument('--rounds', type=int, default=2)
parser.add_argument('--samples', type=int, default=9)
parser.add_argument('--target-ms', type=int, default=12)
parser.add_argument('--warmup-ms', type=int, default=30)
parser.add_argument('--filter')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
if min(args.rounds, args.samples, args.target_ms, args.warmup_ms) <= 0:
    parser.error('Rounds, samples and timing budgets must be positive integers.')
for entry in [args.baseline, args.candidate]:
    if not entry.is_file():
        parser.error('Missing bundle: ' + str(entry))
options = {'samples': args.samples, 'targetMs': args.target_ms, 'warmupMs': args.warmup_ms, 'filter': args.filter}
runs = {'baseline': [], 'candidate': []}
with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if args.chromium:
        launch['executable_path'] = args.chromium
    browser = p.chromium.launch(**launch)
    version = browser.version
    try:
        for round_index in range(args.rounds):
            order = ['baseline', 'candidate'] if round_index % 2 == 0 else ['candidate', 'baseline']
            for kind in order:
                print(f'Round {round_index + 1}/{args.rounds}: {kind}', flush=True)
                context = browser.new_context()
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                try:
                    page.set_content('<!doctype html><title>go-fns benchmark</title>')
                    page.add_script_tag(path=str(getattr(args, kind).resolve()))
                    page.add_script_tag(path=str(root / 'benchmarks/scenarios.js'))
                    result = page.evaluate('options => GoFnsBench.measure(Functions, options)', options)
                    if errors:
                        raise RuntimeError('; '.join(errors))
                    runs[kind].append(result)
                finally:
                    context.close()
    finally:
        browser.close()

cases = []
for index, baseline in enumerate(runs['baseline'][0]['cases']):
    case = {'name': baseline['name'], 'probe': baseline['probe']}
    for kind in ['baseline', 'candidate']:
        values = [run['cases'][index] for run in runs[kind]]
        if any(value['name'] != baseline['name'] or value['probe'] != baseline['probe'] for value in values):
            raise AssertionError('Workload mismatch: ' + baseline['name'])
        samples = [sample for value in values for sample in value['nsPerOperation']]
        ordered = sorted(samples)
        case[kind] = {'medianNs': statistics.median(samples), 'p10Ns': ordered[int(len(ordered) * 0.1)], 'p90Ns': ordered[int(len(ordered) * 0.9)], 'nsPerOperation': samples, 'iterations': [value['iterations'] for value in values]}
    case['speedup'] = case['baseline']['medianNs'] / case['candidate']['medianNs']
    cases.append(case)
if not cases:
    raise RuntimeError('No scenarios match the filter.')
artifacts = {kind: {'path': str(getattr(args, kind)), 'sha256': hashlib.sha256(getattr(args, kind).read_bytes()).hexdigest()} for kind in ['baseline', 'candidate']}
report = {'artifacts': artifacts, 'chromium': version, 'platform': platform.platform(), 'rounds': args.rounds, 'options': options, 'cases': cases}
for case in cases:
    print(f"{case['name']:<35} {case['baseline']['medianNs']:>10.2f} -> {case['candidate']['medianNs']:>10.2f} ns/op  {case['speedup']:>5.2f}x")
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print('Saved ' + str(args.output))
