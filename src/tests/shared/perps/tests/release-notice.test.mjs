import test from 'node:test';
import assert from 'node:assert/strict';
import {dismissReleaseNotice} from '../release-notice.mjs';
function environment(text){const calls=[];const target={filter:()=>target,count:async()=>text.includes('OneKey 再升级')?1:0,locator:()=>({filter:()=>({count:async()=>1,click:async()=>calls.push('close')})}),waitFor:async()=>calls.push('hidden')};return{calls,page:{getByRole:()=>target}};}
test('only the release notice is dismissed; unrelated dialogs are preserved',async()=>{
 for(const text of ['启用交易','确认反手','输入密码','在设备上输入 PIN 码']){const e=environment(text);await dismissReleaseNotice(e.page);assert.deepEqual(e.calls,[]);}
 const e=environment('OneKey 再升级！立即更新');await dismissReleaseNotice(e.page);assert.deepEqual(e.calls,['close','hidden']);
});
