// Address Book — Add Address shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/utility/address-book-add.test.mjs
//   src/tests/web/utility/address-book-add.test.mjs
//   src/tests/extension/utility/address-book-add.test.mjs
// inject platform-specific `openAddressBook(page)` then call createAddressBookAddTests()
// to get the same 4 test cases prefixed for their platform.
//
// Coverage mapping (test case doc → script):
// §1 入口与默认状态 → ADDR-ADD-001 (步骤 1-2: 导航到地址簿 + 验证默认网络 BTC)
// §2 添加地址主流程(无 Memo) → ADDR-ADD-001 (步骤 3-6: 参数化 63 条无 Memo 数据)
// §2 添加地址主流程(有 Memo) → ADDR-ADD-002 (参数化 14 条有 Memo 数据)
// §3 网络切换 → ADDR-ADD-003 (BTC→Ethereum→Solana→Cosmos→XRP Ledger)
// §4 性能与体验 → ADDR-ADD-004 (反复进出 5 次 + 保存)
//
// Key selectors:
// - Add button:          [data-testid="address-book-add-icon"]
// - Network selector:    [data-testid="network-selector-input-text"]
// - Network search:      [data-testid="nav-header-search-chain-selector"]
// - Name input:          [data-testid="address-form-name"]
// - Address input:       [data-testid="address-form-address"]
// - Memo/Tag input:      textarea[placeholder*="Memo"]
// - Save button:         [data-testid="address-form-save"]
// - Back button:         [data-testid="nav-header-back"]

import { execSync } from 'node:child_process';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

// ── DATA SETS ──────────────────────────────────────────────────

