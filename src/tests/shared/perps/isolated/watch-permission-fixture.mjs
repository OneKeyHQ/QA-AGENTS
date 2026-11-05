// Actual account selection callback -> actual account service -> actual derived
// status -> actual ensure hook/action -> actual full order list. Wallet chooser
// notifications, status RPC and storage are local; no signing/exchange imported.
import {
  evaluateSource,
  evaluateText,
  evaluateCallback,
  readSource,
  ts,
  perpsUtils,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { accountSwitchFixture } from "./account-switch-fixture.mjs";
import { tradingGuardFixture } from "./trading-guard-fixture.mjs";
import {
  openOrdersListFixture,
  openOrder,
} from "./open-orders-list-fixture.mjs";
const base = "packages/kit/src/views/Perp/";
export async function watchPermissionFixture() {
  const addr = "0x" + "b".repeat(40),
    accountId = "watching--local";
  const account = accountSwitchFixture({
    profile: async () => "watching",
    resolve: async () => ({ id: accountId, address: addr }),
  });
  const db = evaluateSource("packages/shared/src/consts/dbConsts.ts", {
    names: ["BOT_WALLET_ID_PREFIX", "WALLET_TYPE_WATCHING"],
  });
  const engine = evaluateSource("packages/shared/src/engine/engineConsts.ts", {
    names: ["SEPERATOR"],
  });
  const accountUtils = evaluateSource(
    "packages/shared/src/utils/accountUtils.ts",
    {
      names: [
        "parseBotWalletId",
        "extractBotWalletIdPrefix",
        "getWalletIdFromAccountId",
        "isWatchingWallet",
        "isWatchingAccount",
      ],
      globals: { ...db, ...engine },
    },
  );
  const atomFile = "packages/kit-bg/src/states/jotai/atoms/perps.ts",
    text = readSource(atomFile),
    ast = ts.createSourceFile(atomFile, text, ts.ScriptTarget.Latest, true);
  const decl = ast.statements.find(
    (n) =>
      ts.isVariableStatement(n) &&
      n.declarationList.declarations.some(
        (d) =>
          ts.isObjectBindingPattern(d.name) &&
          d.name.elements.some(
            (e) => e.name.text === "perpsActiveAccountStatusAtom",
          ),
      ),
  );
  if (!decl) throw Error("Derived status atom AST changed");
  const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
    names: ["EHyperLiquidAbstractionMode"],
  });
  const derived = evaluateText(atomFile, decl.getText(ast), {
    globals: {
      ...enums,
      accountUtils,
      perpsActiveAccountStatusInfoAtom: {
        atom: () => "perpsActiveAccountStatusInfoAtom",
      },
      perpsActiveAccountAtom: { atom: () => "perpsActiveAccountAtom" },
      perpsAbstractionModeAtom: { atom: () => "perpsAbstractionModeAtom" },
      globalAtomComputedR: ({ read }) => ({
        target: { get: async () => read((k) => account.data[k]) },
      }),
    },
  }).perpsActiveAccountStatusAtom;
  const readyDecl = ast.statements.find(
    (n) =>
      ts.isVariableStatement(n) &&
      n.declarationList.declarations.some(
        (d) =>
          ts.isObjectBindingPattern(d.name) &&
          d.name.elements.some(
            (e) => e.name.text === "perpsActiveAccountIsAgentReadyAtom",
          ),
      ),
  );
  if (!readyDecl) throw Error("Agent ready atom AST changed");
  const ready = evaluateText(atomFile, readyDecl.getText(ast), {
    globals: {
      perpsActiveAccountStatusAtom: { atom: () => "status" },
      globalAtomComputedR: ({ read }) => ({
        target: {
          get: async () => {
            const status = await derived.get();
            return read(() => status);
          },
        },
      }),
    },
  }).perpsActiveAccountIsAgentReadyAtom;
  const message = evaluateSource(
    "packages/kit/src/states/jotai/contexts/hyperliquid/utils/config.ts",
    {
      names: ["t", "getPerpsTradingNotEnabledMessage"],
      globals: { appLocale: { intl }, ETranslations },
    },
  );
  const events = { checks: [] };
  let guard;
  const Ensure = sourceClass(
    "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts",
    ["ensureTradingEnabled"],
    {
      contextAtomMethod: (fn) => (flow) => fn(null, null, flow),
      perpsActiveAccountIsAgentReadyAtom: ready,
      OneKeyLocalError: Error,
      ...message,
    },
  );
  const actions = { current: new Ensure() };
  const selectCallback = evaluateCallback(
    base + "components/PerpsGlobalEffects.tsx",
    "selectPerpsAccount",
    {
      globalDeriveType: "default",
      activeAccount: {
        account: { id: accountId, address: addr },
        wallet: { id: "watching" },
      },
      activeAccountRefreshHook: 0,
      accountUtils: { isExternalAccount: () => false },
      ...perpsUtils(),
      ...evaluateSource(base + "components/PerpsGlobalEffects.utils.ts", {
        names: ["shouldRunPerpsAccountSelect"],
      }),
      lastSelectParamsRef: { current: null },
      lastSelectAddressRef: { current: null },
      selectAccountRunIdRef: { current: 0 },
      isSelectingAccountRef: { current: false },
      actions: {
        current: {
          changeActivePerpsAccount: (p) =>
            account.service.changeActivePerpsAccount(p),
        },
      },
      checkPerpsAccountStatus: async (a) => {
        events.checks.push(a);
        account.data.perpsActiveAccountStatusInfoAtom = {
          accountAddress: addr,
          details: {
            agentOk: false,
            builderFeeOk: true,
            activatedOk: true,
            referralCodeOk: true,
            internalRebateBoundOk: true,
            abstractionOk: true,
          },
        };
      },
    },
  );
  await selectCallback();
  guard = tradingGuardFixture({
    account: account.data.perpsActiveAccountAtom,
    status: await derived.get(),
    actions,
    terms: false,
  });
  const list = await openOrdersListFixture(
    {
      account: addr,
      scopedAccount: addr,
      dataAccount: addr,
      orders: [openOrder(1, { tif: "Gtc" })],
      useEnsureTradingEnabled: guard.hooks.useEnsureTradingEnabled,
    },
    { chase: true },
  );
  return {
    account,
    derived,
    events,
    guard,
    list,
    addr,
    async preview() {
      await list.tick(() => {
        list.chaseButton(1)?.props.onPress();
      });
    },
    async confirm() {
      if (!list.activity.dialogs[0]) throw Error("Missing chase preview");
      await list.tick(() => list.activity.dialogs[0].onConfirm());
    },
    async close() {
      await list.close();
      await account.clock.tickAsync(account.delay);
    },
  };
}
