import allureReporter from '@wdio/allure-reporter';
import _ from 'lodash-es';

import PlatformChain from './platformChain.js';
import tap from './tap.js';
import appMod from './appMod.js';
import attribute from './attribute.js';
import by from './by.js';
import longPress from './longPress.js';
import switchContext from './switchContext.js';
import pause from './pause.js';
import waitUntil from './waitUntil.js';
import execute from './execute.js';
import accessible from './accessible.js';
import getDeviceSetting from './getDeviceSetting.js';
import getText from './getText.js';
import keys from './keys.js';
import resetApp from './resetApp.js';
import activeApp from './activeApp.js';
import installApp from './installApp.js';
import back from './back.js';
import setValue from './setValue.js';
import getClipboard from './getClipboard.js';
import pushFile from './pushFile.js';
import pushToImageDir from './pushToImageDir.js';
import waitForClickable from './waitForClickable.js';
import allowSysAlerts from './allowSysAlerts.js';
import fixInterceptedClick from './fixInterceptedClick.js';
import restartApp from './restartApp.js';
import globalStore from './globalStore.js';
import scrollToId from './scrollToId.js';
import waitUntilAppInit from './waitUntilAppInit.js';
import waitPageByElement from './waitPageByElement.js';
import waitReqByElement from './waitReqByElement.js';
import hideKeyboard from './hideKeyboard.js';
import tapOnDevBtn from './tapOnDevBtn.js';
import scrollY from './scrollY.js';
import isToastDisplayed from './toast.js';
import shortCut from './shortCut.js';

export const reporter = allureReporter;

export const api = {
  //页面相关
  scrollToId,
  scrollY,
  pause,
  appMod,
  switchContext,
  execute,
  isToastDisplayed,

  //元素相关
  tap,
  longPress,
  getText,
  setValue,
  keys,
  fixInterceptedClick,
  by,
  attr: attribute,

  //应用生命周期相关
  restartApp, //应用重启
  resetApp, // 应用重置
  activeApp, // 打开应用
  installApp, // 安装应用

  //等待相关
  waitUntil, // 通用等待
  waitForClickable, // 暂时弃用
  waitUntilAppInit, //应用级别等待
  waitPageByElement, //页面级别等待
  waitReqByElement, // 接口级别等待

  //系统相关
  accessible,
  getDeviceSetting,
  back,
  getClipboard,
  pushFile,
  pushToImageDir,
  allowSysAlerts,
  hideKeyboard,
  //开发相关
  tapOnDevBtn,
  shortCut,
  _,
  reporter,
  get platformChain() {
    return new PlatformChain();
  },
  globalStore,
};
