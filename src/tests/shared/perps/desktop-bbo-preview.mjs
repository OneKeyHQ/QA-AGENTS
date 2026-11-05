// Desktop preview assertions only; never click Buy/Sell or a confirmation.
import assert from "node:assert/strict";
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {RESULTS_DIR} from '../../helpers/index.mjs';
import { locator, currentPair } from "../../helpers/perps-ui.mjs";
import {waitInstrumentBoundary} from './instrument-readiness.mjs';
import { chooseUnit, pollForm, formRoot } from "./non-order-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  projectBboPreview,
  projectBboFormState,
} from "./bbo-preview-projection.mjs";
import { assertBboPreviewEvidence } from "./bbo-preview-evidence.mjs";
import { SampleUnavailable } from "./desktop-row-suite.mjs";

export async function prepareBboPreview(p) {
  await chooseUnit(p, "usd");
  // A local form fixture, never submitted. USD input also exercises the real
  // SizeInput conversion before reading the token amount from committed state.
  const size = locator(p, "perps.form.size");
  await size.fill("1000");
  assert.equal(await size.inputValue(), "1000");
}
export async function readBboForm(p) {
  // The ticker changes before the shared form/reset commits. Observe the same
  // canonical instrument boundary as chooseMode, without changing the mode.
  await waitInstrumentBoundary(p, await currentPair(p), formRoot(p));
  const states = await projectReactAll(formRoot(p), projectBboFormState);
  assert.equal(states.length, 1);
  return states[0];
}
export async function assertBboPreview(p, fixture) {
  const buttons = locator(p, "perps.perp-long-button").or(
    locator(p, "perps.perp-short-button"),
  );
  let errors, latest;
  const states = await pollForm(
    async () => (latest = await projectReactAll(buttons, projectBboPreview)),
    (values) => {
      if (values.length !== 2) return false;
      try {
        assert.deepEqual(values.map((v) => v.side).sort(), ["long", "short"]);
        for (const v of values) assertBboPreviewEvidence(v, fixture);
        return true;
      } catch (e) {
        errors = e;
        return false;
      }
    },
    `BBO双向金额/成本/强平价稳定${fixture.label}`,
  ).catch((e) => {
    writeFileSync(resolve(RESULTS_DIR, 'perps-desktop-completion', `bbo-preview-diagnostic-${Date.now()}.json`), JSON.stringify({fixture, error: (errors ?? e).message, latest}, null, 2));
    if (errors) throw errors;
    throw e;
  });
  const outputs = states.map((s) => ({
    side: s.side,
    ...assertBboPreviewEvidence(s, fixture),
  }));
  if (outputs.some((s) => !s.numericLiquidationSample))
    throw new SampleUnavailable(
      "金额及成本已核对；当前仓位/抵押条件下至少一侧没有有效强平价，需双侧数值样本，不能把--计为数值覆盖",
    );
  return outputs;
}
