import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFundingCsv, fundingRateText, assertFundingCsv } from '../funding-csv-evidence.mjs';
import {fundingSettlementTokens} from '../public-market-oracle.mjs';
const records=[
  {time:1700000000000,hash:'a',delta:{coin:'BTC',szi:'-0.0100',usdc:'-0.000200',fundingRate:'-0.00000345'}},
  {time:1700000001000,hash:'b',delta:{coin:'xyz:ABC',szi:'2.5000',usdc:'0.12500',fundingRate:'0.0001234567'}},
];
const csv='时间,市场,数量,方向,资金费,结算币种,费率\n2023-11-14T22:13:21.000Z,ABC (xyz),2.5,做多,0.125,USDH,0.0123%\n2023-11-14T22:13:20.000Z,BTC,0.01,做空,-0.0002,USDC,-0.000345%';
test('funding CSV parses BOM, quoted commas, quotes and line breaks',()=>{
  assert.deepEqual(parseFundingCsv('\ufeffa,b\r\n"x,y","a""b\nc"\r\n'),[['a','b'],['x,y','a"b\nc']]);
  assert.throws(()=>parseFundingCsv('a,"unclosed'),/Unclosed/);
  assert.throws(()=>parseFundingCsv('a,"closed"garbage'),/after quote/);
});
test('rate oracle rounds exact decimal values on both precision boundaries',()=>{
  for(const [raw,want] of [['0.0001','0.0100%'],['0.000099999','0.010000%'],['-0.0001','-0.0100%'],['0.000000005','0.000001%'],['0','0.000000%'],['0.123456789','12.3457%']])assert.equal(fundingRateText(raw),want);
});
test('downloaded CSV matches every record, UTC, raw decimals and settlement tokens',()=>{
  assert.equal(assertFundingCsv(Buffer.from(csv),records,{BTC:'USDC','xyz:ABC':'USDH'}),2);
  for(const bad of [csv.replace('0.01,做空','-0.01,做空'),csv.replace('0.125,USDH','0.125,USDC'),csv.replace('0.0123%','0.0124%'),csv.replace('22:13:21.000Z','22:13:21.000+08:00'),csv.split('\n').slice(0,2).join('\n')])assert.throws(()=>assertFundingCsv(Buffer.from(bad),records,{BTC:'USDC','xyz:ABC':'USDH'}));
});
test('settlement token identity follows sparse token indexes and each market DEX',()=>{
  assert.deepEqual(fundingSettlementTokens([{collateralToken:360,universe:[{name:'flx:ABC'}]},{collateralToken:0,universe:[{name:'BTC'}]}],{tokens:[{index:0,name:'USDC'},{index:360,name:'USDH'}]}),{'flx:ABC':'USDH',BTC:'USDC'});
  assert.throws(()=>fundingSettlementTokens([{collateralToken:42,universe:[{name:'BTC'}]}],{tokens:[{index:0,name:'USDC'}]}),/must exist/);
});
