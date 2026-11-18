export function createTracker() {
  return [];
}

export async function runCase(results, { id, name, classname, fn }) {
  const started = Date.now();
  try {
    const outcome = await fn();
    results.push({
      id,
      name,
      classname: classname || 'swap.api',
      status: outcome.status,
      reason: outcome.reason,
      detail: outcome.detail || '',
      ms: Date.now() - started,
    });
    const tag = outcome.status === 'passed' ? 'PASS' : outcome.status === 'skipped' ? 'SKIP' : 'FAIL';
    const extra = outcome.detail ? ` | ${outcome.detail}` : '';
    console.log(`${tag} ${name} — ${outcome.reason}${extra} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    results.push({
      id,
      name,
      classname: classname || 'swap.api',
      status: 'failed',
      reason: err.message,
      detail: err.stack || '',
      ms: Date.now() - started,
    });
    console.log(`FAIL ${name} — ${err.message} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
}

export function summarize(results, { failOnSkip = false } = {}) {
  const passed = results.filter((item) => item.status === 'passed').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const skipped = results.filter((item) => item.status === 'skipped').length;
  const exitCode = failed > 0 || (failOnSkip && skipped > 0) ? 1 : 0;
  console.log(`\nswap-api summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  return { passed, failed, skipped, exitCode };
}
