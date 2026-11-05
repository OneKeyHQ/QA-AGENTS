import { React, renderer, evaluateSource } from "./source.mjs";
const { act } = renderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const A = "0xaaa",
  B = "0xbbb"; // synthetic identities; never wallet addresses
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
export async function fixture(config = {}) {
  const { optOut, canTrade, address, statusAddress } = {
    optOut: true,
    canTrade: true,
    address: A,
    statusAddress: A,
    ...config,
  };
  const atoms = {
    account: { accountAddress: address },
    status: { canTrade },
    dust: { accountAddress: statusAddress, optOut },
  };
  const requests = [],
    toasts = [];
  let next;
  const fakeIntl = { formatMessage: ({ id }) => id };
  const toast = Object.fromEntries(
    ["error", "success", "loading"].map((kind) => [
      kind,
      ({ title }) => {
        const item = { kind, title, closed: false };
        toasts.push(item);
        return { close: () => (item.closed = true) };
      },
    ]),
  );
  const { SpotDustingOptOutSetting: Component } = evaluateSource(
    "packages/kit/src/views/Perp/components/PerpSettingsDialog.tsx",
    {
      names: ["SpotDustingOptOutSetting"],
      globals: {
        ...React,
        useIntl: () => fakeIntl,
        usePerpsActiveAccountAtom: () => [atoms.account],
        usePerpsActiveAccountStatusAtom: () => [atoms.status],
        usePerpsSpotDustingAtom: () => [atoms.dust],
        ETranslations: new Proxy({}, { get: (_, key) => key }),
        ListItem: "ListItem",
        Switch: "Switch",
        ESwitchSize: { small: "small" },
        Toast: toast,
        backgroundApiProxy: {
          serviceHyperliquidExchange: {
            setSpotDustingOptOut: (payload) => {
              requests.push(payload);
              return next?.promise ?? Promise.resolve();
            },
          },
        },
      },
    },
  );
  let tree;
  await act(async () => {
    tree = renderer.create(React.createElement(Component));
  });
  const update = async () =>
    act(async () => tree.update(React.createElement(Component)));
  return {
    atoms,
    requests,
    toasts,
    tree,
    update,
    remount: async () => {
      await act(async () => tree.unmount());
      await act(async () => {
        tree = renderer.create(React.createElement(Component));
      });
    },
    switch: () => tree.root.findByType("Switch").props,
    subtitle: () => tree.root.findByType("ListItem").props.subtitle,
    delay: () => (next = deferred()),
    click: async (value) => {
      if (!tree.root.findByType("Switch").props.disabled)
        await act(async () =>
          tree.root.findByType("Switch").props.onChange(value),
        );
    },
    dispose: async () => act(async () => tree.unmount()),
  };
}
