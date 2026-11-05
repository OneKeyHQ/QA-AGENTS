// Execute the pinned formatter. Locale plumbing is deterministic; numeric
// precision, grouping, currency and compact-number logic remain production code.
import { evaluateSource } from "./source.mjs";
export function numberUtils(locale = "en-US") {
  const intl = {
    locale,
    formatNumber: (n, o) => new Intl.NumberFormat(locale, o).format(n),
  };
  return evaluateSource("packages/shared/src/utils/numberUtils.ts", {
    mocks: {
      "@onekeyhq/shared/src/utils/assertUtils": {
        check: (v, m) => {
          if (!v) throw Error(m);
        },
      },
      "@onekeyhq/shared/src/utils/cacheUtils": { memoizee: (fn) => fn },
      "../locale/appLocale": {
        appLocale: { intl, onLocaleChange: () => {} },
        fallbackAppLocaleIntl: intl,
      },
      "../platformEnv": { isNative: false, isDev: false, isJest: true },
      "./hexUtils": {
        default: { addHexPrefix: (s) => (s.startsWith("0x") ? s : `0x${s}`) },
      },
    },
  });
}
