// Independent expected-set oracle; query normalization belongs to the caller.
export function aliasMatches(coin, query, config) {
  const normalized = query.toLowerCase();
  const prefixOnly = /^[a-z0-9]{1,2}$/.test(normalized);
  return (config.tokenSearchAliases[coin]?.aliases ?? []).some((alias) => {
    const value = alias.toLowerCase();
    return prefixOnly
      ? value.startsWith(normalized)
      : value.includes(normalized);
  });
}
