"""Independent Python arithmetic oracles. No product import, subprocess or network.

Compatibility equations: pinned SUB_CHART_INDICATORS.md, documented in README.
All parameters below are chosen test inputs, never product-default assertions.
"""
import copy
import math
import statistics

NEW = 'WMA VWMA SUPERTREND ENV VWAP DC KDJ SKDJ DMA VR BRAR PSY PVT ATR SMI TSI RVI QQE MASS KST BBP NVI PMO RCI SLOPE'.split()
LEGACY_MA = ['TRIX', 'EMV', 'ROC', 'MTM']
PARAMS = {
    'WMA': {'periods': [2, 3, 5]}, 'VWMA': {'periods': [2, 3, 5]},
    'SUPERTREND': {'atrPeriod': 3, 'multiplier': 1.5},
    'ENV': {'bandwidth': 2, 'lookback': 9, 'multiplier': 1.5},
    'VWAP': {'period': 5}, 'DC': {'period': 5},
    'KDJ': {'period': 5, 'kPeriod': 3, 'dPeriod': 2},
    'SKDJ': {'period': 5, 'smoothingPeriod': 2},
    'DMA': {'shortPeriod': 3, 'longPeriod': 7, 'movingAveragePeriod': 4},
    'VR': {'period': 5, 'movingAveragePeriod': 3}, 'BRAR': {'period': 5},
    'PSY': {'period': 5, 'movingAveragePeriod': 3},
    'PVT': {'zeroVolumeIsMissing': False}, 'ATR': {'period': 3},
    'SMI': {'bollingerPeriod': 5, 'bollingerMultiplier': 2,
            'keltnerPeriod': 5, 'keltnerMultiplier': 1.5, 'momentumPeriod': 5},
    'TSI': {'period': 5}, 'RVI': {'period': 3, 'signalPeriod': 3},
    'QQE': {'rsiPeriod': 3, 'smoothingPeriod': 2, 'fastFactor': 2, 'slowFactor': 4},
    'MASS': {'period': 5},
    'KST': {'rocPeriods': [2, 3, 4, 5], 'smoothingPeriods': [2, 2, 3, 3], 'signalPeriod': 3},
    'BBP': {'period': 5}, 'NVI': {'movingAveragePeriod': 7, 'zeroVolumeIsMissing': False},
    'PMO': {'firstPeriod': 5, 'secondPeriod': 3, 'signalPeriod': 3},
    'RCI': {'periods': [3, 5, 7]}, 'SLOPE': {'period': 5, 'lookback': 2},
    'TRIX': {'period': 3, 'movingAveragePeriod': 4},
    'EMV': {'period': 3, 'divisor': 10000, 'movingAveragePeriod': 4},
    'ROC': {'period': 3, 'movingAveragePeriod': 4},
    'MTM': {'period': 3, 'source': 'close', 'movingAveragePeriod': 4},
}


def parameters(overrides=None):
    result = copy.deepcopy(PARAMS)
    for name, values in (overrides or {}).items():
        result[name].update(values)
    return result


def profiles():
    alternate = {name: {key: (4 if value != 4 else 2)
                        for key, value in p.items()
                        if key.endswith('Period') or key == 'period'}
                 for name, p in PARAMS.items()}
    alternate.update({
        'WMA': {'periods': [1, 4, 8]}, 'VWMA': {'periods': [1, 4, 8]},
        'ENV': {'bandwidth': 1.5, 'lookback': 7, 'multiplier': 2},
        'SUPERTREND': {'atrPeriod': 4, 'multiplier': 2},
        'KDJ': {'period': 4, 'kPeriod': 2, 'dPeriod': 4},
        'DMA': {'shortPeriod': 2, 'longPeriod': 8, 'movingAveragePeriod': 2},
        'QQE': {'rsiPeriod': 4, 'smoothingPeriod': 3, 'fastFactor': 1.5, 'slowFactor': 3},
        'KST': {'rocPeriods': [1, 2, 3, 6], 'smoothingPeriods': [3, 2, 2, 4], 'signalPeriod': 2},
        'RCI': {'periods': [2, 4, 8]}, 'SLOPE': {'period': 4, 'lookback': 1},
        'PVT': {'zeroVolumeIsMissing': False},
        'NVI': {'movingAveragePeriod': 4, 'zeroVolumeIsMissing': False},
        'EMV': {'period': 4, 'divisor': 1000, 'movingAveragePeriod': 2},
        'MTM': {'period': 4, 'source': 'close', 'movingAveragePeriod': 2},
    })
    return {'compact': parameters(), 'alternate-perps': parameters(alternate)}


