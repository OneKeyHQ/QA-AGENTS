import test from 'node:test';
import assert from 'node:assert/strict';
const tabs=[{tabId:'hot',name:'热门',tokens:['BTC','ETH']}];
const window=()=>({serverBefore:tabs,serverAfter:tabs,appliedBefore:tabs,appliedAfter:tabs});
test('same config window still rejects missing or extra category members',async()=>{
 const {assertSearchCategoryWindow}=await import('../search-category-window.mjs');
 assertSearchCategoryWindow({...window(),actual:['BTC','ETH'],coins:new Set(['BTC','ETH','SOL']),name:'热门'});
 for(const actual of [['BTC'],['BTC','ETH','SOL']]) assert.throws(()=>assertSearchCategoryWindow({...window(),actual,coins:new Set(['BTC','ETH','SOL']),name:'热门'}),/Configured category/);
});
test('a changing server snapshot or unapplied config is inconclusive rather than passed',async()=>{
 const {assertSearchCategoryWindow,SearchCategoryWindowChanged}=await import('../search-category-window.mjs');
 const changed=[{...tabs[0],tokens:['BTC','SOL']}];
 for(const field of ['serverAfter','appliedBefore','appliedAfter']) assert.throws(()=>assertSearchCategoryWindow({...window(),[field]:changed,actual:['BTC','ETH'],coins:new Set(['BTC','ETH','SOL']),name:'热门'}),SearchCategoryWindowChanged);
});
test('raw config projection must find the named atom in the committed owner, not derived rows',async()=>{
 const {projectAppliedSearchCategories}=await import('../search-category-window.mjs');
 const named={type:{name:'BasePerpTokenSelectorContent'},memoizedState:{memoizedState:[tabs,{}, {name:'perpTokenSelectorTabsAtom'}]}};
 assert.deepEqual(projectAppliedSearchCategories(named),tabs);
 assert.throws(()=>projectAppliedSearchCategories({...named,memoizedState:{memoizedState:[tabs,{}, {name:'renderedRows'}]}}),/raw category atom/);
});
