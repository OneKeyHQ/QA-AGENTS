import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { globSync } from 'glob';

import step, { getSteps } from '@node-e2e/cli/services/composer/core/step.js';

function executeCode(fullPath, step) {
  return new Promise((resolve, reject) => {
    try {
      const code = fs.readFileSync(fullPath, 'utf-8');
      const sandbox = {
        step: step, // 将 step 函数添加到沙盒环境中
        console: console, // 保留 console 访问
        require: require, // 如果 .step.js 文件需要使用 require
        // 添加其他你需要的全局对象或模块
      };
      vm.createContext(sandbox);
      new vm.Script(code).runInContext(sandbox);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function addE2EPropertyToSteps(steps) {
  Object.keys(steps).forEach(key => {
    const step = steps[key];
    const baseDir = '../../test';
    const idParts = key.split('.');
    const dir = idParts.length > 1 ? idParts[0] : key;
    const filePath = path.join(baseDir, dir, `${key}.e2e.js`);

    if (fs.existsSync(filePath)) {
      step.e2e = true;
    }
  });
}

export default async function loadSteps() {
  const cacheSteps = getSteps();
  if (Object.keys(cacheSteps).length > 0) {
    return cacheSteps;
  }

  const stepsDir = path.join(process.cwd(), '../../', 'stories');

  const files = globSync('**/*.step.js', {
    cwd: stepsDir,
  });

  await Promise.all(
    files.map(file => {
      const fullPath = path.join(stepsDir, file);
      return executeCode(fullPath, step);
    }),
  );
  let steps = getSteps();
  addE2EPropertyToSteps(steps);

  return steps;
}