def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def apply(fn, *arrays):
    return [fn(*xs) if all(finite(x) for x in xs) else None for xs in zip(*arrays)]


def roll(xs, n, fn):
    return [fn(xs[i-n+1:i+1]) if i >= n-1 and
            all(finite(x) for x in xs[i-n+1:i+1]) else None for i in range(len(xs))]


def sma(xs, n):
    return roll(xs, n, lambda w: math.fsum(w)/n)


def smooth(xs, n, alpha):
    out, seed, state = [], [], None
    for x in xs:
        if not finite(x):
            seed, state = [], None
        elif state is None:
            seed.append(x)
            if len(seed) == n:
                state = math.fsum(seed)/n
        else:
            state = alpha*x + (1-alpha)*state
        out.append(state)
    return out


def ema(xs, n):
    return smooth(xs, n, 2/(n+1))


def lag(xs, n=1):
    return [xs[i-n] if i >= n else None for i in range(len(xs))]


def divide(a, b, scale=1):
    return apply(lambda x, y: scale*x/y if y != 0 else None, a, b)


def weighted(prices, volumes, n):
    return divide(roll(apply(lambda c, v: c*v, prices, volumes), n, math.fsum),
                  roll(volumes, n, math.fsum))


def stochastic(bars, n):
    hi, lo = (roll([b[k] for b in bars], n, fn) for k, fn in [('high', max), ('low', min)])
    result, previous = [], 50
    for b, h, l in zip(bars, hi, lo):
        if not all(finite(x) for x in [b['close'], h, l]):
            result.append(None)
            continue
        if h != l:
            previous = 100*(b['close']-l)/(h-l)
        result.append(previous)
    return result


def true_range(bars):
    return [max(b['high']-b['low'], abs(b['high']-bars[i-1]['close']),
                abs(b['low']-bars[i-1]['close']))
            if i and all(finite(x) for x in [b['high'], b['low'], bars[i-1]['close']])
            else None for i, b in enumerate(bars)]


def linreg(w):
    n = len(w)
    if n == 1:
        return w[0]
    center = (n-1)/2
    slope = math.fsum((i-center)*x for i, x in enumerate(w))/math.fsum((i-center)**2 for i in range(n))
    return statistics.mean(w) + slope*center


def correlation(w):
    if len(w) == 1 or max(w) == min(w):
        return None
    return statistics.correlation(range(len(w)), w)


def rank_index(w):
    n = len(w)
    if n == 1:
        return None
    # Average ranks for ties; the compatibility contract still uses d^2.
    ordered = sorted(w, reverse=True)
    ranks = {x: statistics.mean([i+1 for i, v in enumerate(ordered) if v == x]) for x in set(w)}
    distance = math.fsum((n-i-ranks[x])**2 for i, x in enumerate(w))
    return 100*(1-6*distance/(n*(n*n-1)))


def cumulative_volume(bars, average_period, zero_missing):
    pvt, nvi, average = [], [], []
    total, index, avg, prev = 0, 1000, None, None
    any_volume = any(finite(b['volume']) and b['volume'] > 0 for b in bars)
    for b in bars:
        c, v = b['close'], b['volume']
        if not any_volume or not finite(c) or not finite(v) or (zero_missing and v <= 0):
            pvt.append(None); nvi.append(None); average.append(None)
            continue
        valid_change = prev is None or prev['close'] != 0
        if prev and prev['close'] != 0:
            total += v*(c-prev['close'])/prev['close']
            if v < prev['volume']:
                index *= c/prev['close']
        avg = index if avg is None else avg + 2/(average_period+1)*(index-avg)
        pvt.append(total if valid_change else None)
        nvi.append(index); average.append(avg)
        prev = b
    return pvt, {'nvi': nvi, 'movingAverage': average}


def envelope(xs, bandwidth, lookback, multiplier):
    centers = []
    for i in range(len(xs)):
        w = xs[max(0, i-lookback+1):i+1][::-1]
        weights = [math.exp(-j*j/(2*bandwidth*bandwidth)) if bandwidth > 0 else int(j == 0)
                   for j in range(len(w))]
        centers.append(math.fsum(x*a for x, a in zip(w, weights))/math.fsum(weights)
                       if all(finite(x) for x in w) else None)
    errors = apply(lambda x, y: abs(x-y), xs, centers)
    upper, lower = [], []
    warmup = min(lookback, max(math.ceil(3*bandwidth), 2))
    for i, center in enumerate(centers):
        window = errors[max(0, i-max(lookback-1, 1)+1):i+1]
        width = multiplier*statistics.mean(window) if all(finite(x) for x in window) else None
        valid = i+1 >= warmup and finite(center) and finite(width)
        upper.append(center+width if valid else None)
        lower.append(center-width if valid else None)
    return {'upper': upper, 'lower': lower}


