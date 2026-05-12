import path from 'path';
import dotenv from 'dotenv';
import process from 'process';
import fs from 'fs';
import { findWorkspaceRoot } from './workspaceRoot.js';

const newDirectory = findWorkspaceRoot(process.cwd());

dotenv.config();

export const loadEnv = (platform) => {
  dotenv.config({
    path: path.join(newDirectory, `.env.${platform.toLocaleLowerCase()}`),
  });

  // 为 Android 平台设置 Android SDK 环境变量
  if (platform.toLowerCase() === 'android') {
    // 如果环境变量未设置，尝试自动检测
    if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
      const defaultAndroidSdkPath = process.platform === 'darwin' 
        ? `${process.env.HOME}/Library/Android/sdk`
        : `${process.env.HOME}/Android/Sdk`;
      
      // 检查路径是否存在
      try {
        if (fs.existsSync(defaultAndroidSdkPath)) {
          process.env.ANDROID_HOME = defaultAndroidSdkPath;
          process.env.ANDROID_SDK_ROOT = defaultAndroidSdkPath;
        }
      } catch (error) {
        // 忽略错误，继续执行
      }
    } else {
      // 如果设置了其中一个，确保另一个也设置
      if (process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
        process.env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
      } else if (process.env.ANDROID_SDK_ROOT && !process.env.ANDROID_HOME) {
        process.env.ANDROID_HOME = process.env.ANDROID_SDK_ROOT;
      }
    }
  }
};
