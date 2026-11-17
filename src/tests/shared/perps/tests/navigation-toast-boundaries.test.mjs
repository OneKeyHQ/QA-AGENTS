import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {perpsLandingSnapshot} from '../../../helpers/pages/perps.mjs';
import {dismissCurrentValidationToasts} from '../desktop-form-boundaries.mjs';
test('retained Perps under CSS hidden ancestor cannot prove navigation',()=>{
 const dom=new JSDOM('<main style="visibility:hidden"><div data-testid="perp-token-selector">BTCUSDC</div></main>',{runScripts:'outside-only'});const w=dom.window;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent}});w.HTMLElement.prototype.getBoundingClientRect=()=>({width:100,height:20});w.HTMLElement.prototype.checkVisibility=function(){for(let n=this;n;n=n.parentElement){const s=w.getComputedStyle(n);if(s.visibility==='hidden'||s.display==='none'||s.opacity==='0')return false;}return true;};
 const read=()=>w.eval(`(${perpsLandingSnapshot.toString()})()`);assert.equal(read().isPerps,false);w.document.querySelector('main').style.visibility='visible';assert.equal(read().isPerps,true);w.document.querySelector('main').style.opacity='0';assert.equal(read().isPerps,false);dom.window.close();
});
test('toast cleanup clicks each live close control once; removed nodes cannot satisfy next assertion',()=>{
 const dom=new JSDOM('<li role="status" data-removed="true"><button data-close-button="true"></button></li><li role="status" data-removed="false"><button data-close-button="true"></button></li>');let calls=0;for(const b of dom.window.document.querySelectorAll('button'))b.addEventListener('click',()=>{calls++;b.parentElement.dataset.removed='true';});
 const nodes=[...dom.window.document.querySelectorAll('[role="status"]')];assert.equal(dismissCurrentValidationToasts(nodes),1);assert.equal(calls,1);assert.equal(dom.window.document.querySelectorAll('[role="status"]:not([data-removed="true"])').length,0);assert.equal(dismissCurrentValidationToasts(nodes),0);dom.window.close();
});
test('non-dismissible active toast stops validation instead of reusing a stale notice',()=>{const d=new JSDOM('<li role="status"></li>');assert.throws(()=>dismissCurrentValidationToasts([...d.window.document.querySelectorAll('li')]),/no close/);d.window.close();});
