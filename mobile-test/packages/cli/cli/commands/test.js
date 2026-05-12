import fs from 'fs';
import { runTests as runWdioTests } from '../runners/wdioRunner.js';
import logger from '../../utils/logger.js';
import { FRAMEWORKS, PLATFORMS } from '../../utils/constants.js';
import { loadEnv } from '../../utils/loadEnv.js';
import { getAvailableDeviceIds } from '../../utils/adbHelper.js';
import { getTestFiles, distributeTestsToDevices } from '../../utils/testSuiteDistributor.js';
import { MultiDeviceRunner } from '../../utils/multiDeviceRunner.js';
import { DynamicDeviceRunner } from '../../utils/dynamicDeviceRunner.js';
import { mergeAllureReports, generateMergedAllureReport } from '../../utils/reportMerger.js';
import * as statusStore from '../../utils/testRunStatusStore.js';
import { startLiveReportServer } from '../../utils/liveReportServer.js';
import path from 'path';
import { findWorkspaceRoot } from '../../utils/workspaceRoot.js';
import process from 'process';

const rootDir = findWorkspaceRoot(process.cwd());

export const command = 'test';
export const desc = 'This is test command';

export const builder = {
  platform: {
    describe: 'Specify the platform',
    choices: Object.keys(PLATFORMS),
    type: 'string',
    demandOption: true,
  },
  framework: {
    describe: 'Specify the framework',
    choices: Object.keys(FRAMEWORKS),
    type: 'string',
    demandOption: true,
  },
  testCase: {
    describe: 'Specify test case',
    type: 'string',
  },
  multiDevice: {
    describe: 'Enable multi-device concurrent execution (Android only)',
    type: 'boolean',
    default: false,
  },
  dynamic: {
    describe: 'Enable dynamic task distribution (device gets new tasks when finished)',
    type: 'boolean',
    default: false,
  },
  basePort: {
    describe: 'Base port for Appium (used in multi-device mode)',
    type: 'number',
    default: 4723,
  },
  deviceSuites: {
    describe:
      'Multi-device only: comma-separated test patterns, one per device in order (e.g. "./test/addressBook/*.e2e.js,./test/onboarding/*.e2e.js")',
    type: 'string',
  },
};

export const handler = async function (props) {
  const { platform, framework, testCase, multiDevice, dynamic, basePort, deviceSuites } = props;
  logger.debug('Receive parameters', JSON.stringify(props));

  process.env['NODE_E2E_PLATFORM'] = platform;
  process.env['NODE_E2E_FRAMEWORK'] = framework;

  loadEnv(platform);

  if (framework === FRAMEWORKS.wdio) {
    // 多设备并发执行模式（仅Android平台）
    if (multiDevice && platform === PLATFORMS.android) {
      await runMultiDeviceTests(platform, testCase, basePort, dynamic, deviceSuites);
    } else {
      await runWdioTests(platform, testCase);
    }
  } else {
    throw new Error('Only support wdio');
  }
};

/**
 * 多设备并发执行测试
 * @param {string} platform 平台
 * @param {string} testCase 测试用例
 * @param {number} basePort 基础端口
 * @param {boolean} dynamic 是否使用动态分配
 * @param {string} [deviceSuites] 逗号分隔的用例集，按设备顺序一一对应（设备1跑第1个 pattern，设备2跑第2个...）
 */
