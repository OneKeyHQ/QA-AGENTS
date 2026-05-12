import { spawn } from 'child_process';
import process from 'process';
import path from 'path';
import fs from 'fs';

import logger from '../../utils/logger.js';
import { findWorkspaceRoot } from '../../utils/workspaceRoot.js';
const rootDir = findWorkspaceRoot(process.cwd());

export const runTests = async function (platform, testCase = process.env.SPECS) {
  // TestCase config:  https://webdriver.io/docs/organizingsuites/#run-suites-and-test-specs
  // 处理相对路径：如果是相对路径，将其解析为相对于项目根目录的路径
  let specPath = testCase;
  if (testCase && !path.isAbsolute(testCase)) {
    // 解析为相对于项目根目录的路径
    const resolvedPath = path.resolve(rootDir, testCase);
    
    // 如果解析后的路径不存在，尝试其他可能的路径
    if (!fs.existsSync(resolvedPath)) {
      // 尝试将 ../test/xxx 转换为 ./test/xxx
      const normalizedPath = testCase.replace(/^\.\.\//, './');
      const alternativePath = path.resolve(rootDir, normalizedPath);
      
      if (fs.existsSync(alternativePath)) {
        specPath = alternativePath;
        logger.debug(`Path resolved: ${testCase} -> ${specPath}`);
      } else {
        // 如果还是不存在，使用原始解析的路径（让 wdio 报错）
        specPath = resolvedPath;
        logger.warn(`Test file not found at resolved path: ${resolvedPath}`);
      }
    } else {
      specPath = resolvedPath;
    }
  }

  const child = spawn(
    'npx',
    ['wdio', 'run', `packages/cli/confs/wdio.${platform}.conf.js`].concat(
      specPath ? ['--spec', specPath] : [],
    ),
    {
      stdio: 'inherit',
      shell: true,
      cwd: rootDir,
    },
  );

  child.on('close', code => {
    logger.info(`child process exited with code ${code}`);
  });
};
