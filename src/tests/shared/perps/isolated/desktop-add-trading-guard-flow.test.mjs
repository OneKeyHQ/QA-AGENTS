import test from "node:test";
import assert from "node:assert/strict";
import { mountAddForm } from "./add-position-fixture.mjs";
import { tradingGuardFixture } from "./trading-guard-fixture.mjs";
const hostButton = (f, id) =>
  f.find("Button").find((n) => n.props.testID === id);
const continueButton = (f) =>
  hostButton(f, "perp-enable-trading-steps-continue");
for (const accepted of [false, true]) {
  test(`D13-52 actual AddPositionForm guard -> full enable dialog -> actual terms/fallback hooks accepted=${accepted}, never submits from enabling`, async () => {
    const guard = tradingGuardFixture({ terms: accepted });
    const f = await mountAddForm({ guard });
    try {
      await f.amount("0.5");
      const entry = hostButton(f, "perp-is-disabled-btn");
      assert.ok(entry);
      assert.equal(entry.props.children, "启用交易");
      assert.equal(hostButton(f, "submit"), undefined);
      await f.tick(() => {
        void entry.props.onPress();
      });
      assert.equal(guard.events.checks, 1);
      assert.equal(guard.events.dialogs.length, 1);
      assert.equal(guard.events.dialogs[0].dismissOnOverlayPress, false);
      assert.equal(guard.events.dialogs[0].showFooter, false);
      assert.ok(continueButton(f));
      assert.equal(f.find("DialogTitle")[0].children.join(""), "启用交易");
      assert.equal(f.calls.orders.length, 0);
      await f.tick(() => continueButton(f).props.onPress());
      assert.equal(guard.events.passwords, 1);
      assert.equal(guard.events.terms, 1);
      assert.equal(guard.events.enables, accepted ? 1 : 0);
      assert.equal(
        f.calls.orders.length,
        0,
        "Enable confirm must not submit the add order",
      );
      assert.equal(f.calls.closed, 0);
      assert.equal(f.one("SizeInput").props.value, "0.5");
      if (accepted) {
        assert.equal(continueButton(f), undefined);
        assert.ok(hostButton(f, "submit"));
        await f.submit();
        assert.equal(
          f.calls.orders.length,
          1,
          "Separate add confirm reaches local order sink only after guard is ready",
        );
        assert.equal(f.calls.orders[0].size, "0.5");
      } else {
        assert.equal(continueButton(f).props.disabled, false);
        assert.ok(hostButton(f, "perp-is-disabled-btn"));
        await f.tick(() => guard.closeDialog());
        assert.equal(continueButton(f), undefined);
      }
    } finally {
      await f.close();
    }
  });
}
for (const reason of ["password", "status", "enable"]) {
  test(`D13-52 actual add enable ${reason} failure keeps zero orders, releases confirm and permits later retry`, async () => {
    const guard = tradingGuardFixture(
      reason === "password"
        ? { passwordError: "password local rejected" }
        : reason === "status"
          ? { checkError: "status local failed" }
          : {
              enable: async () => {
                throw Error("enable local rejected");
              },
            },
    );
    const f = await mountAddForm({ guard });
    try {
      await f.amount("0.5");
      await f.tick(() => {
        void hostButton(f, "perp-is-disabled-btn").props.onPress();
      });
      if (reason !== "status")
        await f.tick(() => continueButton(f).props.onPress());
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.ok(hostButton(f, "perp-is-disabled-btn"));
      assert.ok(
        guard.events.errors.includes(
          reason + " local " + (reason === "status" ? "failed" : "rejected"),
        ),
      );
      if (continueButton(f))
        assert.equal(continueButton(f).props.disabled, false);
      await f.tick(() => {
        guard.closeDialog();
        guard.update({
          passwordError: undefined,
          checkError: undefined,
          enable: undefined,
        });
      });
      await f.tick(() => {
        void hostButton(f, "perp-is-disabled-btn").props.onPress();
      });
      await f.tick(() => continueButton(f).props.onPress());
      assert.ok(hostButton(f, "submit"));
      assert.equal(f.calls.orders.length, 0);
    } finally {
      await f.close();
    }
  });
}
for (const blocked of ["unsupported", "selecting"]) {
  test(`D13-52 actual add guard ${blocked} hides order and enable actions`, async () => {
    const guard = tradingGuardFixture();
    if (blocked === "unsupported") guard.state.status.accountNotSupport = true;
    else guard.state.loading.selectAccountLoading = true;
    const f = await mountAddForm({ guard });
    try {
      assert.equal(hostButton(f, "submit"), undefined);
      const entry = hostButton(f, "perp-is-disabled-btn");
      assert.equal(entry.props.disabled, true);
      assert.equal(entry.props.onPress, undefined);
      assert.equal(guard.events.dialogs.length, 0);
      assert.equal(f.calls.orders.length, 0);
    } finally {
      await f.close();
    }
  });
}
