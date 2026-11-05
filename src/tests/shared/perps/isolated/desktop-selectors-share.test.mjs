// Actual pinned selector/control components. Host rendering is mocked; these
// assertions do not claim TF pixels, system sharing or successful downloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { React, renderer, evaluateSource, readSource } from './source.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const ETranslations=new Proxy({}, {get:(_,key)=>key});
const en=JSON.parse(readSource('packages/shared/src/locale/json/en_US.json'));
const translations={useIntl:()=>({formatMessage:({id})=>id==='Perps_BBO_Counterparty'?en['Perps.BBO_Counterparty']:id==='Perps_BBO_Queue'?en['Perps.BBO_Queue']:String(id)})};
const locale={ETranslations};
const plain=x=>JSON.parse(JSON.stringify(x));
const host=name=>{const C=({children,...props})=>React.createElement(name,props,children);C.displayName=name;return C;};
const Badge=host('badge');Badge.Text=host('badge-text');
const components={Badge,Icon:host('icon'),IconButton:host('icon-button'),SizableText:host('text'),XStack:host('x-stack'),YStack:host('y-stack'),Select:host('select')};
async function mount(Component, props){let tree;await renderer.act(async()=>{tree=renderer.create(React.createElement(Component,props));});return {get root(){return tree.root;},update:async p=>renderer.act(async()=>tree.update(React.createElement(Component,p))),close:async()=>renderer.act(async()=>tree.unmount())};}
const bboDisplay=evaluateSource('packages/kit/src/views/Perp/components/TradingPanel/selectors/bboDisplay.ts');
const {BBOSelector}=evaluateSource('packages/kit/src/views/Perp/components/TradingPanel/selectors/BBOSelector.tsx',{mocks:{
 'react-intl':translations,'@onekeyhq/components':components,'@onekeyhq/shared/src/locale':locale,
 '@onekeyhq/shared/src/errors/errors/localError':{OneKeyLocalError:class extends Error{constructor({message}){super(message);}}},'./bboDisplay':bboDisplay,
}});
for(const inputLike of [false,true])test(`D01-19/103 BBO desktop ${inputLike?'input':'normal'} four exact options and controlled check`,async()=>{
 let changed;const props={value:{type:'counterparty',offsetTicks:0},onChange:v=>changed=v,inputLike};const f=await mount(BBOSelector,props);
 try{const select=()=>f.root.findByType('select');assert.deepEqual(plain(select().props.items),[
 {label:'Counterparty 1',value:'counterparty-0'},{label:'Counterparty 5',value:'counterparty-5'},
 {label:'Queue 1',value:'queue-0'},{label:'Queue 5',value:'queue-5'}]);
 for(const [value,type,offsetTicks]of [['counterparty-0','counterparty',0],['counterparty-5','counterparty',5],['queue-0','queue',0],['queue-5','queue',5]]){
 await renderer.act(async()=>select().props.onChange(value));assert.deepEqual(plain(changed),{type,offsetTicks});await f.update({...props,value:changed});assert.equal(select().props.value,value);
 }await renderer.act(async()=>select().props.onChange(undefined));assert.equal(changed,null);
 }finally{await f.close();}
});
for(const invalid of ['bad','counterparty','foo-0','queue-1','queue--5','counterparty-NaN','queue-10'])test(`BBO parser fails closed for ${invalid}`,async()=>{let changes=0;const f=await mount(BBOSelector,{value:null,onChange:()=>changes++});try{assert.throws(()=>f.root.findByType('select').props.onChange(invalid),/Invalid BBO/u);assert.equal(changes,0);}finally{await f.close();}});
for(const disabled of [false,true])test(`BBO disabled=${disabled} propagates to select`,async()=>{const f=await mount(BBOSelector,{value:null,onChange:()=>{},disabled});try{assert.equal(f.root.findByType('select').props.disabled,disabled);}finally{await f.close();}});
const constants=evaluateSource('packages/kit/src/views/Perp/components/PositionShare/constants.ts',{mocks:{'@onekeyhq/shared/src/locale':locale}});
for(const [pnl,expected]of [['0','+< $0.01'],['.009','+< $0.01'],['-.009','-< $0.01'],['.01','+$0.01'],['-.01','-$0.01'],['123.459','+$123.45'],['-123.459','-$123.45'],['1000000000000000000.129','+$1000000000000000000.12']])test(`D21-22/24 share amount ${pnl}`,()=>{assert.equal(constants.getPnlDisplayInfo({pnl},'pnl'),expected);});
for(const [pnlPercent,expected]of [['0','+0.00%'],['.009','+0.01%'],['-.009','-0.01%'],['-12.345','-12.35%']])test(`D21-22/24 share ROE ${pnlPercent}`,()=>assert.equal(constants.getPnlDisplayInfo({pnlPercent},'roe'),expected));
for(const [mode,priceType,entry,mark]of [
 ['perp','mark','perp_position_entry_price','perp_position_mark_price'],['perp','exit','perp_position_entry_price','perp_position_exit_price'],['spot','mark','perp_spot_average_cost_price__title','perp_spot_current_price__title'],['spot','exit','perp_spot_average_cost_price__title','perp_spot_current_price__title'],
])test(`D21-20/21/23 price labels ${mode}/${priceType}`,()=>assert.deepEqual(plain(constants.getSharePriceLabelIds({mode,priceType})),{entryPriceLabelId:entry,markPriceLabelId:mark}));
for(const mode of ['perp','spot'])for(const side of ['long','short'])test(`D21-58/60 exact share draft semantic ${mode}/${side}`,()=>{
 const displayName='BTC & TEST / USD?';const text=constants.getDefaultShareText({side,mode,coin:'xyz:BTC',displayName});
 assert.equal(text,mode==='spot'?`Check out my ${side==='long'?'BUY':'SELL'} spot trade on ${displayName}! 🚀`:`Check out my ${side.toUpperCase()} position on ${displayName}! 🚀`);
});
for(const systemShare of [false,true])for(const loading of [false,true])test(`D21-22/36/39 control panel system=${systemShare} loading=${loading}`,async()=>{
 const {ControlPanel}=evaluateSource('packages/kit/src/views/Perp/components/PositionShare/ControlPanel.tsx',{mocks:{'react-intl':translations,'@onekeyhq/components':components,'@onekeyhq/shared/src/locale':locale,'@onekeyhq/kit/src/utils/shareUtils':{canShareImageToSystem:()=>systemShare}}});
 const invoked=[];let config={pnlDisplayMode:'roe',backgroundIndex:0,stickerIndex:null,customText:'fixture'};const props={config,isLoading:loading,onChange:v=>{config=v;},onSaveImage:()=>invoked.push('save'),onShareImage:()=>invoked.push('share'),onCopyLink:()=>invoked.push('copy'),onShareToX:()=>invoked.push('x')};const f=await mount(ControlPanel,props);
 try{let badges=f.root.findAllByType('badge');assert.deepEqual(badges.map(b=>b.props.borderColor),['$borderSubdued','$borderActive']);assert.ok(badges.every(b=>b.props.disabled===loading));
 const buttons=f.root.findAllByType('icon-button');assert.deepEqual(buttons.map(b=>b.props.icon),systemShare?['DownloadOutline','ShareOutline','LinkOutline','Xbrand']:['DownloadOutline','LinkOutline','Xbrand']);assert.ok(buttons.every(b=>b.props.disabled===loading));
 if(!loading){await renderer.act(async()=>badges[0].props.onPress());assert.deepEqual(plain(config),{...props.config,pnlDisplayMode:'pnl'});await f.update({...props,config});badges=f.root.findAllByType('badge');assert.deepEqual(badges.map(b=>b.props.borderColor),['$borderActive','$borderSubdued']);for(const button of buttons)await renderer.act(async()=>button.props.onPress());assert.deepEqual(invoked,systemShare?['save','share','copy','x']:['save','copy','x']);}
 }finally{await f.close();}
});
