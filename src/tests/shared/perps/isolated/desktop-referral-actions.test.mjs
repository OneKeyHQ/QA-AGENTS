import test from "node:test";
import assert from "node:assert/strict";
import { referralActionsFixture } from "./referral-actions-fixture.mjs";
for (const [accountId, show] of [
  ["hd-local--m/44/60", true],
  ["hw-local--m/44/60", true],
  ["imported--local", true],
  ["watching--local", false],
])
  test(`D02-19/22/23/31/44 actual eligibility and Checkbox ${accountId}`, async () => {
    const f = await referralActionsFixture({ props: { accountId } });
    try {
      assert.equal(Boolean(f.checkbox()), show);
      if (show) {
        assert.equal(f.checkbox().props.value, true);
        assert.ok(f.requests.some((r) => r.payload.type === "referral"));
      } else assert.equal(f.requests.length, 0);
      assert.equal(f.signatures.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [label, config] of [
  ["bound", { referredBy: "someone" }],
  [
    "other origin",
    { props: { sourceInfo: { origin: "https://example.invalid" } } },
  ],
  [
    "internal flow",
    { props: { sourceInfo: undefined, walletInternalSign: true } },
  ],
  ["offline", { failureAt: "userRole" }],
  ...["missing", "vault", "subAccount"].map((role) => [role, { role }]),
])
  test(`D02-20/21/72/73 actual visibility exclusion ${label}`, async () => {
    const f = await referralActionsFixture(config);
    try {
      assert.equal(f.checkbox(), undefined);
      assert.equal(f.signatures.length, 0);
      assert.equal(f.submitted.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [locale, expected] of [
  ["zh_CN", "使用 OneKey 邀请码，Hyperliquid 手续费立减 4%"],
  ["en_US", "Get 4% off Hyperliquid fees with OneKey’s code"],
])
  test(`D02-52/53/54 actual ${locale} Checkbox label and shared risk/footer structure`, async () => {
    const f = await referralActionsFixture({ locale });
    try {
      const c = f.checkbox();
      assert.equal(c.props.label, expected);
      assert.ok(!c.props.label.includes("1KREF"));
      let stack = c.parent;
      while (stack && typeof stack.type !== "string") stack = stack.parent;
      assert.equal(stack?.type, "Stack");
      assert.equal(stack.findAllByType("Checkbox").length, 2);
      let footer = stack.parent;
      while (footer && typeof footer.type !== "string") footer = footer.parent;
      assert.equal(footer?.type, "FooterActions");
    } finally {
      await f.close();
    }
  });
test("D02-53 original manual English apostrophe remains a strict pending alignment", async (t) => {
  const f = await referralActionsFixture({ locale: "en_US" });
  try {
    t.todo(
      "固定源码使用OneKey’s，手动原文使用OneKey's；不放宽精确文案断言，不计通过，属文案对齐待确认而非新交易bug",
    );
    assert.equal(
      f.checkbox().props.label,
      "Get 4% off Hyperliquid fees with OneKey's code",
    );
  } finally {
    await f.close();
  }
});
test("D02-32/62/64 actual checkbox opt-out persists across remount until exact two-week boundary; checking clears snooze", async () => {
  const f = await referralActionsFixture();
  try {
    await f.toggle(false);
    assert.equal(f.checkbox().props.value, false);
    const deadline = f.state.now + 14 * 86400000;
    assert.equal(f.snoozes.get("0xaaa"), deadline);
    for (const now of [f.state.now, deadline - 1]) {
      f.state.now = now;
      await f.remount();
      assert.equal(f.checkbox().props.value, false);
    }
    f.state.now = deadline;
    await f.remount();
    assert.equal(f.checkbox().props.value, true);
    await f.toggle(false);
    await f.toggle(true);
    assert.equal(f.snoozes.get("0xaaa"), 0);
    await f.remount();
    assert.equal(f.checkbox().props.value, true);
    assert.equal(f.signatures.length, 0);
  } finally {
    await f.close();
  }
});
test("D02-34/75 actual message confirm binds before resolving original signature; binding failure never replaces original result", async () => {
  for (const failureAt of [null, "build", "binding-sign", "submit"]) {
    const f = await referralActionsFixture({ failureAt });
    try {
      await f.confirm();
      assert.equal(f.resolved.length, 1);
      assert.equal(f.resolved[0].result, "0xlocal-approve-signature");
      assert.equal(f.rejected.length, 0);
      assert.equal(f.toasts.length, 1);
      assert.equal(f.submitted[0].code, "1KREF");
      if (failureAt === null) {
        assert.equal(f.signatures.length, 2);
        assert.equal(f.submitted.at(-1).action.code, "1KREF");
        assert.equal(f.state.referredBy, "local-referrer");
        await f.remount();
        assert.equal(
          f.checkbox(),
          undefined,
          "Actual referral service reads newly bound account and hides Checkbox",
        );
      } else assert.equal(f.state.referredBy, undefined);
    } finally {
      await f.close();
    }
  }
});
test("D02-33 rejection of original ApproveAgent signature does not snooze; referral signature rejection does", async () => {
  for (const failureAt of ["approve-sign", "binding-sign"]) {
    const f = await referralActionsFixture({ failureAt });
    try {
      if (failureAt === "approve-sign") {
        await assert.rejects(f.confirm(), /User cancelled/u);
        assert.equal(f.snoozes.size, 0);
        assert.equal(f.submitted.length, 0);
        assert.equal(f.resolved.length, 0);
      } else {
        await f.confirm();
        assert.equal(f.snoozes.get("0xaaa"), f.state.now + 14 * 86400000);
        assert.equal(f.resolved.length, 1);
      }
    } finally {
      await f.close();
    }
  }
});
test("D02-74 referral-info failure after valid user role retains Checkbox without binding side effects", async () => {
  const f = await referralActionsFixture({ failureAt: "referral" });
  try {
    assert.ok(f.checkbox());
    assert.equal(f.checkbox().props.value, true);
    assert.equal(f.signatures.length, 0);
  } finally {
    await f.close();
  }
});
test("D02-42/43 actual account-specific display and opt-out survive independent account remounts", async () => {
  const storage = new Map();
  for (const [address, referredBy, checked] of [
    ["0xaaa", undefined, true],
    ["0xbbb", "bound", null],
    ["0xccc", undefined, true],
    ["0xaaa", undefined, false],
  ]) {
    const f = await referralActionsFixture({ storage, address, referredBy });
    try {
      assert.equal(f.checkbox()?.props.value ?? null, checked);
      if (address === "0xaaa" && checked) await f.toggle(false);
    } finally {
      await f.close();
    }
  }
});
test("D02-21 non-ApproveAgent typed data never renders a referral Checkbox or issues referral info requests", async () => {
  const f = await referralActionsFixture({
    props: {
      unsignedMessage: {
        type: "typed-v4",
        message: JSON.stringify({
          message: { type: "order" },
          primaryType: "HyperliquidTransaction:ApproveAgent",
        }),
      },
    },
  });
  try {
    assert.equal(f.checkbox(), undefined);
    assert.equal(f.requests.length, 0);
    assert.equal(f.signatures.length, 0);
  } finally {
    await f.close();
  }
});
test("D02-23 zero-balance eligibility does not request balance; checked confirmation reaches only the local referral signature sink", async () => {
  const f = await referralActionsFixture();
  try {
    assert.equal(f.checkbox().props.value, true);
    assert.ok(
      f.requests.every((r) =>
        ["userRole", "referral"].includes(r.payload.type),
      ),
    );
    await f.confirm();
    assert.equal(f.signatures.filter((s) => s.binding).length, 1);
  } finally {
    await f.close();
  }
});
test("D02-33 HW referral rejection remount is unchecked while original signature rejection re-entry remains checked", async () => {
  for (const failureAt of ["approve-sign", "binding-sign"]) {
    const f = await referralActionsFixture({
      failureAt,
      props: { accountId: "hw-local--m/44/60" },
    });
    try {
      if (failureAt === "approve-sign")
        await assert.rejects(f.confirm(), /User cancelled/u);
      else await f.confirm();
      f.state.failureAt = null;
      await f.remount();
      assert.equal(f.checkbox().props.value, failureAt === "approve-sign");
    } finally {
      await f.close();
    }
  }
});
test("D02-62 five re-entries preserve opt-out and default selection without any signing", async () => {
  for (const checked of [true, false]) {
    const f = await referralActionsFixture();
    try {
      if (!checked) await f.toggle(false);
      for (let i = 0; i < 5; i++) {
        await f.remount();
        assert.ok(f.checkbox());
        assert.equal(f.checkbox().props.value, checked);
      }
      assert.equal(f.signatures.length, 0);
    } finally {
      await f.close();
    }
  }
});
test("D02-63 already-rendered Checkbox survives offline/recovery rerenders without overwriting its selection", async () => {
  const f = await referralActionsFixture();
  try {
    await f.toggle(false);
    const count = f.requests.length;
    f.state.failureAt = "userRole";
    await f.render();
    assert.equal(f.checkbox().props.value, false);
    f.state.failureAt = null;
    await f.render();
    assert.equal(f.checkbox().props.value, false);
    assert.equal(f.requests.length, count);
  } finally {
    await f.close();
  }
});
test("D02-42/44 same mounted actual signature footer recalculates bound/unbound account visibility without signing", async () => {
  const f = await referralActionsFixture();
  try {
    for (const [address, referredBy, visible] of [
      ["0xaaa", undefined, true],
      ["0xbbb", "bound", false],
      ["0xccc", undefined, true],
      ["0xaaa", undefined, true],
    ]) {
      f.state.address = address;
      f.state.referredBy = referredBy;
      f.props.accountId = `hd-${address}--m/44/60`;
      await f.render();
      assert.equal(Boolean(f.checkbox()), visible);
    }
    assert.equal(f.signatures.length, 0);
    assert.equal(f.submitted.length, 0);
  } finally {
    await f.close();
  }
});
