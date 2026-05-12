import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import { findWorkspaceRoot } from './workspaceRoot.js';
import process from 'process';
import * as statusStore from './testRunStatusStore.js';

const rootDir = findWorkspaceRoot(process.cwd());

/**
 * 多设备测试执行器
 */
export class MultiDeviceRunner extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.results = new Map();
  }

  /**
   * 在指定设备上运行测试
   * @param {string} deviceId 设备ID
   * @param {Array<string>} testFiles 测试用例文件列表
   * @param {string} platform 平台
   * @param {number} port Appium端口（默认4723）
   * @returns {Promise<number>} 进程退出码
   */
  async runTestsOnDevice(deviceId, testFiles, platform, port = 4723) {
    return new Promise((resolve, reject) => {
      if (testFiles.length === 0) {
        logger.warn(`No test files for device ${deviceId}`);
        return resolve(0);
      }

      // 为每个设备创建独立的allure-results目录
      const deviceResultsDir = path.join(rootDir, 'allure-results', `device-${deviceId}`);
      if (!fs.existsSync(deviceResultsDir)) {
        fs.mkdirSync(deviceResultsDir, { recursive: true });
      }

      // 设置环境变量
      // 确保 NODE_OPTIONS 包含 ts-node loader，以支持 ES 模块和相对路径解析
      const nodeOptions = process.env.NODE_OPTIONS || '';
      const tsNodeLoader = '--loader ts-node/esm';
      let finalNodeOptions = nodeOptions.includes('ts-node/esm')
        ? nodeOptions
        : nodeOptions
          ? `${nodeOptions} ${tsNodeLoader}`
          : tsNodeLoader;
      // 禁用 Node 警告，避免 @wdio/appium-service 把 stderr 首行（ExperimentalWarning 等）当成错误导致 onPrepare 失败
      const suppressWarnings = '--disable-warning=ExperimentalWarning --disable-warning=DEP0180 --disable-warning=DEP0190';
      finalNodeOptions = finalNodeOptions ? `${finalNodeOptions} ${suppressWarnings}` : suppressWarnings;

      // 为 Android 平台确保 Android SDK 环境变量被设置
      let androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (platform.toLowerCase() === 'android' && !androidHome) {
        // 尝试默认路径
        const defaultAndroidSdkPath = process.platform === 'darwin' 
          ? `${process.env.HOME}/Library/Android/sdk`
          : `${process.env.HOME}/Android/Sdk`;
        
        // 检查路径是否存在
        if (fs.existsSync(defaultAndroidSdkPath)) {
          androidHome = defaultAndroidSdkPath;
        }
      }

      const env = {
        ...process.env,
        NODE_OPTIONS: finalNodeOptions,
        APPIUM_DEVICENAME: deviceId,
        APPIUM_PORT: port.toString(),
        // 设置ANDROID_SERIAL环境变量，确保adb命令使用正确的设备
        ANDROID_SERIAL: deviceId,
        // 设置独立的allure结果目录
        ALLURE_RESULTS_DIR: deviceResultsDir,
        SPECS: testFiles.join(','),
        NODE_E2E_PLATFORM: platform,
        NODE_E2E_FRAMEWORK: 'wdio',
        // 确保 Android SDK 环境变量被传递到子进程
        ...(androidHome && {
          ANDROID_HOME: androidHome,
          ANDROID_SDK_ROOT: androidHome,
        }),
      };

      logger.info(
        `Starting tests on device ${deviceId} (port ${port}) with ${testFiles.length} test file(s)`,
      );

      // 构建spec参数，支持多个文件
      // 使用绝对路径，确保路径解析正确（与wdioRunner.js保持一致）
      const specArgs = testFiles.flatMap(file => {
        // 确保是绝对路径
        const absolutePath = path.isAbsolute(file) 
          ? file
          : path.resolve(rootDir, file);
        return ['--spec', absolutePath];
      });

      // 直接用 node 跑 wdio，确保子进程继承 APPIUM_PORT，多设备时端口不冲突
      const wdioBin = path.join(rootDir, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
      const configPath = path.join(rootDir, 'packages', 'cli', 'confs', `wdio.${platform}.conf.js`);
      const child = spawn(
        process.execPath,
        [wdioBin, 'run', configPath, ...specArgs],
        {
          stdio: 'inherit',
          shell: false,
          cwd: rootDir,
          env,
        },
      );

      this.processes.set(deviceId, child);

      child.on('close', code => {
        statusStore.setDeviceComplete(deviceId, code);
        this.processes.delete(deviceId);
        const deviceResultsDir = path.join(rootDir, 'allure-results', `device-${deviceId}`);
        this.results.set(deviceId, { 
          exitCode: code, 
          testFiles,
          resultsDir: deviceResultsDir,
        });
        this.emit('device-complete', { deviceId, exitCode: code, resultsDir: deviceResultsDir });
        logger.info(`Device ${deviceId} completed with exit code ${code}`);
        resolve(code);
      });

      child.on('error', error => {
        this.processes.delete(deviceId);
        this.results.set(deviceId, { exitCode: 1, error, testFiles });
        this.emit('device-error', { deviceId, error });
        logger.error(`Device ${deviceId} error:`, error);
        reject(error);
      });
    });
  }

  /**
   * 并发执行多个设备的测试
   * @param {Array<{deviceId: string, testFiles: Array<string>}>} distributions 分配结果
   * @param {string} platform 平台
   * @param {number} basePort 基础端口号（默认4723）
   * @returns {Promise<{success: boolean, results: Map}>} 执行结果
   */
  async runConcurrentTests(distributions, platform, basePort = 4723) {
    const promises = distributions.map(({ deviceId, testFiles }, index) => {
      const port = basePort + index;
      return this.runTestsOnDevice(deviceId, testFiles, platform, port);
    });

    try {
      const exitCodes = await Promise.all(promises);
      const allSuccess = exitCodes.every(code => code === 0);
      
      return {
        success: allSuccess,
        results: this.results,
        exitCodes,
      };
    } catch (error) {
      logger.error('Error during concurrent test execution:', error);
      return {
        success: false,
        results: this.results,
        error,
      };
    }
  }

  /**
   * 停止所有正在运行的进程
   */
  stopAll() {
    this.processes.forEach((child, deviceId) => {
      logger.info(`Stopping process for device ${deviceId}`);
      child.kill('SIGTERM');
    });
    this.processes.clear();
  }
}
