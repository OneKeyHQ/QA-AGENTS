// Quick test: connect to Android device via Midscene and take a screenshot
import 'dotenv/config';

// Ensure adb is in PATH for appium-adb child processes
if (process.env.ANDROID_HOME && !process.env.PATH?.includes('platform-tools')) {
  process.env.PATH = `${process.env.ANDROID_HOME}/platform-tools:${process.env.PATH}`;
}

import { AndroidAgent, AndroidDevice, getConnectedDevices } from '@midscene/android';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n  Discovering Android devices...');
  const devices = await getConnectedDevices();

  if (devices.length === 0) {
    console.error('  No Android devices found. Check USB connection and USB debugging.');
    process.exit(1);
  }

  console.log(`  Found ${devices.length} device(s):`);
  for (const d of devices) {
    console.log(`    - ${d.udid} (state: ${d.state})`);
  }

  const device = new AndroidDevice(devices[0].udid);
  console.log(`\n  Connecting to ${devices[0].udid}...`);
  await device.connect();
  console.log('  Connected.');

  const agent = new AndroidAgent(device, {
    aiActionContext: 'This is an Android phone. Just observe and describe what is on screen.',
  });

  console.log('\n  Querying current screen content...');
  const screenInfo = await agent.aiQuery('{ appName: string, screenDescription: string }, describe what app is open and what is visible on screen');
  console.log('  Screen info:', JSON.stringify(screenInfo, null, 2));

  console.log('\n  Android connection test passed!');
}

main().catch((err) => {
  console.error(`\n  Failed: ${err.message}`);
  process.exit(1);
});