def supertrend(bars, n, multiplier):
    atr = smooth(true_range(bars), n, 1/n)
    up, down, upper, lower, rising = [], [], None, None, False
    for i, (b, a) in enumerate(zip(bars, atr)):
        if not all(finite(x) for x in [b['high'], b['low'], b['close'], a]):
            up.append(None); down.append(None)
            upper, lower = None, None
            continue
        top = (b['high']+b['low'])/2 + multiplier*a
        bottom = (b['high']+b['low'])/2 - multiplier*a
        prev = bars[i-1]['close'] if i else None
        if upper is None or lower is None or not finite(prev):
            rising = False
        else:
            top = top if top < upper or prev > upper else upper
            bottom = bottom if bottom > lower or prev < lower else lower
            rising = b['close'] >= bottom if rising else b['close'] > top
        upper, lower = top, bottom
        up.append(bottom if rising else None)
        down.append(None if rising else top)
    return {'upTrend': up, 'downTrend': down}


def rsi(xs, n):
    diff = apply(lambda x, y: x-y, xs, lag(xs))
    gain = smooth(apply(lambda x: max(x, 0), diff), n, 1/n)
    loss = smooth(apply(lambda x: max(-x, 0), diff), n, 1/n)
    return apply(lambda g, l: 100 if abs(l) <= 1e-10 else 0 if abs(g) <= 1e-10 else 100-100/(1+g/l), gain, loss)


def trailing(values, widths, factor):
    """QQE compatibility state: two previous band levels; retain over missing bars."""
    result, longs, shorts, rising = [], [0, 0], [0, 0], True
    for i, (x, width) in enumerate(zip(values, widths)):
        if not finite(x) or not finite(width):
            result.append(None)
            continue
        lo, hi = x-factor*width, x+factor*width
        prev = values[i-1] if i else None
        if finite(prev):
            if min(prev, x) > longs[0]:
                lo = max(longs[0], lo)
            if max(prev, x) < shorts[0]:
                hi = min(shorts[0], hi)
            def crosses(levels):
                return (x > levels[0] and prev <= levels[1]) or (x < levels[0] and prev >= levels[1])
            if crosses(shorts):
                rising = True
            elif crosses(longs):
                rising = False
        longs, shorts = [lo, longs[0]], [hi, shorts[0]]
        result.append(lo if rising else hi)
    return result


