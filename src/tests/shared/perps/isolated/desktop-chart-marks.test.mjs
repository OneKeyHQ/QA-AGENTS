import test from "node:test";
import assert from "node:assert/strict";
import { chartMarksFixture, fill } from "./chart-marks-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
test("D04-104/194 actual marks: history plus live fill during request merge once in chronological order", async () => {
  const f = await chartMarksFixture();
  try {
    assert.deepEqual(f.listenerCounts(), [1, 1]);
    assert.equal(f.requests.length, 1);
    assert.deepEqual(plain(f.requests[0].options), { force: false });
    await f.emit([fill(2, { side: "A", dir: "Close Long", px: "105.25" })]);
    await f.resolve(0, [
      fill(1),
      fill(2, { side: "A", dir: "Close Long", px: "105.25" }),
    ]);
    assert.deepEqual(plain(f.marks), [
      {
        id: "BTC:1:1800000001000",
        label: "B",
        text: "做多\n1.25 @ 100.5",
        time: 1800000001,
      },
      {
        id: "BTC:2:1800000002000",
        label: "S",
        text: "平多\n1.25 @ 105.25",
        time: 1800000002,
      },
    ]);
  } finally {
    await f.close();
  }
});
for (const field of ["user", "type", "subType"])
  test(`D04-192 actual marks reject foreign ${field} events with positive event control`, async () => {
    const f = await chartMarksFixture();
    try {
      await f.resolve(0, [fill()]);
      await f.emit([fill(2)], { [field]: "foreign" });
      assert.equal(f.marks.length, 1);
      await f.emit([fill(3)], { user: "0xaaa" });
      assert.equal(f.marks.length, 2);
    } finally {
      await f.close();
    }
  });
test("D04-192 actual same-mount A to B hides old marks and ignores both late A history and old event", async () => {
  const f = await chartMarksFixture();
  try {
    await f.emit([fill()]);
    assert.equal(f.marks.length, 1);
    await f.update({ accountAddress: "0xBbB" });
    assert.equal(f.marks.length, 0);
    assert.equal(f.requests[1].address, "0xBbB");
    await f.resolve(0, [fill(2)]);
    await f.emit([fill(3)], { user: "0xaaa" });
    assert.equal(f.marks.length, 0);
    await f.resolve(1, [fill(4)]);
    assert.equal(f.marks[0].id, "BTC:4:1800000004000");
    assert.deepEqual(f.listenerCounts(), [1, 1]);
    await f.update({ accountAddress: undefined });
    assert.equal(f.marks.length, 0);
    assert.deepEqual(f.listenerCounts(), [0, 0]);
  } finally {
    await f.close();
  }
});
test("D04-192 actual coin switch clears marks immediately, late old response cannot repaint; only canonical target accepted", async () => {
  const f = await chartMarksFixture();
  try {
    await f.emit([fill()]);
    await f.update({ instrument: { coin: "xyz:BTC", mode: "perp" } });
    assert.equal(f.marks.length, 0);
    await f.resolve(0, [fill(2)]);
    await f.resolve(1, [fill(3), fill(4, { coin: "xyz:BTC" })]);
    assert.deepEqual(plain(f.marks.map((m) => m.id)), [
      "xyz:BTC:4:1800000004000",
    ]);
  } finally {
    await f.close();
  }
});
test("D04-183 actual spot aliases match @asset and universe, same-name perp and other pair excluded", async () => {
  const f = await chartMarksFixture({
    instrument: {
      coin: "@1",
      mode: "spot",
      assetId: 10001,
      universe: { name: "UBTC/USDC" },
    },
  });
  try {
    await f.resolve(0, [
      fill(1, { coin: "@1" }),
      fill(2, { coin: "UBTC/USDC", side: "A" }),
      fill(3),
      fill(4, { coin: "@2" }),
    ]);
    assert.equal(f.marks.length, 2);
    assert.equal(f.marks[0].text, "购买\n1.25 @ 100.5");
    assert.equal(f.marks[1].text, "出售\n1.25 @ 100.5");
    await f.update({
      instrument: {
        coin: "@2",
        mode: "spot",
        assetId: 10002,
        universe: { name: "ETH/USDC" },
      },
    });
    assert.equal(f.marks.length, 0);
  } finally {
    await f.close();
  }
});
test("D04-105/106/169/194 toggle hides immediately and detaches events; reenable merges current history and survives request error", async () => {
  const f = await chartMarksFixture();
  try {
    await f.resolve(0, [fill()]);
    await f.update({ showTradeMarks: false });
    assert.equal(f.marks.length, 0);
    assert.deepEqual(f.listenerCounts(), [0, 0]);
    await f.emit([fill(2)]);
    await f.recover();
    assert.equal(f.requests.length, 1);
    await f.update({ showTradeMarks: true });
    assert.equal(f.marks.length, 1);
    assert.equal(f.requests.length, 2);
    await f.reject(1);
    assert.equal(f.marks.length, 1);
    await f.recover();
    assert.equal(f.requests.length, 3);
    assert.deepEqual(plain(f.requests[2].options), { force: true });
    await f.resolve(2, [fill(2)]);
    assert.equal(f.marks.length, 2);
  } finally {
    await f.close();
  }
});
for (const trigger of ["refreshHook", "restoreNonce"])
  test(`D04-194 actual ${trigger} forces history, failure retains same-account marks and retry merges`, async () => {
    const f = await chartMarksFixture();
    try {
      await f.resolve(0, [fill()]);
      await f.update({ [trigger]: 1 });
      assert.equal(f.requests.length, 2);
      assert.equal(f.requests[1].options.force, true);
      await f.reject(1);
      assert.equal(f.marks.length, 1);
      await f.update({ [trigger]: 2 });
      await f.resolve(2, [fill(2)]);
      assert.equal(f.marks.length, 2);
    } finally {
      await f.close();
    }
  });
