// D09 手动用例：docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md
// Existing funding history and local CSV exports; no financial submissions.
import assert from "node:assert/strict";
import {resolve} from 'node:path';
import {RESULTS_DIR} from '../../helpers/index.mjs';
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { pollForm, closePop, clickVisibleChoice } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import {captureDesktopDownload} from './desktop-download.mjs';
import {assertFundingCsv} from './funding-csv-evidence.mjs';
import {assertFundingRenderedRows} from './funding-dom-evidence.mjs';
import {fundingSettlementOracle} from './public-market-oracle.mjs';
import {activeToasts} from './validation-toasts.mjs';
const pop = (p) => locator(p, "perps.overlay.popover");
const control = (p, kind) => locator(p, `perps.history.${kind}_filter`);
const identity = (r) => JSON.stringify([r.hash, r.time, r.delta.coin]);
export async function fundingState(p) {
  const snapshots = await projectReactAll(control(p, "side"), (f) => {
    let root = f;
    while (root.return) root = root.return;
    const tables = [],
      toolbars = [],
      stack = [root];
    for (let visited = 0; stack.length && visited < 100000; visited++) {
      const n = stack.pop(),
        v = n.memoizedProps;
      if (
        v?.listViewDebugRenderTrackerProps?.name === "PerpFundingHistoryList" &&
        Array.isArray(v.data)
      )
        tables.push({
          data: v.data,
          page: v.currentListPage,
          pageSize: v.pageSize,
          columns: v.columns,
          loading: v.listLoading,
        });
      if (
        Array.isArray(v?.marketOptions) &&
        typeof v.onSideFilterChange === "function" &&
        typeof v.onMarketFilterChange === "function"
      )
        toolbars.push({
          side: v.sideFilter,
          market: v.marketFilter,
          options: v.marketOptions,
        });
      if (n.sibling) stack.push(n.sibling);
      if (n.child) stack.push(n.child);
    }
    return { tables, toolbars };
  });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].tables.length, 1, "Unique committed funding table");
  assert.equal(snapshots[0].toolbars.length, 1, "Unique funding toolbar");
  return { ...snapshots[0].tables[0], ...snapshots[0].toolbars[0] };
}
async function ready(p) {
  await locator(p, "perps.funding.tab").click();
  await control(p, "side").waitFor({ state: "visible" });
  return pollForm(
    () => fundingState(p),
    (s) => !s.loading,
    "Funding loaded",
  );
}
async function choose(p, kind, value) {
  await control(p, kind).click();
  const target = locator(pop(p), `perps.history.${kind}_options`).and(
    p.getByTestId(`perps-funding-history-${kind}-${value ?? "all"}`),
  );
  await clickVisibleChoice(target);
  await pop(p).waitFor({ state: "hidden" });
  await pollForm(
    () => fundingState(p),
    (s) => s[kind] === value,
    `Funding ${kind}=${value}`,
  );
}
async function reset(p) {
  await choose(p, "side", "all");
  await choose(p, "market", undefined);
  const all = await fundingState(p);
  if (!all.data.length)
    throw new SampleUnavailable("当前账户没有既有资金费记录；不创建订单补数据");
  return all;
}
async function withFunding(p, fn) {
  const before = await ready(p);
  let primary;
  try {
    return await fn();
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "funding", e);
    throw e;
  } finally {
    try {
      await closePop(p);
      await choose(p, "side", before.side);
      await choose(p, "market", before.market);
      const after = await fundingState(p);
      assert.deepEqual(
        { side: after.side, market: after.market },
        { side: before.side, market: before.market },
        "Independent funding filters restored",
      );
    } catch (e) {
      if (primary) e.message = `原步骤: ${primary.message}; 恢复: ${e.message}`;
      throw markRestoreFailure(null, e, "恢复资金费筛选");
    }
  }
}
const intersection = (data, side = "all", market) =>
  data.filter(
    (r) =>
      (side === "all" ||
        (side === "long"
          ? Number(r.delta.szi) > 0
          : Number(r.delta.szi) < 0)) &&
      (market === undefined || r.delta.coin === market),
  );
