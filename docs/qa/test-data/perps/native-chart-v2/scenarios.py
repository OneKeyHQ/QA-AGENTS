"""Independent Perps feed normalization, event snapshots and four-panel inputs.

The source feed contract rejects non-finite OHLCV/time and inverted ranges.
These functions do not import product code. A separate consumer checks the
actual pinned provider and hook normalization against these expected candles.
"""
import copy
import math
from reference import calculate, datasets, finite, parameters


def normalize_feed(bars):
    return sorted((copy.deepcopy(b) for b in bars
                   if all(finite(b[k]) for k in ['time', 'open', 'high', 'low', 'close', 'volume'])
                   and b['high'] >= b['low']), key=lambda b: b['time'])


def checkpoints(bars, expected):
    """Timestamp markers for initial warm-up, later missing runs and recoveries."""
    result = {}
    for name, lines in expected.items():
        result[name] = {}
        for key, values in lines.items():
            valid = [i for i, x in enumerate(values) if x is not None]
            result[name][key] = {
                'firstValidTime': bars[valid[0]]['time'] if valid else None,
                'missingTimes': [bars[i]['time'] for i in range(1, len(values))
                                 if values[i] is None and values[i-1] is not None],
                'recoveryTimes': [bars[i]['time'] for i in range(1, len(values))
                                  if values[i] is not None and values[i-1] is None and valid[0] < i],
            }
    return result


def feed_sample(raw_bars, params, event=None):
    raw = copy.deepcopy(raw_bars)
    bars = normalize_feed(raw)
    expected = calculate(bars, params)
    result = {'inputBars': raw, 'bars': bars,
              'droppedTimes': [b['time'] for b in raw if b['time'] not in {x['time'] for x in bars}],
              'expected': expected, 'checkpoints': checkpoints(bars, expected)}
    if event:
        result['event'] = event
    return result


def sequences(params):
    source = datasets()['mixed']
    current = copy.deepcopy(source[16:64])
    frames = [feed_sample(current, params, 'initial')]
    current[-1]['volume'] += 140
    frames.append(feed_sample(current, params, 'volume-only'))
    current[-1]['close'] += 2
    current[-1]['high'] = max(current[-1]['high'], current[-1]['close']+1)
    frames.append(feed_sample(current, params, 'price-only'))
    current.append(copy.deepcopy(source[64]))
    frames.append(feed_sample(current, params, 'append'))
    current = copy.deepcopy(source[:16]) + current
    frames.append(feed_sample(current, params, 'history-prepend'))
    frames.append(feed_sample(current, params, 'repeat-last'))
    recovery = [feed_sample(datasets()[name], params, event) for name, event in [
        ('mixed', 'full-valid'), ('missing-price', 'missing-ohlc'),
        ('mixed', 'restore-ohlc'), ('missing-volume', 'missing-volume'),
        ('mixed', 'restore-volume'),
    ]]
    for frame in recovery:
        frame['reloadHistory'] = True
    return {'realtime': frames, 'history-recovery': recovery}


def aggregate_minutes(bars, interval_seconds):
    """OHLCV over complete UTC buckets; never fill incomplete minute history."""
    if interval_seconds < 60 or interval_seconds % 60:
        raise ValueError('Period must be a positive whole number of minutes')
    groups = {}
    for bar in sorted(bars, key=lambda b: b['time']):
        bucket = bar['time']-bar['time'] % interval_seconds
        groups.setdefault(bucket, []).append(bar)
    result = []
    for bucket, group in sorted(groups.items()):
        if [b['time'] for b in group] != list(range(bucket, bucket+interval_seconds, 60)):
            continue
        result.append(dict(time=bucket, open=group[0]['open'],
                           high=max(b['high'] for b in group), low=min(b['low'] for b in group),
                           close=group[-1]['close'], volume=math.fsum(b['volume'] for b in group)))
    return result


