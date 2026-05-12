import { recordingService } from '../../services/recording.service.js';
import logger from '../../utils/logger.js';
import { loadEnv } from '../../utils/loadEnv.js';
import { PLATFORMS } from '../../utils/constants.js';

export const command = 'record';
export const desc = 'Start recording user interactions and auto-generate page object code';

export const builder = {
  platform: {
    describe: 'Specify the platform',
    choices: Object.keys(PLATFORMS),
    type: 'string',
    demandOption: true,
  },
  'page-name': {
    describe: 'Target page object file name (without Page.js)',
    type: 'string',
    alias: 'p',
  },
  output: {
    describe: 'Output directory for page objects',
    type: 'string',
    default: './pages',
    alias: 'o',
  },
  'auto-generate': {
    describe: 'Auto-generate code without confirmation',
    type: 'boolean',
    default: false,
    alias: 'a',
  },
};

export const handler = async function (props) {
  const { platform, pageName, output, autoGenerate } = props;

  logger.info('🎬 Starting recording service...');
  logger.info(`   Platform: ${platform}`);
  logger.info(`   Page Name: ${pageName || 'Auto-detect'}`);
  logger.info(`   Output: ${output}`);
  logger.info(`   Auto-generate: ${autoGenerate ? 'Yes' : 'No'}`);

  // 设置环境变量
  process.env['NODE_E2E_PLATFORM'] = platform;
  loadEnv(platform);

  // 启动录制服务（异步）
  await recordingService.startRecording({
    pageName,
    outputDir: output,
    autoGenerate,
  });

  logger.info('\n✅ Recording started!');
  logger.info('   - Run your tests or interact with the app');
  logger.info('   - All click/setValue operations will be recorded');
  logger.info('   - Press Ctrl+C to stop recording and generate code\n');

  // SIGINT 处理移到下面，避免重复注册

  // 保持进程运行
  // 注意：这个命令本身不运行测试，只是启动录制服务
  // 用户需要在另一个终端运行测试，或者集成到测试流程中
  logger.info('⚠️  Note: This command only starts the recording service.');
  logger.info('   You need to run your tests in another terminal or integrate this into your test flow.');
  logger.info('   The recording will capture operations from WebDriverIO commands.\n');
  logger.info('📌 Next steps:');
  logger.info('   1. The app should be running on your device');
  logger.info('   2. Manually click elements on the device screen');
  logger.info('   3. The system will automatically detect and record your clicks');
  logger.info('   4. Press Ctrl+C when done to generate code\n');

  // 保持进程运行
  // 使用 process.stdin 保持进程活跃，而不是无限Promise
  process.stdin.resume();
  
  // 等待 SIGINT (Ctrl+C)
  await new Promise((resolve) => {
    process.on('SIGINT', async () => {
      logger.info('\n\n🛑 Stopping recording...');
      await recordingService.stopRecording();
      process.stdin.pause();
      resolve();
    });
  });
};
