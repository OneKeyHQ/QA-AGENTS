// Controlled raw-record fixtures execute the pinned product implementation.
// These are source logic assertions, not evidence of a TF UI fixture/account.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSource, perpsUtils } from './source.mjs';
const stats=evaluateSource('packages/kit/src/views/Perp/components/Portfolio/portfolioStats.ts',{mocks:{
 '@onekeyhq/shared/src/utils/perpsUtils':perpsUtils(),
 '@onekeyhq/shared/types/hyperliquid/perp.constants':evaluateSource('packages/shared/types/hyperliquid/perp.constants.ts'),
}});
const clean=x=>JSON.parse(JSON.stringify(x));
const now=Date.UTC(2026,9,29,12),hour=3600000,day=24*hour;
const funding=(offset,coin,usdc)=>({time:now+offset,hash:`qa-${offset}-${coin}`,delta:{coin,usdc:String(usdc),szi:'1',fundingRate:'0.0001'}});
const fill=(coin,pnl,overrides={})=>({coin,closedPnl:String(pnl),sz:'2',px:'100',fee:'0.1',feeToken:'USDC',time:now-1000,...overrides});
const calc=fills=>stats.buildPerpPortfolioFillsStats({fills,timePeriod:'allTime',now});
for(const [mmr,lev,used,expected] of [
 [50,25,80,'danger'],[20,10,70,'caution'],[20,4,50,'safe'],
 [20,10,50,'safe'],[31,4,50,'caution'],[31,10,50,'caution'],[61,4,50,'danger'],
 [30,5,60,'safe'],[30.00001,5,60,'caution'],[60,5,60,'caution'],[60.00001,5,60,'danger'],
 [20,5,60,'safe'],[20,5.00001,60,'safe'],[20,15,60,'safe'],[20,15.00001,60,'caution'],
 [20,5,85,'safe'],[20,5,85.00001,'safe'],
 [null,4,50,'safe'],[null,10,50,'caution'],[null,25,80,'danger'],
])test(`D09-123..128 风险边界 ${mmr}/${lev}/${used}→${expected}`,()=>{
 for(let i=0;i<3;i++)assert.equal(stats.computeAccountHealthRisk(mmr,lev,used).level,expected);
});
test('D09-95/99 空成交与只有账本活动：统计使用空值/0，不编造胜率',()=>{
 assert.deepEqual(clean(calc([])),{winRate:null,avgWin:null,avgLoss:null,feesPaid:0,volumeUsd:0,mostTraded:null,profitFactor:null,realizedPnl:0,spotRealizedPnl:0,totalTrades:0});
});
test('D09-96 仅盈利，D09-97 仅亏损和无平仓：分母与缺失项',()=>{
 const win=calc([fill('BTC',10),fill('ETH',30),fill('ETH',0)]);assert.equal(win.winRate,100);assert.equal(win.avgWin,20);assert.equal(win.avgLoss,null);assert.equal(win.profitFactor,null);assert.equal(win.totalTrades,3);
 const loss=calc([fill('BTC',-10),fill('ETH',-30)]);assert.equal(loss.winRate,0);assert.equal(loss.avgLoss,-20);assert.equal(loss.avgWin,null);assert.equal(loss.profitFactor,0);
 const open=calc([fill('BTC',0)]);assert.equal(open.winRate,null);assert.equal(open.avgWin,null);assert.equal(open.avgLoss,null);
});
test('D09-98/176/177 混合成交：严格按资产类型重算，手续费币种换算',()=>{
 const records=[fill('BTC',20),fill('xyz:BTC',-5),fill('@107',10,{feeToken:'HYPE',fee:'0.2',px:'50'})];
 const all=calc(records);assert.equal(all.totalTrades,3);assert.ok(Math.abs(all.winRate-200/3)<1e-10);assert.equal(all.avgWin,15);assert.equal(all.avgLoss,-5);assert.equal(all.profitFactor,6);assert.equal(all.realizedPnl,25);assert.equal(all.spotRealizedPnl,10);assert.equal(all.feesPaid,10.2);assert.equal(all.volumeUsd,500);
 const perps=stats.buildPerpPortfolioFillsStats({fills:records,timePeriod:'allTime',pnlType:'perps',now});assert.equal(perps.totalTrades,2);assert.equal(perps.realizedPnl,15);assert.equal(perps.spotRealizedPnl,0);
 const spot=stats.buildPerpPortfolioFillsStats({fills:records,timePeriod:'allTime',pnlType:'spot',now});assert.equal(spot.totalTrades,1);assert.equal(spot.realizedPnl,10);assert.equal(spot.feesPaid,10);
});
test('D09-100 null/非法成交盈亏不污染统计；非美元手续费缺失价格不当美元',()=>{
 const valid=fill('BTC',5),invalid=fill('ETH','NaN');assert.deepEqual(clean(calc([valid,invalid])),clean(calc([valid])));
 assert.equal(calc([fill('@107',0,{feeToken:'HYPE',fee:'0.2',px:'0'})]).feesPaid,0);
});
test('D09-201 分布前5+其他，恰好5无其他，同额按完整coin字母序',()=>{
 const records=['g','f','e','d','c','b','a'].map((c,i)=>funding(-hour,c,i===0?2:1));
 const rows=stats.buildFundingDirectionDistribution({records,timePeriod:'day',now}).received;
 assert.deepEqual(clean(rows),[{coin:'g',amount:2},{coin:'a',amount:1},{coin:'b',amount:1},{coin:'c',amount:1},{coin:'d',amount:1},{coin:'Other',amount:2}]);
 const five=stats.buildFundingDirectionDistribution({records:records.slice(0,5),timePeriod:'day',now}).received;assert.equal(five.length,5);assert.ok(!five.some(r=>r.coin==='Other'));
});
test('D09-202/204/205 单市场、空方向、零金额分别保留正确原始集合',()=>{
 const only=stats.buildFundingDirectionDistribution({records:[funding(-hour,'xyz:BTC',0.2),funding(-2*hour,'xyz:BTC',0.3),funding(-hour,'ETH',0)],timePeriod:'day',now});
 assert.deepEqual(clean(only),{received:[{coin:'xyz:BTC',amount:0.5}],paid:[]});
 assert.deepEqual(clean(stats.buildFundingDirectionDistribution({records:[],timePeriod:'day',now})),{received:[],paid:[]});
});
test('D09-207/226 24h、7d边界含端点，拒绝未来记录及无效金额',()=>{
 const records=[funding(-day+1,'BTC',1),funding(-day,'BTC',2),funding(-day-1,'ETH',4),funding(-7*day,'ETH',8),funding(-7*day-1,'SOL',16),funding(-hour,'BTC',-0.5),funding(1,'BTC',1000),funding(-hour,'BTC','NaN')];
 assert.deepEqual(clean(stats.buildFundingNetSummary({records,now})),{net24h:2.5,net7d:14.5,netAllTime:30.5});
 for(const timePeriod of ['day','week','month','allTime']){
  const hist=stats.buildFundingHistogramChartData({records,timePeriod,now});assert.ok(hist.every(([t,v])=>Number.isFinite(t)&&Number.isFinite(v)));
  const expected=timePeriod==='day'?2.5:timePeriod==='week'?14.5:30.5;assert.equal(hist.reduce((n,[,v])=>n+v,0),expected);
 }
});
for(const [timePeriod,count] of [['day',24],['week',7],['month',30],['allTime',30]])test(`D09-224 ${timePeriod} 分桶数量/首条起点/正负净额`,()=>{
 const records=[funding(-day/2,'BTC',2),funding(-day/2,'ETH',-1),funding(-hour,'BTC',-3)];
 const hist=stats.buildFundingHistogramChartData({records,timePeriod,now});assert.equal(hist.length,count);assert.equal(hist.reduce((n,[,v])=>n+v,0),-2);if(timePeriod==='allTime')assert.equal(hist[0][0],(now-day/2)/1000);
 assert.deepEqual(clean(stats.buildFundingHistogramChartData({records:[],timePeriod,now})),[]);
});
for(const [count,active,ratio,max] of [[7,7,0.45,12],[8,2,0.45,12],[8,3,0.4,10],[24,24,0.4,10],[25,5,0.4,10],[25,6,0.35,8]])test(`D09-225 桶数${count}/有效${active}→${ratio}`,()=>{
 const chartData=Array.from({length:count},(_,i)=>[i,i<active?1:0]);assert.deepEqual(clean(stats.resolveFundingHistogramStyle({chartData,isMobile:false})),{barWidthRatio:ratio,maxBarWidth:max});
});
