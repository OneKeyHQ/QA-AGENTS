// Contract trading page exploration test
// Generated from recording session-1772446521391
// Flow: Switch order type to 限價单 → Adjust leverage → Switch token to PLTR (股票)
//
// Hybrid approach: UIAutomator for fast element location, AI Vision as fallback
// Usage: npx tsx src/tests/android/contract/explore-trading.test.mjs

import 'dotenv/config';

if (!process.env.ANDROID_HOME) {
  process.env.ANDROID_HOME = `${process.env.HOME}/Library/Android/sdk`;
}
if (!process.env.PATH?.includes('platform-tools')) {
  process.env.PATH = `${process.env.ANDROID_HOME}/platform-tools:${process.env.PATH}`;
}

import { AndroidAgent, AndroidDevice, getConnectedDevices } from '@midscene/android';
import {
  initDevice,
  hybridTap,
  hybridQuery,
  tapByText,
  hasText,
  invalidateCache,
  UI_TEXT,
} from '../helpers/index.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('\n  === Contract Trading Exploration Test (Hybrid) ===\n');

  // ── Connect device ──
  const devices = await getConnectedDevices();
  if (devices.length === 0) {
    console.error('  No Android devices found.');
    process.exit(1);
  }

  const udid = devices[0].udid;
  const device = new AndroidDevice(udid);
  console.log(`  Connecting to ${udid}...`);
  await device.connect();
  initDevice(udid); // Init fast adb shell
  console.log('  Connected.\n');

  const agent = new AndroidAgent(device, {
    aiActionContext:
      'This is the OneKey wallet app on Android. ' +
      'The app has bottom tabs: 錢包(Wallet), 交易(Trade), 合約(Contract), 發現(Discover). ' +
      'The contract trading page shows a token pair (e.g. CLUSDC, PLTRUSDC), order book on the left, ' +
      'and an order form on the right with 逐倉/全倉 mode, leverage (e.g. 5x, 10x), order type (市價單/限價单), price and amount inputs.',
  });

  let stats = { uiautomator: 0, ai: 0 };
  const startTime = Date.now();

  const step = async (desc, action) => {
    const t0 = Date.now();
    console.log(`  [Step] ${desc}`);
    const result = await action();
    const elapsed = Date.now() - t0;
    if (result?.method) {
      stats[result.method]++;
      console.log(`    → ${result.method} (${elapsed}ms)`);
    }
    await sleep(1000);
    return result;
  };

  // ── Step 0: Dismiss any open modal/sheet ──
  await step('Dismiss any open modal or sheet', async () => {
    try {
      const ok = await tapByText(device, UI_TEXT.CLOSE);
      if (ok) return { method: 'uiautomator' };
      await agent.aiAction('if there is a × (close) button on the screen, tap it to close the current modal or page');
      return { method: 'ai' };
    } catch {
      return null;
    }
  });

  // ── Step 1: Navigate to 合約 tab ──
  await step('Navigate to 合約 (Contract) tab', async () => {
    return hybridTap(device, agent, {
      text: UI_TEXT.TAB_CONTRACT,
      contentDesc: '合約',
      aiAction: 'tap on the "合約" tab at the bottom navigation bar of the screen',
    });
  });

  // ── Step 2: Verify contract page loaded ──
  await step('Verify contract page loaded', async () => {
    return hybridQuery(device, agent, {
      uiCheck: (elements) => {
        const hasUSDC = elements.some((el) => el.text && el.text.includes('USDC'));
        if (hasUSDC) return { verified: true, found: 'USDC token pair' };
        return null;
      },
      aiQuery:
        '{ tokenPair: string, orderType: string }, describe the current token pair name and order type shown on the contract trading page',
    });
  });

  // ── Step 3: Open order type selector ──
  await step('Open order type selector', async () => {
    return hybridTap(device, agent, {
      text: UI_TEXT.ORDER_LIMIT,
      aiAction:
        'tap on the order type dropdown button (shows "市價單" or "限價单") in the order form area on the right side of the screen',
    });
  });

  // ── Step 4: Select 限價单 ──
  await step('Select 限價单 (Limit Order)', async () => {
    return hybridTap(device, agent, {
      text: UI_TEXT.ORDER_LIMIT,
      aiAction: 'in the "訂單類型" bottom sheet modal, tap on "限價单" option',
    });
  });

  // ── Step 5: Verify order type switched ──
  await step('Verify order type is now 限價单', async () => {
    const found = await hasText('限價');
    if (found) {
      console.log('    Order type: 限價单 ✓');
      return { method: 'uiautomator' };
    }
    const info = await agent.aiQuery(
      '{ orderType: string }, what is the currently selected order type on the trading form?',
    );
    console.log(`    Order type: ${info.orderType}`);
    if (!info.orderType.includes('限價')) {
      console.warn('    Warning: Expected 限價单 but got:', info.orderType);
    }
    return { method: 'ai' };
  });

  // ── Step 6: Open leverage selector ──
  await step('Open leverage selector', async () => {
    return hybridTap(device, agent, {
      text: /\d+x/,
      aiAction:
        'tap on the leverage button (shows a number like "5x" or "10x") next to the "逐倉" dropdown at the top of the order form',
    });
  });

  // ── Step 7: Adjust leverage via slider (AI only — needs semantic drag) ──
  await step('Adjust leverage on the slider', async () => {
    await agent.aiAction(
      'in the "調整槓桿" modal, drag the leverage slider to adjust the leverage value',
    );
    invalidateCache();
    return { method: 'ai' };
  });

  await sleep(500);

  // ── Step 8: Close leverage modal ──
  await step('Close leverage modal', async () => {
    try {
      const ok = await tapByText(device, UI_TEXT.CLOSE);
      if (ok) return { method: 'uiautomator' };
      await agent.aiAction(
        'tap the × (close) button at the top right corner of the "調整槓桿" modal',
      );
      return { method: 'ai' };
    } catch {
      return null;
    }
  });

  // ── Step 9: Open token pair selector ──
  await step('Open token pair selector', async () => {
    return hybridTap(device, agent, {
      text: /USDC/,
      aiAction:
        'tap on the token pair name with the dropdown arrow (e.g. "CLUSDC ▼" or "BTCUSDC ▼") at the top left area of the contract page',
    });
  });

  // ── Step 10: Switch to 股票 (Stocks) tab ──
  await step('Switch to 股票 tab in token selector', async () => {
    return hybridTap(device, agent, {
      text: UI_TEXT.TAB_STOCKS,
      aiAction:
        'on the "選擇代幣" page, tap on the "股票" tab in the horizontal tab bar (tabs include 加密貨幣, 股票, 贵金属, 指數, 大宗商品, 外匯)',
    });
  });

  // ── Step 11: Select PLTR ──
  await step('Select PLTR from the stocks list', async () => {
    return hybridTap(device, agent, {
      text: 'PLTR',
      aiAction: 'tap on "PLTR" (帕蘭提爾) in the token list',
    });
  });

  // ── Step 12: Verify final state ──
  await step('Verify final state: PLTRUSDC with limit order', async () => {
    return hybridQuery(device, agent, {
      uiCheck: (elements) => {
        const hasPLTR = elements.some((el) => el.text && el.text.includes('PLTR'));
        const hasLimit = elements.some((el) => el.text && el.text.includes('限價'));
        if (hasPLTR && hasLimit) {
          return { tokenPair: 'PLTRUSDC', orderType: '限價单', verified: true };
        }
        return null;
      },
      aiQuery:
        '{ tokenPair: string, orderType: string, leverage: string }, describe the token pair, order type, and leverage shown on the contract trading page',
    });
  });

  // ── Results ──
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final pass/fail check
  const finalCheck = await (async () => {
    try {
      return await hybridQuery(device, agent, {
        uiCheck: (elements) => {
          const hasPLTR = elements.some((el) => el.text && el.text.includes('PLTR'));
          const hasLimit = elements.some((el) => el.text && el.text.includes('限價'));
          return { pass: hasPLTR && hasLimit };
        },
      });
    } catch {
      return { result: { pass: false } };
    }
  })();

  console.log(`\n  ── Performance Summary ──`);
  console.log(`  UIAutomator steps: ${stats.uiautomator}`);
  console.log(`  AI Vision steps:   ${stats.ai}`);
  console.log(`  Total time:        ${totalTime}s`);

  if (finalCheck.result?.pass) {
    console.log('\n  === Test PASSED ===\n');
  } else {
    console.error('\n  === Test FAILED ===');
    console.error('  Expected PLTR + 限價单 on screen');
    process.exit(1);
  }

  console.log('  === Done ===\n');
}

run().catch((err) => {
  console.error(`\n  Failed: ${err.message}`);
  process.exit(1);
});

export { run };
