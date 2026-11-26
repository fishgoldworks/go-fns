"""Measure original versus shipped adapters in actual Chromium; no external requests."""
import json
import platform
import shutil
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from benchmark_inputs import capture_inputs, assert_unchanged

root = Path(__file__).resolve().parents[1]
entries = {
    'baseline': root / 'benchmarks/baseline-2.2.0/dist/go-fns.min.js',
    'candidate': root / 'package/dist/go-fns.min.js'
}
workload = root / 'benchmarks/adapters/measure.js'
identity = capture_inputs(entries, Path(__file__), workload)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    try:
        page = browser.new_page()
        page.add_script_tag(path=str(entries['baseline']))
        page.evaluate('window.reviewBaseline = Functions')
        page.add_script_tag(path=str(entries['candidate']))
        page.add_script_tag(path=str(workload))
        measurement = page.evaluate('runReviewAdapterBenchmark(reviewBaseline, Functions)')
        assert_unchanged(identity, entries, Path(__file__), workload)
        result = {
            'runtime': browser.version,
            'platform': platform.platform(),
            'baseline': '2.2.0',
            'candidate': json.loads((root / 'package.json').read_text())['version'],
            **measurement,
            **identity
        }
    finally:
        browser.close()

text = json.dumps(result, indent=2) + '\n'
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(text)
print(text)
