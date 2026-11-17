import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export function parseUnifoldReference(text) {
  const contract = text.match(/Arbitrum USDC 合约\s+`(0x[\da-f]{40})`/iu)?.[1];
  const minimums = text.match(
    /USDC 最低存款：Ethereum \$(\d+)，Base \/ Arbitrum \/ Polygon \/ Optimism \/ BSC \$(\d+)/u,
  );
  assert.ok(
    contract && minimums,
    "Accepted manual reference data required; do not invent a fallback",
  );
  return {
    contract,
    minimums: { Ethereum: minimums[1], Arbitrum: minimums[2] },
  };
}
export const unifoldReference = parseUnifoldReference(
  readFileSync(
    new URL(
      "../../../../docs/qa/testcases/cases/perps/2026-08-03_Perps-Unifold充值.md",
      import.meta.url,
    ),
    "utf8",
  ),
);

export function minimumDisclosure(amount) {
  assert.match(String(amount), /^\d+(?:\.\d+)?$/u);
  return `所选网络的最低充值金额为 $${amount}。低于该金额的充值将暂不兑换，后续累计充值达到最低要求后，将自动完成兑换。`;
}
export function assertMinimumDisclosure({ trigger, tooltip }, amount) {
  assert.equal(trigger.trim(), `最低 $${amount}`);
  // The tooltip title is separate from its body. A short label or a second
  // occurrence of the dollar amount cannot replace the full disclosure.
  assert.equal(tooltip.trim(), minimumDisclosure(amount));
}
export function assertContractDisclosure(
  { warning, network, shown, copied, deposit },
  reference = unifoldReference.contract,
) {
  assert.equal(
    warning.trim(),
    "代币合约地址并非你的存款地址，向该地址转账可能导致资产损失。请确认当前信息与你要存入的 USDC 一致。",
  );
  assert.equal(network.trim(), "Arbitrum");
  assert.match(
    shown,
    /^0x[\da-f]{40}$/iu,
    "Full contract, not a truncated address",
  );
  assert.match(
    deposit,
    /^0x[\da-f]{40}$/iu,
    "A ready EVM deposit address is required",
  );
  assert.equal(
    shown.toLowerCase(),
    reference.toLowerCase(),
    "Contract vs accepted manual chain reference",
  );
  assert.equal(
    copied,
    shown,
    "Actual clipboard equals the complete displayed contract",
  );
  assert.notEqual(
    deposit.toLowerCase(),
    shown.toLowerCase(),
    "Token contract is not the deposit destination",
  );
}
export function projectUnifoldSelection(start) {
  for (let f = start; f; f = f.return) {
    const p = f.memoizedProps;
    if (
      p?.selection?.asset &&
      p.selection.chain &&
      Array.isArray(p.assets) &&
      typeof p.onSelectChain === "function"
    ) {
      const { asset, chain } = p.selection;
      return {
        symbol: asset.symbol,
        catalog: p.assets
          .filter((a) => Array.isArray(a.chains) && a.chains.length > 0)
          .map((a) => ({ symbol: a.symbol, networkCount: a.chains.length })),
        chain: {
          id: chain.chain_id,
          type: chain.chain_type,
          name: chain.chain_name,
          contract: chain.token_address,
          icon: chain.icon_url,
          minimum: chain.minimum_deposit_amount_usd,
        },
        supported: asset.chains.map((c) => ({
          id: c.chain_id,
          type: c.chain_type,
          name: c.chain_name,
        })),
      };
    }
  }
  throw Error("Committed selected Unifold asset and network required");
}
export function assertUnifoldSelection(state, symbol, network) {
  assert.equal(state.symbol, symbol);
  assert.equal(state.chain.name, network);
  const matches = state.supported.filter(
    (c) =>
      c.id === state.chain.id &&
      c.type === state.chain.type &&
      c.name === network,
  );
  assert.equal(
    matches.length,
    1,
    "Selected network must belong uniquely to the selected token",
  );
  if (symbol === "USDC") {
    assert.ok(Object.hasOwn(unifoldReference.minimums, network));
    assert.equal(
      String(state.chain.minimum),
      unifoldReference.minimums[network],
    );
    assert.equal(state.chain.type, "ethereum");
    assert.equal(
      String(state.chain.id),
      network === "Arbitrum" ? "42161" : "1",
    );
    assert.match(state.chain.contract, /^0x[\da-f]{40}$/iu);
    if (network === "Arbitrum")
      assert.equal(
        state.chain.contract.toLowerCase(),
        unifoldReference.contract.toLowerCase(),
      );
  }
}

