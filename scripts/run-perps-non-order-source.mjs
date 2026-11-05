#!/usr/bin/env node
// Pinned-source regression entry. Never connects to the user's wallet/CDP.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
  openSync,
  closeSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const workspace = resolve(import.meta.dirname, "..");
const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const app = resolve(
  option(
    "app",
    process.env.PERPS_SOURCE_ROOT ?? resolve(workspace, "../app-monorepo"),
  ),
);
const ref = option(
  "ref",
  process.env.PERPS_SOURCE_REF ?? "6fe766b8156befd546643446474df613efda0385",
);
const sha = execFileSync("git", ["-C", app, "rev-parse", ref], {
  encoding: "utf8",
}).trim();
const out = resolve(
  option("out", join(workspace, "shared/reports/perps-non-order-2026-10-28")),
);
mkdirSync(out, { recursive: true });
const requireApp = createRequire(join(app, "package.json"));
for (const dependency of [
  "jest",
  "typescript",
  "react",
  "react-test-renderer",
  "bignumber.js",
])
  requireApp.resolve(dependency);
let snapshot = option("snapshot");
if (!snapshot) {
  snapshot = mkdtempSync(join(tmpdir(), "perps-source-"));
  const archive = execFileSync("git", ["-C", app, "archive", sha], {
    maxBuffer: 256 * 1024 * 1024,
  });
  const extracted = spawnSync("tar", ["-x", "-C", snapshot], {
    input: archive,
  });
  if (extracted.status !== 0) throw Error("Source extraction failed");
  writeFileSync(join(snapshot, ".perps-source-sha"), sha + "\n");
}
snapshot = resolve(snapshot);
if (
  !existsSync(join(snapshot, ".perps-source-sha")) ||
  readFileSync(join(snapshot, ".perps-source-sha"), "utf8").trim() !== sha
)
  throw Error(
    "Cached snapshot has no matching source manifest; omit --snapshot to extract the requested revision",
  );
let dependencies = option("dependencies");
if (!dependencies) {
  dependencies = mkdtempSync(join(tmpdir(), "perps-source-deps-"));
  const pkg = JSON.parse(readFileSync(join(snapshot, "package.json")));
  const overlayPkg = JSON.parse(
    readFileSync(join(snapshot, "packages/components/package.json")),
  );
  const overlay = (
    overlayPkg.dependencies?.["@onekeyfe/react-native-native-overlay"] ??
    "6.7.0-14"
  ).replace(/^npm:/u, "");
  const sdk = pkg.dependencies["@nktkas/hyperliquid"];
  const installed = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      dependencies,
      "--no-package-lock",
      "--ignore-scripts",
      "--legacy-peer-deps",
      `date-fns-tz@${pkg.dependencies["date-fns-tz"]}`,
      `@nktkas/hyperliquid@${sdk}`,
      `@onekeyfe/react-native-native-overlay@${overlay}`,
    ],
    { stdio: "inherit" },
  );
  if (installed.status !== 0)
    throw Error("Isolated dependency installation failed");
  const patch = join(snapshot, `patches/@nktkas+hyperliquid+${sdk}.patch`);
  if (existsSync(patch)) {
    const result = spawnSync(
      "patch",
      ["-p1", "--batch", "--directory", dependencies],
      { input: readFileSync(patch), encoding: "utf8" },
    );
    if (result.status !== 0) throw Error(`SDK patch failed: ${result.stdout}`);
  }
}
dependencies = resolve(dependencies);
function linkMissingModules(target, original, { sdkOverride } = {}) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(original, { withFileTypes: true })) {
    const dest = join(target, entry.name),
      src = join(original, entry.name);
    if (entry.name.startsWith("@")) {
      if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) continue;
      mkdirSync(dest, { recursive: true });
      for (const item of readdirSync(src)) {
        const child = join(dest, item);
        const source =
          entry.name === "@nktkas" && item === "hyperliquid" && sdkOverride
            ? sdkOverride
            : join(src, item);
        if (!existsSync(child)) symlinkSync(source, child, "dir");
      }
    } else if (!existsSync(dest))
      symlinkSync(src, dest, entry.isDirectory() ? "dir" : "file");
  }
}
linkMissingModules(
  join(dependencies, "node_modules"),
  join(app, "node_modules"),
);
linkMissingModules(join(snapshot, "node_modules"), join(app, "node_modules"), {
  sdkOverride: join(dependencies, "node_modules/@nktkas/hyperliquid"),
});
if (
  realpathSync(join(snapshot, "node_modules/@nktkas/hyperliquid")) !==
  realpathSync(join(dependencies, "node_modules/@nktkas/hyperliquid"))
)
  throw Error(
    "Snapshot SDK differs from isolated patched SDK; use a fresh snapshot",
  );
