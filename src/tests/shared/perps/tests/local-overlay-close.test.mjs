import test from 'node:test';
import assert from 'node:assert/strict';
import {closeLocalOverlay} from '../../../helpers/local-overlay-close.mjs';
test('waits for asynchronous Escape close before touching a disappearing backdrop',async()=>{
  let open=true,clicked=0;
  await closeLocalOverlay({isOpen:async()=>open,escape:async()=>{},waitHidden:async()=>{open=false},clickBackdrop:async()=>{clicked++;throw Error('detached')}});
  assert.equal(clicked,0);assert.equal(open,false);
});
test('backdrop detach is accepted only after independently proving overlay absent',async()=>{
  let open=true;
  const options={isOpen:async()=>open,escape:async()=>{},waitHidden:async()=>{if(open)throw Error('still visible')},clickBackdrop:async()=>{open=false;throw Error('detached')}};
  await closeLocalOverlay(options);
  open=true;
  await assert.rejects(closeLocalOverlay({...options,clickBackdrop:async()=>{throw Error('blocked')}}),/blocked/);
});
