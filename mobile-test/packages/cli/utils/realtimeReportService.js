import { spawn } from 'child_process';
import allure from 'allure-commandline';
import path from 'path';
import fs from 'fs';
import { findWorkspaceRoot } from './workspaceRoot.js';
import process from 'process';
import logger from './logger.js';

const rootDir = findWorkspaceRoot(process.cwd());
let allureServerProcess = null;

/**
 * 启动 Allure 实时报告服务器
 * @param {string} resultsDir allure-results 目录路径
 * @param {number} port 服务器端口，默认随机
 * @param {boolean} openBrowser 是否自动打开浏览器
 * @returns {Promise<void>}
 */
export async function startRealtimeReportServer(
  resultsDir = 'allure-results',
  port = null,
  openBrowser = true,
) {
  const resultsPath = path.join(rootDir, resultsDir);
  
  // 确保结果目录存在
  if (!fs.existsSync(resultsPath)) {
    fs.mkdirSync(resultsPath, { recursive: true });
  }

  // 如果已经有服务器在运行，先停止它
  if (allureServerProcess) {
    await stopRealtimeReportServer();
  }

  logger.info('Starting Allure realtime report server...');

  return new Promise((resolve, reject) => {
    const args = ['serve', resultsPath];
    
    // 如果指定了端口，添加端口参数
    if (port) {
      args.push('--port', port.toString());
    }
    
    // 如果不自动打开浏览器，添加 --no-open 参数
    if (!openBrowser) {
      args.push('--no-open');
    }

    allureServerProcess = spawn('allure', args, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let serverUrl = null;
    let outputBuffer = '';
    let timeoutId = null;

    allureServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // 尝试从输出中提取服务器 URL
      const urlMatch = output.match(/http:\/\/[^\s]+/);
      if (urlMatch && !serverUrl) {
        serverUrl = urlMatch[0];
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        logger.info(`Allure report server started at: ${serverUrl}`);
        if (openBrowser) {
          logger.info('Browser will open automatically...');
        }
        resolve(serverUrl);
      }
    });

    allureServerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      // Allure serve 可能会在 stderr 输出一些信息，但不一定是错误
      if (error.includes('Error') || error.includes('error')) {
        logger.warn(`Allure server stderr: ${error}`);
      }
    });

    allureServerProcess.on('error', (error) => {
      // 如果命令不存在，提供更友好的错误信息
      if (error.code === 'ENOENT') {
        logger.error('Allure command not found. Please install allure-commandline: npm install -g allure-commandline');
      } else {
        logger.error(`Failed to start Allure server: ${error.message}`);
      }
      allureServerProcess = null;
      reject(error);
    });

    allureServerProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        logger.warn(`Allure server exited with code ${code}`);
      }
      allureServerProcess = null;
    });

    // 设置超时，如果5秒内没有启动成功，尝试继续（可能服务器已经在运行）
    timeoutId = setTimeout(() => {
      if (!serverUrl) {
        // 尝试从输出中提取 URL
        const urlMatch = outputBuffer.match(/http:\/\/[^\s]+/);
        if (urlMatch) {
          serverUrl = urlMatch[0];
          logger.info(`Allure report server detected at: ${serverUrl}`);
          resolve(serverUrl);
        } else {
          // 默认 URL（allure serve 默认使用随机端口）
          logger.info('Allure report server is starting...');
          logger.info('The server URL will be displayed in the console output above');
          logger.info('You can also check the Allure process output for the actual URL');
          // 即使没有提取到 URL，也继续执行（服务器可能正在启动）
          resolve(null);
        }
      }
    }, 5000);
    
    // 如果已经解析到 URL，清除超时
    if (serverUrl) {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * 停止 Allure 实时报告服务器
 * @returns {Promise<void>}
 */
export async function stopRealtimeReportServer() {
  if (!allureServerProcess) {
    return;
  }

  logger.info('Stopping Allure realtime report server...');

  return new Promise((resolve) => {
    allureServerProcess.on('exit', () => {
      logger.info('Allure report server stopped');
      resolve();
    });

    // 尝试优雅关闭
    allureServerProcess.kill('SIGTERM');

    // 如果3秒后还没关闭，强制关闭
    setTimeout(() => {
      if (allureServerProcess) {
        allureServerProcess.kill('SIGKILL');
      }
      resolve();
    }, 3000);
  });
}

/**
 * 检查是否启用了实时报告
 * @returns {boolean}
 */
export function isRealtimeReportEnabled() {
  // 默认启用实时报告，除非明确设置为 false
  return process.env.ALLURE_REALTIME_REPORT !== 'false';
}

/**
 * 获取报告结果目录
 * @returns {string}
 */
export function getResultsDir() {
  return process.env.ALLURE_RESULTS_DIR || 'allure-results';
}
