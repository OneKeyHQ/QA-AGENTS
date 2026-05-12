import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 录制服务 - 监听设备上的手动点击事件并自动生成页面对象代码
 */
class RecordingService {
  constructor() {
    this.isRecording = false;
    this.recordedActions = [];
    this.currentPage = null;
    this.lastPageSource = null;
    this.pollingInterval = null;
    // 默认输出目录：项目根目录下的pages文件夹
    const projectRoot = path.resolve(__dirname, '../../../..');
    this.config = {
      outputDir: path.resolve(projectRoot, 'pages'),
      autoGenerate: false,
      pollingInterval: 500, // 轮询间隔（毫秒）
      debug: false, // 为 true 时在控制台输出轮询/检测日志
      openEditorAtLine: true, // 写入文件后是否用编辑器打开并定位到新增代码行
    };
    this._pollCount = 0;
  }

  /**
   * 开始录制
   * @param {Object} options 录制配置
   */
  async startRecording(options = {}) {
    this.isRecording = true;
    this.recordedActions = [];
    this.config = { ...this.config, ...options };
    
    console.log('🎬 Recording started — click on the device; when done, wait for the test to finish (or stop it).\n');

    // 初始化页面源码
    try {
      this.lastPageSource = await browser.getPageSource();
      if (process.env.RECORD_DEBUG && this.lastPageSource) {
        const len = this.lastPageSource.length;
        const snippet = this.lastPageSource.substring(0, 400).replace(/\s+/g, ' ');
        console.log(`  [record] Page source length: ${len}, snippet: ${snippet}...`);
      }
    } catch (error) {
      console.error('⚠️  Warning: Could not get initial page source:', error.message);
      console.log('   Make sure the app is running and WebDriverIO session is active.\n');
    }

    // 启动监听
    await this.startEventListening();
  }

  /**
   * 启动事件监听
   */
  async startEventListening() {
    const platform = detectPlatform();

    if (platform === PLATFORMS.android) {
      await this.startAndroidEventListening();
    } else if (platform === PLATFORMS.ios) {
      await this.startIOSEventListening();
    } else {
      await this.startPollingMethod();
    }
  }

  /**
   * Android: 使用AccessibilityEvent监听
   */
  async startAndroidEventListening() {
    try {
      // 使用UIAutomator2的AccessibilityEvent监听
      // 注意：这需要在设备上运行一个监听服务
      await this.startPollingMethod();
      try {
        await this.setupAccessibilityEventListener();
      } catch {
        // 轮询方式已启用，无需额外提示
      }
    } catch (error) {
      console.error('Error starting Android listener:', error.message);
      await this.startPollingMethod();
    }
  }

  /**
   * iOS: 使用XCUITest事件监听
   */
  async startIOSEventListening() {
    await this.startPollingMethod();
  }

  /**
   * 轮询方法：定期检查页面变化，检测被点击的元素
   */
  async startPollingMethod() {
    // 不再输出轮询提示，避免刷屏

    this.pollingInterval = setInterval(async () => {
      if (!this.isRecording) {
        return;
      }

      try {
        await this.detectPageChanges();
      } catch (error) {
        // 静默处理错误，避免频繁打印
        if (error.message && !error.message.includes('session')) {
          // console.error('Error in polling:', error.message);
        }
      }
    }, this.config.pollingInterval);
  }

  /**
   * 检测页面变化，识别被点击的元素
   */
  async detectPageChanges() {
    try {
      const currentPageSource = await browser.getPageSource();

      if (!this.lastPageSource) {
        this.lastPageSource = currentPageSource;
        return;
      }

      const clickedElements = this.findClickedElements(
        this.lastPageSource,
        currentPageSource,
      );

      for (const elementInfo of clickedElements) {
        await this.recordElement(elementInfo, 'click');
      }

      this.lastPageSource = currentPageSource;
    } catch (error) {
      if (!error.message || !error.message.includes('session')) {
        throw error;
      }
    }
  }

