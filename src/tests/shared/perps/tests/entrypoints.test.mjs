import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// stdin/eval module loaders have no argv[1]. Importing wrappers must only register
// cases; it must never connect to CDP, launch Chrome, or execute a UI test.
test("三端 Perps 入口在无 argv[1] 的加载器中只注册，不启动 UI", () => {
  const script = `
    for (const platform of ['desktop', 'web', 'extension']) {
      for (const group of ['token-search', 'favorites', 'chart', 'portfolio', 'input-validation', 'dust-settings']) {
        const module = await import('./src/tests/' + platform + '/perps/' + group + '.test.mjs');
        if (!module.displayName || typeof module.setup !== 'function' || typeof module.run !== 'function') throw Error('Missing exports');
        if (module.testCases.some(c => c.fn.length !== 1)) throw Error('Invalid fn(page) contract');
      }
    }
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: new URL("../../../../../", import.meta.url),
      timeout: 5000,
      encoding: "utf8",
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "", "Import must not launch a runner or browser");
});

test("Desktop 全部新增边界入口可由 Dashboard 独立加载且用例 ID 不重复", () => {
  const script = `
    import {readdirSync} from 'node:fs';
    const directory='./src/tests/desktop/perps/',ids=new Set();
    for(const file of readdirSync(directory).filter(f=>f.endsWith('.test.mjs'))) {
      const module=await import(directory+file);
      if(!module.displayName || typeof module.setup!=='function' || typeof module.run!=='function') throw Error('Missing exports: '+file);
      if(!Array.isArray(module.testCases) || !module.testCases.length) throw Error('Missing cases: '+file);
      for(const c of module.testCases) {
        if(c.fn.length!==1) throw Error('Invalid fn(page): '+c.id);
        if(ids.has(c.id)) throw Error('Duplicate Desktop ID: '+c.id);
        ids.add(c.id);
      }
    }
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: new URL("../../../../../", import.meta.url),
      timeout: 10000,
      encoding: "utf8",
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "", "Loading boundary groups must not start UI");
});
