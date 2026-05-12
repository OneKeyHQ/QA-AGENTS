import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import logger from './logger.js';
import { findWorkspaceRoot } from './workspaceRoot.js';
import process from 'process';

const rootDir = findWorkspaceRoot(process.cwd());

/**
 * 获取所有测试用例文件
 * @param {string|Array<string>} testCasePattern 测试用例模式或路径
 * @returns {Promise<Array<string>>} 测试用例文件路径列表
 */
export async function getTestFiles(testCasePattern) {
  if (!testCasePattern) {
    // 如果没有指定，从环境变量获取
    testCasePattern = process.env.SPECS || './test/**/*.e2e.js';
  }

  // 处理逗号分隔的字符串
  let patterns;
  if (Array.isArray(testCasePattern)) {
    patterns = testCasePattern;
  } else if (typeof testCasePattern === 'string' && testCasePattern.includes(',')) {
    patterns = testCasePattern.split(',').map(p => p.trim()).filter(p => p);
  } else {
    patterns = [testCasePattern];
  }

  const testFiles = new Set();

  for (const pattern of patterns) {
    let resolvedPattern = pattern;
    
    // 处理相对路径
    if (!path.isAbsolute(pattern)) {
      resolvedPattern = path.resolve(rootDir, pattern);
    }

    // 如果是文件，直接添加
    if (fs.existsSync(resolvedPattern) && fs.statSync(resolvedPattern).isFile()) {
      testFiles.add(resolvedPattern);
      continue;
    }

    // 如果是目录或glob模式，查找所有匹配的文件
    try {
      const files = await glob(resolvedPattern, {
        cwd: rootDir,
        absolute: false, // 使用相对路径，避免中文路径问题
      });
      // 转换为相对于项目根目录的路径
      files.forEach(file => {
        const absolutePath = path.resolve(rootDir, file);
        testFiles.add(absolutePath);
      });
    } catch (error) {
      logger.warn(`Failed to resolve pattern ${pattern}: ${error.message}`);
    }
  }

  const fileList = Array.from(testFiles);
  logger.info(`Found ${fileList.length} test file(s)`);
  return fileList;
}

/**
 * 将测试用例分配给不同的设备
 * @param {Array<string>} testFiles 测试用例文件列表
 * @param {Array<string>} deviceIds 设备ID列表
 * @returns {Array<{deviceId: string, testFiles: Array<string>}>} 分配结果
 */
export function distributeTestsToDevices(testFiles, deviceIds) {
  if (deviceIds.length === 0) {
    throw new Error('No devices available');
  }

  if (testFiles.length === 0) {
    throw new Error('No test files found');
  }

  const distribution = deviceIds.map(deviceId => ({
    deviceId,
    testFiles: [],
  }));

  // 轮询分配测试用例
  testFiles.forEach((testFile, index) => {
    const deviceIndex = index % deviceIds.length;
    distribution[deviceIndex].testFiles.push(testFile);
  });

  // 记录分配结果
  distribution.forEach(({ deviceId, testFiles }) => {
    logger.info(
      `Device ${deviceId}: assigned ${testFiles.length} test file(s)`,
    );
  });

  return distribution;
}

/**
 * 创建testSuite配置
 * @param {string} deviceId 设备ID
 * @param {Array<string>} testFiles 测试用例文件列表
 * @returns {Object} testSuite配置对象
 */
export function createTestSuite(deviceId, testFiles) {
  return {
    deviceId,
    testFiles,
    suiteName: `suite-${deviceId}`,
  };
}
