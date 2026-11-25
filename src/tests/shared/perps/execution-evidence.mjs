// Runtime evidence for real Desktop cases, not another execution-plan index.
import { desktopConfigRequestHeaders } from './desktop-config-headers.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESULTS_DIR } from '../../helpers/constants.mjs';
import { redactExecutionText } from '../../helpers/execution-policy.mjs';

function redact(value,key='') {
  if(/^(?:password|walletPassword|mnemonic|seed|privateKey|authorization|accessToken|refreshToken|apiKey)$/iu.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactExecutionText(value);
  if(Array.isArray(value)) return value.map(item=>redact(item));
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,k)]));
  return value;
}
function category(error) {
  if(error.fatalRestore || (error.status==='failed' && /^恢复/u.test(error.name))) return 'restore';
  if(error.code==='PERPS_SAMPLE_UNAVAILABLE') return 'sample';
  if(error.code==='PERPS_READINESS_TIMEOUT') return 'readiness';
  if(error.code==='ERR_ASSERTION' || error.errorName==='AssertionError') return 'assertion';
  if(error.code==='PERPS_INVALID_RESULT' || error.name==='TimeoutError' || error.errorName==='TimeoutError') return 'automation';
  return error.failureCategory ?? 'unclassified';
}
export function decoratePerpsCases(cases,{platform='desktop',prefix='',readMetadata=desktopConfigRequestHeaders}={}) {
  if(platform!=='desktop' || /^(?:WEB|EXT)-/u.test(prefix)) return cases;
  return cases.map(tc=>({...tc,fn:async function runWithEvidence(page) {
    const context={testId:tc.id,platform,startedAt:new Date().toISOString()};
    let result;
    try {
      const headers=await readMetadata(page);
      context.version=headers['X-Onekey-Request-Version'];context.build=headers['X-Onekey-Request-Build-Number'];
      context.userAgent=headers['User-Agent'];
    } catch(error) {
      context.endedAt=new Date().toISOString();
      return redact({status:'skipped',blocked:true,partial:true,context,steps:[{name:'前置：核对 Desktop 构建',status:'skipped',failureCategory:'environment',detail:error.message}],errors:[]});
    }
    try {
      result=await tc.fn(page);
      if(!result || !['passed','failed','skipped'].includes(result.status))
        throw Object.assign(Error('Perps case returned no valid execution result'),{code:'PERPS_INVALID_RESULT'});
    }
    catch(error) {
      const failureCategory=category(error), status=failureCategory==='sample'?'skipped':'failed';
      const step={name:'执行用例',status,failureCategory,detail:error.message,stack:error.stack,
        code:error.code,expected:error.expected,actual:error.actual};
      if(status==='failed' && typeof page.screenshot==='function') {
        try {
          const dir=resolve(RESULTS_DIR,'perps-evidence');mkdirSync(dir,{recursive:true});
          step.screenshot=resolve(dir,`${tc.id}-error.png`);await page.screenshot({path:step.screenshot,timeout:5000});
        } catch(e){step.evidenceError=e.message;}
      }
      result={status,blocked:status==='skipped',fatalRestore:Boolean(error.fatalRestore),steps:[step],errors:status==='failed'?[error.message]:[]};
    }
    context.endedAt=new Date().toISOString();
    if(result.fatalRestore || result.steps?.some(step=>step.status==='failed')) result={...result,status:'failed'};
    else if(result.status==='passed' && (!result.steps?.length || result.steps.some(step=>step.status==='skipped')))
      result={...result,status:'skipped',partial:true};
    const steps=result.steps?.map(step=>({...step,...(step.status==='failed'?{failureCategory:category(step)}:{})}));
    return redact({...result,context,...(steps?{steps}:{})});
  }}));
}