  /**
   * 查找被点击的元素（通过对比页面源码）
   * 策略：1) 状态变化 2) 新出现的可点击元素 3) 兜底：页面有变化时取上一帧所有可点击元素
   */
  findClickedElements(oldSource, newSource) {
    const clickedElements = [];
    let stateChangeCount = 0;
    let newElementCount = 0;

    try {
      const oldElements = this.parsePageSource(oldSource);
      const newElements = this.parsePageSource(newSource);

      // 1) 找出状态变化的元素（selected / focused / checked）
      for (const [elementId, newElement] of Object.entries(newElements)) {
        const oldElement = oldElements[elementId];

        if (oldElement) {
          const stateChanged =
            (oldElement.selected !== newElement.selected && newElement.selected === 'true') ||
            (oldElement.focused !== newElement.focused && newElement.focused === 'true') ||
            (oldElement.checked !== newElement.checked && newElement.checked === 'true') ||
            (oldElement.enabled !== newElement.enabled && oldElement.enabled === 'false' && newElement.enabled === 'true');

          if (stateChanged) {
            clickedElements.push(newElement);
            stateChangeCount++;
          }
        } else {
          if (newElement.clickable === 'true' || newElement.focusable === 'true') {
            clickedElements.push(newElement);
            newElementCount++;
          }
        }
      }

      // 2) 兜底：页面有变化但未识别到“状态变化/新元素”时，把上一帧里可点击且有定位属性的元素当作候选
      const sourceChanged = typeof oldSource === 'string' && typeof newSource === 'string' &&
        (oldSource.length !== newSource.length || oldSource !== newSource);
      const significantChange = sourceChanged && Math.abs((oldSource || '').length - (newSource || '').length) > 10;

      if (clickedElements.length === 0 && significantChange) {
        const clickablesFromOld = [];
        for (const el of Object.values(oldElements)) {
          if (el.clickable === 'true' && this._hasLocatableAttributes(el)) {
            clickablesFromOld.push(el);
          }
        }
        const limit = 15;
        for (let i = 0; i < Math.min(clickablesFromOld.length, limit); i++) {
          clickedElements.push(clickablesFromOld[i]);
        }
        if (process.env.RECORD_DEBUG && clickablesFromOld.length > 0) {
          console.log(`  [record] Fallback: page changed, ${clickablesFromOld.length} clickable(s) from previous frame.`);
        }
      }

      if (process.env.RECORD_DEBUG && clickedElements.length > 0) {
        console.log(`  [record] This poll: ${clickedElements.length} element(s) to record.`);
      }
    } catch (error) {
      if (process.env.RECORD_DEBUG) {
        console.error('  [record] parsePageSource/findClickedElements error:', error.message);
      }
    }

    return clickedElements;
  }

  /** 元素是否有可用于定位的属性（便于后续生成选择器） */
  _hasLocatableAttributes(el) {
    return (
      (el['resource-id'] && String(el['resource-id']).trim() !== '') ||
      (el.text && String(el.text).trim() !== '') ||
      (el['content-desc'] && String(el['content-desc']).trim() !== '')
    );
  }

  /**
   * 解析页面源码，提取元素信息
   */
  parsePageSource(pageSource) {
    const elements = {};
    
    // 使用正则表达式提取元素
    // 匹配格式: <element attributes />
    const elementRegex = /<(\w+)([^>]*?)(?:\/>|>)/g;
    let match;

    while ((match = elementRegex.exec(pageSource)) !== null) {
      const tagName = match[1];
      const attributesStr = match[2];
      
      // 解析属性
      const attributes = this.parseAttributes(attributesStr);
      
      // 使用 resource-id（非空）或 bounds 或 tagName_index 作为唯一标识，避免空 resource-id 导致覆盖
      const rid = attributes['resource-id'];
      const elementId =
        (rid != null && String(rid).trim() !== '')
          ? rid
          : (attributes.bounds || `${tagName}_${Object.keys(elements).length}`);

      elements[elementId] = {
        tagName,
        ...attributes,
      };
    }

    return elements;
  }