// Expected rows come from committed raw catalog inputs, never from the UI being checked.
export function assertUnifoldCatalogRows(catalog, rows) {
  assert.ok(catalog.length > 0, "Usable supported-asset catalog required");
  assert.equal(
    new Set(catalog.map((a) => a.symbol)).size,
    catalog.length,
    "Unique raw token identities",
  );
  assert.equal(
    rows.length,
    catalog.length,
    "No missing or extra rendered token",
  );
  for (const asset of catalog) {
    assert.ok(Number.isInteger(asset.networkCount) && asset.networkCount > 0);
    const matches = rows.filter((r) => r.symbol === asset.symbol);
    assert.equal(matches.length, 1, `Unique token row ${asset.symbol}`);
    assert.deepEqual(
      matches[0].lines,
      [
        asset.symbol,
        `${asset.networkCount} ${asset.networkCount === 1 ? "网络" : "个网络"}`,
      ],
      "Exact token name and independent network count",
    );
  }
}

// Each item must be read from its own visible two-cell row. A 0.25% maximum
// slippage elsewhere in the dialog cannot satisfy the third-party fee.
export const unifoldDetailLabels = [
  "第三方兑换手续费",
  "处理时间",
  "最大滑点",
  "价格影响",
];
export function assertUnifoldDetailFields(rows) {
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((r) => r.label),
    unifoldDetailLabels,
  );
  for (const row of rows)
    assert.ok(typeof row.value === "string" && row.value.trim());
  assert.equal(rows[0].value, "0.25%");
  assert.match(rows[1].value, /^(?:< )?\d+(?:\.\d+)? (?:秒|分钟|小时|天)$/u);
  assert.match(rows[2].value, /^自动 • \d+\.\d{2}%$/u);
  assert.match(rows[3].value, /^-?\d+\.\d{2}%$/u);
}

export function assertUnifoldNetworkMinimum(text, network, minimum) {
  assert.deepEqual(
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    [network, `最低存款 $${minimum}`],
  );
}

// Read only the actual menu source hook's public catalog, never private wallet
// state. An ambiguous/stale hook shape is an evidence failure, not a fallback.
export function projectUnifoldHintCatalog(start) {
  for (let f = start; f; f = f.return) {
    if ((f.type?.displayName || f.type?.name) !== "TransferChainHintLogos")
      continue;
    const catalogs = new Map();
    for (let h = f.memoizedState, n = 0; h && n < 100; h = h.next, n++) {
      const v = h.memoizedState;
      if (
        Array.isArray(v) &&
        v.length &&
        v.every(
          (a) => a && typeof a.symbol === "string" && Array.isArray(a.chains),
        )
      ) {
        const catalog = v.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          chains: a.chains.map((c) => ({
            type: c.chain_type,
            name: c.chain_name,
            icon: c.icon_url,
          })),
        }));
        catalogs.set(JSON.stringify(catalog), catalog);
      }
    }
    if (catalogs.size !== 1)
      throw Error("Exactly one current source-chain catalog required");
    return [...catalogs.values()][0];
  }
  throw Error("Actual TransferChainHintLogos owner required");
}
export function expectedUnifoldHintLogos(catalog) {
  assert.ok(
    Array.isArray(catalog) && catalog.length > 0,
    "Nonempty raw supported-assets catalog required",
  );
  const bitcoin = [],
    other = [];
  for (const asset of catalog) {
    assert.ok(Array.isArray(asset.chains));
    for (const chain of asset.chains) {
      const words = [asset.symbol, asset.name, chain.type, chain.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      (words.includes("bitcoin") || words.split(/[^a-z0-9]+/u).includes("btc")
        ? bitcoin
        : other
      ).push(chain.icon);
    }
  }
  const unique = [...new Set([...bitcoin, ...other].filter(Boolean))];
  return {
    visible: unique.slice(0, 4),
    remaining: Math.max(0, unique.length - 4),
  };
}
export function assertUnifoldHintLogos(catalog, actual, suffixes) {
  const expected = expectedUnifoldHintLogos(catalog);
  assert.deepEqual(
    actual,
    expected.visible,
    "Exact Bitcoin-first source-network icons from independent raw catalog",
  );
  assert.deepEqual(
    suffixes,
    expected.remaining ? ["+" + expected.remaining] : [],
    "Exact +N after URI deduplication, not total token/chain count",
  );
  return expected;
}
