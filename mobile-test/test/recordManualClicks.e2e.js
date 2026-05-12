import { api } from '@node-e2e/cli/api/index.js';
import { recordingService } from '@node-e2e/cli/services/recording.service.js';

/**
 * 手动点击录制测试
 * 
 * 使用方法：
 * 1. 运行测试：yarn test:android --test-case ./test/recordManualClicks.e2e.js
 * 2. 等待App启动后，在设备上手动点击元素
 * 3. 系统会自动检测并记录你的点击操作
 * 4. 测试结束后会自动生成页面对象代码
 */
describe('Record Manual Clicks', () => {
  before(async () => {
    // 等待App初始化
    await api.waitUntilAppInit();
    
    console.log('\n🎬 ========================================');
    console.log('   Recording Service Starting...');
    console.log('========================================\n');
    
    // 启动录制服务；结束后会自动用编辑器打开对应文件并定位到新增代码行
    await recordingService.startRecording({
      pageName: 'onboarding', // 指定页面名称，或留空自动检测
      autoGenerate: true,
      pollingInterval: 500,
      openEditorAtLine: true,  // 写入后打开 pages/xxxPage.js 并跳到新增的 getter 行
    });
    
    console.log('✅ Recording started successfully!');
    console.log('\n📱 Instructions:');
    console.log('   1. Look at your device screen');
    console.log('   2. Manually click/tap elements on the screen');
    console.log('   3. The system will automatically detect and record your clicks');
    console.log('   4. You have 60 seconds to click elements');
    console.log('   5. After 60 seconds, code will be automatically generated\n');
  });

  it('Record manual clicks on device', async () => {
    // 等待60秒，让你有时间在设备上点击元素
    // 你可以修改这个时间，比如改为30000（30秒）或120000（2分钟）
    const recordingDuration = 60000; // 60秒
    
    console.log(`⏱️  Recording for ${recordingDuration / 1000} seconds...`);
    console.log('   Click elements on your device now!\n');
    
    await api.pause(recordingDuration);
    
    console.log('\n⏱️  Recording time ended.');
  });

  after(async () => {
    console.log('\n🛑 Stopping recording and generating code...\n');
    
    // 停止录制并生成代码
    await recordingService.stopRecording();
    
    console.log('\n✅ Test completed!');
    console.log('   Check the pages/ directory for generated code.\n');
  });
});
