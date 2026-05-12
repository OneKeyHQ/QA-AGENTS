import path from 'path';

/** 用例状态 */
export const CASE_STATUS = {
  PENDING: 'pending',   // 未执行
  RUNNING: 'running',   // 执行中
  PASSED: 'passed',     // 通过
  FAILED: 'failed',     // 失败
};

const state = {
  devices: [],
  testCases: [],  // { file, fileName, status, deviceId?, exitCode?, error? }
  startTime: null,
  mode: 'dynamic',  // 'dynamic' | 'static'
  finished: false,
};

/**
 * 初始化状态（动态分配模式：所有用例初始为 pending）
 * @param {string[]} testFiles 测试文件路径列表
 * @param {string[]} deviceIds 设备 ID 列表
 * @param {'dynamic'|'static'} mode 分配模式
 */
export function init(testFiles, deviceIds, mode = 'dynamic') {
  state.devices = [...deviceIds];
  state.testCases = testFiles.map(file => ({
    file,
    fileName: path.basename(file),
    status: CASE_STATUS.PENDING,
    deviceId: null,
    exitCode: null,
    error: null,
  }));
  state.startTime = Date.now();
  state.mode = mode;
  state.finished = false;
}

/**
 * 从静态分配结果初始化（静态模式：每个用例已绑定设备，初始为 running）
 * @param {Array<{deviceId: string, testFiles: string[]}>} distributions 分配结果
 * @param {string[]} deviceIds 设备 ID 列表
 */
export function initFromDistribution(distributions, deviceIds) {
  state.devices = [...deviceIds];
  state.testCases = [];
  distributions.forEach(({ deviceId, testFiles }) => {
    testFiles.forEach(file => {
      state.testCases.push({
        file,
        fileName: path.basename(file),
        status: CASE_STATUS.RUNNING,
        deviceId,
        exitCode: null,
        error: null,
      });
    });
  });
  state.startTime = Date.now();
  state.mode = 'static';
  state.finished = false;
}

/**
 * 标记某用例正在某设备上执行
 * @param {string} deviceId 设备 ID
 * @param {string} testFile 测试文件路径
 */
export function setRunning(deviceId, testFile) {
  const normalized = path.normalize(testFile);
  const tc = state.testCases.find(c => path.normalize(c.file) === normalized);
  if (tc) {
    tc.status = CASE_STATUS.RUNNING;
    tc.deviceId = deviceId;
    tc.exitCode = null;
    tc.error = null;
  }
}

/**
 * 标记某用例在某设备上执行完成
 * @param {string} deviceId 设备 ID
 * @param {string} testFile 测试文件路径
 * @param {number} exitCode 退出码，0 为通过
 */
export function setComplete(deviceId, testFile, exitCode) {
  const normalized = path.normalize(testFile);
  const tc = state.testCases.find(c => path.normalize(c.file) === normalized);
  if (tc) {
    tc.status = exitCode === 0 ? CASE_STATUS.PASSED : CASE_STATUS.FAILED;
    tc.deviceId = deviceId;
    tc.exitCode = exitCode;
  }
}

/**
 * 静态模式：某设备全部用例执行完成，批量更新该设备上所有用例状态
 * @param {string} deviceId 设备 ID
 * @param {number} exitCode 该设备进程退出码，0 为全部通过
 */
export function setDeviceComplete(deviceId, exitCode) {
  const status = exitCode === 0 ? CASE_STATUS.PASSED : CASE_STATUS.FAILED;
  state.testCases.forEach(tc => {
    if (tc.deviceId === deviceId) {
      tc.status = status;
      tc.exitCode = exitCode;
    }
  });
}

/**
 * 标记整个测试运行已结束
 */
export function setFinished() {
  state.finished = true;
}

/**
 * 获取当前状态（供 API 返回）
 */
export function getState() {
  return {
    devices: state.devices,
    testCases: state.testCases.map(({ file, fileName, status, deviceId, exitCode, error }) => ({
      file,
      fileName,
      status,
      deviceId: deviceId || null,
      exitCode,
      error: error ? String(error) : null,
    })),
    startTime: state.startTime,
    mode: state.mode,
    finished: state.finished,
    summary: {
      total: state.testCases.length,
      pending: state.testCases.filter(c => c.status === CASE_STATUS.PENDING).length,
      running: state.testCases.filter(c => c.status === CASE_STATUS.RUNNING).length,
      passed: state.testCases.filter(c => c.status === CASE_STATUS.PASSED).length,
      failed: state.testCases.filter(c => c.status === CASE_STATUS.FAILED).length,
    },
  };
}
