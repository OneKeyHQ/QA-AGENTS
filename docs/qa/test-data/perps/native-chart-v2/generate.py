"""Verify frozen independent samples and the exact JSON file the consumer reads."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

from reference import NEW, LEGACY_MA, calculate, datasets, profiles
from scenarios import feed_sample, four_panel_workload, sequences

BASE = Path(__file__).resolve().parent
SOURCE_SHA = '054fa331a4053e079ccd73a0ffa551c5910d3237'


def fingerprint(value):
    def normalize(x):
        if isinstance(x, float):
            return float(format(x, '.12g'))
        if isinstance(x, list):
            return [normalize(v) for v in x]
        if isinstance(x, dict):
            return {k: normalize(v) for k, v in x.items()}
        return x
    return hashlib.sha256(json.dumps(normalize(value), sort_keys=True,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def build():
    params = profiles()
    return {'schemaVersion': 4, 'sourceSha': SOURCE_SHA,
            'market': 'QA-NATIVE-USD', 'interval': '1m', 'timezone': 'UTC',
            'newIndicators': NEW, 'legacyMovingAverages': LEGACY_MA,
            'tolerance': {'absolute': 1e-8, 'relative': 1e-8},
            'layers': {'variants': 'calculator-only', 'feedVariants': 'perps-provider-and-history',
                       'sequences': 'perps-feed-snapshots', 'workloads': 'perps-four-panel-snapshots'},
            'profiles': {name: {'parameters': p,
                                'variants': {key: {'bars': bars, 'expected': calculate(bars, p)}
                                             for key, bars in datasets().items()},
                                'feedVariants': {key: feed_sample(bars, p) for key, bars in datasets().items()},
                                'sequences': sequences(p)} for name, p in params.items()},
            'workloads': {'four-panel': four_panel_workload(params)}}


def fingerprints(data):
    result = {}
    for profile, item in data['profiles'].items():
        for variant, sample in item['variants'].items():
            result[f'{profile}/{variant}'] = fingerprint({'parameters': item['parameters'], **sample})
        for variant, sample in item['feedVariants'].items():
            result[f'feed/{profile}/{variant}'] = fingerprint({'parameters': item['parameters'], **sample})
        for name, frames in item['sequences'].items():
            result[f'sequence/{profile}/{name}'] = fingerprint({'parameters': item['parameters'], 'frames': frames})
    result['workload/four-panel'] = fingerprint(data['workloads']['four-panel'])
    return result


def verify(data, frozen):
    if fingerprint(data) != frozen['document'] or fingerprints(data) != frozen['samples']:
        raise ValueError('frozen input contract mismatch: missing, empty or modified fixture content')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='verify the source corpus (default)')
    parser.add_argument('--verify-stdin', action='store_true', help='verify the exact buffered consumer input')
    parser.add_argument('--verify', type=Path, help='verify the actual expanded consumer file')
    parser.add_argument('--output', type=Path, help='expand indicators.json outside this repository')
    args = parser.parse_args()
    frozen = json.loads((BASE/'fingerprints.json').read_text())
    if args.verify or args.verify_stdin:
        verify(json.loads(sys.stdin.read() if args.verify_stdin else args.verify.read_text()), frozen)
        print('PASS: consumed fixture matches the complete frozen input contract')
        return
    data = build()
    verify(data, frozen)
    if args.output:
        target = args.output.resolve()
        repo = next(p for p in BASE.parents if (p/'.git').exists())
        if target == repo or repo in target.parents:
            raise SystemExit('FAIL: expanded temporary data must be outside the repository')
        target.mkdir(parents=True, exist_ok=True)
        (target/'indicators.json').write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')
    print(f'PASS: {len(NEW)} new indicators + {len(LEGACY_MA)} MAs; '
          f'{len(data["profiles"])} Perps profiles; {len(frozen["samples"])} frozen sample groups')


if __name__ == '__main__':
    main()
