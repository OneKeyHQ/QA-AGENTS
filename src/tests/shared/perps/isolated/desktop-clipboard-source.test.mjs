// Actual pinned useClipboard hook with an explicit timer/clipboard sink.
// This characterizes asynchronous copy; live OS clipboard remains a separate test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderer,evaluateSource} from './source.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('D14-47 copy toast precedes the real 200ms clipboard write; empty text never writes',async()=>{
 const jobs=[],writes=[],toasts=[];
 const {useClipboard}=evaluateSource('packages/components/src/hooks/useClipboard.tsx',{globals:{setTimeout:(fn,delay)=>jobs.push({fn,delay})},mocks:{
  'expo-clipboard':{getStringAsync:async()=>'',setStringAsync:async value=>writes.push(value)},
  'react-intl':{useIntl:()=>({formatMessage:({id})=>id})},
  'use-debounce':{useDebouncedCallback:fn=>fn},
  '@onekeyhq/shared/src/locale':{ETranslations:new Proxy({},{get:(_,key)=>key})},
  '@onekeyhq/shared/src/platformEnv':{isNativeAndroid:false,isExtensionUiPopup:false,isExtensionUiSidePanel:false},
  '@onekeyhq/shared/src/utils/openUrlUtils':{openSettings:()=>{throw Error('Unexpected settings action');}},
  '@onekeyhq/shared/src/utils/uriUtils':{ensureHttpsPrefix:value=>value},
  '../actions/Toast':{Toast:{success:payload=>toasts.push(payload),warning:()=>{throw Error('Unexpected Android warning');}}},
  '../primitives/Button':{Button:()=>null},
 }});
 let api,tree;function Harness(){api=useClipboard();return null;}
 try{
  await renderer.act(async()=>{tree=renderer.create(React.createElement(Harness));});
  await renderer.act(async()=>api.copyText('0x'+'a'.repeat(40)));
  assert.equal(toasts.length,1);assert.equal(writes.length,0);assert.deepEqual(jobs.map(j=>j.delay),[200]);
  await jobs.shift().fn();assert.deepEqual(writes,['0x'+'a'.repeat(40)]);
  api.copyText('');assert.equal(jobs.length,0);assert.equal(toasts.length,1);
 }finally{if(tree)await renderer.act(async()=>tree.unmount());}
});