def calculate(bars, overrides=None):
    p = parameters(overrides)
    c, h, l, o, v = ([b[k] for b in bars] for k in ['close', 'high', 'low', 'open', 'volume'])
    result = {}
    result['WMA'] = {f'line:{i}': roll(c, n, lambda w: math.fsum((j+1)*x for j, x in enumerate(w))/(n*(n+1)/2)) for i, n in enumerate(p['WMA']['periods'])}
    result['VWMA'] = {f'line:{i}': weighted(c, v, n) for i, n in enumerate(p['VWMA']['periods'])}
    result['VWAP'] = {'vwap': weighted(apply(lambda a, b, x: (a+b+x)/3, h, l, c), v, p['VWAP']['period'])}
    upper, lower = roll(h, p['DC']['period'], max), roll(l, p['DC']['period'], min)
    result['DC'] = {'upper': upper, 'lower': lower, 'basis': apply(lambda a, b: (a+b)/2, upper, lower)}
    result['SUPERTREND'] = supertrend(bars, **{'n': p['SUPERTREND']['atrPeriod'], 'multiplier': p['SUPERTREND']['multiplier']})
    result['ENV'] = envelope(c, **p['ENV'])
    raw = stochastic(bars, p['KDJ']['period'])
    k, d, j, prev_k, prev_d = [], [], [], 50, 50
    for x in raw:
        if finite(x):
            prev_k += (x-prev_k)/p['KDJ']['kPeriod']
            prev_d += (prev_k-prev_d)/p['KDJ']['dPeriod']
        k.append(prev_k if finite(x) else None)
        d.append(prev_d if finite(x) else None)
        j.append(3*prev_k-2*prev_d if finite(x) else None)
    result['KDJ'] = {'k': k, 'd': d, 'j': j}
    n = p['SKDJ']['smoothingPeriod']
    k = ema(ema(stochastic(bars, p['SKDJ']['period']), n), n)
    result['SKDJ'] = {'k': k, 'd': sma(k, n)}
    dif = apply(lambda a, b: a-b, sma(c, p['DMA']['shortPeriod']), sma(c, p['DMA']['longPeriod']))
    result['DMA'] = {'dif': dif, 'movingAverage': sma(dif, p['DMA']['movingAveragePeriod'])}
    up = apply(lambda x, old, vol: vol if x > old else vol/2 if x == old else 0, c, lag(c), v)
    down = apply(lambda x, old, vol: vol if x < old else vol/2 if x == old else 0, c, lag(c), v)
    n = p['VR']['period']
    vr = divide(roll(up, n, math.fsum), roll(down, n, math.fsum), 100)
    result['VR'] = {'vr': vr, 'movingAverage': sma(vr, p['VR']['movingAveragePeriod'])}
    n = p['BRAR']['period']
    def distances(fn, previous=False):
        return [fn(b, bars[i-1]['close'] if i else None)
                if all(finite(x) for x in [b['high'], b['low'], b['open']]) and
                (not previous or (i and finite(bars[i-1]['close']))) else None
                for i, b in enumerate(bars)]
    def distance_ratio(a, b):
        return divide(roll(a, n, math.fsum), roll(b, n, math.fsum), 100)
    result['BRAR'] = {
        'ar': distance_ratio(distances(lambda b, _: b['high']-b['open']), distances(lambda b, _: b['open']-b['low'])),
        'br': distance_ratio(distances(lambda b, old: max(b['high']-old, 0), True), distances(lambda b, old: max(old-b['low'], 0), True)),
    }
    psy = roll(apply(lambda x, old: int(x > old), c, lag(c)), p['PSY']['period'], lambda w: 100*sum(w)/len(w))
    result['PSY'] = {'psy': psy, 'movingAverage': sma(psy, p['PSY']['movingAveragePeriod'])}
    result['PVT'] = {'pvt': cumulative_volume(bars, 1, p['PVT']['zeroVolumeIsMissing'])[0]}
    result['NVI'] = cumulative_volume(bars, p['NVI']['movingAveragePeriod'], p['NVI']['zeroVolumeIsMissing'])[1]
    tr = true_range(bars)
    result['ATR'] = {'atr': smooth(tr, p['ATR']['period'], 1/p['ATR']['period'])}
    q = p['SMI']
    mean = sma(c, q['keltnerPeriod'])
    extremes = apply(lambda a, b: (a+b)/2, roll(h, q['keltnerPeriod'], max), roll(l, q['keltnerPeriod'], min))
    momentum = roll(apply(lambda x, a, b: x-(a+b)/2, c, mean, extremes), q['momentumPeriod'], linreg)
    bb_mean = sma(c, q['bollingerPeriod'])
    bb_width = apply(lambda x: x*q['bollingerMultiplier'], roll(c, q['bollingerPeriod'], statistics.pstdev))
    kc_width = apply(lambda x: x*q['keltnerMultiplier'], sma(tr, q['keltnerPeriod']))
    def squeeze(b, bw, k, kw):
        gaps = (k+kw-b-bw, b-bw-k+kw)
        return 1 if min(gaps) > 0 else -1 if max(gaps) < 0 else 0
    result['SMI'] = {'momentum': momentum, 'squeeze': apply(squeeze, bb_mean, bb_width, mean, kc_width)}
    result['TSI'] = {'tsi': roll(c, p['TSI']['period'], correlation)}
    std = roll(c, p['RVI']['period'], statistics.pstdev)
    up = ema(apply(lambda x, old, s: s if x > old else 0, c, lag(c), std), 14)
    down = ema(apply(lambda x, old, s: s if x <= old else 0, c, lag(c), std), 14)
    rvi = divide(up, apply(lambda a, b: a+b, up, down), 100)
    result['RVI'] = {'rvi': rvi, 'signal': sma(rvi, p['RVI']['signalPeriod'])}
    q = p['QQE']
    values = ema(rsi(c, q['rsiPeriod']), q['smoothingPeriod'])
    widths = ema(ema(apply(lambda x, old: abs(x-old), values, lag(values)), 2*q['rsiPeriod']-1), 2*q['rsiPeriod']-1)
    result['QQE'] = {'rsi': values, 'fast': trailing(values, widths, q['fastFactor']), 'slow': trailing(values, widths, q['slowFactor'])}
    single = ema(apply(lambda a, b: a-b, h, l), 9)
    result['MASS'] = {'mass': roll(divide(single, ema(single, 9)), p['MASS']['period'], math.fsum)}
    def roc(n, source=c, scale=100):
        return apply(lambda x, old: scale*(x-old)/old if old != 0 else None, source, lag(source, n))
    components = [sma(roc(n), m) for n, m in zip(p['KST']['rocPeriods'], p['KST']['smoothingPeriods'])]
    kst = apply(lambda *xs: math.fsum((i+1)*x for i, x in enumerate(xs)), *components)
    result['KST'] = {'kst': kst, 'signal': sma(kst, p['KST']['signalPeriod'])}
    result['BBP'] = {'bbp': apply(lambda a, b, mean: a+b-2*mean, h, l, ema(c, p['BBP']['period']))}
    q = p['PMO']
    pmo = ema(apply(lambda x: 10*x, ema(roc(1), q['firstPeriod'])), q['secondPeriod'])
    result['PMO'] = {'pmo': pmo, 'signal': ema(pmo, q['signalPeriod'])}
    result['RCI'] = {key: roll(c, n, rank_index) for key, n in zip(['short', 'middle', 'long'], p['RCI']['periods'])}
    means = ema(c, p['SLOPE']['period'])
    result['SLOPE'] = {'slope': roc(p['SLOPE']['lookback'], means, 6392)}
    n = p['TRIX']['period']
    triple = ema(ema(ema([math.log(x) if finite(x) and x > 0 else None for x in c], n), n), n)
    trix = apply(lambda x, old: 10000*(x-old), triple, lag(triple))
    mid = apply(lambda a, b: (a+b)/2, h, l)
    raw_emv = apply(lambda x, old, a, b, vol: p['EMV']['divisor']*(x-old)*(a-b)/vol if vol != 0 else None, mid, lag(mid), h, l, v)
    emv = sma(raw_emv, p['EMV']['period'])
    source = [b[p['MTM']['source']] for b in bars]
    mtm = apply(lambda x, old: x-old if old != 0 else None, source, lag(source, p['MTM']['period']))
    for name, key, values in [('TRIX', 'trix', trix), ('EMV', 'emv', emv), ('ROC', 'roc', roc(p['ROC']['period'])), ('MTM', 'momentum', mtm)]:
        result[name] = {key: values, 'movingAverage': sma(values, p[name]['movingAveragePeriod'])}
    return result


