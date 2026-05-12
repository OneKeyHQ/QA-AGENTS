import { api } from '@node-e2e/cli/api/index.js';
import { recordingService } from '@node-e2e/cli/services/recording.service.js';
import { pages } from '../config/setup.js';

const { onboardingPage, addWalletPage } = pages;

/**
 * 多页面录制测试
 * 
 * 这个测试演示如何录制多个页面的元素
 * 每个页面单独录制，避免混淆
 */
describe('Record Multiple Pages', () => {
  before(async () => {
    await api.waitUntilAppInit();
  });

  it('Record onboarding page elements', async () => {
    console.log('\n📄 Recording onboarding page...\n');
    
    // 启动录制（onboarding页面）
    await recordingService.startRecording({
      pageName: 'onboarding',
      autoGenerate: true,
    });
    
    console.log('✅ Recording started for onboarding page');
    console.log('   Click elements on the onboarding page now!\n');
    
    // 等待30秒让你点击元素
    await api.pause(30000);
    
    // 停止录制
    await recordingService.stopRecording();
    
    console.log('\n✅ Onboarding page recording completed!\n');
  });

  it('Record add wallet page elements', async () => {
    console.log('\n📄 Recording add wallet page...\n');
    
    // 导航到添加钱包页面
    // 假设你点击了某个按钮进入添加钱包页面
    try {
      await onboardingPage.waitEntryPage();
      await onboardingPage.clickRightSideButton();
      await api.pause(2000); // 等待页面加载
      
      // 等待进入添加钱包页面
      if (addWalletPage && addWalletPage.waitEntryPage) {
        await addWalletPage.waitEntryPage();
      }
    } catch (error) {
      console.log('⚠️  Could not navigate to add wallet page automatically');
      console.log('   Please manually navigate to the add wallet page\n');
    }
    
    // 启动录制（addWallet页面）
    await recordingService.startRecording({
      pageName: 'addWallet',
      autoGenerate: true,
    });
    
    console.log('✅ Recording started for add wallet page');
    console.log('   Click elements on the add wallet page now!\n');
    
    // 等待30秒让你点击元素
    await api.pause(30000);
    
    // 停止录制
    await recordingService.stopRecording();
    
    console.log('\n✅ Add wallet page recording completed!\n');
  });

  after(async () => {
    console.log('\n✅ All pages recorded!');
    console.log('   Check the pages/ directory for generated code.\n');
  });
});
