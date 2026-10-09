"""Measure original versus shipped adapters in actual Chromium; no external requests."""
import json,sys,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page()
    page.add_script_tag(path=str(root/'benchmarks/baseline-2.2.0/dist/go-fns.min.js'))
    page.evaluate('window.reviewBaseline = Functions')
    page.add_script_tag(path=str(root/'package/dist/go-fns.min.js'))
    page.add_script_tag(path=str(root/'benchmarks/adapters/measure.js'))
    result={'runtime':browser.version,'baseline':'2.2.0','candidate':json.loads((root/'package.json').read_text())['version'],
            **page.evaluate('runReviewAdapterBenchmark(reviewBaseline, Functions)')}
    browser.close()
text=json.dumps(result,indent=2)+'\n'
if len(sys.argv)>1: Path(sys.argv[1]).write_text(text)
print(text)
