// An asynchronous release notice can appear after a real shell reload. Close
// only this identified informational notice, never its update/confirm action.
import {readFileSync} from 'node:fs';
const closeSelector=JSON.parse(readFileSync(new URL('../../../../shared/ui-semantic-map.json',import.meta.url))).elements['perps.overlay.dialog_close'].primary;
export async function dismissReleaseNotice(page){
 const notice=page.getByRole('dialog').filter({visible:true}).filter({hasText:/OneKey 再升级/u});
 const count=await notice.count();if(!count)return;
 if(count!==1)throw Error('Ambiguous OneKey release notice');
 const close=notice.locator(closeSelector).filter({visible:true});
 if(await close.count()!==1)throw Error('Release notice close control unavailable');
 await close.click();await notice.waitFor({state:'hidden'});
}
