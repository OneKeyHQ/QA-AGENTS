// D10 手动用例：docs/qa/testcases/cases/perps/2026-04-21_Perps-现货交易.md
// Desktop holdings view/settings only. No trading, authorization or funds API.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  projectHoldingsTable,
  expectedVisibleHoldings,
} from "./holdings-visibility-evidence.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm } from "./non-order-ui.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { projectHoldingsEvidence, holdingOracle, assertHoldingNumbers, assertHoldingOrder, assertHoldingValue, assertHoldingPnlColor } from './holdings-data-evidence.mjs';
const tab = (p) => locator(p, "perps.info.balances"),
  checkbox = (p) => locator(p, "perps.holdings.hide_small");
export async function desktopHoldingsState(p) {
  const roots = await projectReactAll(tab(p), projectHoldingsTable);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].length, 1, "One committed Desktop holdings table");
  return roots[0][0];
}
export async function readyHoldings(p) {
  await unlockWalletIfNeeded(p);
  await tab(p).click();
  await checkbox(p).waitFor({ state: "visible" });
  return pollForm(
    () => desktopHoldingsState(p),
    (s) => !s.loading,
    "Current holdings loaded",
  );
}
const ready=readyHoldings;
async function checked(p) {
  const v = await checkbox(p).getAttribute("aria-checked");
  assert.ok(["true", "false"].includes(v), "Readable actual checkbox state");
  return v === "true";
}
export async function setHoldingsHidden(p, value) {
  await unlockWalletIfNeeded(p);
  if ((await checked(p)) !== value) await checkbox(p).click();
  await pollForm(
    () => checked(p),
    (v) => v === value,
    "Actual holdings hide setting",
  );
  return pollForm(
    () => desktopHoldingsState(p),
    (s) => !s.loading,
    "Holdings after filter",
  );
}
const setHidden=setHoldingsHidden;
async function pageInput(p) {
  const candidates = locator(
    p,
    "perps.perp-input-with-accessory-done-view-input",
  );
  const own = await projectReactAll(candidates, (f) => {
    for (let n = f; n; n = n.return)
      if (
        n.memoizedProps?.listViewDebugRenderTrackerProps?.name ===
        "SpotBalanceList"
      )
        return true;
    return false;
  });
  const indices = own.flatMap((v, i) => (v ? [i] : []));
  assert.equal(indices.length, 1, "One holdings-owned pagination input");
  return candidates.nth(indices[0]);
}
async function jump(p, n) {
  const input = await pageInput(p);
  await input.fill(String(n));
  await input.press("Enter");
  await pollForm(
    () => desktopHoldingsState(p),
    (s) => s.page === n,
    "Actual holdings page " + n,
  );
}
export async function showAllHoldings(p) {
  const state=await setHidden(p,false);
  if(state.page!==1)await jump(p,1);
}
export async function withHoldings(p, fn) {
  const initial = await ready(p),
    original = await checked(p);
  let primary;
  try {
    return await fn();
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "holdings-boundary", e);
    throw e;
  } finally {
    try {
      await ready(p);
      const s = await setHidden(p, original);
      if (initial.page > 1) {
        assert.ok(
          s.data.length > (initial.page - 1) * s.pageSize,
          "Original holdings page still exists",
        );
        await jump(p, initial.page);
      }
      assert.equal(await checked(p), original);
      assert.equal((await desktopHoldingsState(p)).page, initial.page);
    } catch (e) {
      throw markRestoreFailure(primary, e, "恢复持有币种过滤及分页");
    }
  }
}
export async function holdingsEvidence(p) {
  const roots=await projectReactAll(tab(p),projectHoldingsEvidence);
  assert.equal(roots.length,1,'One observed holdings root');
  assert.equal(roots[0].raw.isLoaded,true,'Raw holdings loaded');
  assert.equal(new Set(roots[0].raw.balances.map(r=>r.coin)).size,roots[0].raw.balances.length,'Unique raw balance identity');
  assert.equal(new Set(roots[0].data.map(r=>r.rawCoin)).size,roots[0].data.length,'Unique table identity');
  return roots[0];
}
export function rawHoldingExpectation(s,coin) {
  const raw=s.raw.balances.find(r=>r.coin===coin);
  assert.ok(raw,`Raw balance exists for ${coin}`);
  let price;
  if(!['USDC','USDT','USDB','USDH'].includes(coin)) {
    const markets=s.universes.filter(u=>u.baseName===coin&&u.quoteName==='USDC'&&s.prices[u.name]?.markPx);
    if(markets.length!==1)throw new SampleUnavailable(`${coin} 需要唯一可读取的 USDC 标记价；不拿页面派生价值自证`);
    price=s.prices[markets[0].name].markPx;
  }
  return holdingOracle(raw,price);
}
export function visibleHolding(s,coin) {
  const rows=s.rows.filter(r=>r.item.rawCoin===coin);
  if(!rows.length)throw new SampleUnavailable(`${coin} 需要当前页可见的现有持有资产`);
  assert.equal(rows.length,1,'One visible row per raw token');
  assert.deepEqual(Object.keys(rows[0].cells).sort(),['coin','total','available','usdcValue','pnl','contract'].sort(),'All six actual DOM cells readable');
  return rows[0];
}
const texts=r=>Object.fromEntries(Object.entries(r.cells).map(([k,v])=>[k,v.text]));
function assertStableRow(s,coin) {
  const row=visibleHolding(s,coin),c=texts(row);
  assert.equal(c.pnl,'--','Stablecoin has no PnL');
  // USDC is merged across account modes; here check its independent 1:1
  // relationship from the visible quantity, without claiming raw merge coverage.
  const expected=coin==='USDC'?holdingOracle({coin,total:c.total.slice(0,-5),hold:'0'},null):rawHoldingExpectation(s,coin);
  if(coin==='USDC')assertHoldingValue(c.usdcValue,expected);
  else assertHoldingNumbers(c,expected,coin);
  return row;
}
export async function holdingControl(p,coin,key) {
  const candidates=locator(p,key).filter({visible:true});
  const owners=await projectReactAll(candidates,f=>{
    for(let n=f;n;n=n.return)if(n.memoizedProps?.item?.rawCoin)return n.memoizedProps.item.rawCoin;
    throw Error('Holding-owned control required');
  });
  const indices=owners.flatMap((v,i)=>v===coin?[i]:[]);
  assert.ok(indices.length<=1,'One control per raw holding identity');
  return {count:indices.length,node:indices.length?candidates.nth(indices[0]):null};
}
export const holdingsBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-HOLDINGS-001",
    name: "Desktop持有币种列与小额过滤完整断言",
    rows: [
      {
        ids: ["D10-92"],
        name: "六列表头顺序与实际横向几何",
        check: (p) =>
          withHoldings(p, async () => {
            const s = await desktopHoldingsState(p);
            assert.deepEqual(
              s.columns.map((c) => c.key),
              ["coin", "total", "available", "usdcValue", "pnl", "contract"],
            );
            const panel = locator(p, "perps.info.tabs")
              .locator("..")
              .locator("..");
            let previous = -Infinity;
            for (const col of s.columns) {
              const node = panel
                .getByText(col.title, { exact: true })
                .filter({ visible: true });
              assert.equal(await node.count(), 1);
              const rect = await node.boundingBox();
              assert.ok(
                rect && rect.width > 0 && rect.x > previous,
                "Actual header visual order",
              );
              previous = rect.x;
            }
            return "六列key与独立可见表头一一对应，实际x坐标递增";
          }),
      },
      {
        ids: ["D10-107"],
        name: "5美元精确过滤、可见计数、刷新持久化、还原与分页复位",
        check: (p) =>
          withHoldings(p, async () => {
            const all = await setHidden(p, false),
              want = expectedVisibleHoldings(all.data, true);
            if (want.length === all.data.length)
              throw new SampleUnavailable(
                "需要现有非USDC、具有价格且价值严格低于5美元的资产；不通过真实买入造样本",
              );
            const filtered = await setHidden(p, true);
            assert.equal(filtered.page, 1);
            assert.deepEqual(
              filtered.data.map((r) => r.rawCoin),
              want,
              "Exact independent raw quantity/mark threshold, no rounded-price oracle",
            );
            const sampleGaps = [];
            if (want.length)
              sampleGaps.push(
                "全隐藏空态还需无USDC且所有资产低于5美元的现有账户",
              );
            if (!want.length)
              await p
                .getByText("暂无数据", { exact: true })
                .filter({ visible: true })
                .waitFor({ state: "visible" });
            const count = (await tab(p).innerText()).match(/[（(](\d+)[）)]/u);
            assert.ok(count, "Visible tab count must be readable");
            assert.equal(
              Number(count[1]),
              want.length,
              "Original manual expectation: count tracks visible holdings (known source discrepancy remains strict)",
            );
            await p.reload();
            await unlockWalletIfNeeded(p);
            await ready(p);
            assert.equal(
              await checked(p),
              true,
              "Real renderer reload preserves setting",
            );
            // Prices can move through the $5 boundary during reload. Re-read the complete
            // current raw rows before checking membership; the pre-reload list is stale.
            const restored = await setHidden(p, false);
            assert.deepEqual(
              [...restored.data.map((r) => r.rawCoin)].sort(),
              [...all.data.map((r) => r.rawCoin)].sort(),
            );
            const freshWant = expectedVisibleHoldings(restored.data, true),
              fresh = await setHidden(p, true);
            assert.deepEqual(
              fresh.data.map((r) => r.rawCoin),
              freshWant,
            );
            await setHidden(p, false);
            if (all.data.length <= all.pageSize)
              sampleGaps.push("分页复位还需超过一页的现有资产");
            else {
              await jump(p, 2);
              await setHidden(p, true);
              assert.equal((await desktopHoldingsState(p)).page, 1);
              await setHidden(p, false);
              assert.equal((await desktopHoldingsState(p)).page, 1);
            }
            if (sampleGaps.length)
              throw new SampleUnavailable(
                "已执行可用过滤/持久化断言；" +
                  sampleGaps.join("；") +
                  "；不通过真实买入造样本，不将未执行条件分支计整条通过",
              );
            return "独立原数量×价格5美元边界、USDC/无价格豁免、空态、tab可见数、真实reload持久化、取消恢复及页2切换复位";
          }),
      },
    ],
  },
  {
    id:'PERPS-DESKTOP-HOLDINGS-002',
    name:'Desktop持有币种原始数据与可见单元格对账',
    rows:[
      {ids:['D10-93'],name:'BTC/ETH映射、原始数量、冻结扣减与标记价估值',complete:false,missing:'合约复制/跳转与分享按钮需独立交互；本项先对账数值与身份',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p);
          for(const [rawCoin,label] of [['UBTC','BTC'],['UETH','ETH']]) {
            const r=visibleHolding(s,rawCoin);assert.equal(r.cells.coin.text,label,'Canonical display symbol');
            assertHoldingNumbers(texts(r),rawHoldingExpectation(s,rawCoin),label);
          }
          return 'BTC/ETH实际六列DOM；总量/冻结/成本及USDC标记价来自原始持有与行情状态，未读取产品已算出的价值作预期';
        })},
      {ids:['D10-94'],name:'合并USDC仅一行且无盈亏',complete:false,missing:'现货+合约USDC金额与统一账户可用口径仍需独立原始账户模式/摘要对账',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p);
          const usdc=s.data.filter(r=>r.rawCoin==='USDC');if(!usdc.length)throw new SampleUnavailable('需要现有USDC持有样本');
          assert.equal(usdc.length,1);assertStableRow(s,'USDC');
          return '独立读取单一USDC行、实际无盈亏及余额与价值1:1；不将派生余额当成合并金额的独立证据';
        })},
      {ids:['D10-95'],name:'四种稳定币价值1:1且无盈亏',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p),missing=[];
          for(const coin of ['USDC','USDT','USDB','USDH']) {
            if(!s.rows.some(r=>r.item.rawCoin===coin)) {missing.push(coin);continue;}
            assertStableRow(s,coin);
          }
          if(missing.length)throw new SampleUnavailable(`四种稳定币分支尚缺当前页现有样本：${missing.join('/')}`);
          return '四种稳定币可见价值等于余额，盈亏均--；非USDC从原始余额独立计算';
        })},
      {ids:['D10-96'],name:'现货盈亏金额百分比、无成本/缺价与实际红绿颜色',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p),branches=new Set();
          for(const row of s.rows.filter(r=>!['USDC','USDT','USDB','USDH'].includes(r.item.rawCoin))) {
            const markets=s.universes.filter(u=>u.baseName===row.item.rawCoin),missingPrice=markets.length>0&&markets.every(u=>!s.prices[u.name]?.markPx);
            if(missingPrice) {assert.equal(row.cells.pnl.text,'--','Raw absent price must not fabricate PnL');branches.add('no-price');continue;}
            const e=rawHoldingExpectation(s,row.item.rawCoin);assertHoldingNumbers(texts(row),e,row.cells.coin.text);
            if(e.pnl!==null)assertHoldingPnlColor(row.cells.pnl.color,e.pnl);
            branches.add(e.pnl===null?'no-cost':Number(e.pnl)>0?'profit':Number(e.pnl)<0?'loss':'zero');
          }
          const missing=['profit','loss','no-cost','no-price'].filter(x=>!branches.has(x));
          if(missing.length)throw new SampleUnavailable(`已对账可见样本及实际颜色；盈亏分支还缺 ${missing.join('/')}`);
          return '原始数量×USDC标记价−原始成本；成本百分比；正负号、精度、实际DOM红绿颜色及零成本/缺价--';
        })},
      {ids:['D10-98'],name:'原始零余额资产不进入完整列表或实际可见行',complete:false,missing:'已实现非USDC零余额；合并后USDC为零仍需独立原始现货/合约与账户模式对账',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p),zero=s.raw.balances.filter(r=>/^0(?:\.0+)?$/u.test(r.total));
          if(!zero.some(r=>r.coin!=='USDC'))throw new SampleUnavailable('需接口保留零余额的非USDC现有资产；不卖出制造样本');
          for(const r of zero.filter(r=>r.coin!=='USDC')) {
            assert.ok(!s.data.some(x=>x.rawCoin===r.coin),'Raw zero balance absent from entire table data');
            assert.ok(!s.rows.some(x=>x.item.rawCoin===r.coin),'Raw zero balance absent from rendered rows');
          }
          return '原始零余额样本与完整表数据、实际DOM行独立比较；USDC合并余额另测';
        })},
      {ids:['D10-99'],name:'USDC置顶与精确价值/数量排序',complete:false,missing:'跨标记价更新后的实际重排仍需新行情导致排序变化的样本和时序证据',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p);
          if(!s.data.some(r=>r.rawCoin==='USDC')||s.data.length<3)throw new SampleUnavailable('需要USDC及至少两种非USDC现有资产');
          const values=Object.fromEntries(s.data.map(r=>[r.rawCoin,r.rawCoin==='USDC'?'0':rawHoldingExpectation(s,r.rawCoin).valueRatio]));
          assertHoldingOrder(s.data,values);
          assert.ok(s.rows.length,'Actual visible holdings rows required');
          const page=await desktopHoldingsState(p),offset=(page.page-1)*page.pageSize;
          assert.deepEqual([...s.rows].sort((a,b)=>a.cells.coin.y-b.cells.coin.y).map(r=>r.item.rawCoin),s.data.slice(offset,offset+s.rows.length).map(r=>r.rawCoin),'Actual DOM row geometry follows independently checked full-list order');
          return 'USDC置顶；原始数量×标记价精确降序，同价原始数量降序；实际DOM纵向顺序独立读回；不声称行情重排已验证';
        })},
      {ids:['D10-104'],name:'合约缩写、真实复制全文及缺地址/USDC无按钮',complete:false,missing:'实际外链目标尚未独立验证；合约来源尚需独立原始tokenId对账',
        check:p=>withHoldings(p,async()=>{
          await showAllHoldings(p);const s=await holdingsEvidence(p);let hasAddress=false,hasMissing=false,hasUsdc=false;
          for(const r of s.rows) {
            const data=s.data.find(x=>x.rawCoin===r.item.rawCoin);assert.ok(data);
            const cell=r.cells.contract;
            const copy=await holdingControl(p,r.item.rawCoin,'perps.perp-balance-row-copy-contract-button'),open=await holdingControl(p,r.item.rawCoin,'perps.perp-balance-row-open-contract-button');
            if(data.contract&&r.item.rawCoin!=='USDC') {
              assert.equal(cell.text,`${data.contract.slice(0,6)}...${data.contract.slice(-4)}`);hasAddress=true;
              assert.equal(copy.count,1);assert.equal(open.count,1);
              const original=await p.evaluate(()=>navigator.clipboard.readText());let primary;
              try {
                const sentinel='qa:holdings-copy:'+Date.now();await p.evaluate(v=>navigator.clipboard.writeText(v),sentinel);
                await pollForm(()=>p.evaluate(()=>navigator.clipboard.readText()),v=>v===sentinel,'Clipboard calibrated before actual copy');
                await copy.node.click();
                await pollForm(()=>p.evaluate(()=>navigator.clipboard.readText()),v=>v===data.contract,'Actual holding full contract copied');
              }catch(e){primary=e;throw e;}
              finally {
                try {await p.evaluate(v=>navigator.clipboard.writeText(v),original);await pollForm(()=>p.evaluate(()=>navigator.clipboard.readText()),v=>v===original,'Original clipboard restored');}
                catch(e){throw markRestoreFailure(primary,e,'恢复持有币种复制前剪贴板');}
              }
            }else {assert.equal(cell.text,'--');assert.equal(copy.count,0);assert.equal(open.count,0);hasMissing||=r.item.rawCoin!=='USDC';hasUsdc||=r.item.rawCoin==='USDC';}
          }
          if(!hasAddress||!hasMissing||!hasUsdc)throw new SampleUnavailable('需同时有地址、无地址及USDC三类当前页样本；复制/实际外链另补');
          return '实际6+4缩写、独立剪贴板哨兵后的全文复制及恢复；无地址/USDC均--且无按钮；实际外链仍待补';
        })},
    ],
  },
];
export const holdingsBoundarySuite = createDesktopRowSuite(
  holdingsBoundaryDefinitions,
);
