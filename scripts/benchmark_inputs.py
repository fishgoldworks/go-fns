"""Capture benchmark sources before loading and detect ordinary mid-run edits."""
import hashlib
from pathlib import Path


def describe(filename):
    filename = Path(filename)
    return {'path': str(filename), 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()}


def capture_inputs(entries, driver, workload):
    return {
        'artifacts': {kind: describe(filename) for kind, filename in entries.items()},
        'harness': {'driver': describe(driver), 'workload': describe(workload)}
    }


def assert_unchanged(before, entries, driver, workload):
    if capture_inputs(entries, driver, workload) != before:
        raise RuntimeError('Benchmark inputs changed during measurement.')
