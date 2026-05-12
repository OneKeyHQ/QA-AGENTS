import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
const currentPlatform = detectPlatform();

export default async (mobileFn, otherFn) => {
  if (
    currentPlatform === PLATFORMS.android ||
    currentPlatform === PLATFORMS.ios
  ) {
    await mobileFn();
  } else {
    await otherFn();
  }
};
