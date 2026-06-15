# DeFi Stakefish Desktop Recording Notes

> Recording source: `shared/results/recording/steps.json`
> Recorded at: 2026-06-11
> Target app: OneKey Desktop TF package `6.4.0 (20260610170)`
> Scope after user adjustment: SOL and ATOM follow the recorded full flow. ETH and POL only cover token detail display plus subscribe amount `100` yield calculation. ETH/POL must not submit transactions.

## Normalized Coverage

| Case ID | Token | Scope | Submit transaction | Recording steps | Main assertions |
| --- | --- | --- | --- | --- | --- |
| DEFI-STAKEFISH-SOL-001 | SOL | Detail display, APY popover, FAQ, amount validation, subscribe, history, redeem, position manage | Yes | 5-48 | Stakefish detail page displays SOL content; APY popover opens/closes; FAQ expands/collapses; `0.0000001` shows minimum `0.01 SOL`; `0.01` can continue; password prompt is handled if shown; history/position/redeem flow is reachable |
| DEFI-STAKEFISH-ATOM-001 | ATOM | Detail display, APY popover, FAQ, amount validation, subscribe, yield calculation probe, position manage, redeem, claim | Yes | 49-86 | Stakefish detail page displays ATOM content; FAQ expands/collapses; `0.01` can continue; `100` shows estimated annual yield; recorded yield sample: `17.72 ATOM ($31.9)` with `17.72% APR`; redeem/claim flow is reachable |
| DEFI-STAKEFISH-ETH-001 | ETH | Detail display and subscribe amount `100` yield calculation only | No | 87-101, 117-119 | Stakefish ETH detail content is visible; amount `100` can be entered; estimated annual yield is shown and formula is validated. Recorded yield sample: `2.2875 ETH (< $0.01)` with `2.29%` |
| DEFI-STAKEFISH-POL-001 | POL | Detail display and subscribe amount `100` yield calculation only | No | 120-140 for detail/FAQ/input evidence; submit/redeem steps excluded | Stakefish POL detail content is visible; APY popover/FAQ content is visible; script should input `100` and validate estimated annual yield. Recorded POL segment did not include a `100` probe, so this should be implemented from requirement rather than copied from the submit/redeem recording |

## Explicit Exclusions

- ETH recorded steps after detail probing include redeem/claim actions. They are excluded from automation.
- POL recorded steps include redeem, history filter, claim, account switching, and wallet switching. They are excluded from automation.
- ETH/POL scripts must stop before any `Continue`, `Confirm`, `Redeem`, `Claim`, password, or broadcast action.

## SOL Flow From Recording

1. Enter DeFi / staking list and open `SOL`.
2. Select `Stakefish`.
3. Open APY/info icon and close popover.
4. Scroll to FAQ and expand/collapse `Stakefish SOL 在 OneKey 上是如何运作的？`.
5. Return to subscribe form.
6. Enter invalid amount `0.0000001`.
7. Assert minimum amount validation: `最小金额为 0.01 SOL。`.
8. Enter valid amount `0.01`.
9. Click `继续`.
10. Confirm transaction.
11. If wallet password prompt appears, input configured wallet password.
12. Open `历史记录`.
13. Go to redeem flow, select redeem order, confirm redeem.
14. Assert submitted state/toast: `交易已提交` or pending/history status.
15. Open position tab and manage panel.

## ATOM Flow From Recording

1. From asset selector, open `ATOM`.
2. Select `Stakefish`.
3. Open APY/info icon and close popover.
4. Scroll to FAQ and expand/collapse `我该如何赎回我的资产？`.
5. Return to subscribe form.
6. Enter small amount `0.000001`, then valid amount `0.01`.
7. Click `继续` and handle confirm dialogs.
8. Enter amount `100` for yield calculation probe.
9. Assert estimated annual yield is visible. Recorded sample: `17.72 ATOM ($31.9)`.
10. Clear amount.
11. Open position tab and manage panel.
12. Redeem `0.01`, confirm redeem.
13. Trigger claim flow and confirm.
14. Verify the resulting submitted/pending/history state according to the actual page state.

## ETH / POL Reduced Flow

For both ETH and POL:

1. Enter DeFi asset list.
2. Open target token detail page.
3. Select `Stakefish`.
4. Assert page content is visible: token symbol, Stakefish provider, APY/APR, subscribe form, FAQ or about section.
5. Enter subscribe amount `100`.
6. Read estimated annual yield and APY/APR.
7. Validate formula with page values:
   - `estimated annual yield token amount ~= input amount * APY/APR`
   - Use current page APY/APR, not hardcoded values.
   - Allow display rounding tolerance.
8. Clear amount or leave page without clicking any submit/confirm action.

## Script Generation Notes

- Prefer existing desktop DeFi helper patterns from `src/tests/desktop/defi/lista-usdt.test.mjs`.
- Use `amount-input-input-element-input` for amount input when visible.
- Use `page-footer-confirm`, `dialog-confirm-btn`, and password prompt handling only for SOL/ATOM positive flows.
- Do not add recorded `wallet-hd-*` testids to shared semantic maps from this recording; wallet/account selection should be handled by runtime configuration if needed.
- Do not encode dynamic APY or yield numbers as fixed expected values. Read current page values and validate the relationship with tolerance.
