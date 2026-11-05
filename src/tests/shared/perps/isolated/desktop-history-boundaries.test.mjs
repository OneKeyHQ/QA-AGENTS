// D17-18/19/20/22/29/41 and D09 funding list/export branches.
// Executes pinned production functions against explicit records, never a wallet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSource, perpsUtils } from './source.mjs';
const utils=perpsUtils(), plain=x=>JSON.parse(JSON.stringify(x));
const funding=evaluateSource('packages/kit/src/views/Perp/components/OrderInfoPanel/fundingHistoryDisplay.ts',{mocks:{
 '@onekeyhq/shared/src/errors':{OneKeyLocalError:Error},'@onekeyhq/shared/src/utils/perpsUtils':utils,
}});
const trade=evaluateSource('packages/kit/src/views/Perp/components/OrderInfoPanel/Components/tradeFillDisplay.ts',{mocks:{
 '@onekeyhq/shared/src/locale':{ETranslations:new Proxy({},{get:(_,k)=>k})},
 '@onekeyhq/shared/src/utils/numberUtils':{formatLocalizedNumberString:String,numberFormat:String},
 '@onekeyhq/shared/src/utils/perpsUtils':utils,'../utils':{getFillDirectionDisplayInfo:()=>{throw Error('Direction renderer outside this fixture');}},
}});
const fills=[
 {tid:'native-buy',coin:'BTC',side:'B'}, {tid:'native-sell',coin:'BTC',side:'A'},
 {tid:'dex-buy',coin:'xyz:BTC',side:'B'}, {tid:'dex-sell',coin:'xyz:BTC',side:'A'},
 {tid:'spot-usdc-buy',coin:'@1',side:'B'}, {tid:'spot-usdc-sell',coin:'@1',side:'A'},
 {tid:'spot-usdh-buy',coin:'@2',side:'B'}, {tid:'spot-usdh-sell',coin:'@2',side:'A'},
 {tid:'spot-eth-buy',coin:'@3',side:'B'},
];
const pairs={'@1':'UBTC/USDC','@2':'UBTC/USDH','@3':'UETH/USDC'};
// Expectations list identities, not an implementation-shaped filter predicate.
const expected={
 all:['native-buy','native-sell','dex-buy','dex-sell','spot-usdc-buy','spot-usdc-sell','spot-usdh-buy','spot-usdh-sell','spot-eth-buy'],
 perp:['native-buy','native-sell','dex-buy','dex-sell'],
 spot:['spot-usdc-buy','spot-usdc-sell','spot-usdh-buy','spot-usdh-sell','spot-eth-buy'],
 BTC:['native-buy','native-sell'],'xyz:BTC':['dex-buy','dex-sell'],
 'spot:BTC':['spot-usdc-buy','spot-usdc-sell','spot-usdh-buy','spot-usdh-sell'],
 'spot:ETH':['spot-eth-buy'], '@1':['spot-usdc-buy','spot-usdc-sell'], unknown:[],
};
for(const type of ['all','perp','spot'])for(const side of ['all','long','short'])for(const market of [undefined,'BTC','xyz:BTC','spot:BTC','spot:ETH','active','unknown']){
 test(`D17-18/19/20 intersection ${type}/${side}/${market??'all'}`,()=>{
  const typeSet=new Set(expected[type]),marketSet=new Set(market===undefined?expected.all:expected[market==='active'?'@1':market]);
  const sideSet=new Set(side==='all'?expected.all:side==='long'?['native-buy','dex-buy','spot-usdc-buy','spot-usdh-buy','spot-eth-buy']:['native-sell','dex-sell','spot-usdc-sell','spot-usdh-sell']);
  const want=expected.all.filter(id=>typeSet.has(id)&&marketSet.has(id)&&sideSet.has(id));
  assert.deepEqual(plain(trade.filterTradeHistory(fills,{type,side,market},'@1',pairs).map(x=>x.tid)),want);
 });
}
test('D17-19 active market follows exact quote pair; fixed spot market aggregates quotes',()=>{
 const f={type:'all',side:'all',market:'active'};
 assert.deepEqual(plain(trade.filterTradeHistory(fills,f,'@1',pairs).map(x=>x.tid)),expected['@1']);
 assert.deepEqual(plain(trade.filterTradeHistory(fills,f,'@2',pairs).map(x=>x.tid)),['spot-usdh-buy','spot-usdh-sell']);
 assert.deepEqual(plain(trade.filterTradeHistory(fills,{...f,market:'spot:BTC'},'ETH',pairs).map(x=>x.tid)),expected['spot:BTC']);
});
test('D17-20/22 delayed spot metadata has no unstable raw @ filters; complete metadata merges quotes',()=>{
 const initial=trade.getTradeHistoryMarketOptions(fills,{},'现货');assert.deepEqual(plain(initial.map(x=>x.coin).sort()),['BTC','xyz:BTC']);
 const loaded=plain(trade.getTradeHistoryMarketOptions(fills,pairs,'现货'));
 assert.equal(loaded.filter(x=>x.coin==='spot:BTC').length,1);assert.equal(loaded.find(x=>x.coin==='spot:BTC').label,'BTC (现货)');
 assert.equal(loaded.find(x=>x.coin==='xyz:BTC').label,'BTC (xyz)');
 assert.deepEqual(plain(trade.getTradeHistoryMarketOptions(fills,pairs,'现货')),loaded);
});
for(const [feeToken,want] of [['USDC','8'],[undefined,'8'],['UBTC','10'],['USDT','10']])test(`D17-29 fee unit ${feeToken}`,()=>assert.equal(trade.getTradeFillClosePnlBN({closedPnl:'10',fee:'2',feeToken}).toFixed(),want));
for(const [fill,want] of [
 [{coin:'BTC',closedPnl:'1'},true],[{coin:'BTC',closedPnl:'-1'},true],[{coin:'BTC',closedPnl:'0'},false],
 [{coin:'@1',closedPnl:'1'},false],[{coin:'UBTC/USDC',closedPnl:'1'},false],
 [{coin:'BTC',closedPnl:'1',liquidation:{liquidatedUser:'x'}},false],
])test(`D17-41 share eligibility ${JSON.stringify(fill)}`,()=>assert.equal(trade.canShareTradeFill(fill),want));
const record=(hash,coin,szi,usdc,time=1700000000000)=>({hash,time,delta:{coin,szi,usdc,fundingRate:'0.00000012'}});
const records=[record('b','BTC','1','0.125'),record('a','BTC','-2','-0.25'),record('d','xyz:BTC','3','0.5'),record('c','ETH','0','0')];
for(const sideFilter of ['all','long','short'])for(const marketFilter of [undefined,'BTC','xyz:BTC','ETH','unknown'])test(`D09-242/243/244 funding ${sideFilter}/${marketFilter??'all'}`,()=>{
 const side={all:['b','a','d','c'],long:['b','d'],short:['a']}[sideFilter],market=marketFilter===undefined?['b','a','d','c']:{BTC:['b','a'],'xyz:BTC':['d'],ETH:['c'],unknown:[]}[marketFilter];
 const want=['b','a','d','c'].filter(x=>side.includes(x)&&market.includes(x));
 assert.deepEqual(plain(funding.filterFundingHistoryRecords({records,sideFilter,marketFilter}).map(x=>x.hash)),want);
});
test('D09-250/251 funding export intersection, raw decimals, deterministic order and payment token',()=>{
 const data=plain(funding.buildFundingHistoryExportRecords({records,sideFilter:'long',marketFilter:undefined,longLabel:'做多',shortLabel:'做空',paymentTokens:{BTC:'USDC','xyz:BTC':'USDH',ETH:'USDC'}}));
 assert.deepEqual(data,[
  {time:'2023-11-14T22:13:20.000Z',market:'BTC (xyz)',size:'3',side:'做多',payment:'0.5',paymentToken:'USDH',rate:'0.000012%'},
  {time:'2023-11-14T22:13:20.000Z',market:'BTC',size:'1',side:'做多',payment:'0.125',paymentToken:'USDC',rate:'0.000012%'},
 ]);
 assert.throws(()=>funding.buildFundingHistoryExportRecords({records,sideFilter:'long',longLabel:'做多',shortLabel:'做空',paymentTokens:{BTC:'USDC'}}),/metadata is unavailable/u);
});
for(const [rate,want]of[['0.000099','0.009900%'],['0.0001','0.0100%'],['-0.0001','-0.0100%'],['NaN','--']])test(`D09-258 rate ${rate}`,()=>assert.equal(funding.formatFundingHistoryRate(rate),want));
test('D09-259 zero signed size has neutral side and neutral zero payment',()=>{assert.equal(funding.getFundingHistorySide('0'),'none');assert.deepEqual(plain(funding.getFundingHistoryPaymentPresentation('0')),{absoluteAmount:'0',color:'$text',sign:''});});
for(const prefix of ['=','+','-','@','\t','\r'])test(`D09-263 spreadsheet formula prefix ${JSON.stringify(prefix)}`,()=>{
 const rows=funding.buildFundingHistoryExportRecords({records:[record('x',`${prefix}TOKEN`,'1','-0.1')],sideFilter:'all',longLabel:`${prefix}LONG`,shortLabel:'SHORT',paymentTokens:{[`${prefix}TOKEN`]:`${prefix}USD`}});
 assert.equal(rows[0].market,`'${prefix}TOKEN`);assert.equal(rows[0].side,`'${prefix}LONG`);assert.equal(rows[0].paymentToken,`'${prefix}USD`);assert.equal(rows[0].payment,'-0.1','Numeric signed values must remain numeric');
});
