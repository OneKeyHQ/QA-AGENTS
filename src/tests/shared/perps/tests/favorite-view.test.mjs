import test from 'node:test';
import assert from 'node:assert/strict';
import { coherentFavoriteView } from '../favorite-view.mjs';
const ready={selected:'自选',query:'',stars:[true,true],recommended:false,topCount:24};
test('favorites requires both the selected tab and its committed favorite rows',()=>{
  assert.equal(coherentFavoriteView(ready),true);
  assert.equal(coherentFavoriteView({...ready,selected:'永续合约'}),false);
  assert.equal(coherentFavoriteView({...ready,stars:[true,false]}),false);
  assert.equal(coherentFavoriteView({...ready,query:'BTC'}),false);
  assert.equal(coherentFavoriteView({...ready,topCount:null}),true);
});
test('transient empty rows cannot erase a nonempty baseline',()=>{
  assert.equal(coherentFavoriteView({...ready,stars:[],recommended:false}),false);
  assert.equal(coherentFavoriteView({...ready,stars:[],recommended:true}),false);
  assert.equal(coherentFavoriteView({...ready,stars:[],recommended:true,topCount:0}),true);
});
