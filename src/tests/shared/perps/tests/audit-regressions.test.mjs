import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as runtime from "../runtime.mjs";
import { createTracker } from "../../../helpers/preconditions.mjs";

function extract(file, predicate) {
  const path = new URL(`../${file}`, import.meta.url);
  const ast = ts.createSourceFile(
    file,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let found;
  function visit(node) {
    if (predicate(node, ast)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, file);
  return found.getText(ast);
}
const named = (file, name) =>
  extract(file, (n) => ts.isFunctionDeclaration(n) && n.name?.text === name);

test("F03 必需统计缺失/非法值失败，合法空态与完整值通过", () => {
  assert.equal(typeof runtime.assertPortfolioStats, "function");
  const good = {
    totalPnl: { text: "$100" },
    winRate: "50.00%",
    profitFactor: "2.00",
    avgProfit: "$10.00",
    avgLoss: "-$5.00",
    volume: "$120.00",
    totalTrades: "2",
    hasNaN: false,
  };
  runtime.assertPortfolioStats(good);
  for (const key of [
    "winRate",
    "profitFactor",
    "avgProfit",
    "avgLoss",
    "volume",
    "totalTrades",
  ]) {
    for (const missing of [null, "", "garbage", "NaN", "Infinity"])
      assert.throws(
        () => runtime.assertPortfolioStats({ ...good, [key]: missing }),
        new RegExp(key),
      );
  }
  runtime.assertPortfolioStats({
    ...good,
    winRate: "--",
    profitFactor: "--",
    avgProfit: "--",
    avgLoss: "--",
    volume: "$0.00",
    totalTrades: "0",
  });
  assert.throws(() =>
    runtime.assertPortfolioStats({ ...good, winRate: "101%" }),
  );
  assert.throws(() =>
    runtime.assertPortfolioStats({ ...good, totalTrades: "-1" }),
  );
});
test("F02 Tooltip 缺失、缺数值、错误类型、越界必须失败；两种图表值相同允许", () => {
  assert.equal(typeof runtime.assertPortfolioTooltip, "function");
  const value = {
    text: "2026/10/29 净值 $0.00",
    label: "净值",
    value: "$0.00",
    time: "2026/10/29",
    rect: { x: 15, y: 10, width: 200, height: 30 },
    bounds: { x: 10, y: 0, width: 500, height: 100 },
  };
  runtime.assertPortfolioTooltip(value, "净值");
  runtime.assertPortfolioTooltip({ ...value, label: "盈亏" }, "盈亏");
  for (const bad of [
    null,
    { ...value, value: null },
    { ...value, time: "" },
    { ...value, rect: { ...value.rect, x: -20 } },
    { ...value, rect: { ...value.rect, y: -20 } },
  ])
    assert.throws(() => runtime.assertPortfolioTooltip(bad, "净值"));
  assert.throws(() => runtime.assertPortfolioTooltip(value, "盈亏"));
});

test("F04 带词切分类必须仍命中 BTC，空或只返回 ETH 整组失败", async () => {
  const source = named("token-search.mjs", "testTwoLevel001");
  for (const stock of [[], ["ETH"], ["BTC"]]) {
    let tab = "全部";
    const fn = vm.runInNewContext(`(${source})`, {
      prefix: "AUDIT",
      _preReport: undefined,
      createTracker,
      clickTopTab: async () => {},
      getPopoverTabRows: async () => [
        { index: 0, tabs: ["永续合约"] },
        { index: 1, tabs: ["全部", "股票"] },
      ],
      clickSubTab: async (_page, value) => {
        tab = value;
      },
      searchAsset: async () => {},
      clearSearch: async () => {},
      getSubTabs: async () => ["全部", "股票"],
      getTokenList: async () => (tab === "全部" ? ["BTC"] : stock),
      isSearchEmpty: async () => stock.length === 0,
      screenshot: async () => {},
      screenshotDir: "",
    });
    const result = await fn({});
    assert.equal(
      result.status,
      stock.includes("BTC") ? "passed" : "failed",
      JSON.stringify(stock),
    );
  }
});
test("F07 同名不同 DEX 高亮错索引必须失败，正确 ID 才通过", async () => {
  const source = named("selector-keyboard.mjs", "selected");
  for (const index of [0, 1]) {
    const list = [
      { id: "row-DEX-A:USAR", name: "USAR", selected: index === 0 },
      { id: "row-DEX-B:USAR", name: "USAR", selected: index === 1 },
    ];
    const fn = vm.runInNewContext(`(${source})`, {
      assert,
      primaryTab: async () => ["永续合约"],
      pairPopover: () => ({
        locator: () => ({ inputValue: async () => "USAR" }),
      }),
      rows: async () => list,
      poll: async (read, predicate) => {
        const value = await read();
        assert.ok(predicate(value));
        return value;
      },
    });
    if (index === 0) assert.equal((await fn({}, 0)).id, list[0].id);
    else await assert.rejects(fn({}, 0));
  }
});
test("F05 收藏切币无论成功/失败都恢复原非空表单，恢复失败标记不可继续", async () => {
  // Read the arrow directly so formatting changes do not alter the test boundary.
  const arrow = extract(
    "favorites.mjs",
    (n, ast) =>
      ts.isArrowFunction(n) &&
      ts.isBinaryExpression(n.parent) &&
      n.parent.left.getText(ast) === "tc.fn",
  );
  for (const failure of ["none", "case", "restore"]) {
    let form = "12.34";
    const result = {
      status: "passed",
      steps: [],
      errors: [],
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
    };
    const fn = vm.runInNewContext(`(${arrow})`, {
      tc: { id: "AUDIT-004" },
      goToPerps: async () => {},
      currentPair: async () => "BTCUSDC",
      favoriteSnapshot: async () => [],
      closePairs: async () => {},
      restoreFavorites: async () => {},
      restorePair: async () => {},
      snapshotNonOrderForm: async () => ({ fields: [{ value: form }] }),
      restoreNonOrderForm: async (_page, before) => {
        if (failure === "restore") throw Error("restore broke");
        form = before.fields[0].value;
      },
      run: async () => {
        form = "";
        if (failure === "case") throw Error("case broke");
        return result;
      },
      markRestoreFailure: runtime.markRestoreFailure,
      mkdirSync: () => {},
      writeFileSync: () => {},
      resolve: () => "",
      RESULTS_DIR: "",
    });
    const page = {
      setDefaultTimeout: () => {},
      getByText: () => ({ filter: () => ({ count: async () => 0 }) }),
    };
    if (failure === "case") {
      await assert.rejects(fn(page), /case broke/);
      assert.equal(form, "12.34");
    } else {
      const actual = await fn(page);
      if (failure === "restore") assert.equal(actual.fatalRestore, true);
      else assert.equal(form, "12.34");
    }
  }
});
test("F08 高度矩阵采样前必须验证行数，不能把空永续当单条", () => {
  assert.equal(typeof runtime.assertResultPopulation, "function");
  for (const [kind, count] of [
    ["multiple", 3],
    ["single", 1],
    ["empty", 0],
  ])
    runtime.assertResultPopulation(kind, count);
  for (const [kind, count] of [
    ["multiple", 1],
    ["single", 0],
    ["single", 2],
    ["empty", 1],
  ])
    assert.throws(() => runtime.assertResultPopulation(kind, count));
});
test("F06 只有恢复失败/明确fatal标记中止，普通断言失败可继续", () => {
  assert.equal(typeof runtime.mustStopAfterResult, "function");
  assert.equal(
    runtime.mustStopAfterResult({
      status: "failed",
      errors: ["ordinary assertion"],
    }),
    false,
  );
  assert.equal(runtime.mustStopAfterResult({ fatalRestore: true }), true);
  assert.equal(
    runtime.mustStopAfterResult({
      steps: [{ name: "恢复原输入", status: "failed" }],
    }),
    true,
  );
});

test("F03 实际 PNL-005 回调不能因总盈亏有效而放过缺失统计", async () => {
  const source = named("portfolio.mjs", "test005");
  for (const missing of [true, false]) {
    const tracker = () => {
      const steps = [];
      return {
        add: (name, status, detail) => steps.push({ name, status, detail }),
        result: () => ({
          status: steps.some((s) => s.status === "failed")
            ? "failed"
            : "passed",
          steps,
          summary: {},
        }),
      };
    };
    const fn = vm.runInNewContext(`(${source})`, {
      prefix: "AUDIT",
      createStepTracker: tracker,
      ensureCleanState: async () => {},
      accounts: [{ label: "当前账户" }],
      switchAccountAndOpenPortfolio: async () => {},
      switchChartType: async () => {},
      _ssStep: async (_p, t, name, check) => {
        try {
          t.add(name, "passed", await check());
        } catch (e) {
          t.add(name, "failed", e.message);
        }
      },
      getPortfolioData: async () => ({
        totalPnl: { text: "$10" },
        winRate: missing ? null : "50%",
        profitFactor: "2",
        avgProfit: "$2",
        avgLoss: "-$1",
        volume: "$10",
        totalTrades: "2",
      }),
      assertPortfolioStats: runtime.assertPortfolioStats,
      getTotalPnLColor: async () => {},
      assertPnlColor: () => {},
      closePortfolioPopup: async () => {},
    });
    const result = await fn({});
    assert.equal(result.status, missing ? "failed" : "passed");
  }
});

test("F05 图表准备失败与正文失败都必须恢复非空草稿，恢复失败携带 fatal", async () => {
  const arrow = extract(
    "chart.mjs",
    (n, ast) =>
      ts.isArrowFunction(n) &&
      ts.isBinaryExpression(n.parent) &&
      n.parent.left.getText(ast) === "tc.fn",
  );
  for (const failure of ["none", "prepare", "case", "restore"]) {
    let form = "12.34";
    const fn = vm.runInNewContext(`(${arrow})`, {
      tc: { id: "AUDIT-CHART-008" },
      goToPerps: async () => {},
      currentPair: async () => "BTCUSDC",
      snapshotNonOrderForm: async () => ({ fields: [{ value: form }] }),
      locator: () => ({ innerText: async () => "原生版" }),
      setChartMode: async () => {},
      waitForTVReady: async () => {
        form = "";
        if (failure === "prepare") throw Error("prepare broke");
      },
      getTimeIntervals: async () => [],
      run: async () => {
        form = "";
        if (failure === "case") throw Error("case broke");
        return { status: "passed", steps: [], errors: [] };
      },
      restorePair: async () => {},
      restoreNonOrderForm: async (_p, before) => {
        if (failure === "restore") throw Error("restore broke");
        form = before.fields[0].value;
      },
      markRestoreFailure: runtime.markRestoreFailure,
    });
    const page = {
      setDefaultTimeout: () => {},
      keyboard: { press: async () => {} },
    };
    if (["prepare", "case"].includes(failure)) {
      await assert.rejects(fn(page), new RegExp(failure));
      assert.equal(form, "12.34");
    } else {
      const result = await fn(page);
      if (failure === "restore") assert.equal(result.fatalRestore, true);
      else assert.equal(form, "12.34");
    }
  }
});

test("F08 实际高度采样回调必须采到三种行数，错误人口不能输出九次重复测量", async () => {
  const arrow = extract(
    "selector-keyboard.mjs",
    (n) =>
      ts.isArrowFunction(n) &&
      ts.isArrayLiteralExpression(n.parent) &&
      n.parent.elements[0]?.text === "三主Tab及多条/单条/空结果高度一致",
  );
  for (const wrongPopulation of [false, true]) {
    let tab, query, saved;
    const list = [
      { id: "a", name: "AAA" },
      { id: "b", name: "BBB" },
      { id: "c", name: "CCC" },
    ];
    const fn = vm.runInNewContext(`(${arrow})`, {
      assert,
      prepare: async (_p, t, q) => {
        tab = t;
        query = q;
      },
      rows: async () =>
        wrongPopulation && tab === "现货"
          ? []
          : !query
            ? list
            : list.filter((x) => x.name === query),
      setFavorite: async () => {},
      searchPairs: async (_p, q) => {
        query = q;
      },
      assertResultPopulation: runtime.assertResultPopulation,
      pairPopover: () => ({
        boundingBox: async () => ({ height: 600 }),
        locator: () => ({ boundingBox: async () => ({ height: 40 }) }),
      }),
      writeFileSync: (_p, text) => {
        saved = JSON.parse(text);
      },
      resolve: () => "",
      dir: "",
    });
    if (wrongPopulation) await assert.rejects(fn({}));
    else {
      await fn({});
      assert.equal(saved.length, 9);
      for (const tab of ["自选", "永续合约", "现货"])
        assert.deepEqual(
          saved.filter((x) => x.tab === tab).map((x) => x.resultCount),
          [3, 1, 0],
        );
    }
  }
});

test("投资组合入口只点击真实余额，标题/图表唯一且统计缺失时失败", async () => {
  const source = named("portfolio.mjs", "openPortfolioPopup");
  for (const patch of [
    {},
    { titles: 0 },
    { titles: 2 },
    { charts: 2 },
    { stats: 0 },
  ]) {
    const state = { titles: 1, charts: 1, stats: 1, ...patch };
    let clicked = false;
    const visible = (count) => ({
      filter() {
        return this;
      },
      count: async () => count,
      waitFor: async () => {
        assert.equal(clicked, true);
        assert.ok(count > 0, "Visible target required");
      },
    });
    const entry = {
      count: async () => 1,
      innerText: async () => "$1.23",
      click: async () => {
        clicked = true;
      },
    };
    const fn = vm.runInNewContext(`(${source})`, {
      goToPerps: async () => {},
      unlockWalletIfNeeded: async () => {},
      scrollToTop: async () => {},
      goBackToMainPage: async () => {
        throw Error("Background back button must not be used");
      },
      locator: (_p, key) => {
        assert.ok(
          [
            "perps.perp-portfolio-button",
            "perps.portfolio.chart_type",
          ].includes(key),
        );
        return key === "perps.perp-portfolio-button"
          ? entry
          : visible(state.charts);
      },
      isPortfolioPopupVisible: async () => true,
    });
    const page = {
      getByText: (label, opts) => {
        assert.equal(opts.exact, true);
        assert.ok(["投资组合与盈亏", "总交易次数"].includes(label));
        return visible(label === "投资组合与盈亏" ? state.titles : state.stats);
      },
    };
    if (Object.keys(patch).length) await assert.rejects(fn(page));
    else assert.equal(await fn(page), "$1.23");
    assert.equal(clicked, true);
  }
});

test("F06 正式CLI跨文件执行也在恢复失败后停止，普通失败可继续", async () => {
  const { runUntilRestoreFailure } =
    await import("../../../helpers/execution-policy.mjs");
  for (const fatalRestore of [false, true]) {
    const called = [];
    const results = await runUntilRestoreFailure(
      ["first", "second"],
      async (name) => {
        called.push(name);
        return {
          status: "failed",
          fatalRestore: name === "first" && fatalRestore,
        };
      },
    );
    assert.equal(results.length, fatalRestore ? 1 : 2);
    assert.equal(called.includes("second"), !fatalRestore);
  }
});

test("F07 testid也重复时仍按实际高亮行索引判断，不能用重复ID替代身份", async () => {
  const source = named("selector-keyboard.mjs", "selected");
  const list = [
    { id: "row-btc", name: "BTC/USDC", selected: false },
    { id: "row-btc", name: "BTC/USDH", selected: true },
  ];
  const fn = vm.runInNewContext(`(${source})`, {
    assert,
    primaryTab: async () => ["现货"],
    pairPopover: () => ({ locator: () => ({ inputValue: async () => "BTC" }) }),
    rows: async () => list,
    poll: async (read) => read(),
  });
  await assert.rejects(fn({}, 0));
  assert.equal((await fn({}, 1)).name, "BTC/USDH");
});

test("F06 图表步骤包装不能吞掉内部恢复失败，普通断言仍记录为失败", async () => {
  const arrow = extract(
    "chart.mjs",
    (n) =>
      ts.isArrowFunction(n) &&
      ts.isVariableDeclaration(n.parent) &&
      n.parent.name?.text === "_ssStep",
  );
  const run = vm.runInNewContext(`(${arrow})`, {
    safeStep: async (_page, tracker, name, fn) => {
      try {
        tracker.add(name, "passed", await fn());
        return true;
      } catch (error) {
        tracker.add(name, "failed", error.message);
        return false;
      }
    },
    screenshot: () => {},
    screenshotDir: "",
  });
  const steps = [],
    tracker = { add: (...args) => steps.push(args) };
  assert.equal(
    await run({}, tracker, "普通断言", async () => {
      throw Error("ordinary");
    }),
    false,
  );
  await assert.rejects(
    run({}, tracker, "内部清理", async () => {
      throw Object.assign(Error("restore"), { fatalRestore: true });
    }),
    /restore/,
  );
  assert.deepEqual(
    steps.map((step) => step[1]),
    ["failed", "failed"],
  );
});

test("F06 配额探针与默认成交量的内部 finally 恢复异常必须带 fatal", async () => {
  for (const name of ["quotaFailure", "defaultVolume"]) {
    const source = named("chart-interactions.mjs", name);
    let calls = 0;
    const run = vm.runInNewContext(`(${source})`, {
      api: async () => ({
        key: "qa",
        value: null,
        ids: [],
        values: {},
        studies: [],
      }),
      tvEval: async () => {
        if (++calls === 2) throw Error("cleanup broke");
      },
      markRestoreFailure: runtime.markRestoreFailure,
      drawingFixture: async () => {
        throw Error("exercise broke");
      },
    });
    const page = { locator: () => ({ count: async () => 1 }) };
    const refresh = async () => {
      throw Error("exercise broke");
    };
    await assert.rejects(
      name === "quotaFailure"
        ? run(page, () => {}, refresh)
        : run(page, refresh),
      (error) =>
        error.fatalRestore === true && /cleanup broke/.test(error.message),
    );
  }
});

test("F06 面板高度拖动的内部清理失败不能被普通步骤失败吞掉", async () => {
  const source = named("chart-interactions.mjs", "dragLayout");
  const run = vm.runInNewContext(`(${source})`, {
    locator: () => ({
      scrollIntoViewIfNeeded: async () => {},
      boundingBox: async () => ({ x: 0, y: 500, height: 10 }),
    }),
    markRestoreFailure: runtime.markRestoreFailure,
  });
  await assert.rejects(
    run({
      mouse: {
        move: async () => {},
        down: async () => {
          throw Error("exercise");
        },
        up: async () => {
          throw Error("cleanup broke");
        },
      },
    }),
    (error) =>
      error.fatalRestore === true && /cleanup broke/.test(error.message),
  );
});

test("F07 跨屏可视行按testid及显示名联合定位，同名DEX与重复testid均不歧义", async () => {
  const source = named("selector-keyboard.mjs", "selectedRow");
  const items = [
    { id: "xyz-aaoi", name: "AAOI" },
    { id: "para-aaoi", name: "AAOI" },
    { id: "btc", name: "BTC/USDC" },
    { id: "btc", name: "BTC/USDH" },
  ];
  function locator(entries) {
    return {
      filter: ({ has }) => locator(entries.filter((x) => x.name === has.name)),
      and: (other) => locator(entries.filter((x) => x.id === other.id)),
      count: async () => entries.length,
      entries,
    };
  }
  const run = vm.runInNewContext(`(${source})`, {
    assert,
    pairRows: () => locator(items),
  });
  const page = {
    getByText: (name) => ({ name }),
    getByTestId: (id) => ({ id }),
  };
  for (const item of items)
    assert.deepEqual((await run(page, item)).entries, [item]);
});

test("F07 收藏BTC前必须高亮精确BTC，搜索首行BTCD不能作为BTC前置", async () => {
  const source = named("selector-keyboard.mjs", "selectFixtureWithKeyboard");
  const list = [
    { id: "para-btcd", name: "BTCD" },
    { id: "xyz-iren", name: "IREN" },
    { id: "btc", name: "BTC" },
  ];
  let index = 0;
  const run = vm.runInNewContext(`(${source})`, {
    assert,
    rows: async () => list,
    selectFirstWithKeyboard: async () => {
      index = 0;
    },
    pressInPicker: async () => {
      index++;
    },
    selected: async (_page, expected) => {
      assert.equal(index, expected);
      return list[index];
    },
  });
  assert.deepEqual(await run({}, list[2]), list[2]);
  assert.equal(index, 2);
  await assert.rejects(run({}, { id: "missing", name: "BTC" }));
});

test("D13-73 both actual close paths run inside calibrated request observation, and observer failures propagate", async () => {
  const source = named(
    "desktop-chase-boundaries.mjs",
    "verifyChaseClosePaths",
  ).replace(/^export\s+/u, "");
  const execute = async ({
    observerFailure = false,
    missingClose = false,
    remainsOpen = false,
  } = {}) => {
    const calls = [];
    let observing = false;
    const close = (method) => ({
      count: async () => (missingClose ? 0 : 1),
      click: async () => {
        assert.equal(observing, true);
        calls.push(method);
      },
    });
    const verify = vm.runInNewContext(`(${source})`, {
      assert,
      locator: (_d, key) => {
        assert.equal(key, "perps.overlay.dialog_close");
        return close("×");
      },
      dialog: () => ({ count: async () => (remainsOpen ? 1 : 0) }),
      withDesktopRequestObservation: async (_p, action) => {
        observing = true;
        calls.push("armed");
        const detail = await action();
        calls.push("settled");
        if (observerFailure) throw Error("exchange request observed");
        observing = false;
        return { detail, observation: { calibrated: true, requests: [] } };
      },
      withChasePreviews: async (_p, check, options) => {
        assert.equal(observing, true, "Preview open must already be observed");
        assert.equal(options.needsBook, false);
        return check({
          s: { order: { oid: 7 } },
          d: {
            getByText: (text, opts) => {
              assert.equal(text, "取消");
              assert.equal(opts.exact, true);
              return close("取消");
            },
            waitFor: async (opts) => {
              assert.equal(opts.state, "hidden");
              assert.equal(observing, true);
            },
          },
        });
      },
    });
    return { result: await verify({}), calls };
  };
  const good = await execute();
  assert.deepEqual(good.calls, ["armed", "取消", "×", "settled"]);
  assert.match(good.result, /0个exchange请求/u);
  await assert.rejects(
    execute({ observerFailure: true }),
    /exchange request observed/u,
  );
  await assert.rejects(execute({ missingClose: true }));
  await assert.rejects(execute({ remainsOpen: true }));
});