test("D04-104 actual duplicate identity updates quantity, finite times only, sorted cap retains latest 2000", async () => {
  const f = await chartMarksFixture();
  try {
    await f.resolve(
      0,
      Array.from({ length: 2003 }, (_, i) => fill(2003 - i)),
    );
    assert.equal(f.marks.length, 2000);
    assert.equal(f.marks[0].id, "BTC:4:1800000004000");
    assert.equal(f.marks.at(-1).id, "BTC:2003:1800002003000");
    await f.emit([
      fill(2003, { sz: "2" }),
      fill(2004, { time: NaN }),
      fill(2005, { time: Infinity }),
      fill(2006, { time: "1800002006000" }),
    ]);
    assert.equal(f.marks.length, 2000);
    assert.equal(f.marks.at(-1).text, "做多\n2 @ 100.5");
  } finally {
    await f.close();
  }
});
test("D04-104 actual missing tid uses order id and milliseconds floor to seconds; zero time remains valid", async () => {
  const f = await chartMarksFixture();
  try {
    await f.resolve(0, [
      fill(1, { tid: undefined, oid: 88, time: 0 }),
      fill(2, { time: 1800000002999 }),
    ]);
    assert.deepEqual(plain(f.marks.map((m) => [m.id, m.time])), [
      ["BTC:88:0", 0],
      ["BTC:2:1800000002999", 1800000002],
    ]);
  } finally {
    await f.close();
  }
});
test("D04-104 actual locale change relabels loaded marks without history request, preserves all nontext fields and localizes new live marks", async () => {
  const f = await chartMarksFixture();
  try {
    const directions = [
      "Open Long",
      "Open Short",
      "Close Long",
      "Close Short",
      "Long > Short",
      "Short > Long",
      "Liquidated Cross Long",
    ];
    await f.resolve(
      0,
      directions.map((dir, i) => fill(i + 1, { dir, side: i % 2 ? "A" : "B" })),
    );
    const before = plain(f.marks);
    await f.update({ locale: "en_US" });
    assert.deepEqual(plain(f.marks.map((m) => m.text.split("\n")[0])), [
      "Long",
      "Short",
      "Close Long",
      "Close Short",
      "Long > Short",
      "Short > Long",
      "Liquidated Cross Long",
    ]);
    assert.deepEqual(
      plain(f.marks.map(({ text, ...m }) => m)),
      before.map(({ text, ...m }) => m),
    );
    assert.equal(f.requests.length, 1);
    await f.emit([fill(8, { dir: "Close Short" })]);
    assert.equal(f.marks.at(-1).text, "Close Short\n1.25 @ 100.5");
  } finally {
    await f.close();
  }
});
test("D04-195 actual marks hook unmount removes both listeners; outstanding history and recovery cannot add subscriptions", async () => {
  const f = await chartMarksFixture();
  await f.close();
  assert.deepEqual(f.listenerCounts(), [0, 0]);
  await f.resolve(0, [fill()]);
  await f.recover();
  assert.equal(f.requests.length, 1);
});
for (const patch of [{ accountAddress: "" }, { showTradeMarks: false }])
  test(`D04-194 actual no account/hidden is request-free ${JSON.stringify(patch)}`, async () => {
    const f = await chartMarksFixture(patch);
    try {
      assert.equal(f.requests.length, 0);
      assert.equal(f.marks.length, 0);
      assert.deepEqual(f.listenerCounts(), [0, 0]);
    } finally {
      await f.close();
    }
  });
