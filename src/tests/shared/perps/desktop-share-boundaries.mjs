// D10 手动用例：docs/qa/testcases/cases/perps/2026-04-21_Perps-现货交易.md
// D21 手动用例：docs/qa/testcases/cases/perps/2026-10-28_Perps-分享.md
// D21 current-position sharing. Opens existing data only; no signing, publishing,
// system recipient selection or financial actions. Actual PNG text is recognized
// locally and checked independently; remaining visual clauses stay partial.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { closeFunds, accountFingerprint } from "./desktop-funds-boundaries.mjs";
import { pollForm } from "./non-order-ui.mjs";
import { existingOrderIds } from "./order-observation.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { decodeRenderedQr } from "./qr-evidence.mjs";
import { activeToasts } from "./validation-toasts.mjs";
import { captureDesktopDownload } from "./desktop-download.mjs";
import { recognizeCardFile, assertShareBitmapText } from "./share-bitmap-evidence.mjs";
import { withHoldings, showAllHoldings, holdingsEvidence, holdingControl, rawHoldingExpectation } from './desktop-holdings-boundaries.mjs';
import { assertSpotShareSource } from './holdings-data-evidence.mjs';
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const ui = (p, key) => locator(dialog(p), `perps.share.${key}`);
const entries = (p) =>
  locator(p, "perps.perp-position-row-desktop-pn-l-icon-btn");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function sourcePosition(entry) {
  const rows = await projectReactAll(entry, (f) => {
    for (; f; f = f.return) {
      const pos = f.memoizedProps?.mockedPosition?.activePosition?.position;
      if (pos)
        return {
          coin: pos.coin,
          szi: pos.szi,
          entryPx: pos.entryPx,
          leverage: pos.leverage,
        };
    }
    throw Error("Position source unavailable");
  });
  assert.equal(rows.length, 1);
  return rows[0];
}
export async function shareState(p) {
  const results = await projectReactAll(dialog(p), (f) => {
    const stack = [f],
      views = [];
    while (stack.length) {
      const n = stack.pop(),
        v = n.memoizedProps;
      if (
        v?.data?.token &&
        v?.config?.pnlDisplayMode &&
        v.generatorRef &&
        Object.hasOwn(v, "referralQrCodeUrl")
      )
        views.push({
          data: v.data,
          config: v.config,
          url: v.referralQrCodeUrl,
          displayText: v.referralDisplayText,
        });
      if (n.sibling && n !== f) stack.push(n.sibling);
      if (n.child) stack.push(n.child);
    }
    return views;
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].length, 1, "One current ShareView");
  return results[0][0];
}
async function withShare(p, fn) {
  await locator(p, "perps.position.tab").click();
  if (!(await entries(p).count()))
    throw new SampleUnavailable(
      "当前账户没有可分享的既有持仓，不为测试创建订单",
    );
  const entry = entries(p).first(),
    before = await sourcePosition(entry),
    account = await accountFingerprint(p),
    orders = await existingOrderIds(p);
  let primary;
  try {
    await entry.click();
    await dialog(p).waitFor({ state: "visible" });
    const s = await shareState(p);
    assert.equal(s.data.token, before.coin);
    assert.equal(s.data.side, Number(before.szi) >= 0 ? "long" : "short");
    assert.equal(s.data.entryPrice, before.entryPx);
    assert.equal(s.data.leverage, before.leverage.value);
    assert.equal(s.data.priceType, "mark");
    assert.equal(s.config.pnlDisplayMode, "roe");
    return await fn(s, before);
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "share", e);
    throw e;
  } finally {
    try {
      await closeFunds(p);
      assert.equal(await accountFingerprint(p), account);
      assert.deepEqual(
        await sourcePosition(entries(p).first()),
        before,
        "Opening share preserves position identity/size/cost/leverage",
      );
      assert.deepEqual(
        await existingOrderIds(p),
        orders,
        "Share does not alter existing orders",
      );
    } catch (e) {
      throw markRestoreFailure(primary, e, "关闭分享并核对账户、持仓及委托");
    }
  }
}
async function bitmap(p) {
  const image = ui(p, "preview");
  await image.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await image.count(), 1, "One visible card preview");
  await pollForm(
    () =>
      image.evaluate((e) => ({
        loaded: e.complete,
        width: e.naturalWidth,
        height: e.naturalHeight,
      })),
    (v) => v.loaded && v.width >= 900 && v.height === v.width,
    "Readable square PNG preview",
  );
  const src = await image.getAttribute("src");
  assert.match(src, /^data:image\/png;base64,/u);
  const bytes = Buffer.from(src.split(",")[1], "base64"),
    meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "png");
  assert.ok(meta.width >= 900 && meta.width === meta.height);
  const qr = await decodeRenderedQr(bytes);
  assert.match(
    qr,
    /^https:\/\/(?:app\.onekey\.so|app\.onekeytest\.com)\/(?:perps|r\/[^\s/]+\/app\/perps)$/u,
  );
  assert.equal(
    qr,
    (await shareState(p)).url,
    "Real rendered QR matches current card link",
  );
  return {
    src,
    bytes,
    qr,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
async function paintedText(p, bytes) {
  const state=await shareState(p), mode=state.config.pnlDisplayMode;
  const file=resolve(RESULTS_DIR,"perps-desktop-completion",`share-ocr-${mode}-${Date.now()}.png`);
  writeFileSync(file,bytes);
  const rows=await recognizeCardFile(file);
  try {
    const evidence=assertShareBitmapText(rows,state.data,mode);
    writeFileSync(file+".json",JSON.stringify({rows,state,evidence},null,2));
    return evidence;
  } catch(error) {
    writeFileSync(file+".json",JSON.stringify({rows,state,error:error.message},null,2));
    throw error;
  }
}
async function modeStyle(p, label) {
  return dialog(p)
    .getByText(label, { exact: true })
    .evaluate((e) => {
      for (
        let n = e;
        n && n.getAttribute("role") !== "dialog";
        n = n.parentElement
      ) {
        const s = getComputedStyle(n);
        if (parseFloat(s.borderTopWidth) > 0) return s.borderTopColor;
      }
      throw Error("Visible mode selection border unavailable");
    });
}
async function changeMode(p, mode) {
  const before = (await shareState(p)).config.pnlDisplayMode;
  if (before === mode) return bitmap(p);
  const original = await bitmap(p);
  await dialog(p)
    .getByText(mode === "roe" ? "收益率" : "收益额", { exact: true })
    .click();
  await pollForm(
    () => shareState(p),
    (s) => s.config.pnlDisplayMode === mode,
    "Selected share mode",
  );
  await pollForm(
    () => ui(p, "preview").getAttribute("src"),
    (src) => src !== original.src,
    "Painted preview updates after mode change",
  );
  return bitmap(p);
}
const checkSpotShare = (p, requireStable=false)=>withHoldings(p,async()=>{
      await showAllHoldings(p);
      const before=await holdingsEvidence(p),shareKey='perps.perp-balance-row-share-button';
      const stableRows=before.rows.filter(r=>['USDC','USDT','USDB','USDH'].includes(r.item.rawCoin));
      for(const r of stableRows)
        assert.equal((await holdingControl(p,r.item.rawCoin,shareKey)).count,0,'An actual present stable holding has no share control');
      let selected;
      for(const r of before.rows.filter(r=>!['USDC','USDT','USDB','USDH'].includes(r.item.rawCoin))) {
        const e=rawHoldingExpectation(before,r.item.rawCoin);
        if(e.pnl!==null&&Number(e.pnl)!==0) {
          const control=await holdingControl(p,r.item.rawCoin,shareKey);
          assert.equal(control.count,1,'Profitable/loss spot holding has actual share entry');
          selected={row:r,node:control.node};break;
        }
      }
      if(!selected)throw new SampleUnavailable('需要有成本且现货盈亏非零的当前页既有资产；不真实买入造样本');
      const coin=selected.row.item.rawCoin,raw=before.raw.balances.find(r=>r.coin===coin);
      let primary;
      try {
        await selected.node.click();await dialog(p).waitFor({state:'visible'});
        const initial=await shareState(p),after=await holdingsEvidence(p);
        assert.equal(initial.data.tokenDisplayName,selected.row.cells.coin.text,'Card display token matches clicked actual spot row');
        const markets=before.universes.filter(u=>u.baseName===coin&&u.quoteName==='USDC');
        assert.equal(markets.length,1,'Unique independent USDC mark market');
        const marks=[...new Set([before.prices[markets[0].name]?.markPx,after.prices[markets[0].name]?.markPx].filter(Boolean))];
        const checks=marks.map(mark=>{try {assertSpotShareSource(initial.data,raw,mark);return {mark,passed:true};}catch(e){return {mark,passed:false,error:e.message};}});
        assert.ok(checks.some(c=>c.passed),`Frozen spot card must match a raw mark captured immediately around click: ${JSON.stringify(checks)}`);
        const hashes={};
        for(const mode of ['pnl','roe','pnl','roe']) {
          const card=await changeMode(p,mode),current=await shareState(p);
          assert.deepEqual(current.data,initial.data,'Changing display mode preserves original spot data');
          await paintedText(p,card.bytes);
          if(hashes[mode])assert.equal(hashes[mode],card.hash,'Same-mode actual PNG stable');
          hashes[mode]=card.hash;
        }
        assert.notEqual(hashes.pnl,hashes.roe,'Different numeric display modes have distinct actual PNGs');
        if(requireStable&&!stableRows.length)throw new SampleUnavailable('现货分享与双模式已验证；D10-97仍缺实际可见的稳定币无分享按钮样本');
        return '现货行真实点击；原始现货数量/成本/标记价独立对账，实际PNG OCR核对币名、买入/卖出、平均成本/当前价及双模式盈亏，拒绝合约杠杆/多空/价格标签；真实PNG二维码一致';
      }catch(e){primary=e;await recordBeforeRestore(p,'spot-share-boundary',e);throw e;}
      finally {
        try {await closeFunds(p);assert.equal(await dialog(p).count(),0,'Actual spot sharing dialog closed');}
        catch(e){throw markRestoreFailure(primary,e,'关闭现货资产分享');}
      }
    });
export const shareDefinitions = [
  {
    id:'PERPS-DESKTOP-SHARE-004',
    name:'Desktop现货持有资产分享与双模式独立对账',
    rows:[
      row('D21-23','现货入口、原始成本/盈亏、实际PNG与双模式切换',p=>checkSpotShare(p)),
      row('D10-97','现货分享数据与双模式，实际稳定币行无分享按钮',p=>checkSpotShare(p,true),{
        complete:false,missing:'现货卡片数量展示、保存/复制及系统分享分支仍未覆盖，不计整条完整',
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-SHARE-001",
    name: "Desktop 当前持仓分享与模式切换",
    rows: [
      row(
        "D21-20",
        "当前持仓身份、默认收益率及真实PNG预览",
        (p) =>
          withShare(p, async (s, before) => {
            const card = await bitmap(p);
            writeFileSync(
              resolve(
                RESULTS_DIR,
                "perps-desktop-completion",
                "share-current-position.png",
              ),
              card.bytes,
            );
            await paintedText(p,card.bytes);
            assert.match(s.data.pnl, /^-?\d+(?:\.\d+)?$/u);
            assert.match(s.data.pnlPercent, /^-?\d+(?:\.\d+)?$/u);
            return `${before.coin}已有${Number(before.szi) > 0 ? "多" : "空"}仓；方向、成本、杠杆对账，默认roe，真实PNG可解码QR`;
          }),
        {
          complete: false,
          missing:
            "PNG文字已补本机OCR；当前账户仅一个既有方向样本，背景资源及标记价/盈亏原始持仓实时值的独立对账仍缺，不计整行已覆盖",
        },
      ),
      row(
        "D21-22",
        "收益额/收益率反复切换、单选边框和预览更新",
        (p) =>
          withShare(p, async (initial) => {
            const active = await modeStyle(p, "收益率"),
              inactive = await modeStyle(p, "收益额");
            assert.notEqual(active, inactive);
            const hashes = [];
            for (const mode of ["pnl", "roe", "pnl", "roe"]) {
              const card = await changeMode(p, mode),
                s = await shareState(p);
              assert.deepEqual(
                s.data,
                initial.data,
                "Switch preserves the original card data",
              );
              assert.equal(
                await modeStyle(p, mode === "roe" ? "收益率" : "收益额"),
                active,
              );
              assert.equal(
                await modeStyle(p, mode === "roe" ? "收益额" : "收益率"),
                inactive,
              );
              await paintedText(p,card.bytes);
              hashes.push(card.hash);
            }
            assert.equal(hashes[0], hashes[2]);
            assert.equal(hashes[1], hashes[3]);
            assert.notEqual(hashes[0], hashes[1]);
            return "四次模式切换单选、实际PNG的正负/美元精度/百分比/币名/方向杠杆/价格标签及数值逐项OCR核对，同模式hash一致且原卡数据不变";
          }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-SHARE-002",
    name: "Desktop 分享链接与真实剪贴板",
    rows: [
      row(
        "D21-52",
        "两模式连续复制、纯链接及真实QR一致",
        (p) =>
          withShare(p, async () => {
            const original = await p.evaluate(() =>
              navigator.clipboard.readText(),
            );
            const downloads = [],
              onDownload = (d) => downloads.push(d);
            p.on("download", onDownload);
            try {
              let link;
              for (const mode of ["roe", "pnl"]) {
                const card = await changeMode(p, mode);
                if (link) assert.equal(card.qr, link);
                else link = card.qr;
                for (let i = 0; i < 2; i++) {
                  const copy=ui(p,"copy"), beforeHover=await copy.elementHandle();
                  try{await copy.hover();await p.waitForTimeout(400);console.log('COPY_HOVER '+JSON.stringify({replaced:await beforeHover.evaluate(e=>!e.isConnected)}));}
                  finally{await beforeHover.dispose();}
                  await copy.click();
                  await pollForm(
                    () => p.evaluate(() => navigator.clipboard.readText()),
                    (value) => value === card.qr,
                    "Actual copied share link",
                  );
                  assert.ok(
                    (await activeToasts(p).allTextContents()).some((text) =>
                      /复制|copied/iu.test(text),
                    ),
                    "Visible copy feedback",
                  );
                  await p.waitForTimeout(550);
                }
              }
              assert.equal(downloads.length, 0, "Copy never downloads a card");
              assert.doesNotMatch(link, /[\s<>]|undefined/u);
              return "真实QR=四次实际剪贴板纯链接；模式不改变链接，有反馈且无下载";
            } finally {
              p.off("download", onDownload);
              await p.evaluate(
                (value) => navigator.clipboard.writeText(value),
                original,
              );
            }
          }),
        {
          complete: false,
          missing:
            "当前卡链接及模式一致已实测；所属OneKey ID邀请码所有权需独立账号/主邀请码原始数据核对，不计整行已覆盖",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-SHARE-003",
    name: "Desktop 分享PNG导出",
    rows: [
      row(
        "D21-32",
        "两模式逐次真实下载、PNG解码与QR核对",
        (p) =>
          withShare(p, async () => {
            const downloads = [],
              onDownload = (d) => downloads.push(d);
            p.on("download", onDownload);
            try {
              const hashes = [];
              for (const mode of ["pnl", "roe"]) {
                const card = await changeMode(p, mode);
                const file = resolve(
                  RESULTS_DIR,
                  "perps-desktop-completion",
                  `share-export-${mode}.png`,
                );
                const { bytes } = await captureDesktopDownload(
                  p,
                  { filename: /^onekey-position-\d+\.png$/u, output: file },
                  () => ui(p, "save").click(),
                );
                const meta = await sharp(bytes).metadata();
                assert.equal(meta.format, "png");
                assert.ok(meta.width >= 900 && meta.width === meta.height);
                assert.equal(await decodeRenderedQr(bytes), card.qr);
                await paintedText(p,bytes);
                hashes.push(createHash("sha256").update(bytes).digest("hex"));
              }
              assert.equal(downloads.length, 2);
              assert.notEqual(hashes[0], hashes[1]);
              return "收益额与收益率各导出1张真实PNG，可打开且QR正确、两个模式图片不同";
            } finally {
              p.off("download", onDownload);
            }
          }),
        {
          complete: false,
          missing:
            "真实下载PNG已补OCR核对两模式、符号、精度、币名/方向/杠杆/价格标签/数值和无面板控件；背景/币图标资源及全部邀请信息完整性仍缺独立像素oracle",
        },
      ),
    ],
  },
];
export const shareSuite = createDesktopRowSuite(shareDefinitions);
