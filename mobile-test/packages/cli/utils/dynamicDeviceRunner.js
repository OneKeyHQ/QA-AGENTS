import { spawn } from 'child_process';
import { createServer } from 'node:net';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import { findWorkspaceRoot } from './workspaceRoot.js';
import process from 'process';
import * as statusStore from './testRunStatusStore.js';

const rootDir = findWorkspaceRoot(process.cwd());

/** 每台设备间隔 10 个端口，避免与系统或其他进程占用冲突（4723, 4733, 4743...） */
const PORT_STEP = 10;

/**
 * 获取一个可用端口（先尝试 preferred，若被占用则递增直到可用）
 * @param {number} preferred
 * @returns {Promise<number>}
 */
function getAvailablePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        server.close();
        getAvailablePort(preferred + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.listen(preferred, '127.0.0.1');
  });
}

/**
 * 动态多设备测试执行器（支持动态任务分配）
 * 当设备完成当前任务后，会自动从任务队列中获取新任务
 */
export class DynamicDeviceRunner extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.results = new Map();
    this.taskQueue = [];
    this.deviceStatus = new Map(); // deviceId -> { isRunning: boolean, completedTasks: number }
    this.allTasksCompleted = false;
  }

  /**
   * 在指定设备上运行单个测试文件
   * @param {string} deviceId 设备ID
   * @param {string} testFile 测试用例文件
   * @param {string} platform 平台
   * @param {number} port Appium端口
   * @returns {Promise<number>} 进程退出码
   */
  async runSingleTestOnDevice(deviceId, testFile, platform, port) {
    return new Promise((resolve, reject) => {
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
        ANDROID_SERIAL: deviceId,
        ALLURE_RESULTS_DIR: deviceResultsDir,
        SPECS: testFile,
        NODE_E2E_PLATFORM: platform,
        NODE_E2E_FRAMEWORK: 'wdio',
        // 确保 Android SDK 环境变量被传递到子进程
        ...(androidHome && {
          ANDROID_HOME: androidHome,
          ANDROID_SDK_ROOT: androidHome,
        }),
      };

      logger.info(`Device ${deviceId}: executing ${path.basename(testFile)} (Appium port: ${port})`);
      statusStore.setRunning(deviceId, testFile);

      // 使用绝对路径，确保路径解析正确（与wdioRunner.js保持一致）
      const specPath = path.isAbsolute(testFile)
        ? testFile
        : path.resolve(rootDir, testFile);

      // 直接用 node 跑 wdio，避免 npx+shell 导致子进程未继承 APPIUM_PORT，多设备时端口冲突
      const wdioBin = path.join(rootDir, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
      const configPath = path.join(rootDir, 'packages', 'cli', 'confs', `wdio.${platform}.conf.js`);
      const child = spawn(
        process.execPath,
        [
          wdioBin,
          'run',
          configPath,
          '--spec',
          specPath,
        ],
        {
          stdio: 'inherit',
          shell: false,
          cwd: rootDir,
          env,
        },
      );

      child.on('close', code => {
        statusStore.setComplete(deviceId, testFile, code);
        const status = this.deviceStatus.get(deviceId) || { completedTasks: 0 };
        status.completedTasks += 1;
        status.isRunning = false;
        this.deviceStatus.set(deviceId, status);

        logger.info(`Device ${deviceId}: completed ${path.basename(testFile)} (exit code: ${code})`);
        this.emit('task-complete', { deviceId, testFile, exitCode: code });
        resolve(code);
      });

      child.on('error', error => {
        statusStore.setComplete(deviceId, testFile, 1);
        const status = this.deviceStatus.get(deviceId) || { completedTasks: 0 };
        status.isRunning = false;
        this.deviceStatus.set(deviceId, status);

        logger.error(`Device ${deviceId}: error executing ${path.basename(testFile)}:`, error);
        this.emit('task-error', { deviceId, testFile, error });
        reject(error);
      });
    });
  }

  /**
   * 设备工作循环：持续从任务队列获取任务并执行
   * @param {string} deviceId 设备ID
   * @param {string} platform 平台
   * @param {number} port Appium端口
   */
  async deviceWorker(deviceId, platform, port) {
    const status = { isRunning: false, completedTasks: 0 };
    this.deviceStatus.set(deviceId, status);

    logger.info(`Device ${deviceId}: worker started`);

    while (!this.allTasksCompleted || this.taskQueue.length > 0) {
      // 从队列中获取任务
      const testFile = this.taskQueue.shift();

      if (!testFile) {
        // 队列为空，等待一下再检查
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      status.isRunning = true;
      this.deviceStatus.set(deviceId, status);

      try {
        const exitCode = await this.runSingleTestOnDevice(deviceId, testFile, platform, port);
        
        // 记录结果
        if (!this.results.has(deviceId)) {
          this.results.set(deviceId, {
            exitCode: exitCode === 0 ? 0 : 1,
            testFiles: [],
            resultsDir: path.join(rootDir, 'allure-results', `device-${deviceId}`),
          });
        }
        
        const result = this.results.get(deviceId);
        result.testFiles.push({ file: testFile, exitCode });
        
        // 如果任务失败，更新整体退出码
        if (exitCode !== 0 && result.exitCode === 0) {
          result.exitCode = 1;
        }
      } catch (error) {
        logger.error(`Device ${deviceId}: failed to execute ${path.basename(testFile)}:`, error);
        
        if (!this.results.has(deviceId)) {
          this.results.set(deviceId, {
            exitCode: 1,
            testFiles: [],
            resultsDir: path.join(rootDir, 'allure-results', `device-${deviceId}`),
          });
        }
        
        const result = this.results.get(deviceId);
        result.testFiles.push({ file: testFile, exitCode: 1, error });
      }
    }

    const finalStatus = this.deviceStatus.get(deviceId);
    logger.info(`Device ${deviceId}: worker completed (${finalStatus.completedTasks} task(s) executed)`);
    this.emit('device-complete', { 
      deviceId, 
      exitCode: this.results.get(deviceId)?.exitCode || 0,
      completedTasks: finalStatus.completedTasks,
    });
  }

  /**
   * 动态并发执行测试（支持动态任务分配）
   * @param {Array<string>} testFiles 所有测试文件列表
   * @param {Array<string>} deviceIds 设备ID列表
   * @param {string} platform 平台
   * @param {number} basePort 基础端口号（默认4723）
   * @returns {Promise<{success: boolean, results: Map}>} 执行结果
   */
  async runDynamicTests(testFiles, deviceIds, platform, basePort = 4723) {
    if (testFiles.length === 0) {
      throw new Error('No test files to execute');
    }

    if (deviceIds.length === 0) {
      throw new Error('No devices available');
    }

    // 初始化任务队列与实时看板状态
    this.taskQueue = [...testFiles];
    this.allTasksCompleted = false;
    this.results.clear();
    this.deviceStatus.clear();
    statusStore.init(testFiles, deviceIds, 'dynamic');

    logger.info(`Starting dynamic test execution: ${testFiles.length} test file(s), ${deviceIds.length} device(s)`);
    logger.info(`Task queue initialized with ${this.taskQueue.length} task(s)`);

    // 为每台设备分配可用端口（4723, 4733, 4743...），避免 "port already in use"
    const ports = [];
    for (let i = 0; i < deviceIds.length; i++) {
      const p = await getAvailablePort(basePort + i * PORT_STEP);
      ports.push(p);
      logger.info(`Device ${deviceIds[i]}: assigned Appium port ${p}`);
    }

    // 错峰启动各设备，避免同时绑定端口
    const APPIUM_STAGGER_MS = 8000;
    const workerPromises = deviceIds.map((deviceId, index) => {
      const port = ports[index];
      if (index === 0) {
        return this.deviceWorker(deviceId, platform, port);
      }
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.deviceWorker(deviceId, platform, port).then(resolve).catch(reject);
        }, index * APPIUM_STAGGER_MS);
      });
    });

    try {
      // 等待所有设备完成
      await Promise.all(workerPromises);
      
      // 检查是否所有任务都已完成
      const totalExecuted = Array.from(this.results.values())
        .reduce((sum, result) => sum + result.testFiles.length, 0);
      
      if (totalExecuted < testFiles.length) {
        logger.warn(`Warning: Only ${totalExecuted} out of ${testFiles.length} tasks were executed`);
      }

      const allSuccess = Array.from(this.results.values())
        .every(result => result.exitCode === 0);

      return {
        success: allSuccess,
        results: this.results,
        totalTasks: testFiles.length,
        executedTasks: totalExecuted,
      };
    } catch (error) {
      logger.error('Error during dynamic test execution:', error);
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
    this.allTasksCompleted = true;
    this.taskQueue = []; // 清空任务队列
    logger.info('Stopping all device workers...');
  }
}
