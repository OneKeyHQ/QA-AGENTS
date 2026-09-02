// Unified mobile test runner — mirrors desktop/run-software-wallet-transfer.mjs.

export function createMobileRunner({
  testCases,
  setup,
  connectOptions = {},
}) {
  const defaultSetup = async () => ({ shouldSkip: () => false });

  async function run() {
    const { connectDriver, disconnectDriver } = await import('./_appium.mjs');
    const driver = await connectDriver(connectOptions);
    let failed = false;
    try {
      const pre = await (setup ?? defaultSetup)(driver);
      for (const tc of testCases) {
        if (pre.shouldSkip(tc.id)) {
          console.log(`  SKIP  ${tc.id}  ${tc.name}`);
          continue;
        }
        console.log(`  RUN   ${tc.id}  ${tc.name}`);
        const start = Date.now();
        try {
          const result = await tc.fn(driver);
          const ok = result?.status === 'passed';
          if (!ok) failed = true;
          console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s`);
        } catch (err) {
          failed = true;
          console.log(`  FAIL  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s  ${err.message}`);
        }
      }
    } finally {
      await disconnectDriver(driver);
    }
    if (failed) process.exitCode = 1;
  }

  return {
    testCases,
    setup: setup ?? defaultSetup,
    run,
  };
}

export function runAsMain(importMetaUrl, run) {
  const isMain = !process.argv[1] || process.argv[1] === new URL(importMetaUrl).pathname;
  if (isMain) {
    run().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
}
