import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMinimumValidationStates} from '../desktop-form-boundaries.mjs';
const state={activeTradeInstrument:{coin:'BTC'},computedSizeForSide:{toFixed:()=>'.01'},effectivePriceBN:{toFixed:()=> '100'},formData:{type:'limit',price:'100'},isMinimumOrderNotMetForSide:true,isSpot:false,resolvedSizeInputUnit:'usd',side:'long'};
function component(count,at) {
 const hooks=Array.from({length:count},()=>({memoizedState:null,next:null}));
 hooks.forEach((h,i)=>h.next=hooks[i+1]??null);
 if(at!==undefined)hooks[at].memoizedState={current:state};
 return {type:{displayName:'SideButtonInternal'},memoizedState:hooks[0],return:null};
}
test('reads the live TF minimum guard beyond 400 hooks without losing the exact button state',()=>{
 const values=projectMinimumValidationStates(component(500,472));
 assert.equal(values.length,1);assert.equal(values[0].coin,'BTC');assert.equal(values[0].quantity,'.01');assert.equal(values[0].belowMinimum,true);
});
test('does not silently accept a cyclic or unbounded hook chain',()=>{
 const cyclic=component(3);cyclic.memoizedState.next.next.next=cyclic.memoizedState;
 assert.throws(()=>projectMinimumValidationStates(cyclic),/hook/i);
 assert.throws(()=>projectMinimumValidationStates(component(4097)),/hook/i);
});
