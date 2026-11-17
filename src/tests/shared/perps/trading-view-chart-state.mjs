export function tradingViewSymbolMatches(actual, canonicalCoin) {
  return typeof actual === 'string' && typeof canonicalCoin === 'string' &&
    canonicalCoin.length > 0 && actual.toUpperCase() === canonicalCoin.toUpperCase();
}
