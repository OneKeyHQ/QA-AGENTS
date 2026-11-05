// Render the actual funding breakdown with controlled records. Host layout and
// USD formatter are explicit seams, so pixel geometry/formatting need TF proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderer,evaluateSource,perpsUtils} from './source.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const host=name=>{const C=React.forwardRef(({children,...props},ref)=>React.createElement(name,{...props,ref},children));C.displayName=name;return C;};
const theme=Object.fromEntries(['green9','blue9','purple9','orange9','teal9','red9','pink9','neutral6','bgSubdued'].map(k=>[k,{val:k}]));
const constants=evaluateSource('packages/shared/types/hyperliquid/perp.constants.ts');
const utils=perpsUtils();
const stats=evaluateSource('packages/kit/src/views/Perp/components/Portfolio/portfolioStats.ts',{mocks:{'@onekeyhq/shared/src/utils/perpsUtils':utils,'@onekeyhq/shared/types/hyperliquid/perp.constants':constants}});
const components=Object.fromEntries(['Button','SizableText','Skeleton','Stack','XStack','YStack'].map(k=>[k,host(k)]));components.useTheme=()=>theme;
const {PerpFundingBreakdown}=evaluateSource('packages/kit/src/views/Perp/components/Portfolio/PerpFundingBreakdown.tsx',{mocks:{
 'react-intl':{useIntl:()=>({formatMessage:({id})=>id})},'react-native-svg':{__esModule:true,default:host('Svg'),Circle:host('Circle')},
 '@onekeyhq/components':components,'@onekeyhq/shared/src/locale':{ETranslations:new Proxy({},{get:(_,k)=>k})},
 '@onekeyhq/shared/src/platformEnv':{isNative:false},
 '@onekeyhq/shared/src/utils/perpsUtils':{parseDexCoin:utils.parseDexCoin,formatPerpsUsd:v=>`USD(${v})`},'./portfolioStats':stats,
}});
const record=(coin,usdc)=>({time:Date.now()-1000,delta:{coin,usdc:String(usdc),szi:'1',fundingRate:'0.0001'},hash:`qa-${coin}-${usdc}`});
async function mount(props){let tree;await renderer.act(async()=>tree=renderer.create(React.createElement(PerpFundingBreakdown,{timePeriod:'allTime',isLoading:false,isMobile:false,...props})));return tree;}
const nodes=(t,type)=>t.root.findAllByType(type);
const texts=t=>nodes(t,'SizableText').map(n=>n.children.join(''));
const visuals=t=>nodes(t,'Circle').filter(n=>n.props.strokeLinecap==='round');
const legend=t=>nodes(t,'XStack').filter(n=>typeof n.props.onPointerEnter==='function');
for(const direction of [1,-1])test(`D09-200/205 funding direction=${direction}: title total, exact shares and ring colors`,async()=>{
 const t=await mount({records:[record('BTC',direction*3),record('ETH',direction)]});try{
  const text=texts(t);assert.ok(text.includes('BTC 75.00%'));assert.ok(text.includes('ETH 25.00%'));assert.ok(text.includes('USD(4)'));assert.ok(text.includes('USD(0)'));
  assert.equal(nodes(t,'Svg').length,1,'Empty direction has no ring');assert.equal(visuals(t).length,2);assert.equal(visuals(t)[0].props.stroke,direction>0?'green9':'red9');
  assert.ok(visuals(t).every(n=>n.props.strokeOpacity===1&&n.props.strokeWidth===7));assert.equal(legend(t).length,2);
 }finally{await renderer.act(async()=>t.unmount());}
});
test('D09-201 >5 markets: five largest and gray Other; exactly five has no Other',async()=>{
 for(const count of [5,7]){const t=await mount({records:Array.from({length:count},(_,i)=>record(String.fromCharCode(65+i),count-i))});try{
  const rows=legend(t);assert.equal(rows.length,count===5?5:6);assert.equal(visuals(t).length,rows.length);
  assert.equal(texts(t).some(s=>s.startsWith('global_others ')),count>5);
  if(count>5){assert.equal(visuals(t).at(-1).props.stroke,'neutral6');assert.ok(texts(t).includes('USD(3)'));}
 }finally{await renderer.act(async()=>t.unmount());}}
});
test('D09-202 single market: 100.00%, one full ring and no Other',async()=>{
 const t=await mount({records:[record('BTC',2)]});try{assert.ok(texts(t).includes('BTC 100.00%'));assert.equal(visuals(t).length,1);const lengths=visuals(t)[0].props.strokeDasharray.split(' ').map(Number);assert.ok(lengths[0]>300);assert.ok(!texts(t).some(s=>s.startsWith('global_others')));}finally{await renderer.act(async()=>t.unmount());}
});
test('D09-204 empty: two zero rows, no graph/legend/trading statistics',async()=>{
 const t=await mount({records:[]});try{assert.deepEqual(texts(t),['perp_portfolio_funding_total_received__label','USD(0)','perp_portfolio_funding_total_paid__label','USD(0)']);assert.equal(nodes(t,'Svg').length,0);assert.equal(legend(t).length,0);}finally{await renderer.act(async()=>t.unmount());}
});
for(const hover of ['legend','arc'])test(`D09-209 ${hover} hover highlights one market, dims rest, leaving restores`,async()=>{
 const t=await mount({records:[record('BTC',3),record('ETH',1)]});try{
  const start=hover==='legend'?legend(t)[0].props.onPointerEnter:nodes(t,'Circle').find(n=>n.props.onMouseEnter).props.onMouseEnter;
  await renderer.act(async()=>start());assert.deepEqual(visuals(t).map(n=>n.props.strokeWidth),[10,7]);assert.deepEqual(visuals(t).map(n=>n.props.strokeOpacity),[1,0.28]);assert.deepEqual(legend(t).map(n=>n.props.opacity),[1,0.42]);
  const end=hover==='legend'?legend(t)[0].props.onPointerLeave:nodes(t,'Circle').find(n=>n.props.onMouseLeave).props.onMouseLeave;
  await renderer.act(async()=>end());assert.ok(visuals(t).every(n=>n.props.strokeWidth===7&&n.props.strokeOpacity===1));assert.ok(legend(t).every(n=>n.props.opacity===1));
 }finally{await renderer.act(async()=>t.unmount());}
});
test('D09-214 loading empty displays two complete skeleton cards then data',async()=>{
 const t=await mount({records:[],isLoading:true});try{assert.equal(nodes(t,'Skeleton').length,16);assert.equal(nodes(t,'Svg').length,0);await renderer.act(async()=>t.update(React.createElement(PerpFundingBreakdown,{records:[record('BTC',2)],timePeriod:'allTime',isLoading:false,isMobile:false})));assert.equal(nodes(t,'Skeleton').length,0);assert.equal(nodes(t,'Svg').length,1);}finally{await renderer.act(async()=>t.unmount());}
});
test('D09-215 failure displays retry; retry calls supplied refresh once',async()=>{
 let calls=0;const t=await mount({records:[],isError:true,onRetry:()=>calls++});try{assert.deepEqual(texts(t),['global_failed']);assert.equal(nodes(t,'Svg').length,0);const buttons=nodes(t,'Button');assert.equal(buttons.length,1);assert.equal(buttons[0].props.testID,'perp-funding-breakdown-retry');await renderer.act(async()=>buttons[0].props.onPress());assert.equal(calls,1);}finally{await renderer.act(async()=>t.unmount());}
});
test('D09-218 DEX display name ellipsis preserves raw identity and amount column',async()=>{
 const t=await mount({records:[record('xyz:LONG-TOKEN-NAME-123456',2)]});try{assert.ok(texts(t).includes('LONG-TOKEN-NAME-123456 100.00%'));const label=nodes(t,'SizableText').find(n=>n.children.join('').startsWith('LONG-TOKEN'));assert.equal(label.props.numberOfLines,1);assert.equal(label.props.ellipsizeMode,'tail');assert.equal(label.props.minWidth,0);assert.ok(texts(t).includes('USD(2)'));}finally{await renderer.act(async()=>t.unmount());}
});
for(const tiny of [0.00001,0.001,0.0049])test(`D09-219 tiny share ${tiny}: real share text, minimum arc and conserved circumference`,async()=>{
 const t=await mount({records:[record('BTC',1-tiny),record('ETH',tiny)]});try{assert.ok(texts(t).includes(`ETH ${(tiny*100).toFixed(2)}%`));const hits=nodes(t,'Circle').filter(n=>n.props.strokeOpacity===0.001);const lengths=hits.map(n=>Number(n.props.strokeDasharray.split(' ')[0]));assert.ok(lengths[1]>=14);assert.ok(Math.abs(lengths.reduce((a,b)=>a+b,0)-2*Math.PI*51)<1e-10);assert.ok(visuals(t).every(n=>Number(n.props.strokeDasharray.split(' ')[0])>0));}finally{await renderer.act(async()=>t.unmount());}
});
