// A numeral elsewhere in a row cannot substitute for its actual price column.
import assert from "node:assert/strict";
export function favoriteListProjection(start, element) {
  const cells = {};
  function walk(f) {
    for (let n = f.child; n; n = n.sibling) {
      const name = [
        n.type?.displayName,
        n.type?.type?.displayName,
        n.memoizedProps?.["data-sentry-element"],
        n.memoizedProps?.name,
      ].find((value) =>
        ["TokenPriceCellDesktop", "Token24hChangeCellDesktop"].includes(value),
      );
      if (
        ["TokenPriceCellDesktop", "Token24hChangeCellDesktop"].includes(name)
      ) {
        const stack = [n];
        let host;
        while (stack.length && !host) {
          const v = stack.pop();
          if (
            v.stateNode instanceof HTMLElement &&
            element.contains(v.stateNode)
          )
            host = v.stateNode;
          else {
            const children = [];
            for (let c = v.child; c; c = c.sibling) children.push(c);
            stack.push(...children.reverse());
          }
        }
        if (!host) throw Error(`No visible DOM for ${name}`);
        if (cells[name]) throw Error(`Duplicate ${name}`);
        cells[name] = {
          text: host.innerText.trim(),
          visible: host.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }),
        };
      } else walk(n);
    }
  }
  walk(start);
  let context;
  for (let n = start; n; n = n.return) {
    const v = n.memoizedProps?.value;
    if (v?.assetCtx && v?.token) {
      context = {
        name: v.token.name,
        price: String(v.assetCtx.markPrice),
        change: Number(v.assetCtx.change24hPercent),
      };
      break;
    }
  }
  const star = element.querySelector(
      '[data-testid="perp-already-favorite-icon-btn"]',
    ),
    name = [...element.querySelectorAll("span")].find(
      (n) => n.innerText === context?.name,
    );
  return {
    cells,
    context,
    starBeforeName:
      !!star &&
      !!name &&
      star.getBoundingClientRect().right <= name.getBoundingClientRect().left,
  };
}
export function assertFavoriteListRow(row, expectedName) {
  assert.equal(row.context?.name, expectedName, "Independent row identity");
  assert.equal(row.starBeforeName, true, "Star at left of token name");
  const price = row.cells.TokenPriceCellDesktop,
    change = row.cells.Token24hChangeCellDesktop;
  assert.equal(price?.visible, true, "Actual price cell visible");
  assert.equal(change?.visible, true, "Actual change cell visible");
  const text = price.text.replaceAll(",", "");
  assert.match(text, /^\d+(?:\.\d+)?$/u, "Price cell, not another row numeral");
  const raw = Number(row.context.price);
  assert.ok(raw > 0 && Number.isFinite(raw));
  const unit = 10 ** -(text.split(".")[1]?.length ?? 0);
  assert.ok(
    Math.abs(Number(text) - raw) <= unit + 1e-8,
    "Displayed price agrees with committed raw quote to its displayed precision",
  );
  const match = change.text
    .replace("−", "-")
    .match(/\/\s*([+-]?\d+(?:\.\d+)?)%$/u);
  assert.ok(match, "Actual 24h change column contains percentage");
  assert.ok(
    Math.abs(Number(match[1]) - row.context.change) <= 0.005000001,
    "24h percent agrees with committed raw quote",
  );
}
