"""Regression tests for Perps applicability, data layers and CLI false passes."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from generate import build
from scenarios import checkpoints

BASE = Path(__file__).resolve().parent
ROOT = next(p for p in BASE.parents if (p/'.git').exists())
APP = os.environ.get('APP_MONOREPO_PATH', str(ROOT.parent/'app-monorepo'))


class PerpsContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build()

    def test_both_perps_profiles_keep_zero_as_reported_volume(self):
        self.assertEqual(len(self.data['profiles']), 2)
        for profile in self.data['profiles'].values():
            for name in ['PVT', 'NVI']:
                self.assertFalse(profile['parameters'][name]['zeroVolumeIsMissing'])

    def test_perps_mtm_uses_ui_available_close_source(self):
        for profile in self.data['profiles'].values():
            self.assertEqual(profile['parameters']['MTM']['source'], 'close')
        for panel in self.data['workloads']['four-panel']['panels']:
            self.assertEqual(panel['parameters']['MTM']['source'], 'close')
            for frame in panel['frames']+panel['periodSwitch']['frames']:
                self.assertEqual(frame.get('parameters', panel['parameters'])['MTM']['source'], 'close')

    def test_feed_samples_drop_invalid_candles_before_indicators(self):
        for profile in self.data['profiles'].values():
            self.assertTrue('feedVariants' in profile, 'Missing feed-layer expectations')
            p = profile['feedVariants']['missing-price']
            self.assertEqual(len(p['inputBars']), 96)
            self.assertEqual(len(p['bars']), 92)
            self.assertEqual(p['droppedTimes'], [1767227700, 1767227760, 1767227820, 1767227880])
        p = self.data['profiles']['compact']['feedVariants']['missing-price']
        index = next(i for i, b in enumerate(p['bars']) if b['time'] == 1767227940)
        self.assertEqual(p['expected']['WMA']['line:1'][index], 108)
        self.assertEqual(len(self.data['profiles']['compact']['feedVariants']['missing-volume']['bars']), 93)

    def test_sequences_supply_realtime_and_recovery_snapshots(self):
        for profile in self.data['profiles'].values():
            self.assertTrue('sequences' in profile, 'Missing event-sequence expectations')
            seq = profile['sequences']['realtime']
            self.assertEqual([f['event'] for f in seq], ['initial', 'volume-only', 'price-only', 'append', 'history-prepend', 'repeat-last'])
            initial, volume, price, append, prepend, repeat = seq
            self.assertEqual(len(initial['bars']), 48)
            self.assertEqual(len(append['bars']), 49)
            self.assertEqual(len(prepend['bars']), 65)
            self.assertEqual(prepend['bars'], repeat['bars'])
            self.assertEqual(prepend['expected'], repeat['expected'])
            for key in ['open', 'high', 'low', 'close', 'time']:
                self.assertEqual(initial['bars'][-1][key], volume['bars'][-1][key])
            self.assertNotEqual(initial['expected']['VWMA']['line:1'][-1], volume['expected']['VWMA']['line:1'][-1])
            self.assertNotEqual(volume['expected']['ROC']['roc'][-1], price['expected']['ROC']['roc'][-1])
            recovery = profile['sequences']['history-recovery']
            self.assertEqual([len(f['bars']) for f in recovery], [96, 92, 96, 93, 96])
            self.assertEqual(recovery[0]['expected'], recovery[2]['expected'])
            self.assertEqual(recovery[0]['expected'], recovery[4]['expected'])

    def test_missing_and_recovery_markers_use_actual_times(self):
        bars = [dict(time=1767225600+60*i) for i in range(6)]
        marks = checkpoints(bars, {'WMA': {'line:0': [None, 1, None, None, 2, 3]}})
        self.assertEqual(marks['WMA']['line:0'], {
            'firstValidTime': 1767225660, 'missingTimes': [1767225720],
            'recoveryTimes': [1767225840]})

    def test_history_recovery_requests_isolated_history_sessions(self):
        for p in self.data['profiles'].values():
            self.assertTrue(all(frame.get('reloadHistory') for frame in p['sequences']['history-recovery']))

    def test_four_panels_share_one_realtime_clock(self):
        panels = self.data['workloads']['four-panel']['panels']
        self.assertEqual(len({p['frames'][-1]['bars'][-1]['time'] for p in panels}), 1)
        for p in panels:
            self.assertEqual(p['frames'][-1]['bars'][-1]['time']-p['frames'][0]['bars'][-1]['time'], p['intervalSeconds'])

    def test_minute_aggregation_has_hand_checked_ohlcv(self):
        import scenarios
        self.assertTrue(hasattr(scenarios, 'aggregate_minutes'), 'Missing independent period aggregation')
        bars = [dict(time=1767225600+60*i, open=10+i, high=12+i,
                     low=8+i, close=11+i, volume=i+1) for i in range(6)]
        self.assertEqual(scenarios.aggregate_minutes(bars, 180), [
            dict(time=1767225600, open=10, high=14, low=8, close=13, volume=6),
            dict(time=1767225780, open=13, high=17, low=11, close=16, volume=15)])
        self.assertEqual(scenarios.aggregate_minutes(bars[:1]+bars[2:], 180), [
            dict(time=1767225780, open=13, high=17, low=11, close=16, volume=15)])
        with self.assertRaises(ValueError):
            scenarios.aggregate_minutes(bars, 90)

    def test_same_panel_roundtrip_keeps_target_period_and_clock(self):
        targets = [300, 900, 3600, 14400]
        for panel, target in zip(self.data['workloads']['four-panel']['panels'], targets):
            self.assertTrue('periodSwitch' in panel, 'Missing same-panel period-switch samples')
            switch = panel['periodSwitch']
            frames = switch['frames']
            self.assertTrue(switch['requiresFreshSession'])
            self.assertEqual([f['event'] for f in frames], ['interval-source', 'interval-target', 'interval-return'])
            self.assertEqual([f['intervalSeconds'] for f in frames], [panel['intervalSeconds'], target, panel['intervalSeconds']])
            self.assertEqual([f['fromIntervalSeconds'] for f in frames], [None, panel['intervalSeconds'], target])
            self.assertEqual([f['measure'] for f in frames], [False, True, True])
            for f in frames:
                self.assertEqual(len(f['bars']), 256)
                self.assertTrue(all(b['time'] % f['intervalSeconds'] == 0 for b in f['bars']))
                self.assertEqual(f['bars'][-1]['time']+f['intervalSeconds']-1, switch['clockTime'])
                self.assertEqual(f['parameters'], panel['parameters'])
            self.assertEqual(frames[0]['bars'], frames[2]['bars'])
            self.assertEqual(frames[0]['expected'], frames[2]['expected'])
            self.assertNotEqual(frames[0]['expected']['WMA']['line:1'][-1], frames[1]['expected']['WMA']['line:1'][-1])
        self.assertEqual(len({p['periodSwitch']['clockTime'] for p in self.data['workloads']['four-panel']['panels']}), 1)

    def test_target_buckets_match_complete_source_buckets(self):
        import math
        for panel in self.data['workloads']['four-panel']['panels']:
            self.assertTrue('periodSwitch' in panel, 'Missing coherent target candles')
            src, dst, _ = panel['periodSwitch']['frames']
            width = dst['intervalSeconds']
            expected = {b['time']: b for b in dst['bars']}
            buckets = {}
            for b in src['bars']:
                buckets.setdefault(b['time']//width*width, []).append(b)
            checked = 0
            for time, points in buckets.items():
                if len(points) != width//src['intervalSeconds']:
                    continue
                self.assertEqual(expected[time], dict(time=time, open=points[0]['open'],
                    high=max(b['high'] for b in points), low=min(b['low'] for b in points),
                    close=points[-1]['close'], volume=math.fsum(b['volume'] for b in points)))
                checked += 1
            self.assertGreater(checked, 0)

    def test_period_timing_requires_each_cache_mode_and_direction(self):
        workload = self.data['workloads']['four-panel']
        self.assertTrue('periodSwitchTiming' in workload, 'Missing measurable timing plan')
        timing = workload['periodSwitchTiming']
        self.assertEqual(timing['roundsPerDirection'], 20)
        self.assertEqual(timing['cacheModes'], ['cold', 'warm'])
        self.assertTrue(timing['coldClearDestinationBeforeSwitch'])
        self.assertTrue(timing['warmPreloadBothIntervals'])
        self.assertFalse(timing['syncIntervals'])
        self.assertEqual(timing['requiredObservations'], 320)

    def test_four_panel_workload_has_independent_expected_outputs(self):
        self.assertTrue('workloads' in self.data, 'Missing four-panel workload')
        workload = self.data['workloads']['four-panel']
        self.assertEqual(len(workload['panels']), 4)
        self.assertEqual(workload['repeatRounds'], 20)
        for panel in workload['panels']:
            self.assertGreaterEqual(len(panel['frames'][0]['bars']), 256)
            self.assertIn('ENV', panel['enabledIndicators'])
            self.assertIn('QQE', panel['enabledIndicators'])
            self.assertEqual(len(panel['frames']), 4)
            self.assertEqual(set(panel['frames'][0]['expected']), set(self.data['newIndicators']+self.data['legacyMovingAverages']))
            self.assertFalse(panel['parameters']['PVT']['zeroVolumeIsMissing'])


class ConsumerIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build()

    def reject(self, change):
        data = copy.deepcopy(self.data)
        change(data)
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp)/'indicators.json'
            file.write_text(json.dumps(data, allow_nan=False))
            result = subprocess.run(['node', str(BASE/'compare-product.mjs'), '--app-repo', APP,
                                     '--fixtures', str(file)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0, 'Malformed/truncated fixture passed')
        self.assertIn('Input contract rejected', result.stderr)

    def test_rejects_zero_profiles(self):
        self.reject(lambda d: d.update(profiles={}))

    def test_rejects_missing_profile(self):
        self.reject(lambda d: d['profiles'].pop('compact'))

    def test_rejects_only_empty_variant(self):
        self.reject(lambda d: [p.update(variants={'empty': p['variants']['empty']}) for p in d['profiles'].values()])

    def test_rejects_empty_arrays_behind_all_scenario_names(self):
        def empty(d):
            for p in d['profiles'].values():
                for sample in p['variants'].values():
                    sample['bars'] = []
                    sample['expected'] = {n: {k: [] for k in lines} for n, lines in sample['expected'].items()}
        self.reject(empty)

    def test_rejects_modified_candle(self):
        self.reject(lambda d: d['profiles']['compact']['variants']['mixed']['bars'][0].update(high=999))

    def test_rejects_modified_parameters(self):
        self.reject(lambda d: d['profiles']['compact']['parameters']['PVT'].update(zeroVolumeIsMissing=True))

    def test_rejects_modified_expected_value(self):
        self.reject(lambda d: d['profiles']['compact']['variants']['mixed']['expected']['ROC']['movingAverage'].__setitem__(-1, 999))

    def test_rejects_missing_or_relabelled_period_switch_data(self):
        self.assertTrue('periodSwitch' in self.data['workloads']['four-panel']['panels'][0])
        self.reject(lambda d: d['workloads']['four-panel']['panels'][0].pop('periodSwitch'))
        self.reject(lambda d: d['workloads']['four-panel']['panels'][0]['periodSwitch']['frames'][1].update(intervalSeconds=60))

    def test_rejects_missing_feed_sequence_or_workload(self):
        for key in ['feedVariants', 'sequences']:
            self.assertTrue(key in self.data['profiles']['compact'], f'Missing {key}')
            self.reject(lambda d: d['profiles']['compact'].pop(key))
        self.assertTrue('workloads' in self.data)
        self.reject(lambda d: d.pop('workloads'))


if __name__ == '__main__':
    unittest.main()
