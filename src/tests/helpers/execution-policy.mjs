// A failed cleanup invalidates the baseline for every later case in this queue.
export function mustStopAfterResult(result) {
  return Boolean(result?.fatalRestore || result?.steps?.some(step =>
    step.status === 'failed' && /^恢复/.test(step.name)));
}
export function markRestoreFailure(result, error, name = '恢复用户状态') {
  const message = error?.message ?? String(error);
  if (!result) {
    const failure = new Error(`${name}: ${message}`, { cause: error });
    failure.fatalRestore = true;
    return failure;
  }
  result.status = 'failed';
  result.fatalRestore = true;
  result.steps ??= [];
  result.errors ??= [];
  result.steps.push({ name, status: 'failed', detail: message });
  result.errors.push(`${name}: ${message}`);
  result.summary = {
    passed: result.steps.filter(s => s.status === 'passed').length,
    failed: result.steps.filter(s => s.status === 'failed').length,
    skipped: result.steps.filter(s => s.status === 'skipped').length,
    total: result.steps.length,
  };
  return result;
}

// A folder run must honor the same cleanup boundary as a case run.
export async function runUntilRestoreFailure(items, runItem) {
  const results=[];
  for(const item of items) {
    const result=await runItem(item);
    results.push(result);
    if(mustStopAfterResult(result)) break;
  }
  return results;
}
