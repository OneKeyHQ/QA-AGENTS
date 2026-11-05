// Execution scheduling only. Coverage and historical results remain unchanged.
// This module has no CDP, wallet, signing, network or order dependencies.
import assert from "node:assert/strict";

export const lanes = {
  observation: {
    title: "只读、输入与预览",
    group: "non-trading",
    target: "address-or-wallet",
  },
  account: {
    title: "账户设置与签名流程",
    group: "account-actions",
    target: "wallet",
  },
  orders: {
    title: "真实下单、改单、撤单与平仓",
    group: "trading",
    target: "wallet",
  },
  funds: { title: "真实存取款与资金流转", group: "trading", target: "wallet" },
};
// Reviewed steps that need wallet/permission changes, despite not creating an
// order. Do not classify these as read-only just because the order count is 0.
const accountRows = new Set([
  "D11-261",
  "D11-232",
  "D11-233",
  "D11-234",
  "D13-52",
  "D15-47",
  "D15-48",
  "D15-54",
  "D15-55",
  "D15-56",
  "D15-89",
  "D15-100",
  "D17-39",
  "D17-40",
  "D18-69",
  "D19-26",
  "D19-27",
  "D19-28",
  "D19-29",
  "D19-30",
]);
// Existing coverage labels describe an older no-order phase. These original
// rows explicitly confirm/submit, or race a mutation; execute them with the
// order queue even when their expected outcome is rejection/no new order.
const orderRows = new Set([
  "D08-40",
  "D08-41",
  "D08-49",
  "D08-50",
  "D08-121",
  "D10-173",
  "D11-59",
  "D11-102",
  "D11-294",
  "D12-108",
  "D13-51",
  "D13-94",
  "D18-58",
  "D18-59",
  "D18-70",
]);
export function executionLane(row) {
  assert.equal(row.desktopApplicable, true, "Desktop row required");
  const category = row.task?.category;
  if (category === "真实订单操作") return "orders";
  if (category === "真实资金操作") return "funds";
  assert.equal(
    category,
    "非下单场景",
    "Unclassified task category cannot default to read-only",
  );
  if (orderRows.has(row.rowId)) return "orders";
  if (row.rowId.startsWith("D02-") || accountRows.has(row.rowId))
    return "account";
  return "observation";
}

export function executionEntry(row) {
  const lane = executionLane(row);
  const text = `${row.desktopScenario} ${row.desktopSteps} ${row.desktopExpected}`;
  return {
    rowId: row.rowId,
    file: row.file,
    line: row.line,
    rowSha256: row.rowSha256,
    scenario: row.desktopScenario,
    steps: row.desktopSteps,
    expected: row.desktopExpected,
    lane,
    group: lanes[lane].group,
    targetRequirement: lanes[lane].target,
    // These tags assist scheduling; they never authorize an action or a pass.
    hasInputOrPreview: /输入|填写|滑块|滑杆|预览|校验/.test(text),
    usesExistingSample: /已有|已成交|持仓|历史|委托|记录/.test(text),
    pendingAssertionAudit: row.clauseAudit?.reviewStatus !== "已逐项审核",
    automationIds: [...new Set((row.newAssertions ?? []).map((a) => a.testId))],
    executionStatus: "未执行；执行前提供本批目标并核对当前账户，不沿用上批账户",
    constraints:
      lane === "observation"
        ? [
            "仅使用既有持仓/委托/历史样本；缺样本跳过，不自动下单造数据",
            "输入校验不完成授权；权限前置不满足时改用合适账户或跳过",
            "预览禁止最终确认；收藏/布局等本地偏好结束恢复并读回",
            "有请求失败/断网注入的场景先使用本地隔离测试，不向真实交易接口发请求",
          ]
        : lane === "account"
          ? [
              "不等同真实下单，但可能签名或修改交易权限/杠杆/远端设置",
              "本批指定钱包账户后单独执行，不与观察地址队列混跑",
            ]
          : [
              "执行时由用户提供本批钱包及账户、选定场景与交易参数",
              "提供观察地址或只选择账户不代表可以执行整组全部交易",
              "不从只读组自动切入此组，不自动下单构造样本",
            ],
  };
}

const addressPattern = /^0x[\da-fA-F]{40}$/;
export function validateTarget(target, lane) {
  assert.ok(Object.hasOwn(lanes, lane), "Unknown execution lane");
  assert.ok(
    target && typeof target === "object" && !Array.isArray(target),
    "执行前请提供本批观察地址，或钱包名和账户名",
  );
  const allowed =
    target.kind === "address"
      ? ["kind", "address"]
      : ["kind", "walletName", "accountName"];
  assert.ok(
    Object.keys(target).every((key) => allowed.includes(key)),
    "账户配置包含非约定字段；只接受公开地址或钱包/账户名称",
  );
  assert.ok(
    !Object.keys(target).some((k) =>
      /password|private|mnemonic|seed|secret/i.test(k),
    ),
    "配置只接受公开地址或钱包/账户名称，不接受密码、私钥或助记词",
  );
  if (target.kind === "address") {
    assert.equal(
      lanes[lane].target,
      "address-or-wallet",
      "此组需要钱包账户，观察地址不可执行签名或交易",
    );
    assert.match(
      target.address ?? "",
      addressPattern,
      "完整EVM观察地址 required",
    );
    return { kind: "address", address: target.address.toLowerCase() };
  }
  assert.equal(target.kind, "wallet", "target.kind must be address or wallet");
  for (const key of ["walletName", "accountName"])
    assert.ok(
      typeof target[key] === "string" && target[key].trim(),
      `${key} required`,
    );
  return {
    kind: "wallet",
    walletName: target.walletName.trim(),
    accountName: target.accountName.trim(),
  };
}

export function planExecution(entries, request) {
  assert.ok(
    request && typeof request === "object" && !Array.isArray(request),
    "请求必须是JSON对象",
  );
  assert.ok(
    Object.hasOwn(lanes, request.lane),
    "明确选择 observation / account / orders / funds；不能混跑",
  );
  const chosen = request.rowIds;
  assert.ok(
    Array.isArray(chosen) && chosen.length > 0,
    "执行前明确本批手动用例行；不默认全选",
  );
  assert.equal(new Set(chosen).size, chosen.length, "重复用例行");
  const byId = new Map(entries.map((r) => [r.rowId, r]));
  const rows = chosen.map((id) => {
    const row = byId.get(id);
    assert.ok(row, `未知Desktop用例 ${id}`);
    assert.equal(
      row.lane,
      request.lane,
      `${id} 属于 ${row.lane}，不可混入 ${request.lane}`,
    );
    return row;
  });
  const target = validateTarget(request.target, request.lane);
  return {
    lane: request.lane,
    target,
    rows,
    state: "awaiting-live-target-verification",
    canExecuteNow: false,
    next: "通过UI选中本批目标并读回账户地址/身份后，按对应脚本执行；本计划命令不连接App，也不发起交易",
    // Shared testCases can cover other lanes: never invoke a whole testCase
    // solely because one of its mapped manual rows was selected.
    automationCandidates: [...new Set(rows.flatMap((r) => r.automationIds))],
    candidateWarning:
      "候选脚本需逐组确认整段步骤均属于本lane；映射不等于可直接运行整组",
  };
}
