"""Hand arithmetic, closed-form paths and invariants, independent of product code."""
import unittest
import reference as r


class Coverage(unittest.TestCase):
    def test_all_25_new_and_four_ma_outputs_exist(self):
        result = r.calculate([])
        self.assertEqual(set(result), set(r.NEW + r.LEGACY_MA))
        for name in r.LEGACY_MA:
            self.assertIn('movingAverage', result[name])




def bars(closes, volumes=None, spread=1):
    return [dict(time=1767225600+60*i, open=c, high=c+spread, low=c-spread,
                 close=c, volume=100 if volumes is None else volumes[i])
            for i, c in enumerate(closes)]


class Arithmetic(unittest.TestCase):
    def check(self, actual, expected):
        self.assertEqual(len(actual), len(expected))
        for a, e in zip(actual, expected):
            if e is None:
                self.assertIsNone(a)
            else:
                self.assertIsNotNone(a)
                self.assertAlmostEqual(a, e, delta=1e-8+1e-8*abs(e))

    def test_wma_direction_and_three_lines(self):
        out = r.calculate(bars([1, 2, 3]), {'WMA': {'periods': [1, 2, 3]}})['WMA']
        self.check(out['line:0'], [1, 2, 3])
        self.check(out['line:1'], [None, 5/3, 8/3])
        self.check(out['line:2'], [None, None, 14/6])

    def test_volume_weight_and_typical_price(self):
        b = bars([3, 9], [1, 2])
        b[0].update(high=6, low=0)
        b[1].update(high=12, low=3)
        out = r.calculate(b, {'VWMA': {'periods': [1, 2, 3]}, 'VWAP': {'period': 2}})
        self.check(out['VWMA']['line:1'], [None, 7])
        self.check(out['VWAP']['vwap'], [None, 19/3])

    def test_donchian(self):
        out = r.calculate(bars([10, 14, 9]), {'DC': {'period': 2}})['DC']
        self.check(out['upper'], [None, 15, 15])
        self.check(out['lower'], [None, 9, 8])
        self.check(out['basis'], [None, 12, 11.5])

    def test_atr_seed_and_wilder(self):
        self.check(r.calculate(bars([10, 12, 11, 15]), {'ATR': {'period': 2}})['ATR']['atr'],
                   [None, None, 2.5, 3.75])

    def test_supertrend_reversal_and_equality(self):
        out = r.calculate(bars([10, 12, 11, 15, 10, 9]), {'SUPERTREND': {'atrPeriod': 1, 'multiplier': 1}})['SUPERTREND']
        self.check(out['downTrend'], [None, 15, 13, None, None, 11])
        self.check(out['upTrend'], [None, None, None, 10, 10, None])

    def test_envelope_gaussian_and_zero_bandwidth(self):
        import math
        out = r.calculate(bars([1, 2]), {'ENV': {'bandwidth': 1, 'lookback': 2, 'multiplier': 2}})['ENV']
        error = math.exp(-.5)/(1+math.exp(-.5))
        self.check(out['upper'], [None, 2+error])
        self.check(out['lower'], [None, 2-3*error])
        self.check(r.calculate(bars([1, 2, 4]), {'ENV': {'bandwidth': 0, 'lookback': 3}})['ENV']['upper'], [None, 2, 4])

    def test_kdj_initial_state(self):
        b = bars([10, 8])
        b[0].update(high=10, low=8)
        b[1].update(high=10, low=8)
        out = r.calculate(b, {'KDJ': {'period': 1, 'kPeriod': 2, 'dPeriod': 2}})['KDJ']
        self.check(out['k'], [75, 37.5])
        self.check(out['d'], [62.5, 50])
        self.check(out['j'], [100, 12.5])

    def test_skdj_double_smoothing_warmup(self):
        out = r.calculate(bars([10]*6), {'SKDJ': {'period': 2, 'smoothingPeriod': 2}})['SKDJ']
        self.check(out['k'], [None, None, None, 50, 50, 50])
        self.check(out['d'], [None, None, None, None, 50, 50])

    def test_dma(self):
        out = r.calculate(bars(list(range(1, 7))), {'DMA': {'shortPeriod': 2, 'longPeriod': 4, 'movingAveragePeriod': 2}})['DMA']
        self.check(out['dif'], [None, None, None, 1, 1, 1])
        self.check(out['movingAverage'], [None, None, None, None, 1, 1])

    def test_volume_ratio_psy_flat_bar(self):
        out = r.calculate(bars([10, 12, 11, 11], [1, 20, 10, 6]),
                          {'VR': {'period': 3, 'movingAveragePeriod': 1}, 'PSY': {'period': 2, 'movingAveragePeriod': 2}})
        self.check(out['VR']['vr'], [None, None, None, 2300/13])
        self.check(out['PSY']['psy'], [None, None, 50, 0])
        self.check(out['PSY']['movingAverage'], [None, None, None, 25])

    def test_brar(self):
        b = bars([10]*3)
        for x in b:
            x['high'] = 12
        out = r.calculate(b, {'BRAR': {'period': 2}})['BRAR']
        self.check(out['ar'], [None, 200, 200])
        self.check(out['br'], [None, None, 200])

    def test_pvt_nvi_skip_missing_volume(self):
        out = r.calculate(bars([10, 12, 999, 6], [100, 50, None, 25]), {'NVI': {'movingAveragePeriod': 3}})
        self.check(out['PVT']['pvt'], [0, 10, None, -2.5])
        self.check(out['NVI']['nvi'], [1000, 1200, None, 600])
        self.check(out['NVI']['movingAverage'], [1000, 1100, None, 850])

    def test_zero_volume_source_semantics(self):
        b = bars([10, 12, 6], [100, 0, 50])
        native = r.calculate(b)
        stock = r.calculate(b, {'PVT': {'zeroVolumeIsMissing': True}, 'NVI': {'zeroVolumeIsMissing': True}})
        self.check(native['PVT']['pvt'], [0, 0, -25])
        self.check(stock['PVT']['pvt'], [0, None, -20])
        self.check(stock['NVI']['nvi'], [1000, None, 600])

    def test_squeeze_linear_momentum_and_equality(self):
        out = r.calculate(bars([1, 2, 3, 4, 5]), {'SMI': {'bollingerPeriod': 2, 'keltnerPeriod': 2, 'momentumPeriod': 2, 'bollingerMultiplier': 0, 'keltnerMultiplier': 0}})['SMI']
        self.check(out['momentum'], [None, None, .5, .5, .5])
        self.check(out['squeeze'], [None, None, 0, 0, 0])
        on = r.calculate(bars([10]*8))['SMI']['squeeze'][-1]
        self.assertEqual(on, 1)

    def test_tsi_and_rvi_monotonic(self):
        for sign, expected in [(1, 100), (-1, 0)]:
            out = r.calculate(bars([100+sign*i for i in range(30)]))
            self.assertAlmostEqual(out['TSI']['tsi'][-1], sign)
            self.assertAlmostEqual(out['RVI']['rvi'][-1], expected)
            self.assertAlmostEqual(out['RVI']['signal'][-1], expected)
        self.assertTrue(all(x is None for x in r.calculate(bars([10]*30))['TSI']['tsi']))
        self.assertTrue(all(x is None for x in r.calculate(bars([10]*30))['RVI']['rvi']))

    def test_qqe_constant_rsi_and_trailing_crossings(self):
        out = r.calculate(bars(list(range(1, 31))))['QQE']
        for line in out.values():
            self.assertEqual(line[-1], 100)
        # Hand-stepped band=1, factor=2; crossing uses band[t-1] and band[t-2].
        self.check(r.trailing([50, 55, 51, 45, 49, 55], [1]*6, 2), [48, 53, 49, 43, 47, 53])
        self.check(r.trailing([50, 50, 45, 50, 55], [1]*5, 2), [48, 48, 47, 48, 53])

    def test_mass_constant_range(self):
        out = r.calculate(bars([10]*25), {'MASS': {'period': 3}})['MASS']['mass']
        self.check(out, [None]*18 + [3]*7)

    def test_kst_pmo_geometric_growth(self):
        out = r.calculate(bars([2**i for i in range(15)]),
                          {'KST': {'rocPeriods': [1, 2, 3, 4], 'smoothingPeriods': [1]*4, 'signalPeriod': 2},
                           'PMO': {'firstPeriod': 2, 'secondPeriod': 2, 'signalPeriod': 2}})
        self.check(out['KST']['kst'], [None]*4 + [8800]*11)
        self.check(out['KST']['signal'], [None]*5 + [8800]*10)
        self.check(out['PMO']['pmo'], [None]*3 + [1000]*12)
        self.check(out['PMO']['signal'], [None]*4 + [1000]*11)

    def test_bbp_and_scaled_slope(self):
        out = r.calculate(bars([1, 2, 3, 4]), {'BBP': {'period': 3}, 'SLOPE': {'period': 3, 'lookback': 1}})
        self.check(out['BBP']['bbp'], [None, None, 2, 2])
        self.check(out['SLOPE']['slope'], [None, None, None, 3196])

    def test_rci_rank_ties_and_ribbon(self):
        self.assertEqual(r.rank_index([1, 2, 3]), 100)
        self.assertEqual(r.rank_index([3, 2, 1]), -100)
        self.assertEqual(r.rank_index([1, 1, 1]), 50)
        # Price ranks 3,1.5,1.5; time ranks 3,2,1 -> sum(d^2)=.5.
        self.assertEqual(r.rank_index([1, 2, 2]), 87.5)
        out = r.calculate(bars(list(range(1, 9))))['RCI']
        for line in out.values():
            self.assertEqual(line[-1], 100)

    def test_roc_mtm_ma_are_indicator_averages(self):
        out = r.calculate(bars([10, 12, 9, 18]), {'ROC': {'period': 1, 'movingAveragePeriod': 2}, 'MTM': {'period': 1, 'movingAveragePeriod': 2}})
        self.check(out['ROC']['roc'], [None, 20, -25, 100])
        self.check(out['ROC']['movingAverage'], [None, None, -2.5, 37.5])
        self.check(out['MTM']['momentum'], [None, 2, -3, 9])
        self.check(out['MTM']['movingAverage'], [None, None, -.5, 3])

    def test_mtm_open_source_is_calculator_only(self):
        sample = bars([10, 12, 9, 18])
        for bar, value in zip(sample, [11, 11, 10, 16]):
            bar['open'] = value
        out = r.calculate(sample, {'MTM': {'period': 1, 'source': 'open', 'movingAveragePeriod': 2}})['MTM']
        self.check(out['momentum'], [None, 0, -1, 6])
        self.check(out['movingAverage'], [None, None, -.5, 2.5])

    def test_trix_emv_ma(self):
        import math
        out = r.calculate(bars([math.exp(i) for i in range(5)]), {'TRIX': {'period': 1, 'movingAveragePeriod': 2}})['TRIX']
        self.check(out['trix'], [None]+[10000]*4)
        self.check(out['movingAverage'], [None, None]+[10000]*3)
        emv = r.calculate(bars([10, 12, 11, 15]), {'EMV': {'period': 1, 'movingAveragePeriod': 2}})['EMV']
        self.check(emv['emv'], [None, 400, -200, 800])
        self.check(emv['movingAverage'], [None, None, 100, 300])

    def test_null_windows_restart_and_ma_first_valid(self):
        self.check(r.sma([1, 2, None, 4, 6], 2), [None, 1.5, None, None, 5])
        self.check(r.ema([1, 2, None, 4, 6, 8], 2), [None, 1.5, None, None, 5, 7])
        out = r.calculate(r.datasets()['mixed'])
        for name, first in [('TRIX', 10), ('EMV', 6), ('ROC', 6), ('MTM', 6)]:
            self.assertEqual(next(i for i, x in enumerate(out[name]['movingAverage']) if x is not None), first)

    def test_all_arrays_finite_or_null_and_nonvacuous(self):
        for profile in r.profiles().values():
            out = r.calculate(r.datasets()['mixed'], profile)
            for name, lines in out.items():
                for key, values in lines.items():
                    self.assertEqual(len(values), 96, (name, key))
                    self.assertTrue(any(r.finite(x) for x in values), (name, key))
            for data in r.datasets().values():
                for name, lines in r.calculate(data, profile).items():
                    for key, values in lines.items():
                        self.assertEqual(len(values), len(data))
                        self.assertTrue(all(x is None or r.finite(x) for x in values), (name, key))

    def test_squeeze_fixture_contains_all_three_states(self):
        for profile in r.profiles().values():
            states = {x for data in r.datasets().values()
                      for x in r.calculate(data, profile)['SMI']['squeeze'] if x is not None}
            self.assertEqual(states, {-1, 0, 1})

    def test_volume_scaling_invariance(self):
        import copy
        b = r.datasets()['mixed']
        scaled = copy.deepcopy(b)
        for x in scaled:
            x['volume'] *= 7
        a, z = r.calculate(b), r.calculate(scaled)
        for name in ['VWMA', 'VWAP', 'VR', 'NVI']:
            for key in a[name]:
                self.check(a[name][key], z[name][key])
        self.check([x*7 if x is not None else None for x in a['PVT']['pvt']], z['PVT']['pvt'])

    def test_frozen_hashes_include_inputs_parameters_and_all_outputs(self):
        import copy
        import json
        from pathlib import Path
        from generate import build, fingerprints
        data = build()
        frozen = json.loads((Path(__file__).parent/'fingerprints.json').read_text())['samples']
        self.assertEqual(fingerprints(data), frozen)
        changed = copy.deepcopy(data)
        changed['profiles']['compact']['variants']['mixed']['expected']['ROC']['movingAverage'][-1] += 1
        self.assertNotEqual(fingerprints(changed), frozen)
        changed = copy.deepcopy(data)
        changed['profiles']['compact']['parameters']['ROC']['movingAveragePeriod'] += 1
        self.assertNotEqual(fingerprints(changed), frozen)

    def test_causality_with_zero_volume_global_gate_exception(self):
        for profile in r.profiles().values():
            for label, data in r.datasets().items():
                complete = r.calculate(data, profile)
                for length in [2, 16, 55]:
                    if length >= len(data):
                        continue
                    prefix = r.calculate(data[:length], profile)
                    for name in complete:
                        # PVT/NVI deliberately gate all values on any positive volume.
                        if name in ['PVT', 'NVI'] and not any(b['volume'] is not None and b['volume'] > 0 for b in data[:length]):
                            continue
                        for key in complete[name]:
                            self.check(prefix[name][key], complete[name][key][:length])


if __name__ == '__main__':
    unittest.main()
