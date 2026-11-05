// Actual pinned Desktop form calculations. Controlled fixtures never submit,
// sign, mutate an account, or replace a TF result.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSource,evaluateCallback,BigNumber,React,renderer} from './source.mjs';
const base='packages/kit/src/views/Perp/components/TradingPanel/modals/';
const constants=evaluateSource('packages/shared/types/hyperliquid/perp.constants.ts');
const minimum=evaluateSource(`${base}depositTokenDisplayUtils.ts`,{names:['getPerpsDepositMinimumCheck'],globals:{BigNumber,MIN_DEPOSIT_AMOUNT:constants.MIN_DEPOSIT_AMOUNT}}).getPerpsDepositMinimumCheck;
for(const price of ['1','0.5','2','1923.456789','0.000001'])for(const value of ['4.99','5','5.01'])for(const isUsdInput of [true,false])test(`D20-35 USD minimum price=${price},usd=${value},unit=${isUsdInput?'usd':'token'}`,()=>{
 const inputAmount=isUsdInput?value:new BigNumber(value).div(price).toFixed();
 const result=minimum({inputAmount,isUsdInput,tokenPrice:price,tokenDecimals:18});
 assert.equal(result.value,Number(value)>=5);
 if(!result.value){const threshold=new BigNumber(result.minFromTokenAmount);assert.ok(threshold.times(price).gte(5));assert.ok(threshold.minus('0.00000001').times(price).lt(5));}
});
for(const tokenPrice of [undefined,'','0','-1','NaN','Infinity'])test(`D20-35/68 missing price ${tokenPrice} cannot validate minimum`,()=>assert.deepEqual(JSON.parse(JSON.stringify(minimum({inputAmount:'10',isUsdInput:true,tokenPrice,tokenDecimals:6}))),{value:false,minFromTokenAmount:'-'}));
const modal=`${base}DepositWithdrawModal.tsx`;
for(const fee of [undefined,'0','0.2','1.999999','2','10.123456'])test(`D20-63 dynamic minimum fee=${fee}`,()=>{
 const actual=evaluateCallback(modal,'minimumWithdrawAmountBN',{BigNumber,MIN_WITHDRAW_AMOUNT:constants.MIN_WITHDRAW_AMOUNT,cctpFeeComponent:fee===undefined?undefined:{amount:fee}})();
 const expected=Math.max(2,Number(fee||0)+(fee?0.000001:0));assert.ok(Math.abs(actual.toNumber()-expected)<1e-10);
 for(const [delta,valid] of [[-0.000001,false],[0,true],[0.000001,true]]){
  const amountBN=actual.plus(delta),amount=amountBN.toFixed();
  const result=evaluateCallback(modal,'isValidAmount',{amountBN,amount,selectedAction:'withdraw',minimumWithdrawAmountBN:actual,maximumWithdrawAmountBN:actual.plus(1)})();
  assert.equal(result,valid);
 }
});
for(const [balance,reserve,shouldReserveWithdrawGas,expected]of [['10','0.2',true,'9.8'],['10','0.2',false,'10'],['0.1','0.2',true,'0'],['10.1234569','0',false,'10.123456'],['10',undefined,true,'10']])test(`D20-64 reserve ${balance}/${reserve}/${shouldReserveWithdrawGas}`,()=>{
 const result=evaluateCallback(modal,'maximumWithdrawAmountBN',{BigNumber,availableBalanceBN:new BigNumber(balance),shouldReserveWithdrawGas,matchedWithdrawReserve:reserve?{reserve}:undefined,USDC_TOKEN_INFO:constants.USDC_TOKEN_INFO})();assert.equal(result.toFixed(),expected);
});
for(const raw of ['','0','-1','NaN','100.000001'])test(`D20-65 invalid withdrawal ${JSON.stringify(raw)}`,()=>{
 assert.equal(evaluateCallback(modal,'isValidAmount',{amountBN:new BigNumber(raw),amount:raw,selectedAction:'withdraw',minimumWithdrawAmountBN:new BigNumber(2),maximumWithdrawAmountBN:new BigNumber(100)})(),false);
});
for(const balance of ['4.999999','5','5.000001'])test(`D20-38 current balance=${balance}`,()=>{
 assert.equal(evaluateCallback(modal,'isValidAmount',{amountBN:new BigNumber(5),amount:'5',selectedAction:'deposit',checkFromTokenFiatValue:{value:true},tokenAmountBN:new BigNumber(5),availableBalanceBN:new BigNumber(balance)})(),Number(balance)>=5);
});
const debounce=evaluateSource(modal,{names:['hasPositivePerpsDepositTokenAmount','shouldWaitForPerpsDepositQuoteDebounce'],globals:{BigNumber}});
for(const [patch,expected]of [[{},true],[{selectedAction:'withdraw'},false],[{isArbitrumUsdcToken:true},false],[{canQuoteDepositAmount:false},false],[{tokenAmount:'0'},false],[{tokenAmount:'-1'},false],[{tokenAmount:'NaN'},false],[{debouncedTokenAmount:'2'},false]])test(`D20-42/43 changed quote debounce ${JSON.stringify(patch)}`,()=>assert.equal(debounce.shouldWaitForPerpsDepositQuoteDebounce({selectedAction:'deposit',isArbitrumUsdcToken:false,canQuoteDepositAmount:true,tokenAmount:'2',debouncedTokenAmount:'1',...patch}),expected));
test('D20-36 unit toggles preserve original precision; edits use current unit/price',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {usePerpsAmountInput}=evaluateSource(`${base}usePerpsAmountInput.ts`);
 let output,tree;function Harness(props){output=usePerpsAmountInput(props);return null;}
 const render=async props=>renderer.act(async()=>{if(tree)tree.update(React.createElement(Harness,props));else tree=renderer.create(React.createElement(Harness,props));});
 try{
  await render({unit:'usd',tokenPrice:'3',tokenDecimals:6});await renderer.act(async()=>output.setAmount('10'));
  const exact=output.tokenAmountBN.toFixed();assert.equal(output.amount,'10');assert.equal(output.convertedAmount,'3.333333');
  for(let i=0;i<5;i++){await render({unit:'token',tokenPrice:'3',tokenDecimals:6});assert.equal(output.amount,'3.333333');assert.equal(output.tokenAmountBN.toFixed(),exact);await render({unit:'usd',tokenPrice:'3',tokenDecimals:6});assert.equal(output.amount,'10');}
  await render({unit:'token',tokenPrice:'3',tokenDecimals:6});await renderer.act(async()=>output.setAmount('1.234567'));assert.equal(output.convertedAmount,'3.70');
  await render({unit:'usd',tokenPrice:'4',tokenDecimals:6});assert.equal(output.amount,'4.94');assert.equal(output.tokenAmountBN.toFixed(),'1.234567');
 }finally{if(tree)await renderer.act(async()=>tree.unmount());}
});
