import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import { findWorkspaceRoot } from './workspaceRoot.js';
import process from 'process';
import allure from 'allure-commandline';

const execAsync = promisify(exec);
const rootDir = findWorkspaceRoot(process.cwd());

/**
 * 合并多个设备的allure报告
 * @param {Array<string>} deviceResultsDirs 各设备的allure-results目录列表
 * @param {string} mergedResultsDir 合并后的结果目录
 * @returns {Promise<void>}
 */
export async function mergeAllureReports(deviceResultsDirs, mergedResultsDir = 'allure-results') {
  const mergedPath = path.join(rootDir, mergedResultsDir);
  
  // 确保合并目录存在
  if (!fs.existsSync(mergedPath)) {
    fs.mkdirSync(mergedPath, { recursive: true });
  }

  logger.info(`Merging reports from ${deviceResultsDirs.length} device(s)...`);

  // 合并所有设备的结果文件
  for (const deviceDir of deviceResultsDirs) {
    if (!fs.existsSync(deviceDir)) {
      logger.warn(`Results directory not found: ${deviceDir}`);
      continue;
    }

    // 复制所有文件到合并目录
    const files = fs.readdirSync(deviceDir);
    for (const file of files) {
      const sourceFile = path.join(deviceDir, file);
      const targetFile = path.join(mergedPath, file);
      
      // 如果是目录，递归复制
      if (fs.statSync(sourceFile).isDirectory()) {
        copyDirectory(sourceFile, targetFile);
      } else {
        // 对于文件，如果已存在则追加内容（对于某些allure文件类型）
        if (fs.existsSync(targetFile) && file.endsWith('.json')) {
          // 合并JSON文件内容（适用于某些allure结果文件）
          try {
            const sourceContent = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
            const targetContent = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
            
            // 如果都是数组，合并
            if (Array.isArray(sourceContent) && Array.isArray(targetContent)) {
              fs.writeFileSync(targetFile, JSON.stringify([...targetContent, ...sourceContent], null, 2));
            } else {
              // 否则直接覆盖（保留最新的）
              fs.copyFileSync(sourceFile, targetFile);
            }
          } catch (error) {
            // 如果解析失败，直接覆盖
            fs.copyFileSync(sourceFile, targetFile);
          }
        } else {
          // 直接复制文件
          fs.copyFileSync(sourceFile, targetFile);
        }
      }
    }
  }

  logger.info(`Reports merged successfully to ${mergedPath}`);
}

/**
 * 递归复制目录
 * @param {string} source 源目录
 * @param {string} target 目标目录
 */
function copyDirectory(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * 生成合并后的allure报告
 * @param {string} resultsDir allure-results目录
 * @param {boolean} openBrowser 是否自动打开浏览器
 * @returns {Promise<void>}
 */
export async function generateMergedAllureReport(resultsDir = 'allure-results', openBrowser = true) {
  const resultsPath = path.join(rootDir, resultsDir);
  
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`Results directory not found: ${resultsPath}`);
  }

  logger.info(`Generating Allure report from ${resultsPath}...`);

  return new Promise((resolve, reject) => {
    const reportError = new Error('Could not generate Allure report');
    const generation = allure(['generate', resultsPath, '--clean']);

    const generationTimeout = setTimeout(() => reject(reportError), 60000);
    
    generation.on('exit', function(exitCode) {
      clearTimeout(generationTimeout);
      if (exitCode !== 0) {
        return reject(reportError);
      }
      
      logger.info('Allure report generated successfully');
      
      if (openBrowser) {
        allure(['open']);
      }
      
      resolve();
    });
  });
}
