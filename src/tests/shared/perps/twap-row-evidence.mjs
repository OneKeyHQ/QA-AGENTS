// Independent Desktop cell expectations. No product formatter/calculator.
import assert from "node:assert/strict";
import { twapSchemas, twapRecordKey } from "./twap-list-evidence.mjs";
const places = 30,
  scale = 10n ** BigInt(places);
function decimal(raw) {
  assert.match(
    String(raw),
    /^-?\d+(?:\.\d{1,30})?$/u,
    "Plain finite field decimal required",
  );
  const negative = String(raw).startsWith("-");
  const [a, b = ""] = String(raw).replace(/^-/, "").split(".");
  return BigInt(a + b.padEnd(places, "0")) * (negative ? -1n : 1n);
}
function text(n, digits = places, keep = false, grouping = false) {
  assert.ok(Number.isInteger(digits) && digits >= 0 && digits <= places);
  const negative = n < 0n,
    raw = negative ? -n : n,
    step = 10n ** BigInt(places - digits);
  const rounded = (raw + step / 2n) / step;
  const unit = 10n ** BigInt(digits);
  let a = String(rounded / unit),
    b = digits ? String(rounded % unit).padStart(digits, "0") : "";
  if (!keep) b = b.replace(/0+$/u, "");
  if (grouping) a = a.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return (negative && rounded ? "-" : "") + a + (b ? "." + b : "");
}
function balance(n, currency = "") {
  if (n === 0n) return currency + "0";
  const abs = n < 0n ? -n : n;
  for (const [limit, suffix] of [
    [10n ** 15n, "Q"],
    [10n ** 12n, "T"],
    [10n ** 9n, "B"],
  ])
    if (abs >= limit * scale)
      return currency + text(n / limit, 4, false, true) + suffix;
  const raw = text(abs),
    fraction = raw.split(".")[1] ?? "";
  const zeros = abs < scale ? (fraction.match(/^0*/u)?.[0].length ?? 0) : 0;
  const out = text(n, Math.min(places, 4 + zeros), false, true);
  return out.startsWith("-") ? "-" + currency + out.slice(1) : currency + out;
}
function value(n) {
  const abs = n < 0n ? -n : n;
  if (abs > 0n && abs < scale / 100n) return (n < 0n ? "-" : "") + "< $0.01";
  return (n < 0n ? "-" : "") + "$" + text(abs, 2, true, true);
}
function price(n, spot) {
  if (n <= 0n) return text(n);
  const raw = text(n),
    [integer, fraction = ""] = raw.split(".");
  if (!fraction) return integer;
  const significant = (
    integer === "0" ? fraction.replace(/^0+/u, "") : integer + fraction
  ).length;
  let digits = Math.min(fraction.length, spot ? 8 : 6);
  if (significant > 5) {
    const integerDigits = integer === "0" ? 0 : integer.length;
    const leadingZeros =
      spot && integer === "0" ? (fraction.match(/^0*/u)?.[0].length ?? 0) : 0;
    digits = Math.min(digits, Math.max(0, 5 - integerDigits + leadingZeros));
  }
  // Spot precision comes from a truncated valid-price grid, before the
  // independent display round. Rounding here first would erase significant
  // display zeros (80.2399… -> grid 80.239 -> display 80.240).
  if (spot) {
    const step = 10n ** BigInt(places - digits);
    digits = text((n / step) * step, digits).split(".")[1]?.length ?? 0;
  }
  return text(n, digits, true);
}
export const twapStatusLabels = {
  zh: {
    waitingForTrigger: "等待触发",
    activated: "活跃中",
    finished: "已完成",
    terminated: "已终止",
    stopped: "已停止",
    error: "异常",
  },
  en: {
    waitingForTrigger: "Waiting for Trigger",
    activated: "Activated",
    finished: "Finished",
    terminated: "Terminated",
    stopped: "Stopped",
    error: "Error",
  },
};
export function twapRowLocale(tabs) {
  if (tabs.find((t) => t.key === "active")?.label === "当前委托") return "zh";
  if (tabs.find((t) => t.key === "active")?.label === "Active") return "en";
  throw Error(
    "TWAP field oracle requires an explicitly supported Chinese/English locale",
  );
}
function duration(minutes, locale) {
  const units = locale === "zh" ? ["小时", "分钟"] : ["hour", "minutes"];
  return minutes < 60
    ? `${minutes} ${units[1]}`
    : `${Math.floor(minutes / 60)} ${units[0]}` +
        (minutes % 60 ? ` ${minutes % 60} ${units[1]}` : "");
}
function dateTime(timestamp, locale, timeZone) {
  assert.ok(Number.isFinite(timestamp), "Actual timestamp required");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    date:
      locale === "zh"
        ? `${p.year}/${p.month}/${p.day}`
        : `${p.month}/${p.day}/${p.year}`,
    time: `${p.hour}:${p.minute}:${p.second}`,
  };
}
const ms = (v) => (v > 1_000_000_000_000 ? v : v * 1000);
const tokenAliases = {
  UBTC: "BTC",
  UETH: "ETH",
  USOL: "SOL",
  UFART: "FARTCOIN",
  UBONK: "BONK",
  UPUMP: "PUMP",
  UENA: "ENA",
  UXPL: "XPL",
  UZEC: "ZEC",
  UMON: "MON",
  UUUSPX: "SPX",
  UDOGE: "DOGE",
  UMOG: "MOG",
  UWLD: "WLD",
  UMEGA: "MEGA",
  UVIRT: "VIRTUAL",
  USPYX: "SPYX",
  UDZ: "DZ",
  LINK0: "LINK",
  AAVE0: "AAVE",
  AVAX0: "AVAX",
  BNB0: "BNB",
  CFX0: "CFX",
  PEPE0: "PEPE",
  TRX0: "TRX",
  USDT0: "USDT",
  XAUT0: "XAUT",
  HPENGU: "PENGU",
  HPEPE: "PEPE",
  FXRP: "XRP",
  XMR1: "XMR",
  HBNB: "BNB",
  HSEI: "SEI",
};
const token = (s) => tokenAliases[s] ?? s;
function symbols(coin, context) {
  if (!coin.startsWith("@") && !coin.includes("/"))
    return { asset: coin.split(":").at(-1), size: coin.split(":").at(-1) };
  const raw = coin.includes("/") ? coin : context.spotDisplayMap?.[coin];
  assert.ok(raw, `Independent spot display metadata required for ${coin}`);
  return {
    asset:
      context.spotPairDisplayNameMap?.[coin] ??
      raw.split("/").map(token).join("/"),
    size: token(raw.split("/")[0]),
  };
}
export function expectedTwapCells(tab, record, context) {
  const { locale = "zh", timeZone = "Asia/Shanghai" } = context;
  assert.ok(["zh", "en"].includes(locale));
  const yes = locale === "zh" ? "是" : "Yes",
    no = locale === "zh" ? "否" : "No";
  const s = record.state ?? record.fill,
    spot = s.coin.startsWith("@") || s.coin.includes("/");
  const symbol = symbols(s.coin, context);
  let fields,
    colors = {};
  if (tab === "fills") {
    const n = (decimal(s.px) * decimal(s.sz)) / scale;
    const usdc = !s.feeToken || s.feeToken.toUpperCase() === "USDC";
    const pnl = decimal(s.closedPnl) - (usdc ? decimal(s.fee) : 0n);
    const directions =
      locale === "zh"
        ? {
            "open long": "做多",
            "open short": "做空",
            "close long": "平多",
            "close short": "平空",
            "long > short": "多转空",
            "short > long": "空转多",
            settlement: "结算",
          }
        : {
            "open long": "Long",
            "open short": "Short",
            "close long": "Close Long",
            "close short": "Close Short",
            "long > short": "Long > Short",
            "short > long": "Short > Long",
            settlement: "Settlement",
          };
    const direction = spot
      ? locale === "zh"
        ? s.side === "B"
          ? "购买"
          : "出售"
        : s.side === "B"
          ? "Buy"
          : "Sell"
      : (directions[s.dir?.trim().toLowerCase()] ?? s.dir ?? "");
    const date = dateTime(s.time, locale, timeZone);
    fields = [
      date.date + date.time,
      symbol.asset,
      direction,
      price(decimal(s.px), spot),
      balance(decimal(s.sz)),
      balance(n, "$"),
      usdc
        ? balance(decimal(s.fee), "$")
        : `${balance(decimal(s.fee))} ${token(s.feeToken)}`,
      value(pnl),
    ];
    colors = {
      direction: s.side === "B" ? "$green11" : "$red11",
      closePnl: pnl < 0n ? "$red11" : "$green11",
    };
  } else {
    const status = tab === "history" ? record.status.status : context.status;
    assert.ok(
      Object.hasOwn(twapStatusLabels[locale], status),
      `Known status required: ${status}`,
    );
    const inactive = ["activated", "waitingForTrigger"].includes(status);
    const average =
      decimal(s.executedSz) > 0n
        ? price((decimal(s.executedNtl) * scale) / decimal(s.executedSz), spot)
            .split(".")
            .map((v, i) =>
              i === 0 ? v.replace(/\B(?=(\d{3})+(?!\d))/gu, ",") : v,
            )
            .join(".")
        : "--";
    const trigger =
      s.trigger?.px && decimal(s.trigger.px) > 0n
        ? text(decimal(s.trigger.px), places, false, true)
        : "--";
    const stop =
      s.stopPx && decimal(s.stopPx) > 0n
        ? text(decimal(s.stopPx), places, false, true)
        : "--";
    const total = `${balance(decimal(s.sz))} ${symbol.size}`,
      executed = `${balance(decimal(s.executedSz))} ${symbol.size}`;
    const side = s.side === "B" ? "$green11" : "$red11";
    if (tab === "active") {
      let running = "--";
      if (
        status !== "waitingForTrigger" &&
        (!s.trigger?.px || context.activatedAt !== undefined)
      ) {
        const elapsed = Math.floor(
          Math.min(
            Math.max(context.now - (context.activatedAt ?? s.timestamp), 0),
            s.minutes * 60000,
          ) / 1000,
        );
        running =
          [
            Math.floor(elapsed / 3600),
            Math.floor((elapsed % 3600) / 60),
            elapsed % 60,
          ]
            .map((n) => String(n).padStart(2, "0"))
            .join(":") +
          " / " +
          duration(s.minutes, locale);
      }
      const date = dateTime(s.timestamp, locale, timeZone);
      fields = [
        symbol.asset,
        total,
        executed,
        average,
        trigger,
        stop,
        running,
        twapStatusLabels[locale][status],
        s.reduceOnly ? yes : no,
        s.randomize ? yes : no,
        date.date + " " + date.time,
        locale === "zh" ? "终止" : "Terminate",
      ];
      colors = {
        coin: side,
        size: side,
        executedSize: side,
        terminate: "$bgCriticalStrong",
      };
    } else {
      const date = dateTime(
        record.time ? ms(record.time) : s.timestamp,
        locale,
        timeZone,
      );
      const statusText =
        twapStatusLabels[locale][status] +
        (status === "error" && record.status.description
          ? `: ${record.status.description}`
          : "");
      fields = [
        date.date + date.time,
        symbol.asset,
        total,
        inactive ? "--" : executed,
        inactive ? "--" : average,
        trigger,
        stop,
        status === "waitingForTrigger" ? "--" : duration(s.minutes, locale),
        s.reduceOnly ? yes : no,
        s.randomize ? yes : no,
        statusText,
      ];
      colors = {
        coin: side,
        sz: side,
        ...(!inactive || status === "waitingForTrigger"
          ? { executedSz: side }
          : {}),
        status: status === "error" ? "$red11" : "$text",
      };
    }
  }
  assert.equal(fields.length, twapSchemas[tab].length);
  return { key: twapRecordKey(tab, record), fields, colors };
}
export function assertTwapCellEvidence(tab, record, actual, context) {
  const expected = expectedTwapCells(tab, record, context);
  assert.deepEqual(
    actual.map((c) => c.key),
    twapSchemas[tab],
    "Actual Desktop cells have exact keys/order including fixed column",
  );
  for (const [i, cell] of actual.entries()) {
    assert.equal(
      cell.text.replace(/\s/gu, ""),
      expected.fields[i].replace(/\s/gu, ""),
      `TWAP ${expected.key} ${cell.key}: independent raw record vs actual DOM`,
    );
    if (expected.colors[cell.key]) {
      assert.ok(
        cell.colorTokens.includes(expected.colors[cell.key]),
        `TWAP ${cell.key}: required semantic color ${expected.colors[cell.key]}`,
      );
      assert.ok(
        cell.semanticColors?.some(
          (c) =>
            c.token === expected.colors[cell.key] &&
            c.resolved &&
            c.resolved === c.actual,
        ),
        `TWAP ${cell.key}: actual computed color equals resolved theme variable`,
      );
      assert.ok(
        cell.domColors?.some((c) => c && c !== "rgba(0, 0, 0, 0)"),
        `TWAP ${cell.key}: actual text has a computed color`,
      );
    }
  }
  return expected;
}
// Independently derive runtime identity from raw history, never row.status alone.
export function independentTwapRuntime(order, history) {
  const rows = history.filter((r) => r.twapId === order.twapId);
  const latest = rows.reduce(
    (a, b) => (!a || b.time >= a.time ? b : a),
    undefined,
  );
  const activation = rows
    .filter((r) => r.status.status === "activated")
    .map((r) => ms(r.time));
  const reported = latest?.status.status;
  const terminal = ["finished", "terminated", "stopped", "error"].includes(
    reported,
  );
  const status = terminal
    ? reported
    : decimal(order.state.executedSz) > 0n
      ? "activated"
      : (reported ??
        (order.state.trigger?.px ? "waitingForTrigger" : "activated"));
  return {
    status,
    activatedAt:
      status === "activated" && activation.length
        ? Math.min(...activation)
        : undefined,
  };
}
export function assertTwapFieldRows(tab, records, fragments, context) {
  const expectedKeys = records.map((r) => twapRecordKey(tab, r)),
    groups = new Map();
  for (const row of fragments) {
    const key = twapRecordKey(tab, row.record),
      group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  assert.deepEqual(
    [...groups.keys()],
    expectedKeys,
    "Actual field rows match ordered page identities",
  );
  for (const record of records) {
    const group = groups.get(twapRecordKey(tab, record)),
      first = group[0];
    const modes = group.map((r) => r.renderMode);
    assert.ok(
      JSON.stringify(modes) === '["full"]' ||
        JSON.stringify(modes) === '["left","right"]',
      "One full row or one ordered left/right pair required",
    );
    for (const fragment of group) {
      assert.deepEqual(
        fragment.record,
        record,
        "Cell raw record belongs to current page snapshot",
      );
      for (const key of [
        "status",
        "activatedAt",
        "now",
        "timeZone",
        "spotDisplayMap",
        "spotPairDisplayNameMap",
      ])
        assert.deepEqual(
          fragment[key],
          first[key],
          `Fixed-column fragment shares ${key}`,
        );
    }
    const runtime =
      tab === "active" ? independentTwapRuntime(record, context.history) : {};
    if (tab === "active") {
      assert.equal(
        first.status,
        runtime.status,
        "Actual active status independently derived from history/executed quantity",
      );
      assert.equal(
        first.activatedAt,
        runtime.activatedAt,
        "Actual activation is earliest raw activated event",
      );
      assert.ok(
        Number.isFinite(first.now) &&
          Math.abs(first.capturedAt - first.now) <= 2000,
        "Active clock tick must be within two seconds of capture",
      );
    }
    assertTwapCellEvidence(
      tab,
      record,
      group.flatMap((r) => r.cells),
      {
        ...context,
        ...runtime,
        now: first.now,
        timeZone: first.timeZone,
        spotDisplayMap: first.spotDisplayMap,
        spotPairDisplayNameMap: first.spotPairDisplayNameMap,
      },
    );
  }
  return expectedKeys;
}
