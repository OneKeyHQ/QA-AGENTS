import { PLATFORMS as PLATFORMS_CONST } from '../utils/constants.js';

export const detectPlatform = () => {
  return PLATFORMS_CONST[process.env.NODE_E2E_PLATFORM];
};

export const PLATFORMS = PLATFORMS_CONST;