  /**
   * 解析XML属性字符串
   */
  parseAttributes(attributesStr) {
    const attributes = {};
    // 匹配属性: name="value" 或 name='value'
    const attrRegex = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
    let match;

    while ((match = attrRegex.exec(attributesStr)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  /**
   * 设置AccessibilityEvent监听器（Android）
   */
  async setupAccessibilityEventListener() {
    // 使用Appium的execute执行Android代码来监听AccessibilityEvent
    // 注意：这需要Appium的特殊支持，可能不可用
    const script = `
      // 这里需要运行一个Android服务来监听AccessibilityEvent
      // 由于Appium的限制，我们使用轮询方法作为主要方案
    `;
    
    // 如果Appium支持，可以尝试执行
    // await browser.execute('mobile: shell', { command: '...' });
  }

  /**
   * 记录元素
   * @param {Object} elementInfo 元素信息
   * @param {string} actionType 操作类型
   */
  async recordElement(elementInfo, actionType = 'click') {
    if (!this.isRecording) {
      return;
    }

    try {
      let detailedInfo = await this.getElementInfoFromAppium(elementInfo);
      if (!detailedInfo) {
        detailedInfo = elementInfo;
      }

      // 检测当前页面
      const pageName = await this.detectCurrentPage();

      const action = {
        command: actionType,
        page: pageName,
        element: detailedInfo,
        timestamp: Date.now(),
      };

      // 检查是否已记录过相同元素（用多种属性组合判断，避免无 resource-id/text 时全部被判为重复）
      const key = (e) =>
        `${e['resource-id'] || ''}|${e.text || ''}|${e['content-desc'] || ''}|${e.bounds || ''}`;
      const isDuplicate = this.recordedActions.some(
        (a) => a.page === pageName && key(a.element) === key(detailedInfo),
      );

      if (!isDuplicate) {
        this.recordedActions.push(action);
        const name = this.generateElementName(action.element, action.command);
        console.log(`  ✓ Recorded: ${name} (${this.recordedActions.length} total)`);
      }
    } catch (error) {
      if (process.env.RECORD_DEBUG) {
        console.error('  [record] Error recording element:', error.message);
      }
    }
  }

  /**
   * 通过Appium获取元素详细信息
   */
  async getElementInfoFromAppium(elementInfo) {
    try {
      const platform = detectPlatform();
      let selector = null;

      // 构建选择器
      if (elementInfo['resource-id']) {
        if (platform === PLATFORMS.android) {
          selector = `//*[@resource-id="${elementInfo['resource-id']}"]`;
        } else {
          selector = `//*[@name="${elementInfo['resource-id']}"]`;
        }
      } else if (elementInfo.text) {
        selector = `//*[@text="${elementInfo.text}"]`;
      } else if (elementInfo['content-desc']) {
        selector = `//*[@content-desc="${elementInfo['content-desc']}"]`;
      }

      if (!selector) {
        return elementInfo;
      }

      // 尝试查找元素
      const element = await browser.$(selector);
      
      if (await element.isExisting()) {
        // 获取元素属性
        const elementId = element.elementId;
        const attributes = {};
        const attributeNames = [
          'resource-id',
          'name',
          'text',
          'content-desc',
          'class',
          'bounds',
          'clickable',
          'enabled',
          'selected',
          'focusable',
        ];

        for (const attrName of attributeNames) {
          try {
            const value = await browser.getElementAttribute(elementId, attrName);
            if (value !== null && value !== undefined) {
              attributes[attrName] = value;
            }
          } catch (e) {
            // 忽略获取失败的属性
          }
        }

        // 生成选择器
        const generatedSelector = await this.generateSelector(attributes, platform);

        return {
          ...attributes,
          selector: generatedSelector,
          platform,
        };
      }
    } catch (error) {
      // 如果无法通过Appium获取，返回原始信息
    }

    return elementInfo;
  }

  /**
   * 生成选择器
   */
  async generateSelector(attributes, platform) {
    // 优先级1: resource-id (Android) / name (iOS)，使用完整 id 以便 api.by.id 能正确定位
    if (platform === PLATFORMS.android && attributes['resource-id']) {
      const resourceId = String(attributes['resource-id']).replace(/'/g, "\\'");
      return `api.by.id('${resourceId}')`;
    }

    if (platform === PLATFORMS.ios && attributes.name) {
      return `api.by.id('${attributes.name}')`;
    }

    // 优先级2: text
    if (attributes.text && attributes.text.trim().length > 0 && attributes.text.length < 50) {
      const text = attributes.text.replace(/'/g, "\\'");
      if (platform === PLATFORMS.android) {
        return `api.by.xpath('//*[@text="${text}"]')`;
      }
      if (platform === PLATFORMS.ios) {
        return `api.by.xpath('//*[@name="${text}" or @label="${text}"]')`;
      }
    }

    // 优先级3: content-desc
    if (attributes['content-desc'] && attributes['content-desc'].trim().length > 0) {
      const contentDesc = attributes['content-desc'].replace(/'/g, "\\'");
      if (platform === PLATFORMS.android) {
        return `api.by.xpath('//*[@content-desc="${contentDesc}"]')`;
      }
      if (platform === PLATFORMS.ios) {
        return `api.by.xpath('//*[@name="${contentDesc}" or @label="${contentDesc}"]')`;
      }
    }

    // 优先级4: XPath相对定位
    if (attributes.class) {
      const className = attributes.class.split('.').pop();
      if (platform === PLATFORMS.android) {
        return `api.by.xpath('//${className}')`;
      }
      if (platform === PLATFORMS.ios) {
        return `api.by.xpath('//XCUIElementType${className}')`;
      }
    }

    return null;
  }

  /**
   * 生成元素名称
   */
  generateElementName(elementInfo, commandName) {
    if (elementInfo['resource-id']) {
      const resourceId = elementInfo['resource-id'];
      const parts = resourceId.split('/');
      const lastPart = parts[parts.length - 1];
      return this.toCamelCase(lastPart.replace(/-/g, '_'));
    }

    if (elementInfo.name) {
      return this.toCamelCase(elementInfo.name.replace(/-/g, '_'));
    }

    if (elementInfo.text && elementInfo.text.trim().length > 0) {
      const text = elementInfo.text.trim().substring(0, 30);
      return this.toCamelCase(text.replace(/[^a-zA-Z0-9]/g, '_'));
    }

    if (elementInfo['content-desc'] && elementInfo['content-desc'].trim().length > 0) {
      const desc = elementInfo['content-desc'].trim().substring(0, 30);
      return this.toCamelCase(desc.replace(/[^a-zA-Z0-9]/g, '_'));
    }

    if (elementInfo.class) {
      const className = elementInfo.class.split('.').pop();
      return this.toCamelCase(className) + 'Element';
    }

    return `element${this.recordedActions.length}`;
  }

  /**
   * 转换为驼峰命名
   */
  toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * 检测当前页面
   */
  async detectCurrentPage() {
    if (this.config.pageName) {
      return this.config.pageName;
    }

    try {
      const platform = detectPlatform();

      if (platform === PLATFORMS.android) {
        try {
          const currentActivity = await browser.getCurrentActivity();
          if (currentActivity) {
            const activityName = currentActivity.split('.').pop();
            return this.toCamelCase(activityName.replace('Activity', ''));
          }
        } catch (e) {
          // 忽略错误
        }
      }

      // 尝试从页面源码中提取页面标题
      if (this.lastPageSource) {
        const titleMatch = this.lastPageSource.match(/<.*?text="([^"]{1,50})".*?>/);
        if (titleMatch && titleMatch[1]) {
          return this.toCamelCase(titleMatch[1]);
        }
      }

      return 'recordedPage';
    } catch (error) {
      return 'recordedPage';
    }
  }

  /**
   * 预览操作（录制过程中不再打日志，避免刷屏；结果以「打开编辑器并定位行」展示）
   */
  previewAction() {
    // 不再输出，避免每秒几十行；结束时用 openEditorAtLine 打开文件并定位到新增代码
  }

  /**
   * 获取方法名称
   */
  getMethodName(command, elementName) {
    const prefix = command === 'setValue' ? 'input' : 'click';
    return `${prefix}${elementName.charAt(0).toUpperCase() + elementName.slice(1)}`;
  }

  /**
   * 停止录制并生成代码
   */
  async stopRecording() {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;

    // 停止轮询
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    console.log(`\n📝 Recording stopped. Total actions: ${this.recordedActions.length}`);

    if (this.recordedActions.length === 0) {
      console.log('⚠️  No elements recorded.');
      console.log('   • Tap buttons that open a new screen or dialog (so the page DOM changes).');
      console.log('   • Run with RECORD_DEBUG=1 to see detection details:');
      console.log('     RECORD_DEBUG=1 yarn test:android:record');
      return;
    }

    // 生成代码
    await this.generatePageObjectCode();
    console.log('✅ Code generation completed!');
  }

  /**
   * 生成页面对象代码
   */
  async generatePageObjectCode() {
    const actionsByPage = {};
    for (const action of this.recordedActions) {
      if (!actionsByPage[action.page]) {
        actionsByPage[action.page] = [];
      }
      actionsByPage[action.page].push(action);
    }

    for (const [pageName, actions] of Object.entries(actionsByPage)) {
      await this.writeToPageObjectFile(pageName, actions);
    }
  }

  /**
   * 写入页面对象文件
   * 若已存在 pages/<pageName>/ 子目录，则写入 pages/<pageName>/<pageName>Page.js，否则写入 pages/<pageName>Page.js
   */
  async writeToPageObjectFile(pageName, actions) {
    const pageDir = path.join(this.config.outputDir, pageName);
    const flatPath = path.join(this.config.outputDir, `${pageName}Page.js`);
    let filePath = flatPath;
    try {
      const stat = await fs.promises.stat(pageDir);
      if (stat.isDirectory()) {
        filePath = path.join(pageDir, `${pageName}Page.js`);
      }
    } catch {
      // 无 pageName 子目录，用平铺路径
    }
    const fileLabel = path.relative(this.config.outputDir, filePath);

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    } catch (error) {
      // 目录已存在或其他错误，忽略
    }

    const elementsMap = new Map();
    for (const action of actions) {
      if (!action.element.selector) {
        action.element.selector = await this.generateSelector(action.element, detectPlatform());
      }
      const elementName = this.generateElementName(action.element, action.command);
      const methodName = this.getMethodName(action.command, elementName);

      if (!elementsMap.has(elementName)) {
        const code = this.generateElementCode(
          action.element,
          elementName,
          action.command,
          methodName,
        );
        elementsMap.set(elementName, code);
      }
    }

    let fileContent = '';
    let existingGetters = new Set();
    let existingMethods = new Set();

    try {
      fileContent = await fs.promises.readFile(filePath, 'utf8');
      const getterMatches = fileContent.matchAll(/get\s+(\w+)\s*\(\)/g);
      for (const match of getterMatches) {
        existingGetters.add(match[1]);
      }
      const methodMatches = fileContent.matchAll(/async\s+(\w+)\s*\(/g);
      for (const methodMatch of methodMatches) {
        existingMethods.add(methodMatch[1]);
      }
    } catch (error) {
      fileContent = '';
    }

    const newGetters = [];
    const newMethods = [];

    for (const [elementName, code] of elementsMap.entries()) {
      if (!existingGetters.has(elementName)) {
        newGetters.push(code.getter);
      }
      const methodMatch = code.method.match(/async\s+(\w+)\s*\(/);
      if (methodMatch && !existingMethods.has(methodMatch[1])) {
        newMethods.push(code.method);
      }
    }

    if (newGetters.length === 0 && newMethods.length === 0) {
      console.log(`\n⚠️  pages/${fileLabel}: All elements already exist, skipping.`);
      return;
    }

    if (!fileContent) {
      fileContent = this.generatePageObjectTemplate(pageName);
    }

    fileContent = this.insertCodeIntoFile(fileContent, newGetters, newMethods);

    await fs.promises.writeFile(filePath, fileContent, 'utf8');
    console.log(`\n✅ Generated code in pages/${fileLabel} (${newGetters.length} getters, ${newMethods.length} methods)`);

    if (this.config.openEditorAtLine && newGetters.length > 0) {
      const firstNewElementName = Array.from(elementsMap.keys()).find((name) => !existingGetters.has(name));
      if (firstNewElementName) {
        const lines = fileContent.split('\n');
        const lineIndex = lines.findIndex((l) => l.includes(`get ${firstNewElementName}()`));
        if (lineIndex >= 0) {
          this._openEditorAtLine(path.resolve(filePath), lineIndex + 1);
        }
      }
    }
  }

  /**
   * 用编辑器打开文件并定位到指定行（优先 Cursor，其次 VS Code）
   */
  _openEditorAtLine(absolutePath, line) {
    const arg = `${absolutePath}:${line}`;
    const tryEditor = (cmd, args) =>
      new Promise((resolve) => {
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.unref();
        child.on('error', () => done(false));
        child.on('spawn', () => done(true));
        setTimeout(() => done(false), 300);
      });

    (async () => {
      const ok = await tryEditor('cursor', ['-g', arg]);
      if (!ok) await tryEditor('code', ['-g', arg]);
    })();
  }

  /**
   * 生成元素代码
   */
  generateElementCode(elementInfo, elementName, command, methodName) {
    const comments = [];
    if (elementInfo.text) {
      comments.push(`text: "${elementInfo.text}"`);
    }
    if (elementInfo['resource-id']) {
      comments.push(`resource-id: "${elementInfo['resource-id']}"`);
    }
    if (elementInfo.bounds) {
      comments.push(`bounds: ${elementInfo.bounds}`);
    }
    const commentStr = comments.length > 0 ? ` * ${comments.join(', ')}\n` : '';

    const getter = `  /**
   * ${elementName}${commentStr}   */
  get ${elementName}() {
    return ${elementInfo.selector || 'null'};
  }`;

    let method;
    if (command === 'setValue' || command === 'input') {
      method = `  /**
   * 输入到${elementName}
   * @param {string} value 输入值
   */
  async ${methodName}(value) {
    await api.setValue(this.${elementName}, value);
  }`;
    } else {
      method = `  /**
   * 点击${elementName}
   */
  async ${methodName}() {
    await api.tap(this.${elementName});
  }`;
    }

    return { getter, method, elementName };
  }

  /**
   * 生成页面对象模板
   */
  generatePageObjectTemplate(pageName) {
    const className = pageName.charAt(0).toUpperCase() + pageName.slice(1) + 'Page';
    return `import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';

/**
 * ${className} - 自动生成的页面对象
 */
class ${className} extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return null; // TODO: 设置关键元素
  }

  // ========== 元素定义 ==========

  // ========== 操作方法 ==========
}

export const ${pageName}Page = new ${className}();
`;
  }

  /**
   * 将代码插入到文件中
   */
  insertCodeIntoFile(fileContent, getters, methods) {
    const elementMarker = '// ========== 元素定义 ==========';
    const methodMarker = '// ========== 操作方法 ==========';

    let result = fileContent;

    if (getters.length > 0) {
      const gettersCode = '\n' + getters.join('\n\n') + '\n';
      if (result.includes(elementMarker)) {
        result = result.replace(elementMarker, elementMarker + gettersCode);
      } else {
        const classMatch = result.match(/(class\s+\w+\s+extends\s+Page\s*\{[^}]*)/);
        if (classMatch) {
          result = result.replace(
            classMatch[0],
            classMatch[0] + '\n' + elementMarker + gettersCode,
          );
        }
      }
    }

    if (methods.length > 0) {
      const methodsCode = '\n' + methods.join('\n\n') + '\n';
      if (result.includes(methodMarker)) {
        result = result.replace(methodMarker, methodMarker + methodsCode);
      } else {
        const classEndMatch = result.match(/(\n\})/);
        if (classEndMatch) {
          result = result.replace(/\n\}/, '\n' + methodMarker + methodsCode + '\n}');
        }
      }
    }

    return result;
  }
}

// 导出单例
export const recordingService = new RecordingService();