const config = join(out, "source-jest.config.cjs");
const mappings = {
  "^date-fns-tz$": join(dependencies, "node_modules/date-fns-tz"),
  "^react-dom$": join(app, "node_modules/react-dom"),
  "^@onekeyfe/react-native-native-overlay$": join(
    dependencies,
    "node_modules/@onekeyfe/react-native-native-overlay",
  ),
  "^@nktkas/hyperliquid/signing$": join(
    dependencies,
    "node_modules/@nktkas/hyperliquid/esm/signing/mod.js",
  ),
  "^@onekeyhq/(.+)$": "<rootDir>/packages/$1",
};
writeFileSync(
  config,
  `module.exports=async()=>{const c=await require(${JSON.stringify(join(snapshot, "jest.config.js"))})();return{...c,rootDir:${JSON.stringify(snapshot)},reporters:['default'],moduleNameMapper:{...c.moduleNameMapper,...${JSON.stringify(mappings)}}};};\n`,
);
const files = execFileSync(
  "git",
  ["-C", app, "ls-tree", "-r", "--name-only", sha],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(
    (file) =>
      /\.test\.tsx?$/u.test(file) &&
      (file.startsWith("packages/kit/src/views/Perp/") ||
        file.startsWith(
          "packages/kit/src/components/TradingView/",
        ) ||
        /^packages\/shared\/src\/utils\/(?:perps|hyperliquid)/iu.test(file) ||
        file.startsWith("packages/kit-bg/src/services/ServiceHyperLiquid/") ||
        file.startsWith(
          "packages/kit/src/states/jotai/contexts/hyperliquid/",
        ) ||
        [
          "packages/kit-bg/src/services/ServiceMarketV2.perpsFavorites.test.ts",
          "packages/kit-bg/src/states/jotai/atoms/perps.test.ts",
          "packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityReferralCode.test.ts",
        ].includes(file)),
  );
writeFileSync(
  join(out, "source-suite-paths.json"),
  JSON.stringify(files, null, 2),
);
function runLogged(args, log, options = {}) {
  const fd = openSync(join(out, log), "w");
  try {
    return spawnSync(process.execPath, args, {
      cwd: workspace,
      stdio: ["ignore", fd, fd],
      ...options,
    });
  } finally {
    closeSync(fd);
  }
}
console.log(`Source ${sha}; ${files.length} upstream suites; no live orders`);
const jest = runLogged(
  [
    join(snapshot, "node_modules/jest/bin/jest.js"),
    "--config",
    config,
    "--runInBand",
    "--forceExit",
    "--runTestsByPath",
    ...files,
    "--json",
    `--outputFile=${join(out, "upstream-jest.json")}`,
  ],
  "upstream-jest.log",
  { cwd: snapshot },
);
const isolatedDir = join(workspace, "src/tests/shared/perps/isolated");
const isolatedFiles = readdirSync(isolatedDir)
  .filter((file) => file.endsWith(".test.mjs"))
  .map((file) => join(isolatedDir, file));
const isolated = runLogged(
  ["--test", "--test-reporter=tap", ...isolatedFiles],
  "isolated.tap",
  { env: { ...process.env, PERPS_SOURCE_ROOT: app, PERPS_SOURCE_REF: sha } },
);
const data = existsSync(join(out, "upstream-jest.json"))
  ? JSON.parse(readFileSync(join(out, "upstream-jest.json")))
  : {};
const tap = readFileSync(join(out, "isolated.tap"), "utf8");
const number = (label) =>
  Number(tap.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1] ?? 0);
const result = {
  sourceSha: sha,
  generatedAt: new Date().toISOString(),
  level: "isolated source/component; not live UI",
  upstream: {
    suites: data.numTotalTestSuites,
    passedSuites: data.numPassedTestSuites,
    failedSuites: data.numFailedTestSuites,
    passedTests: data.numPassedTests,
    failedTests: data.numFailedTests,
    exit: jest.status,
  },
  newIsolated: {
    tests: number("tests"),
    passed: number("pass"),
    failed: number("fail"),
    todo: number("todo"),
    exit: isolated.status,
  },
  trackedRegressions: [
    ...tap.matchAll(/^(not ok|ok) \d+ - (.+) # TODO (.*)$/gmu),
  ].map((match) => ({
    name: match[2],
    note: match[3],
    observed:
      match[1] === "not ok"
        ? "assertion-still-fails"
        : "assertion-passed-review-todo",
  })),
  snapshot,
  dependencies,
};
writeFileSync(
  join(out, "source-verification.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
process.exitCode = jest.status || isolated.status ? 1 : 0;