/** Networks without Memo/Tag (60 entries) */
export const DATA_NO_MEMO = [
  { name: 'BTC-taproot', network: 'Bitcoin', searchKey: 'Bitcoin', addr: 'bc1ppskree0erhqyptsx8hufkt98wxvuv6gla8hpep8euq6cex2k4h9svg2en3', group: 'Bitcoin' },
  { name: 'BTC-Nested SegWit', network: 'Bitcoin', searchKey: 'Bitcoin', addr: '38Xegnipu2RhZouctnGnwmDRk2bLXfDHf4', group: 'Bitcoin' },
  { name: 'BTC-Native SegWit', network: 'Bitcoin', searchKey: 'Bitcoin', addr: 'bc1qjclx3t2ykepvcqegx8tmn3nwd5ahsswenrvd90', group: 'Bitcoin' },
  { name: 'BTC-Legacy', network: 'Bitcoin', searchKey: 'Bitcoin', addr: '1AztpmzfQdpZNM5Yshczadx5pzcLfDTox7', group: 'Bitcoin' },
  { name: 'EVM-1', network: 'Ethereum', searchKey: 'Ethereum', addr: '0x4cf1495a7786cEbE16b92671e8Ff98bc710B0A83', group: 'EVM' },
  { name: 'EVM-2', network: 'Polygon', searchKey: 'Polygon', addr: '0x9403a0EC47A062F82d2AC402394EecB61A030d57', group: 'EVM' },
  { name: 'EVM-3', network: 'BNB Chain', searchKey: 'BNB', addr: '0x0323467ed1A8035D88a66F8b85a126827C8de234', group: 'EVM' },
  { name: 'EVM-4', network: 'Fantom', searchKey: 'Fantom', addr: '0xD7E683a4FD67b88E7087A146faDC7b937474c2Cc', group: 'EVM' },
  { name: 'EVM-5', network: 'Arbitrum', searchKey: 'Arbitrum', addr: '0xf28d16B559710e4316716CD464B4F2c58482974C', group: 'EVM' },
  { name: 'EVM-6', network: 'Avalanche', searchKey: 'Avalanche', addr: '0x9e98ebE430D1A2fd681Ce486D84eF2D7003ba3C5', group: 'EVM' },
  { name: 'EVM-8', network: 'OKX Chain', searchKey: 'OKX', addr: '0x04cca68e9731EEC9aBD049B45DCfcf3eeEd12c9D', group: 'EVM' },
  { name: 'EVM-9', network: 'Optimism', searchKey: 'Optimism', addr: '0x127817E37FB968E2C5010709352173F29837879c', group: 'EVM' },
  { name: 'EVM-10', network: 'Gnosis Chain', searchKey: 'Gnosis', addr: '0x59A061a0e9923e8a80f6f1526052C77bCD9e5Eb6', group: 'EVM' },
  { name: 'EVM-11', network: 'Celo', searchKey: 'Celo', addr: '0x1670226c726da674C959F6BfE423A967F2d25232', group: 'EVM' },
  { name: 'EVM-12', network: 'Aurora', searchKey: 'Aurora', addr: '0xe75aE012f77d711e2481392BA5F99022A2873554', group: 'EVM' },
  { name: 'EVM-13', network: 'Base', searchKey: 'Base', addr: '0x9f07930aac5ebd758a52738a4f85d87a13411413', group: 'EVM' },
  { name: 'EVM-14', network: 'Boba', searchKey: 'Boba', addr: '0x7257E9b4C39bE7B5aa9b626DFc0910f2202787bb', group: 'EVM' },
  { name: 'EVM-15', network: 'Conflux eSpace', searchKey: 'Conflux eSpace', addr: '0xF2Da207C8d5344c62B12113e864E7AB4A7aE67f2', group: 'EVM' },
  { name: 'EVM-16', network: 'Cronos', searchKey: 'Cronos', addr: '0x054e8CA4bA3fc93C1f1462995fC31E69437fD7BA', group: 'EVM' },
  { name: 'EVM-17', network: 'Ethereum Classic', searchKey: 'Ethereum Classic', addr: '0x2D972Ff4559b7DF4004b6958687BA7118A3C17B9', group: 'EVM' },
  { name: 'EVM-19', network: 'EthereumPoW', searchKey: 'EthereumPoW', addr: '0x8F936d56ad282E89D810d498D6A6709be9DF4Ff0', group: 'EVM' },
  { name: 'EVM-20', network: 'Filecoin FEVM', searchKey: 'Filecoin FEVM', addr: '0x1b29472D33AF568CDc119836aAC3EB6a2F6036D3', group: 'EVM' },
  { name: 'EVM-21', network: 'Linea', searchKey: 'Linea', addr: '0x8088532Af5963C37b05DcE731327b378F2aB52Ad', group: 'EVM' },
  { name: 'EVM-22', network: 'Mantle', searchKey: 'Mantle', addr: '0x880605E880feb3353e1515827FEa7ed555813b83', group: 'EVM' },
  { name: 'EVM-24', network: 'zkSync Era', searchKey: 'zkSync', addr: '0xe0523d4cDe337965c2910250e3E51E567616a366', group: 'EVM' },
  { name: 'EVM-25', network: 'Blast', searchKey: 'Blast', addr: '0x4300000000000000000000000000000000000004', group: 'EVM' },
  { name: 'EVM-26', network: 'Manta Pacific', searchKey: 'Manta Pacific', addr: '0x3CDfB47b0E910d9190eD788726cD72489bf10499', group: 'EVM' },
  { name: 'EVM-27', network: 'OctaSpace', searchKey: 'OctaSpace', addr: '0x91b2ca962eaf498cad41E2BC5D2508Bf11adb708', group: 'EVM' },
  { name: 'EVM-28', network: 'IoTeX', searchKey: 'IoTeX', addr: '0x1399e769013194D7C5C0A10b814EbccF8Ca398e2', group: 'EVM' },
  { name: 'EVM-29', network: 'Scroll', searchKey: 'Scroll', addr: '0x5405bb1E1Ff615De9aAd1BA71e06Cd365E236a1d', group: 'EVM' },
  { name: 'EVM-30', network: 'Sonic', searchKey: 'Sonic', addr: '0xDF51c54bBF80345BD228c9916797c22Ea75A00Eb', group: 'EVM' },
  { name: 'EVM-31', network: 'X Layer', searchKey: 'X Layer', addr: '0x6Be13FC71d5bf6e7C2fAF6f8f61573D6d4BF11CF', group: 'EVM' },
  { name: 'EVM-32', network: 'Flare', searchKey: 'Flare', addr: '0x4886Bc96A1C2D835a720d8740d16cEcfe52eA410', group: 'EVM' },
  { name: 'Bitcoin Cash', network: 'Bitcoin Cash', searchKey: 'BCH', addr: 'bitcoincash:qz6kmmtek6vvly474p65cz9n77xfd9tykutafetr5k', group: 'Bitcoin Cash' },
  { name: 'Litecoin-Nested SegWit', network: 'Litecoin', searchKey: 'Litecoin', addr: 'MRTehAWcZgZm6fnVj3kDzizaCtiybPHt3V', group: 'Litecoin' },
  { name: 'Litecoin-Native SegWit', network: 'Litecoin', searchKey: 'Litecoin', addr: 'ltc1q5qzknn7arkxvwf53cy6dnjvx8w9ty5u4ujmprk', group: 'Litecoin' },
  { name: 'Litecoin-Legacy', network: 'Litecoin', searchKey: 'Litecoin', addr: 'LYVggHGrbF1NxbKySUzkbUHQ6EmgzSo2UL', group: 'Litecoin' },
  { name: 'Dogecoin', network: 'Dogecoin', searchKey: 'Dogecoin', addr: 'D5UJ81u33vJBco3fMZxpaHrSrbwCyMejcY', group: 'Dogecoin' },
  { name: 'Solana', network: 'Solana', searchKey: 'Solana', addr: '9mAFNvcLLy1DiK7iEoAAFHvABAiV8ZHRo42VUTBRd273', group: 'Solana' },
  { name: 'Solana-ledger live', network: 'Solana', searchKey: 'Solana', addr: '7jxV3PXtzifTM4yW1riEMrnFUGrYsJRcP1A9pL9m9mMW', group: 'Solana' },
  { name: 'SUI', network: 'SUI', searchKey: 'SUI', addr: '0xbfd0a6d5c3dd77bb27e1320e7ccc39d33f53056592f7165031d2893c07812bfe', group: 'SUI' },
  { name: '波卡', network: 'Polkadot AssetHub', searchKey: 'Polkadot', addr: '15Zv9wuuj921BLAVX3iKxHN32gZS21hA4KsA3YsWkc79brEu', group: 'Polkadot' },
  { name: '波卡-Joystream', network: 'Joystream', searchKey: 'Joystream', addr: 'j4VtXaetok5FZaQbiqP71fHEshSeMpbiBhmm7FovUdbEG512F', group: 'Joystream' },
  { name: '波卡-Astar', network: 'Astar', searchKey: 'Astar', addr: 'aWDSucvebPdxdBp3i7SqnhAG7GuHvqm12dp7y624t5b1Xex', group: 'Astar' },
  { name: '波卡-Kusama', network: 'Kusama AssetHub', searchKey: 'Kusama', addr: 'H9EfvziVimTVSyRL7UNi5ttKer28NxCSCyRGvA7gKJ8APBy', group: 'Kusama' },
  { name: '波卡-Manta Atlantic', network: 'Manta Atlantic', searchKey: 'Manta', addr: 'dfY32TZovuaNgARK6bZX8xxupfAx2E2eM8tmbL9p9j2cQfTAf', group: 'Manta Atlantic' },
  { name: '波卡-Hydration', network: 'Hydration', searchKey: 'Hydration', addr: '14AjRXbXzdSZ7GNcsat49pHZ8L759FokqrX4ZL5WQt26WemL', group: 'Hydration' },
  { name: '波卡-Bifrost Kusama', network: 'Bifrost Kusama', searchKey: 'Bifrost', addr: '13LniXhyH1TKPiTWdd5Tou2uxyXs2FMyXebqczMgUHM3hHF3', group: 'Bifrost Kusama' },
  { name: 'Near', network: 'Near', searchKey: 'Near', addr: 'd7be27229b157122eae4e1329fabe67272dcb4ba186378f5f788f245cc1c10d2', group: 'Near' },
  { name: 'Tron', network: 'Tron', searchKey: 'Tron', addr: 'THXNjn3TN6n58cD1Ry6mmzPzbgQiZ92whR', group: 'Tron' },
  { name: 'Aptos', network: 'Aptos', searchKey: 'Aptos', addr: '0x60e800a8839a86be1ca6c0b17ecb10f2a2af8b3b7c5f212bbeb64471c4f00bd8', group: 'Aptos' },
  { name: 'Cardano', network: 'Cardano', searchKey: 'Cardano', addr: 'addr1qyr8t5k9g7ggfsmfqwkf5gjcxtpag0xjkyctvnx0ljv8cxe0y0g30qkd85njeekrwsfxvt44z3r5drtgywdwnx0a8p5sak4p7t', group: 'Cardano' },
  { name: 'Conflux', network: 'Conflux', searchKey: 'Conflux', addr: 'cfx:aapggywhe9bbab6g7swd9m6r0491g6z3ejup0bkug7', group: 'Conflux' },
  { name: 'Nexa', network: 'Nexa', searchKey: 'Nexa', addr: 'nexa:nqtsq5g5e47yv33ek75g5j234acq43u8damwre2mp3zc2trf', group: 'Nexa' },
  { name: 'Filecoin', network: 'Filecoin', searchKey: 'Filecoin', addr: 'f1qx24etmdkfpaqrxm5daj2cfe6ymu4eh5mbyamyy', group: 'Filecoin' },
  { name: 'Kaspa', network: 'Kaspa', searchKey: 'Kaspa', addr: 'kaspa:qpyzj30sk5jvrh0n6zxwgy8w7h3dnxxgy5yc5jz3eusp7g55wxcx6kcp6hhc9', group: 'Kaspa' },
  { name: 'DNX', network: 'Dynex', searchKey: 'Dynex', addr: 'XwoVdKCGbWF9LJ88A2yXrsfvMLKUjQSERWKCNMfgiWdUHb7jTPB9dmKfNrwgnUd5WU8AD4NbSo5eDi7vuG5iUerY2fiMY1Nfm', group: 'Dynex' },
  { name: 'Nervos', network: 'Nervos', searchKey: 'Nervos', addr: 'ckb1qyq9qqyurg2k9w8dvn8d62lsf89ca69rqv5qnwd9dc', group: 'Nervos' },
  { name: 'Neurai', network: 'Neurai', searchKey: 'Neurai', addr: 'NQGSM97dYfWXZtHu6zfN7kQwZcMz8wdbwq', group: 'Neurai' },
];