def period_switch_samples(source_interval, target_interval, scale, volume_scale, params):
    """One market, one frozen history, source→target→source at a single clock."""
    cutoff = 1767225600+256*3600
    count = 256*(target_interval//60)
    start = cutoff-count*60
    minutes = []
    for i in range(count):
        close = 100+(i*17 % 23)-11+(i//8 % 3)*7
        minutes.append(dict(time=start+60*i,
                            open=(close+(-1 if i % 2 == 0 else 1))*scale,
                            high=(close+2+i % 3)*scale, low=(close-2-i % 2)*scale,
                            close=close*scale, volume=(100+10*(i % 7))*volume_scale))
    by_period = {n: aggregate_minutes(minutes, n)[-256:] for n in [source_interval, target_interval]}
    frames = []
    for event, before, after in [('interval-source', None, source_interval),
                                  ('interval-target', source_interval, target_interval),
                                  ('interval-return', target_interval, source_interval)]:
        frame = feed_sample(by_period[after], params, event)
        frame.update(intervalSeconds=after, fromIntervalSeconds=before,
                     measure=before is not None, parameters=copy.deepcopy(params))
        frames.append(frame)
    return {'clockTime': cutoff-1, 'requiresFreshSession': True,
            'historyRecipe': {'generator': 'mixed-minute-v1', 'from': start,
                              'untilExclusive': cutoff, 'minuteCount': count,
                              'priceScale': scale, 'volumeScale': volume_scale},
            'frames': frames}


def four_panel_workload(profile_params):
    # Chosen workload parameters, not product defaults or performance limits.
    source = []
    for i in range(257):
        close = 100+(i*17 % 23)-11+(i//8 % 3)*7
        source.append(dict(time=1767225600+60*i, open=close+(-1 if i % 2 == 0 else 1),
                           high=close+2+i % 3, low=close-2-i % 2,
                           close=close, volume=100+10*(i % 7)))
    definitions = [
        ('compact', 1, 60, ['ENV', 'WMA', 'VWAP', 'QQE', 'SMI', 'TRIX', 'EMV']),
        ('alternate-perps', 2, 300, ['ENV', 'VWMA', 'DC', 'QQE', 'RVI', 'ROC', 'MTM']),
        ('compact', .1, 900, ['ENV', 'SUPERTREND', 'WMA', 'QQE', 'KST', 'MASS', 'NVI']),
        ('alternate-perps', 10, 3600, ['ENV', 'VWAP', 'DC', 'QQE', 'SMI', 'RCI', 'SLOPE']),
    ]
    panels = []
    for i, (profile, scale, interval, enabled) in enumerate(definitions):
        original = copy.deepcopy(source)
        for b in original:
            for k in ['open', 'high', 'low', 'close']:
                b[k] *= scale
            b['volume'] *= i+1
            b['time'] = 1767225600+256*3600-(256-(b['time']-1767225600)//60)*interval
        params = parameters(profile_params[profile])
        params['ENV']['lookback'] = 64
        current = copy.deepcopy(original[:256])
        frames = [feed_sample(current, params, 'initial')]
        current[-1]['volume'] *= 3
        frames.append(feed_sample(current, params, 'volume-only'))
        changed = copy.deepcopy(params)
        changed['ENV']['multiplier'] += .5
        changed['QQE']['fastFactor'] += .5
        reconfigure = feed_sample(current, changed, 'parameter-change')
        reconfigure['parameters'] = changed
        frames.append(reconfigure)
        current.append(copy.deepcopy(original[256]))
        appended = feed_sample(current, changed, 'append')
        appended['parameters'] = changed
        frames.append(appended)
        panels.append({'panel': f'P{i+1}', 'market': f'QA-NATIVE-USD-{i+1}',
                       'intervalSeconds': interval, 'parameters': params,
                       'enabledIndicators': enabled, 'frames': frames,
                       'periodSwitch': period_switch_samples(
                           interval, [300, 900, 3600, 14400][i], scale, i+1, params)})
    return {'repeatRounds': 20, 'panels': panels,
            'periodSwitchTiming': {'cacheModes': ['cold', 'warm'], 'roundsPerDirection': 20,
                                   'coldClearDestinationBeforeSwitch': True,
                                   'warmPreloadBothIntervals': True, 'syncIntervals': False,
                                   'requiredObservations': 320,
                                   'start': 'period-control-click',
                                   'end': ['selected-period', 'target-candles-and-indicators',
                                           'loading-mask-gone', 'first-interaction-ready']},
            'measurement': 'UI measurements required; calculator comparison is not a performance pass'}
