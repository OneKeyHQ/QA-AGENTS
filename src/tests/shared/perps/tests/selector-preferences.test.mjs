import test from 'node:test';
import assert from 'node:assert/strict';
import {coherentSelectorState as ready} from '../selector-preferences.mjs';
const headers=Array.from({length:5},(_,i)=>({label:String(i)}));
test('empty favorites recommendation has no table header and is a valid restoration source',()=>assert.equal(ready({primary:'自选',secondary:null,headers:[],emptyFavorites:true}),true));
test('missing header without a proven recommendation is still unresolved',()=>assert.equal(ready({primary:'自选',secondary:null,headers:[],emptyFavorites:false}),false));
test('perp transition without its own category is rejected; complete render accepted',()=>{assert.equal(ready({primary:'永续合约',secondary:null,headers}),false);assert.equal(ready({primary:'永续合约',secondary:'全部',headers}),true);});
test('spot header render and populated favorites accepted; unknown and mixed empty render rejected',()=>{assert.equal(ready({primary:'现货',secondary:null,headers}),true);assert.equal(ready({primary:'自选',secondary:null,headers}),true);assert.equal(ready({primary:'自选',secondary:null,headers,emptyFavorites:true}),false);assert.equal(ready({primary:null,secondary:null,headers}),false);});
