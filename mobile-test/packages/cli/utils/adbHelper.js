import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger.js';

const execAsync = promisify(exec);

/**
 * 获取adb设备列表
 * @returns {Promise<Array<{id: string, status: string}>>} 设备列表
 */
export async function getAdbDevices() {
  try {
    const { stdout } = await execAsync('adb devices');
    const lines = stdout.trim().split('\n');
    const devices = [];

    // 跳过第一行 "List of devices attached"
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('\t');
      if (parts.length >= 2) {
        const id = parts[0];
        const status = parts[1];
        // 只返回已连接的设备
        if (status === 'device') {
          devices.push({ id, status });
        }
      }
    }

    logger.info(`Found ${devices.length} connected Android device(s)`);
    return devices;
  } catch (error) {
    logger.error('Failed to get adb devices:', error.message);
    throw new Error(`Failed to get adb devices: ${error.message}`);
  }
}

/**
 * 检查设备是否可用
 * @param {string} deviceId 设备ID
 * @returns {Promise<boolean>} 设备是否可用
 */
export async function isDeviceAvailable(deviceId) {
  try {
    const { stdout } = await execAsync(`adb -s ${deviceId} shell echo "ok"`);
    return stdout.trim() === 'ok';
  } catch (error) {
    logger.warn(`Device ${deviceId} is not available: ${error.message}`);
    return false;
  }
}

/**
 * 获取可用的设备列表
 * @returns {Promise<Array<string>>} 可用的设备ID列表
 */
export async function getAvailableDeviceIds() {
  const devices = await getAdbDevices();
  const availableDevices = [];

  for (const device of devices) {
    if (await isDeviceAvailable(device.id)) {
      availableDevices.push(device.id);
    }
  }

  return availableDevices;
}