async function verify(p, expected) {
  const s = await pollForm(
    () => fundingState(p),
    (v) =>
      JSON.stringify(v.data.map(identity)) ===
      JSON.stringify(expected.map(identity)),
    "Funding exact record intersection",
  );
  assert.equal(
    new Set(s.data.map(identity)).size,
    s.data.length,
    "No duplicate funding identity",
  );
  assert.equal(s.page, 1, "Filtering resets first page");
  await pollForm(async()=>{
    const actual=await locator(p,"perps.position.table_body").locator('[data-sentry-component="FundingHistoryRow"]').evaluateAll(es=>es.map(e=>[...e.children].map(c=>c.textContent)));
    try{assertFundingRenderedRows(actual,expected,s.page);return {matched:true};}catch(e){return {matched:false,mismatch:e.message,actual:actual.slice(0,2)};}
  },v=>v.matched,"Rendered funding page matches exact market, side and rate");
  return s;
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function exportFunding(p,expected,label,totalCount) {
  const paymentTokens=await fundingSettlementOracle();
  assert.ok(expected.length,'A nonempty fixture is required for an actual CSV');
  const expectedFile=new RegExp(`^perp_funding_history_${totalCount>=2000?'recent_':''}\\d{8}-\\d{6}\\.csv$`,'u');
  const {bytes}=await captureDesktopDownload(p,{filename:expectedFile,output:resolve(RESULTS_DIR,'perps-desktop-completion',`funding-export-${label}.csv`)},()=>locator(p,'perps.funding.export').click());
  const count=assertFundingCsv(bytes,expected,paymentTokens);
  await pollForm(()=>activeToasts(p).allTextContents(),texts=>texts.some(t=>/^成功$/u.test(t.trim())),'Actual CSV success feedback');
  assert.equal(await locator(p,'perps.funding.export').isEnabled(),true,'Export button returns to enabled state');
  return `${count}条真实CSV逐行核对UTC/市场/绝对数量/方向/原始资金费/独立结算币/精确费率`;
}
async function marketOptions(p) {
  return locator(pop(p), "perps.history.market_options").evaluateAll((es) =>
    es
      .filter((e) => e.dataset.testid !== "perps-funding-history-market-search")
      .map((e) => ({
        coin: e.dataset.testid.slice("perps-funding-history-market-".length),
        label: e.innerText.trim(),
      })),
  );
}
export const fundingDefinitions = [
  {
    id: "PERPS-DESKTOP-FUNDING-001",
    name: "Desktop 资金费列表筛选与精确集合",
    rows: [
      row("D09-243", "三方向、唯一勾选、筛选文案与精确记录", (p) =>
        withFunding(p, async () => {
          const all = await reset(p),
            details = [];
          for (const [side, label] of [
            ["all", "方向"],
            ["long", "做多"],
            ["short", "做空"],
          ]) {
            await choose(p, "side", side);
            await verify(p, intersection(all.data, side));
            assert.equal((await control(p, "side").innerText()).trim(), label);
            await control(p, "side").click();
            const options = locator(pop(p), "perps.history.side_options");
            assert.deepEqual(
              await options.evaluateAll((es) =>
                es.map((e) => e.dataset.testid),
              ),
              [
                "perps-funding-history-side-all",
                "perps-funding-history-side-long",
                "perps-funding-history-side-short",
              ],
            );
            const checked = await options.evaluateAll((es) =>
              es
                .filter((e) =>
                  e.querySelector('svg[data-sentry-component="SvgCheckLarge"]'),
                )
                .map((e) => e.dataset.testid),
            );
            assert.deepEqual(checked, [`perps-funding-history-side-${side}`]);
            await closePop(p);
            details.push(`${side}:${intersection(all.data, side).length}`);
          }
          return details.join(";");
        }),
      ),
      row("D09-244", "原始市场选项集合、字母顺序和固定市场精确过滤", (p) =>
        withFunding(p, async () => {
          const all = await reset(p);
          const expected = [...new Set(all.data.map((r) => r.delta.coin))]
            .map((coin) => ({
              coin,
              label: coin.includes(":")
                ? `${coin.split(":").at(-1)} (${coin.split(":")[0]})`
                : coin,
            }))
            .sort(
              (a, b) =>
                a.label.localeCompare(b.label) || a.coin.localeCompare(b.coin),
            );
          await control(p, "market").click();
          assert.equal(
            await locator(pop(p), "perps.history.market_search").count(),
            1,
          );
          assert.deepEqual(await marketOptions(p), [
            { coin: "all", label: "全部" },
            ...expected,
          ]);
          await closePop(p);
          const option = expected[0];
          await choose(p, "market", option.coin);
          await verify(p, intersection(all.data, "all", option.coin));
          assert.equal(
            (await control(p, "market").innerText()).trim(),
            option.label,
          );
          await choose(p, "market", undefined);
          await verify(p, all.data);
          return `${expected.length} 原始市场；${option.coin}过滤及全部恢复`;
        }),
      ),
      row("D09-245", "市场搜索大小写、空匹配及清空恢复", (p) =>
        withFunding(p, async () => {
          const all = await reset(p),
            option = all.options.find((o) => /[a-z]/iu.test(o.label));
          assert.ok(option, "需英文市场名样本");
          await control(p, "market").click();
          const input = locator(pop(p), "perps.history.market_search");
          for (const query of [
            option.label.slice(0, 2).toLowerCase(),
            option.label.slice(0, 2).toUpperCase(),
          ]) {
            await input.fill(query);
            const expected = all.options.filter(
              (o) =>
                o.coin.toLowerCase().includes(query.toLowerCase()) ||
                o.label.toLowerCase().includes(query.toLowerCase()),
            );
            await pollForm(
              () => marketOptions(p),
              (v) => JSON.stringify(v) === JSON.stringify(expected),
              "Case-insensitive funding markets",
            );
          }
          await input.fill("ZZZ_NO_FUNDING_MATCH_92831");
          await pollForm(
            () => marketOptions(p),
            (v) => v.length === 0,
            "No matching funding market",
          );
          assert.equal(
            await pop(p).getByText("未找到结果", { exact: true }).count(),
            1,
          );
          await input.fill("");
          await pollForm(
            () => marketOptions(p),
            (v) => v.length === all.options.length + 1,
            "Clearing restores all options",
          );
          await closePop(p);
          return "小写/大写完整集合相同；无匹配提示；清空恢复全部";
        }),
      ),
      row("D09-246", "做空×指定市场交集及两个筛选文案", (p) =>
        withFunding(p, async () => {
          const all = await reset(p),
            sample = all.data.find((r) => Number(r.delta.szi) < 0);
          if (!sample)
            throw new SampleUnavailable(
              "当前账户没有既有空仓资金费记录，不能以空集合通过",
            );
          await choose(p, "side", "short");
          await choose(p, "market", sample.delta.coin);
          const expected = intersection(all.data, "short", sample.delta.coin);
          assert.ok(expected.length);
          await verify(p, expected);
          assert.equal((await control(p, "side").innerText()).trim(), "做空");
          assert.equal(
            (await control(p, "market").innerText()).trim(),
            all.options.find((o) => o.coin === sample.delta.coin).label,
          );
          return `${sample.delta.coin} 做空逐条对账${expected.length}条`;
        }),
      ),
      row("D09-247", "无交集明确空态、无副文案和无导出入口", (p) =>
        withFunding(p, async () => {
          const all = await reset(p);
          let fixture;
          for (const option of all.options)
            for (const side of ["long", "short"])
              if (!intersection(all.data, side, option.coin).length)
                fixture ??= { option, side };
          if (!fixture)
            throw new SampleUnavailable(
              "当前账户每市场双向都有资金费，缺无交集样本；不修改真实仓位",
            );
          await choose(p, "side", fixture.side);
          await choose(p, "market", fixture.option.coin);
          await verify(p, []);
          assert.equal(
            await p
              .getByText("没有匹配的资金费", { exact: true })
              .filter({ visible: true })
              .count(),
            1,
          );
          assert.equal(await locator(p, "perps.funding.export").count(), 0);
          const body = locator(p, "perps.history.empty_state");
          assert.equal(await body.count(), 1, "One actual Desktop empty state");
          const text = await body.innerText();
          assert.equal(
            text.trim(),
            "没有匹配的资金费",
            "Empty message has no secondary text",
          );
          assert.ok(
            await body.locator("svg,img").count(),
            "Empty illustration exists",
          );
          return `${fixture.option.coin}/${fixture.side}空交集，准确空态且无导出`;
        }),
      ),
      row('D09-258','真实费率小于/达到0.01%与负号的屏幕精确格式',(p)=>withFunding(p,async()=>{
        const all=await reset(p);const seen=new Set(),sampleMarkets=[];
        for(const coin of new Set(all.data.map(r=>r.delta.coin))){
          for(const r of all.data.filter(v=>v.delta.coin===coin).slice(0,20)){
            const rate=Number(r.delta.fundingRate)*100,key=Math.abs(rate)<0.01?'small':'large';
            if(!seen.has(key)||(rate<0&&!seen.has('negative'))){sampleMarkets.push(coin);seen.add(key);if(rate<0)seen.add('negative');}
          }
        }
        if(!['small','large','negative'].every(k=>seen.has(k)))throw new SampleUnavailable(`资金费真实记录缺费率样本：${['small','large','negative'].filter(k=>!seen.has(k)).join(',')}`);
        for(const coin of new Set(sampleMarkets)){await choose(p,'market',coin);await verify(p,intersection(all.data,'all',coin));}
        return `真实DOM六列逐行核对，覆盖小于/达到0.01%及负费率；${new Set(sampleMarkets).size}市场`;
      })),
      row('D09-249','导出全部分页记录、实际文件名与七列',(p)=>withFunding(p,async()=>{
        const all=await reset(p);
        assert.equal(all.pageSize,20);
        return exportFunding(p,all.data,'all',all.data.length);
      }),{complete:false,missing:'实际CSV文件、全部记录数和成功反馈已断言；尚缺独立捕获按钮加载态及>=2000条文件名样本'}),
      row('D09-250','做多与指定市场筛选后的真实CSV精确交集',(p)=>withFunding(p,async()=>{
        const all=await reset(p),sample=all.data.find(r=>Number(r.delta.szi)>0);
        if(!sample)throw new SampleUnavailable('当前无既有做多资金费样本，不创建仓位');
        await choose(p,'side','long');await choose(p,'market',sample.delta.coin);
        const expected=intersection(all.data,'long',sample.delta.coin);await verify(p,expected);
        return exportFunding(p,expected,'long-market',all.data.length);
      })),
      row('D09-251','实际CSV的UTC、原始数值及按DEX结算币逐条对账',(p)=>withFunding(p,async()=>{
        const all=await reset(p);return exportFunding(p,all.data,'values',all.data.length);
      }),{complete:false,missing:'逐条实际文件对账已实现；结算币元数据获取失败的UI错误提示尚缺故障注入验证'}),
    ],
  },
];
export const fundingBoundarySuite = createDesktopRowSuite(fundingDefinitions);