def datasets():
    # Integer prices, deterministic oscillation/reversals/ties; UTC 2026-01-01 1m.
    mixed = []
    for i in range(96):
        close = 100 + (i*17 % 23)-11 + (i//8 % 3)*7
        mixed.append({'time': 1767225600+60*i, 'open': close+(-1 if i % 2 == 0 else 1),
                      'high': close+2+i % 3, 'low': close-2-i % 2,
                      'close': close, 'volume': 100+10*(i % 7)})
    result = {'mixed': mixed, 'short': copy.deepcopy(mixed[:2]), 'empty': []}
    for name in ['flat', 'zero-volume', 'missing-volume', 'missing-price', 'zero-close', 'ascending', 'descending', 'zero-volume-prefix', 'squeeze-release']:
        bars = copy.deepcopy(mixed)
        for i, b in enumerate(bars):
            if name == 'flat':
                b.update(open=100, high=100, low=100, close=100)
            elif name == 'zero-volume':
                b['volume'] = 0
            elif name == 'missing-volume' and i in [8, 9, 48]:
                b['volume'] = None
            elif name == 'missing-volume' and i in [32, 33]:
                b['volume'] = 0
            elif name == 'missing-price' and i in [35, 36, 37, 38]:
                b[{35: 'close', 36: 'high', 37: 'low', 38: 'open'}[i]] = None
            elif name == 'zero-close' and i == 40:
                b.update(open=0, high=0, low=0, close=0)
            elif name in ['ascending', 'descending']:
                c = 100+i if name == 'ascending' else 200-i
                b.update(open=c, high=c+2, low=c-2, close=c)
            elif name == 'squeeze-release':
                c = 100 + 3*max(0, min(i-12, 30))
                b.update(open=c, high=c+.25, low=c-.25, close=c)
            elif name == 'zero-volume-prefix' and i < 12:
                b['volume'] = 0
        result[name] = bars
    return result