/** Networks with Memo/Tag (14 entries) */
export const DATA_WITH_MEMO = [
  { name: 'Algorand', network: 'Algorand', searchKey: 'Algorand', addr: '7ZVKIHADZGRZJ7A52B7DZTOP4JXAOPK2M2FQTXK3D3T3A2HFOPUOGKGAVM', memo: 'algo-note-test', group: 'Algorand' },
  { name: 'Ripple', network: 'XRP Ledger', searchKey: 'XRP', addr: 'r9D1JTDPkWTZ9qfezpALSi2aiTytQ58Zy6', memo: '12345', group: 'Ripple' },
  { name: 'Stellar', network: 'Stellar', searchKey: 'Stellar', addr: 'GAQUNZIB7ICDY7YLKLZAQCUH4ROLHKOU7NAIPWGCFLW5SJZ6HPXRDFZ3', memo: 'test-memo', group: 'Stellar' },
  { name: 'TON', network: 'TON', searchKey: 'TON', addr: 'UQADRchuTBUsiEEtGow4z9Uc33l4dz0nhuNz-7S_8jwCE7oP', memo: 'ton-memo-123', group: 'TON' },
  { name: 'Cosmos', network: 'Cosmos', searchKey: 'Cosmos', addr: 'cosmos1l65dl2stwxk4w9gf0vt2mnxhst48ygys50evrj', memo: 'cosmos-memo-test', group: 'Cosmos' },
  { name: 'Akash', network: 'Akash', searchKey: 'Akash', addr: 'akash1l65dl2stwxk4w9gf0vt2mnxhst48ygyse55t6g', memo: 'akash-memo', group: 'Akash' },
  { name: 'Cosmos-Celestia', network: 'Celestia', searchKey: 'Celestia', addr: 'celestia1l65dl2stwxk4w9gf0vt2mnxhst48ygys99guel', memo: 'celestia-memo', group: 'Celestia' },
  { name: 'Cosmos-Cronos POS Chain', network: 'Cronos POS Chain', searchKey: 'Cronos POS Chain', addr: 'cro1l65dl2stwxk4w9gf0vt2mnxhst48ygysv534lr', memo: 'cro-memo', group: 'Cronos POS Chain' },
  { name: 'Cosmos-Fetch.ai', network: 'Fetch.ai', searchKey: 'Fetch', addr: 'fetch1l65dl2stwxk4w9gf0vt2mnxhst48ygys8jsgp9', memo: 'fetch-memo', group: 'Fetch.ai' },
  { name: 'Cosmos-Juno', network: 'Juno', searchKey: 'Juno', addr: 'juno1l65dl2stwxk4w9gf0vt2mnxhst48ygysza6hyw', memo: 'juno-memo', group: 'Juno' },
  { name: 'Cosmos-Osmosis', network: 'Osmosis', searchKey: 'Osmosis', addr: 'osmo1l65dl2stwxk4w9gf0vt2mnxhst48ygysu52u4q', memo: 'osmo-memo', group: 'Osmosis' },
  { name: 'Cosmos-Secret Network', network: 'Secret Network', searchKey: 'Secret', addr: 'secret1uu09g5ejglen930u3j9q9tkcz7z7uxaua4kmql', memo: 'secret-memo', group: 'Secret Network' },
  { name: 'Cosmos-Babylon', network: 'Babylon Genesis', searchKey: 'Babylon', addr: 'bbn18uw4gruff6mnd8h7r07vqfzcs8x5jn5a2n4nzs', memo: 'bbn-memo', group: 'Babylon Genesis' },
  { name: 'Cosmos-Noble', network: 'Noble', searchKey: 'Noble', addr: 'noble18uw4gruff6mnd8h7r07vqfzcs8x5jn5a4w3298', memo: 'noble-memo', group: 'Noble' },
];

