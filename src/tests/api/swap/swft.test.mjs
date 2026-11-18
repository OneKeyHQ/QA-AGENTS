import { createChannelTestModule } from './create-channel-module.mjs';

const mod = createChannelTestModule('swft');
export const platform = mod.platform;
export const categoryTitle = mod.categoryTitle;
export const displayName = mod.displayName;
export const testCases = mod.testCases;
