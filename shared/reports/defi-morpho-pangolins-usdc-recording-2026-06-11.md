# DeFi Morpho Pangolins USDC Desktop Recording Notes

> Recording source: `shared/results/recording/steps.json`
> Recorded at: 2026-06-11
> Target app: OneKey Desktop TF package `6.4.0`
> Scope: Morpho / Pangolins USDC stake flow.

## Normalized Coverage

| Case ID | Scope | Submit transaction | Recording steps | Main assertions |
| --- | --- | --- | --- | --- |
| DEFI-MORPHO-PANGOLINS-USDC-001 | Detail page content and APY/info display | No | 10-32 | Enters DeFi USDC Morpho/Pangolins detail; APY/info popover opens/closes; detail tabs/content are visible; team/audit/investor/risk content opens; `自动风控` dialog opens and closes |
| DEFI-MORPHO-PANGOLINS-USDC-002 | Input `100` for APY/yield calculation | No | 33-37 | Enter `100`; estimated annual yield is visible and matches the current page APY/APR calculation with tolerance. Recorded sample only: `4.002 USDC ($4)` |
| DEFI-MORPHO-PANGOLINS-USDC-003 | Actual subscribe submit | Yes | 38-44 | Clear `100`, input actual submit amount `0.01`; click `授权并认购`; confirm authorization/subscription dialogs; resulting state shows pending/history |
| DEFI-MORPHO-PANGOLINS-USDC-004 | Position management and redeem | Yes | 45-52 | Open portfolio tab; find Morpho/Pangolins USDC position; click `管理`; input redeem amount `0.001`; click `赎回`; confirm |

## Recorded Flow

1. Switch wallet/account to configured `ran / piggy` account.
2. Enter DeFi from sidebar.
3. Open `USDC`.
4. Select `MorphoPangolins USDC` detail.
5. Open APY/info icon, then close popover.
6. Scroll detail page and click/check:
   - `Pangolins资产`
   - `Morpho资产`
   - `资产`
   - `Paul Frambot`
   - `Ribbit Capital`
   - `Certora`
   - `自动风控`, then confirm `明白了！`
7. Return to subscribe input area.
8. Input sequence for validation/probe:
   - `0.0`
   - `0.01`
   - `100`
9. Assert estimated annual yield for `100` using the current page APY/APR value. Recorded sample only: `4.002 USDC ($4)`.
10. Clear amount.
11. Input actual submit amount `0.01`.
12. Click `授权并认购`.
13. Confirm both submit/authorization dialogs.
14. Assert pending/submitted/history state.
15. Open `持仓`.
16. Open Morpho/Pangolins USDC position management.
17. Input redeem amount `0.001`.
18. Click `赎回`.
19. Confirm redeem dialog.

## Script Generation Notes

- Do not hardcode recorded wallet ids such as `wallet-hd-32`; use runtime account configuration or current active account handling.
- `100` is only for APY/yield calculation and must not be submitted.
- Actual subscribe amount from recording is `0.01 USDC`.
- Redeem amount from recording is `0.001 USDC`.
- For dynamic APY/yield, read current page APY/APR and estimated annual yield values, then validate the relationship with tolerance. Do not hardcode `4.002 USDC ($4)` as an expected value; it is only the value observed during recording.
- Recorded `noscript`/HTML clicks at steps 1-3 are noise and should be excluded.

## Automation Status

- Script: `src/tests/desktop/defi/morpho-pangolins-usdc.test.mjs`
- Runner discovery: `desktop/defi/morpho-pangolins-usdc`
- `DEFI-MORPHO-PANGOLINS-USDC-001` verified on 2026-06-11: passed detail page/APY/info/content/risk checks.
- `DEFI-MORPHO-PANGOLINS-USDC-002` verified on 2026-06-11: passed dynamic APY/yield validation with current page value `100 * 4% ~= 4.002 USDC`.
- `DEFI-MORPHO-PANGOLINS-USDC-003` and `DEFI-MORPHO-PANGOLINS-USDC-004` are implemented for real subscribe/redeem flow but were not executed in this verification pass to avoid broadcasting a transaction without an explicit run request.
