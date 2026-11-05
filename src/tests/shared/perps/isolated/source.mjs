// Execute actual source at a pinned upstream revision. No OneKey/network imports
// escape the explicit mock allowlist. This is component/logic coverage, not CDP.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import vm from "node:vm";
export const appRoot = resolve(
  process.env.PERPS_SOURCE_ROOT ?? "../app-monorepo",
);
export const sourceRef =
  process.env.PERPS_SOURCE_REF ?? "6fe766b8156befd546643446474df613efda0385";
export const appRequire = createRequire(resolve(appRoot, "package.json"));
export const ts = appRequire("typescript");
export const React = appRequire("react");
export const renderer = appRequire("react-test-renderer");
export const BigNumber = appRequire("bignumber.js");
export const sourceSha = execFileSync(
  "git",
  ["-C", appRoot, "rev-parse", sourceRef],
  { encoding: "utf8" },
).trim();
export const readSource = (file) =>
  execFileSync("git", ["-C", appRoot, "show", `${sourceSha}:${file}`], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
export function evaluateSource(file, { mocks = {}, names, globals = {} } = {}) {
  let source = readSource(file);
  if (names) {
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const found = ast.statements.filter(
      (node) =>
        names.includes(node.name?.text) ||
        (ts.isVariableStatement(node) &&
          node.declarationList.declarations.some((d) =>
            names.includes(d.name?.text),
          )),
    );
    if (found.length !== names.length)
      throw Error(`Source AST changed: ${file} ${names}`);
    source =
      found.map((node) => node.getText(ast)).join("\n") +
      `\nexport {${names.join(",")}};`;
  }
  return evaluateText(file, source, { mocks, globals });
}
export function evaluateCallback(file, name, globals) {
  const source = readSource(file),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  let callback;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name?.text === name &&
      ts.isCallExpression(node.initializer)
    )
      callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!callback || !ts.isArrowFunction(callback))
    throw Error(`Missing source callback ${name}`);
  return evaluateText(
    file,
    `export const callback = ${callback.getText(ast)};`,
    { globals },
  ).callback;
}
export function evaluateText(file, source, { mocks = {}, globals = {} } = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      ...globals,
      require: (name) => {
        if (name === "bignumber.js") return BigNumber;
        if (name === "react") return React;
        if (name === "react/jsx-runtime") return appRequire(name);
        if (Object.hasOwn(mocks, name)) return mocks[name];
        throw Error(`Unmocked import blocked: ${name} from ${file}`);
      },
    },
    { filename: file },
  );
  return module.exports;
}
export function perpsUtils() {
  const constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
  return evaluateSource("packages/shared/src/utils/perpsUtils.ts", {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
      "@onekeyhq/shared/types/hyperliquid/types": evaluateSource(
        "packages/shared/types/hyperliquid/types.ts",
        { names: ["EHyperLiquidAbstractionMode", "ETriggerOrderType"] },
      ),
      "./numberUtils": {
        numberFormat: () => {
          throw Error("Formatting not mocked for this test");
        },
      },
    },
  });
}
