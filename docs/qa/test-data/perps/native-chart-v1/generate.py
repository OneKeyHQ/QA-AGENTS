"""Independent arithmetic fixture builder; never imports or calls OneKey code.

Default: verify frozen fingerprints without writing files.
Use --output <temporary-directory> to expand both JSON datasets locally.
Parameters are chosen test inputs, not assertions about product defaults.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).parent
PARAMS = {
    'MA': {'periods': [2, 3, 5]}, 'EMA': {'periods': [2, 3, 5]},
    'BOLL': {'period': 3, 'deviation': 2},
    'SAR': {'accelerationStart': .04, 'accelerationStep': .03, 'accelerationMax': .18},
    'VOL': {'movingAveragePeriod': 3, 'smoothingPeriod': 2},
    'MACD': {'fastPeriod': 2, 'slowPeriod': 5, 'signalPeriod': 3},
    'RSI': {'period': 3, 'movingAveragePeriod': 2},
    'StochRSI': {'rsiPeriod': 3, 'stochasticPeriod': 3, 'kPeriod': 2, 'dPeriod': 2},
    'OBV': {'movingAveragePeriod': 3}, 'MFI': {'period': 3},
    'TRIX': {'period': 3}, 'EMV': {'period': 3, 'divisor': 10000},
    'WR': {'period': 3}, 'ROC': {'period': 3}, 'MTM': {'period': 3, 'source': 'close'},
    'DMI': {'diPeriod': 3, 'adxSmoothingPeriod': 3},
    'CCI': {'period': 3, 'movingAveragePeriod': 2},
}


def rolling(values, period, fn):
    return [fn(values[i-period+1:i+1]) if i >= period-1 and
            all(v is not None for v in values[i-period+1:i+1]) else None
            for i in range(len(values))]


def sma(values, period):
    return rolling(values, period, lambda window: sum(window)/period)


def smooth(values, period, alpha):
    out, window, current = [], [], None
    for value in values:
        if value is None:
            current, window = None, []
        elif current is None:
            window.append(value)
            if len(window) == period:
                current = sum(window)/period
        else:
            current += alpha*(value-current)
        out.append(current)
    return out


def ema(values, period):
    return smooth(values, period, 2/(period+1))


def rma(values, period):
    return smooth(values, period, 1/period)


def pairwise(a, b, fn):
    return [fn(x, y) if x is not None and y is not None else None for x, y in zip(a, b)]


def ratio(positive, negative):
    return 100 if abs(negative) <= 1e-10 else 0 if abs(positive) <= 1e-10 else 100-100/(1+positive/negative)


def parabolic_sar(bars):
    out = [None]*len(bars)
    if len(bars) < 2:
        return out
    up = bars[1]['close'] >= bars[0]['close']
    out[1] = bars[0]['low' if up else 'high']
    extreme = (max if up else min)(b['high' if up else 'low'] for b in bars[:2])
    af = .04
    for i in range(2, len(bars)):
        candidate = out[i-1] + af*(extreme-out[i-1])
        if up:
            candidate = min(candidate, bars[i-1]['low'], bars[i-2]['low'])
            if bars[i]['low'] < candidate:
                up, candidate, extreme, af = False, extreme, bars[i]['low'], .04
            elif bars[i]['high'] > extreme:
                extreme, af = bars[i]['high'], min(af+.03, .18)
        else:
            candidate = max(candidate, bars[i-1]['high'], bars[i-2]['high'])
            if bars[i]['high'] > candidate:
                up, candidate, extreme, af = True, extreme, bars[i]['high'], .04
            elif bars[i]['low'] < extreme:
                extreme, af = bars[i]['low'], min(af+.03, .18)
        out[i] = candidate
    return out


def indicators(bars):
    c, h, low, v = ([b[key] for b in bars] for key in ('close', 'high', 'low', 'volume'))
    size = len(c)
    tp = [(x+y+z)/3 for x, y, z in zip(h, low, c)]
    middle = sma(c, 3)
    deviation = rolling(c, 3, lambda w: 2*math.sqrt(sum((x-sum(w)/3)**2 for x in w)/3))
    dif = pairwise(ema(c, 2), ema(c, 5), lambda x, y: x-y)
    signal = ema(dif, 3)
    change = [None]+[c[i]-c[i-1] for i in range(1, size)]
    gains = rma([None if x is None else max(x, 0) for x in change], 3)
    losses = rma([None if x is None else max(-x, 0) for x in change], 3)
    rsi = pairwise(gains, losses, ratio)
    raw, previous = [], None
    for i, value in enumerate(rsi):
        window = rsi[max(0, i-2):i+1]
        if len(window) != 3 or any(x is None for x in window):
            raw.append(None)
        else:
            if max(window) != min(window):
                previous = 100*(value-min(window))/(max(window)-min(window))
            raw.append(previous)
    k = sma(raw, 2)
    obv = [0]
    for i in range(1, size):
        obv.append(obv[-1]+(v[i] if c[i] > c[i-1] else -v[i] if c[i] < c[i-1] else 0))
    positive = [None]+[tp[i]*v[i] if tp[i] > tp[i-1] else 0 for i in range(1, size)]
    negative = [None]+[tp[i]*v[i] if tp[i] < tp[i-1] else 0 for i in range(1, size)]
    triple = ema(ema(ema([math.log(x) for x in c], 3), 3), 3)
    trix = [None]+[None if triple[i] is None or triple[i-1] is None else
                         10000*(triple[i]-triple[i-1]) for i in range(1, size)]
    eom = [None]+[None if v[i] == 0 else 10000*((h[i]+low[i]-h[i-1]-low[i-1])/2)*
                  (h[i]-low[i])/v[i] for i in range(1, size)]
    wr = [None if i < 2 else 100*(c[i]-max(h[i-2:i+1]))/
          (max(h[i-2:i+1])-min(low[i-2:i+1])) for i in range(size)]
    tr, plus, minus = [None], [None], [None]
    for i in range(1, size):
        rise, fall = h[i]-h[i-1], low[i-1]-low[i]
        plus.append(rise if rise > fall and rise > 0 else 0)
        minus.append(fall if fall > rise and fall > 0 else 0)
        tr.append(max(h[i]-low[i], abs(h[i]-c[i-1]), abs(low[i]-c[i-1])))
    atr = rma(tr, 3)
    pdi = pairwise(rma(plus, 3), atr, lambda x, y: 100*x/y)
    mdi = pairwise(rma(minus, 3), atr, lambda x, y: 100*x/y)
    dx = pairwise(pdi, mdi, lambda x, y: 100*abs(x-y)/(x+y) if x+y else 0)
    adx = rma(dx, 3)
    adxr = [None if i < 2 or adx[i] is None or adx[i-2] is None else
            (adx[i]+adx[i-2])/2 for i in range(size)]
    cci = rolling(tp, 3, lambda w: (w[-1]-sum(w)/3)/
                  (.015*sum(abs(x-sum(w)/3) for x in w)/3)
                  if any(x != w[0] for x in w) else None)
    return {
        'MA': {f'line{i+1}': sma(c, n) for i, n in enumerate((2, 3, 5))},
        'EMA': {f'line{i+1}': ema(c, n) for i, n in enumerate((2, 3, 5))},
        'BOLL': {'middle': middle, 'upper': pairwise(middle, deviation, lambda x,y:x+y),
                 'lower': pairwise(middle, deviation, lambda x,y:x-y)},
        'SAR': {'sar': parabolic_sar(bars)},
        'VOL': {'volume': v, 'movingAverage': sma(v, 3), 'smoothedMovingAverage': sma(sma(v, 3), 2)},
        'MACD': {'macd': dif, 'signal': signal, 'histogram': pairwise(dif, signal, lambda x,y:x-y)},
        'RSI': {'rsi': rsi, 'movingAverage': sma(rsi, 2)},
        'StochRSI': {'k': k, 'd': sma(k, 2)},
        'OBV': {'obv': obv, 'movingAverage': sma(obv, 3)},
        'MFI': {'mfi': pairwise(rolling(positive, 3, sum), rolling(negative, 3, sum), ratio)},
        'TRIX': {'trix': trix}, 'EMV': {'emv': sma(eom, 3)}, 'WR': {'wr': wr},
        'ROC': {'roc': [None if i < 3 else 100*(c[i]-c[i-3])/c[i-3] for i in range(size)]},
        'MTM': {'momentum': [None if i < 3 else c[i]-c[i-3] for i in range(size)]},
        'DMI': {'plusDi': pdi, 'minusDi': mdi, 'dx': dx, 'adx': adx, 'adxr': adxr},
        'CCI': {'cci': cci, 'movingAverage': sma(cci, 2)},
    }


def build():
    closes = [100,102,101,105,103,108,107,110,106,111,109,114,112,115,113,117,116,120,118,122]
    start = int(datetime(2026,1,1,tzinfo=timezone.utc).timestamp())
    bars = [{'time_utc': datetime.fromtimestamp(start+i*60, timezone.utc).isoformat(),
             'open': c+(-1 if i%2 == 0 else 1), 'high': c+2+i%3,
             'low': c-2-i%2, 'close': c, 'volume': 100+10*(i%7)} for i,c in enumerate(closes)]
    variants = {'mixed': bars, 'short': bars[:2],
                'zero-volume': [dict(b, volume=0) for b in bars]}
    return {'version': 1, 'market': 'QA-NATIVE-USD', 'interval': '1m', 'timezone': 'UTC',
            'purpose': 'Synthetic isolated test feed; never a trading market or a defaults specification.',
            'parameters': PARAMS, 'variants': {name: {'bars': bs, 'expected': indicators(bs)}
                                            for name, bs in variants.items()},
            'comparison': {'raw_abs_tolerance': 1e-8, 'raw_relative_tolerance': 1e-8,
                           'ui': 'round the independent expected value to the precision shown by that UI; null is a missing placeholder, never zero'}}


def self_check(data):
    expected = data['variants']['mixed']['expected']
    assert sma([100,102,101],3) == [None,None,101]
    assert ema([100,102,101,105],3) == [None,None,101,103]
    assert abs(expected['BOLL']['upper'][2]-(101+2*math.sqrt(2/3))) < 1e-12
    assert expected['OBV']['obv'][:3] == [0,110,-10]
    assert expected['ROC']['roc'][3] == 5 and expected['MTM']['momentum'][3] == 5
    assert abs(expected['RSI']['rsi'][3] - 100*6/7) < 1e-12
    assert all(x == 0 for x in data['variants']['zero-volume']['expected']['VOL']['volume'])
    assert all(x is None for x in data['variants']['zero-volume']['expected']['EMV']['emv'])
    for variant in data['variants'].values():
        assert len(variant['expected']) == 17
        assert all(len(series) == len(variant['bars']) for outputs in variant['expected'].values()
                   for series in outputs.values())
    json.dumps(data, allow_nan=False)


def build_drawings():
    data = json.loads((BASE/'drawings.json').read_text())
    defaults, tools = data.pop('tool_defaults'), data.pop('tools')
    anchors = [a['name'] for a in data['anchors']]
    data['tool_oracles'] = [
        {**defaults, **tool,
         'anchors': tool.get('anchors', anchors[:tool['input_anchor_count']])}
        for tool in tools
    ]
    return data


def fingerprint(value):
    # Ignore binary floating-point tail differences across Python platforms;
    # 12 significant digits remain stricter than the documented 1e-8 tolerance.
    def stable(v):
        if isinstance(v, float):
            return float(format(v, '.12g'))
        if isinstance(v, list):
            return [stable(x) for x in v]
        if isinstance(v, dict):
            return {k: stable(x) for k, x in v.items()}
        return v
    text = json.dumps(stable(value), ensure_ascii=False, sort_keys=True, allow_nan=False)
    return hashlib.sha256(text.encode()).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='verify only (default)')
    mode.add_argument('--output', type=Path, help='write expanded data outside this source directory')
    args = parser.parse_args()
    if args.output and (args.output.resolve() == BASE.resolve() or
                        BASE.resolve() in args.output.resolve().parents):
        parser.error('Output must be outside the compact fixture source directory')
    data = build()
    self_check(data)
    datasets = {'indicators.json': data, 'drawings.json': build_drawings()}
    frozen = json.loads((BASE/'fingerprints.json').read_text())
    for name, value in datasets.items():
        if fingerprint(value) != frozen[name]:
            parser.error(f'{name} differs from frozen values; review expectations before updating fingerprints')
    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)
        for name, value in datasets.items():
            (args.output/name).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    print('17 indicators × 3 variants and 90 drawing tools match frozen values')
