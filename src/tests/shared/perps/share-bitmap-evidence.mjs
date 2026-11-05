import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const compact = value => String(value).replace(/\s/gu, '');
function parts(value) {
  assert.match(String(value), /^-?\d+(?:\.\d+)?$/u, 'Exact plain card decimal');
  const negative = String(value).startsWith('-');
  const [whole, fraction = ''] = String(value).replace(/^-/, '').split('.');
  const normalizedWhole = BigInt(whole).toString(), normalizedFraction = fraction.replace(/0+$/u, '');
  return {negative: negative && BigInt(whole + fraction) !== 0n, whole: normalizedWhole, fraction: normalizedFraction};
}
export function expectedSharePnl(data, mode) {
  assert.ok(['pnl', 'roe'].includes(mode));
  const p = parts(mode === 'pnl' ? data.pnl : data.pnlPercent), sign = p.negative ? '-' : '+';
  if (mode === 'pnl') {
    if (p.whole === '0' && p.fraction.padEnd(2,'0').slice(0,2) === '00') return `${sign}< $0.01`;
    return `${sign}$${p.whole}${p.fraction ? '.' + p.fraction.slice(0, 2) : ''}`;
  }
  const hundredths = BigInt(p.whole) * 100n + BigInt(p.fraction.padEnd(2, '0').slice(0, 2)) + (Number(p.fraction[2] ?? 0) >= 5 ? 1n : 0n);
  return `${sign}${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}%`;
}
export async function recognizeCardFile(file) {
  assert.equal(process.platform, 'darwin', 'This local OCR adapter requires macOS Vision');
  const {stdout} = await run('/usr/bin/swift', [fileURLToPath(new URL('../../helpers/recognize-image-text.swift', import.meta.url)), file], {timeout:30000, maxBuffer:1024*1024});
  const rows = JSON.parse(stdout);
  assert.ok(Array.isArray(rows) && rows.length > 0, 'Image OCR must return actual text');
  return rows;
}
export function assertShareBitmapText(rows, data, mode) {
  assert.ok(Array.isArray(rows) && rows.length >= 6, 'Recognized card text required');
  for (const r of rows) {
    assert.ok(typeof r.text === 'string' && r.text.length > 0);
    assert.ok([r.x,r.y,r.width,r.height].every(Number.isFinite));
    assert.ok(r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x+r.width <= 1.001 && r.y+r.height <= 1.001, 'Text must fit the actual bitmap');
    assert.doesNotMatch(r.text, /NaN|Infinity/u);
    assert.ok(!['收益率','收益额','保存图片','复制链接'].includes(compact(r.text)), 'Panel controls must not be painted into the card');
  }
  const text = rows.map(r=>compact(r.text));
  assert.equal(text.filter(t=>t === (data.tokenDisplayName || data.token)).length, 1, 'Painted token identity');
  const spot=data.mode==='spot';
  if(spot) {
    assert.ok(text.includes(data.side==='long'?'买入':'卖出'),'Painted spot side');
    for(const t of text)assert.doesNotMatch(t,/做多|做空|\d+(?:\.\d+)?X|开仓价格|平仓价格|标记价格/u,'Spot bitmap must not contain contract direction, leverage or labels');
  }else assert.ok(text.includes(`${data.side === 'long' ? '做多' : '做空'}${data.leverage}X`), 'Painted direction and leverage');
  const prominent = rows.filter(r=>r.y >= 0.27 && r.y < 0.50 && r.height >= 0.04);
  assert.equal(prominent.length, 1, 'One prominent painted PnL value');
  assert.equal(compact(prominent[0].text), compact(expectedSharePnl(data,mode)), 'Painted PnL sign, precision and mode');
  const readPrice = (label, expected) => {
    const labels = rows.filter(r=>compact(r.text) === label);
    assert.equal(labels.length,1,`Painted ${label} label`);
    const box=labels[0], values=rows.filter(r=>r.y > box.y+box.height && r.y < box.y+0.11 && Math.abs(r.x-box.x)<0.025 && /^[\d.,]+$/u.test(r.text));
    assert.equal(values.length,1,`One price below ${label}`);
    assert.equal(values[0].text, String(expected),`Painted ${label} binds to this card`);
    return values[0].text;
  };
  return {mode, pnl:prominent[0].text, token:data.tokenDisplayName||data.token,
    entry:readPrice(spot?'平均成本价格':'开仓价格',data.entryPrice), mark:readPrice(spot?'当前价格':data.priceType === 'exit' ? '平仓价格' : '标记价格',data.markPrice)};
}
