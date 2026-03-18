// Video recording via CDP Page.startScreencast
// Captures frames during test execution, stitches into MP4 with ffmpeg.

import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const RESULTS_DIR = resolve(import.meta.dirname, '../../shared/results');

function hasFFmpeg() {
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start recording the page via CDP screencast.
 * Returns a recording handle to pass to stopRecording().
 */
export async function startRecording(page, testId) {
  const framesDir = resolve(RESULTS_DIR, `${testId}-frames`);
  mkdirSync(framesDir, { recursive: true });

  let cdpSession;
  try {
    cdpSession = await page.context().newCDPSession(page);
  } catch (e) {
    console.log(`  Recording: CDP session failed (${e.message}), skipping video`);
    return null;
  }

  let frameIndex = 0;
  const startTime = Date.now();

  cdpSession.on('Page.screencastFrame', async (params) => {
    frameIndex++;
    const framePath = resolve(framesDir, `frame-${String(frameIndex).padStart(5, '0')}.jpg`);
    const buffer = Buffer.from(params.data, 'base64');
    writeFileSync(framePath, buffer);

    // Acknowledge the frame to keep receiving
    await cdpSession.send('Page.screencastFrameAck', {
      sessionId: params.sessionId,
    }).catch(() => {});
  });

  await cdpSession.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 2,
  });

  console.log(`  Recording started for ${testId}`);

  return {
    cdpSession,
    framesDir,
    startTime,
    testId,
    getFrameCount: () => frameIndex,
  };
}

/**
 * Stop recording and produce an MP4 video (if ffmpeg available).
 * Returns the path to the video file, or the frames directory if no ffmpeg.
 */
export async function stopRecording(recording) {
  if (!recording) return null;

  const { cdpSession, framesDir, startTime, testId } = recording;

  try {
    await cdpSession.send('Page.stopScreencast');
  } catch { /* already stopped */ }

  try {
    await cdpSession.detach();
  } catch { /* best effort */ }

  const duration = (Date.now() - startTime) / 1000;
  const frameCount = recording.getFrameCount();
  console.log(`  Recording stopped: ${frameCount} frames in ${duration.toFixed(1)}s`);

  if (frameCount === 0) {
    console.log('  Recording: no frames captured');
    return null;
  }

  // Stitch frames into MP4 with ffmpeg
  if (hasFFmpeg()) {
    const fps = Math.max(2, Math.min(15, Math.round(frameCount / duration)));
    const videoPath = resolve(RESULTS_DIR, `${testId}-recording.mp4`);
    try {
      execSync(
        `ffmpeg -y -framerate ${fps} -i "${framesDir}/frame-%05d.jpg" -c:v libx264 -pix_fmt yuv420p -crf 23 -preset fast "${videoPath}"`,
        { stdio: 'ignore', timeout: 60000 }
      );
      console.log(`  Video saved: ${videoPath} (${fps} fps)`);

      // Clean up frames directory
      rmSync(framesDir, { recursive: true, force: true });

      return videoPath;
    } catch (e) {
      console.log(`  ffmpeg failed: ${e.message}, keeping frames at ${framesDir}`);
      return framesDir;
    }
  }

  console.log(`  ffmpeg not found, frames saved at ${framesDir}`);
  return framesDir;
}
