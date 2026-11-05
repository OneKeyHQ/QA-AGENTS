import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
test('F02 Tooltip 读取限于投资组合弹窗，日期/标签/数值必须来自同一个可见框',async()=>{
  const {portfolioTooltipSnapshot}=await import('../portfolio-assertions.mjs');
  const dom=new JSDOM(`<div id="portfolio"><div id="chart" data-box="0,0,500,200"><canvas data-box="0,0,500,200"></canvas></div></div><div style="position:absolute;pointer-events:none" data-box="0,0,200,60"><span>10/29 10:00</span><span>净值</span><span>$999</span></div>`,{runScripts:'outside-only'});
  const {window}=dom;window.HTMLElement.prototype.getBoundingClientRect=function(){const [x,y,width,height]=(this.dataset.box||'0,0,100,20').split(',').map(Number);return {x,y,width,height,right:x+width,bottom:y+height};};
  const read=()=>window.eval(`(${portfolioTooltipSnapshot.toString()})(document.querySelector('#portfolio'))`);
  assert.equal(read(),null,'An unrelated external dollar tooltip must not satisfy the chart assertion');
  window.document.getElementById('chart').insertAdjacentHTML('afterbegin','<div id="tip" style="position:absolute;pointer-events:none" data-box="10,5,200,60"><span>10/29 10:00</span><span>净值</span><span>$1.00</span></div>');
  const value=read();assert.equal(value.value,'$1.00');assert.equal(value.label,'净值');assert.equal(value.time,'10/29 10:00');
  window.document.getElementById('tip').style.display='none';assert.equal(read(),null);
  dom.window.close();
});