async function runMultiDeviceTests(platform, testCase, basePort, dynamic = false, deviceSuites) {
  try {
    logger.info(`Starting ${dynamic ? 'dynamic' : 'static'} multi-device test execution...`);

    // 1. 获取可用设备
    const deviceIds = await getAvailableDeviceIds();
    if (deviceIds.length === 0) {
      throw new Error('No available Android devices found. Please connect at least one device.');
    }
    logger.info(`Found ${deviceIds.length} available device(s): ${deviceIds.join(', ')}`);

    let distributions = [];
    let testFiles = [];

    if (deviceSuites) {
      // 按设备指定用例集：deviceSuites = "pattern1,pattern2" => 设备1跑 pattern1，设备2跑 pattern2
      const patterns = deviceSuites.split(',').map(p => p.trim()).filter(p => p);
      if (patterns.length !== deviceIds.length) {
        throw new Error(
          `device-suites 数量(${patterns.length}) 与当前设备数量(${deviceIds.length}) 不一致，请提供 ${deviceIds.length} 个用例集（逗号分隔）`,
        );
      }
      logger.info('\n=== Device-Suite Mapping ===');
      for (let i = 0; i < deviceIds.length; i++) {
        const files = await getTestFiles(patterns[i]);
        if (files.length === 0) {
          logger.warn(`No test files for pattern: ${patterns[i]} (device ${deviceIds[i]})`);
        }
        distributions.push({ deviceId: deviceIds[i], testFiles: files });
        testFiles = testFiles.concat(files);
        logger.info(`Device ${deviceIds[i]}: ${files.length} file(s) from "${patterns[i]}"`);
      }
      logger.info('');
    } else {
      // 2. 获取测试用例文件并轮询分配
      testFiles = await getTestFiles(testCase);
      if (testFiles.length === 0) {
        throw new Error('No test files found');
      }
      distributions = distributeTestsToDevices(testFiles, deviceIds);
    }

    let runner;

    if (dynamic && !deviceSuites) {
      // 动态分配模式：使用任务队列
      logger.info('\n=== Dynamic Task Distribution ===');
      logger.info(`Total test files: ${testFiles.length}`);
      logger.info('Devices will automatically pick up new tasks when they finish current ones');
      logger.info('');
      statusStore.init(testFiles, deviceIds, 'dynamic');
      runner = new DynamicDeviceRunner();
      
      // 监听任务完成事件
      runner.on('task-complete', ({ deviceId, testFile, exitCode }) => {
        logger.info(`✓ Device ${deviceId} completed: ${path.basename(testFile)}`);
      });

      runner.on('task-error', ({ deviceId, testFile, error }) => {
        logger.error(`✗ Device ${deviceId} failed: ${path.basename(testFile)}`);
      });
    } else {
      // 静态分配模式：预先分配（使用 deviceSuites 时 distributions 已在上方构建）
      if (!deviceSuites) {
        distributions = distributeTestsToDevices(testFiles, deviceIds);
      }
      statusStore.initFromDistribution(distributions, deviceIds);
      if (!deviceSuites) {
        logger.info('\n=== Static Test Distribution ===');
        distributions.forEach(({ deviceId, testFiles: assignedFiles }) => {
          logger.info(`Device ${deviceId}: ${assignedFiles.length} test file(s)`);
          assignedFiles.forEach((file, index) => {
            const fileName = path.basename(file);
            logger.info(`  ${index + 1}. ${fileName}`);
          });
        });
        logger.info('');
      }
      runner = new MultiDeviceRunner();
    }
    
    // 监听设备完成事件
    runner.on('device-complete', ({ deviceId, exitCode, completedTasks }) => {
      if (completedTasks !== undefined) {
        logger.info(`Device ${deviceId} completed ${completedTasks} task(s) with exit code ${exitCode}`);
      } else {
        logger.info(`Device ${deviceId} test execution completed with exit code ${exitCode}`);
      }
    });

    runner.on('device-error', ({ deviceId, error }) => {
      logger.error(`Device ${deviceId} test execution failed:`, error);
    });

    // 处理进程退出
    const cleanup = () => {
      logger.info('Stopping all test processes...');
      runner.stopAll();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // 启动实时看板（动态展示设备/用例状态）
    const reportPort = parseInt(process.env.LIVE_REPORT_PORT || '5051', 10);
    try {
      await startLiveReportServer(reportPort, true);
    } catch (err) {
      logger.warn('Live report server failed to start:', err?.message || err);
    }

    // 执行测试
    let result;
    if (dynamic) {
      result = await runner.runDynamicTests(testFiles, deviceIds, platform, basePort);
    } else {
      result = await runner.runConcurrentTests(distributions, platform, basePort);
    }

    // 清理
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
    statusStore.setFinished();

    // 输出结果摘要
    logger.info('\n=== Test Execution Summary ===');
    const deviceResultsDirs = [];
    
    if (dynamic) {
      // 动态模式：显示每个设备执行的任务数
      result.results.forEach((deviceResult, deviceId) => {
        const status = deviceResult.exitCode === 0 ? 'PASSED' : 'FAILED';
        const taskCount = deviceResult.testFiles.length;
        logger.info(`Device ${deviceId}: ${status} (${taskCount} task(s) executed)`);
        
        if (deviceResult.resultsDir) {
          deviceResultsDirs.push(deviceResult.resultsDir);
        }
      });
      logger.info(`Total tasks: ${result.totalTasks}, Executed: ${result.executedTasks}`);
    } else {
      // 静态模式：显示预分配的任务
      distributions.forEach(({ deviceId, testFiles: assignedFiles }) => {
        const deviceResult = result.results.get(deviceId);
        const status = deviceResult?.exitCode === 0 ? 'PASSED' : 'FAILED';
        logger.info(`Device ${deviceId}: ${status} (${assignedFiles.length} test file(s))`);
        
        if (deviceResult?.resultsDir) {
          deviceResultsDirs.push(deviceResult.resultsDir);
        }
      });
    }

    // 5. 合并所有设备的报告
    if (deviceResultsDirs.length > 0) {
      logger.info('\n=== Merging Reports ===');
      try {
        await mergeAllureReports(deviceResultsDirs, 'allure-results');
        await generateMergedAllureReport('allure-results', true);
        logger.info('All reports merged successfully!');
      } catch (error) {
        logger.error('Failed to merge reports:', error);
        // 报告合并失败不影响测试结果
      }
    }

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Multi-device test execution failed:', error);
    process.exit(1);
  }
}