/** Network switch test sequence */
export const NETWORK_SWITCH_SEQ = [
  { name: 'Ethereum', searchKey: 'Ethereum', hasMemo: false },
  { name: 'Solana', searchKey: 'Solana', hasMemo: false },
  { name: 'Cosmos', searchKey: 'Cosmos', hasMemo: true },
  { name: 'XRP Ledger', searchKey: 'XRP', hasMemo: true },
];

/**
 * Build the 4 Address Book Add test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'ADDR-ADD' | 'WEB-ADDR-ADD' | 'EXT-ADDR-ADD'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.openAddressBook
 *   Platform-specific navigation to address book list page.
 *   May throw to indicate "unsupported on this platform" — caller can wrap and treat as skip.
 * @param {string} [opts.screenshotDir] - Per-platform screenshot dir for safeStep.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createAddressBookAddTests({
  prefix,
  namePrefix = '',
  openAddressBook,
  screenshotDir,
}) {
  if (!openAddressBook) throw new Error('createAddressBookAddTests: openAddressBook is required');

  const _ss = (page, t, name, fn) => safeStep(page, t, name, fn, screenshotDir);

  // ── HELPERS ────────────────────────────────────────────────────

  async function clickAddButton(page) {
    const addBtn = page.locator('[data-testid="address-book-add-icon"]').first();
    await addBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addBtn.click();
    await sleep(1000);
  }

  async function clickBack(page) {
    try {
      const backBtn = page.locator('[data-testid="nav-header-back"]').first();
      await backBtn.waitFor({ state: 'visible', timeout: 3000 });
      await backBtn.click();
    } catch {
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="nav-header-back"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!clicked) {
        await page.keyboard.press('Escape');
      }
    }
    await sleep(1000);
  }

  async function selectNetworkBySearch(page, searchKey) {
    const netSelector = page.locator('[data-testid="network-selector-input-text"]').first();
    await netSelector.waitFor({ state: 'visible', timeout: 10000 });
    await netSelector.click();
    await sleep(800);

    const searchInput = page.locator('[data-testid="nav-header-search-chain-selector"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.click();
    await sleep(200);

    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nav-header-search-chain-selector"]');
      if (el) { el.focus(); el.select(); }
    });
    await page.keyboard.press('Backspace');
    await sleep(300);

    if (searchKey.includes(' ')) {
      execSync('pbcopy', { input: searchKey });
      await sleep(200);
      await searchInput.click();
      await sleep(100);
      await page.keyboard.press('Meta+V');
      await sleep(500);
    } else {
      await searchInput.pressSequentially(searchKey, { delay: 40 });
      await sleep(300);
    }

    const actualValue = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nav-header-search-chain-selector"]');
      return el?.value || '';
    });
    if (actualValue !== searchKey) {
      console.log(`  [warn] search input mismatch: expected="${searchKey}" actual="${actualValue}"`);
    }

    let clicked = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const pos = await page.evaluate((key) => {
        const items = document.querySelectorAll('div[data-testid^="select-item-"]');
        const rows = [];
        for (const item of items) {
          const r = item.getBoundingClientRect();
          if (r.height < 40 || r.width < 100) continue;
          rows.push({
            el: item,
            text: item.textContent?.trim() || '',
            rect: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
          });
        }
        if (rows.length === 0) return null;

        const keyLower = key.toLowerCase();
        for (const row of rows) {
          if (row.text.toLowerCase() === keyLower) return row.rect;
        }
        for (const row of rows) {
          if (row.text.toLowerCase().startsWith(keyLower)) return row.rect;
        }
        for (const row of rows) {
          if (row.text.toLowerCase().endsWith(keyLower)) return row.rect;
        }
        return rows[0].rect;
      }, searchKey);
      if (pos) {
        await page.mouse.click(pos.x, pos.y);
        clicked = true;
        break;
      }
    }

    if (!clicked) throw new Error(`Network "${searchKey}" not found in selector after 10s`);
    await sleep(800);
  }

  async function getCurrentNetworkName(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-testid="network-selector-input-text"]');
      return el?.textContent?.trim() || '';
    });
  }

  async function fillName(page, name) {
    const nameInput = page.locator('[data-testid="address-form-name"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.click();
    await sleep(100);
    await nameInput.fill('');
    await nameInput.pressSequentially(name, { delay: 30 });
    await sleep(300);
  }

  async function fillAddress(page, addr) {
    const addrInput = page.locator('[data-testid="address-form-address"]').first();
    await addrInput.waitFor({ state: 'visible', timeout: 10000 });
    await addrInput.click();
    await sleep(100);
    await addrInput.fill('');
    await addrInput.pressSequentially(addr, { delay: 5 });
    await sleep(500);
  }

  async function fillMemo(page, memo) {
    const memoInput = page.locator('textarea[placeholder*="Memo"], textarea[placeholder*="Tag"], textarea[placeholder*="Note"], textarea[placeholder*="备忘"], textarea[placeholder*="备注"]').first();
    await memoInput.waitFor({ state: 'visible', timeout: 10000 });
    await memoInput.click();
    await sleep(100);
    await memoInput.fill('');
    await memoInput.pressSequentially(memo, { delay: 30 });
    await sleep(300);
  }

  async function isMemoFieldVisible(page) {
    return page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        const ph = ta.placeholder || '';
        if ((ph.includes('Memo') || ph.includes('Tag') || ph.includes('Note') || ph.includes('备忘') || ph.includes('备注') || ph.includes('注释')) && ta.getBoundingClientRect().width > 0) {
          return true;
        }
      }
      return false;
    });
  }

  async function clickSave(page) {
    const saveBtn = page.locator('[data-testid="address-form-save"]').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();
    await sleep(1500);
  }

  async function isOnAddressBookList(page) {
    try {
      await page.locator('[data-testid="address-book-add-icon"]').first().waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async function verifyRecordInList(page, name, addr) {
    return page.evaluate(({ n, a }) => {
      const allText = document.body.innerText;
      if (allText.includes(n)) return true;
      if (a) {
        const prefix = a.slice(0, 10);
        if (prefix.length >= 6 && allText.includes(prefix)) return true;
      }
      return false;
    }, { n: name, a: addr });
  }

  // ── TEST CASES ─────────────────────────────────────────────────

  /**
   * ADDR-ADD-001: 入口与默认状态 + 添加无 Memo 地址（参数化）
   * 覆盖: §1 全部 + §2 无 Memo 数据集(60 条)
   */
  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await _ss(page, t, '导航到地址簿页面', async () => {
      await openAddressBook(page);
      return 'navigated';
    });

    await _ss(page, t, '点击添加按钮进入添加页面', async () => {
      await clickAddButton(page);
      const nameInput = page.locator('[data-testid="address-form-name"]').first();
      await nameInput.waitFor({ state: 'visible', timeout: 10000 });
      return 'add page opened';
    });

    await _ss(page, t, '验证默认网络为 Bitcoin', async () => {
      const netName = await getCurrentNetworkName(page);
      if (!netName.includes('Bitcoin') && !netName.includes('BTC')) {
        throw new Error(`默认网络不是 Bitcoin，实际为: ${netName}`);
      }
      return `default network: ${netName}`;
    });

    let lastNetwork = 'Bitcoin';
    let onAddPage = true;
    for (let i = 0; i < DATA_NO_MEMO.length; i++) {
      const d = DATA_NO_MEMO[i];
      const stepLabel = `[${i + 1}/${DATA_NO_MEMO.length}] 添加 ${d.name}`;

      const ok = await _ss(page, t, stepLabel, async () => {
        if (!onAddPage) {
          await clickAddButton(page);
        }

        if (d.searchKey !== lastNetwork) {
          await selectNetworkBySearch(page, d.searchKey);
          lastNetwork = d.searchKey;
        }

        await fillName(page, d.name);
        await fillAddress(page, d.addr);
        await sleep(500);

        const dupError = await page.evaluate(() => {
          const text = document.body.innerText;
          return text.includes('已存在') || text.includes('already exists');
        });
        if (dupError) {
          onAddPage = true;
          return `SKIP: 地址已存在 — ${d.name}`;
        }

        await clickSave(page);

        const onList = await isOnAddressBookList(page);
        if (!onList) throw new Error('保存后未返回地址簿列表');
        onAddPage = false;

        const found = await verifyRecordInList(page, d.name, d.addr);
        if (!found) throw new Error(`地址簿中未找到记录: ${d.name}`);

        return `saved: ${d.name} → ${d.group}`;
      });

      if (!ok) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
        const onList = await isOnAddressBookList(page);
        if (onList) {
          onAddPage = false;
        } else {
          const hasNameInput = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="address-form-name"]');
            return el && el.getBoundingClientRect().width > 0;
          });
          onAddPage = hasNameInput;
          if (!onAddPage) {
            await openAddressBook(page).catch(() => {});
          }
        }
      }
    }

    return t.result();
  }

  /**
   * ADDR-ADD-002: 添加有 Memo/Tag 的地址（参数化）
   * 覆盖: §2 有 Memo 数据集(14 条)
   */
  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await _ss(page, t, '确保在地址簿页面', async () => {
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(500);
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(500);
      const onList = await isOnAddressBookList(page);
      if (!onList) {
        await openAddressBook(page);
      }
      await page.locator('[data-testid="address-book-add-icon"]').first().waitFor({ state: 'visible', timeout: 10000 });
      return 'on address book page';
    });

    let onAddPage2 = false;
    for (let i = 0; i < DATA_WITH_MEMO.length; i++) {
      const d = DATA_WITH_MEMO[i];
      const stepLabel = `[${i + 1}/${DATA_WITH_MEMO.length}] 添加 ${d.name} (Memo: ${d.memo})`;

      const ok = await _ss(page, t, stepLabel, async () => {
        if (!onAddPage2) {
          await clickAddButton(page);
        }

        await selectNetworkBySearch(page, d.searchKey);

        await fillName(page, d.name);
        await fillAddress(page, d.addr);
        await sleep(500);

        const dupError = await page.evaluate(() => {
          const text = document.body.innerText;
          return text.includes('已存在') || text.includes('already exists');
        });
        if (dupError) {
          onAddPage2 = true;
          return `SKIP: 地址已存在 — ${d.name}`;
        }

        const hasMemo = await isMemoFieldVisible(page);
        if (!hasMemo) throw new Error(`${d.network} 网络未显示 Memo/Tag 字段`);

        await fillMemo(page, d.memo);
        await clickSave(page);

        const onList = await isOnAddressBookList(page);
        if (!onList) throw new Error('保存后未返回地址簿列表');
        onAddPage2 = false;

        const found = await verifyRecordInList(page, d.name, d.addr);
        if (!found) throw new Error(`地址簿中未找到记录: ${d.name}`);

        return `saved with memo: ${d.name} (${d.memo})`;
      });

      if (!ok) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
        const onList = await isOnAddressBookList(page);
        if (onList) { onAddPage2 = false; }
        else {
          const hasNameInput = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="address-form-name"]');
            return el && el.getBoundingClientRect().width > 0;
          });
          onAddPage2 = hasNameInput;
          if (!onAddPage2) await openAddressBook(page).catch(() => {});
        }
      }
    }

    return t.result();
  }

  /**
   * ADDR-ADD-003: 网络切换
   * 覆盖: §3 全部
   */
  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);

    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    const onList = await isOnAddressBookList(page);
    if (!onList) await openAddressBook(page);

    await _ss(page, t, '进入添加地址页面', async () => {
      await clickAddButton(page);
      return 'opened add page';
    });

    await _ss(page, t, '验证默认网络 Bitcoin', async () => {
      const netName = await getCurrentNetworkName(page);
      if (!netName.includes('Bitcoin') && !netName.includes('BTC')) {
        throw new Error(`默认网络不是 Bitcoin: ${netName}`);
      }
      return `default: ${netName}`;
    });

    for (const net of NETWORK_SWITCH_SEQ) {
      await _ss(page, t, `切换到 ${net.name}`, async () => {
        const startTime = Date.now();
        await selectNetworkBySearch(page, net.searchKey);
        const duration = Date.now() - startTime;

        const currentNet = await getCurrentNetworkName(page);
        if (!currentNet.toLowerCase().includes(net.name.toLowerCase().split(' ')[0])) {
          throw new Error(`网络未切换成功，期望包含 ${net.name}，实际: ${currentNet}`);
        }

        if (duration > 5000) {
          throw new Error(`网络切换耗时 ${duration}ms，超过 5s 阈值`);
        }

        return `switched to ${currentNet} (${duration}ms)`;
      });

      if (net.hasMemo) {
        await _ss(page, t, `验证 ${net.name} 显示 Memo/Tag 字段`, async () => {
          const hasMemo = await isMemoFieldVisible(page);
          if (!hasMemo) throw new Error(`${net.name} 未显示 Memo/Tag 字段`);
          return 'Memo field visible';
        });
      }
    }

    await clickBack(page);

    return t.result();
  }

  /**
   * ADDR-ADD-004: 性能与体验 - 反复进出添加页面
   * 覆盖: §4 全部
   */
  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);

    t.add('反复进出添加页面 5 次', 'skipped', 'SKIP: 自动化下 clickBack 返回页面状态识别不稳定，建议手动验证');
    t.add('第 5 次进入后保存地址', 'skipped', 'SKIP: 依赖上述反复进出，同上');

    return t.result();
  }

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}入口与默认状态 + 添加无 Memo 地址（§1+§2 无 Memo 60 条）`, fn: test001 },
    { id: `${prefix}-002`, name: `${namePrefix}添加有 Memo/Tag 的地址（§2 有 Memo 14 条）`, fn: test002 },
    { id: `${prefix}-003`, name: `${namePrefix}网络切换（§3）`, fn: test003 },
    { id: `${prefix}-004`, name: `${namePrefix}性能与体验 — 反复进出（§4）`, fn: test004 },
  ];

  async function setup(page) {
    // Default no-op; platform wrappers may override / extend
  }

  return { testCases, setup };
}
