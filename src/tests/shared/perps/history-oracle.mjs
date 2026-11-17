// Independent record identity and filter oracle. Uses full raw coin, never base
// display names for DEX perpetuals. Spot market aggregation requires metadata.
export const fillKey = (f) =>
  f.tid !== undefined && f.dir !== "Spot Dust Conversion"
    ? `tid:${f.tid}`
    : JSON.stringify([f.hash, f.oid, f.time, f.coin, f.side, f.px, f.sz]);
export const isSpotCoin = (coin) => coin.startsWith("@") || coin.includes("/");
// Absence and undefined both mean no market restriction. Preserve every
// concrete value and every other key so real restore mismatches still fail.
export function historyFilterIdentity(filters) {
  const { market, ...rest } = filters;
  return market === undefined ? rest : { ...rest, market };
}
export function historyIntersection(
  fills,
  { type = "all", side = "all", market },
  activeCoin,
  spotNames = {},
) {
  return fills.filter((f) => {
    const spot = isSpotCoin(f.coin);
    let marketMatch =
      market === undefined ||
      (market === "active" && f.coin === activeCoin) ||
      (market === f.coin && !spot);
    if (market?.startsWith("spot:") && spot) {
      const pair =
        spotNames[f.coin] ?? (f.coin.includes("/") ? f.coin : undefined);
      if (!pair) throw Error(`Missing spot pair metadata for ${f.coin}`);
      marketMatch = market === `spot:${pair.split("/")[0]}`;
    }
    return (
      (type === "all" || spot === (type === "spot")) &&
      (side === "all" || f.side === (side === "long" ? "B" : "A")) &&
      marketMatch
    );
  });
}
export function assertUniqueFillKeys(fills) {
  const keys = fills.map(fillKey);
  if (new Set(keys).size !== keys.length)
    throw Error("Duplicate trade identities");
  return keys;
}
