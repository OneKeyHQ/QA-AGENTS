import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const by = {
  id(str, element = { $ }, platform = detectPlatform()) {
    if (platform === PLATFORMS.ios) {
      return element.$(`~${str}`);
    }
    if (platform === PLATFORMS.android) {
      return element.$(`//*[@resource-id="${str}"]`);
      // return element.$(`id:${str}`);
    }
    return element.$(`[data-testid='${str}']`);
  },
  idStartWith(str, element = { $ }, platform = detectPlatform()) {
    if (platform === PLATFORMS.android) {
      return element.$(`//*[starts-with(@resource-id, "${str}")]`);
    }
    if (platform === PLATFORMS.ios) {
      return element.$(`//*[starts-with(@name, "${str}")]`);
    }
    return element.$(`[data-testid^='${str}']`);
  },
  idsStartWith(str, element = { $$ }, platform = detectPlatform()) {
    if (platform === PLATFORMS.android) {
      return element.$$(`//*[starts-with(@resource-id, "${str}")]`);
    }
    if (platform === PLATFORMS.ios) {
      return element.$$(`//*[starts-with(@name, "${str}")]`);
    }
    return element.$$(`[data-testid^='${str}']`);
  },
  xpath(str, element = { $ }) {
    return element.$(str);
  },
  /**
   * 检测字符串是否包含中文字符
   * @param {string} str - 要检测的字符串
   * @returns {boolean} 是否包含中文
   */
  _containsChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
  },

  /**
   * 按优先级排序文本数组，中文优先
   * @param {string[]} texts - 文本数组
   * @returns {string[]} 排序后的文本数组（中文在前）
   */
  _sortTextsByPriority(texts) {
    const chineseTexts = [];
    const nonChineseTexts = [];
    
    for (const text of texts) {
      if (this._containsChinese(text)) {
        chineseTexts.push(text);
      } else {
        nonChineseTexts.push(text);
      }
    }
    
    // 中文文本在前，其他文本在后
    return [...chineseTexts, ...nonChineseTexts];
  },

  /**
   * 为单个文本构建 XPath 条件
   * @param {string} text - 文本值
   * @param {boolean} includeHint - 是否包含 hint 属性
   * @param {boolean} includeContentDesc - 是否包含 content-desc 属性
   * @returns {string} XPath 条件字符串
   */
  _buildTextXPathCondition(text, includeHint, includeContentDesc) {
    const conditions = [];
    
    // 匹配 text 属性（TextView, Button 等）
    conditions.push(`@text="${text}"`);
    
    // 匹配 hint 属性（EditText 等输入框）
    if (includeHint) {
      conditions.push(`@hint="${text}"`);
    }
    
    // 匹配 content-desc 属性（Button 等，用于无障碍访问）
    if (includeContentDesc) {
      conditions.push(`@content-desc="${text}"`);
    }
    
    return `(${conditions.join(' or ')})`;
  },

  /**
   * 多语言文本定位 - 尝试多个文本值来定位元素，优先检测中文
   * 支持匹配 text、hint 和 content-desc 属性（用于按钮、输入框等）
   * 
   * 注意：此方法会自动将中文文本排序到数组前面，确保优先匹配中文。
   * 虽然 XPath 的 OR 条件理论上没有严格的优先级，但在实际应用中，
   * XPath 引擎通常会按照条件的顺序进行匹配，因此将中文条件放在前面
   * 可以确保优先匹配中文元素。
   * 
   * @param {string[]} texts - 文本值数组，会自动按优先级排序（中文优先）
   * @param {object} element - 父元素，默认为 { $ }
   * @param {string} platform - 平台类型
   * @param {boolean} includeHint - 是否同时匹配 hint 属性（默认 true）
   * @param {boolean} includeContentDesc - 是否同时匹配 content-desc 属性（默认 true）
   * @returns {object} WebDriverIO 元素对象
   */
  text(texts, element = { $ }, platform = detectPlatform(), includeHint = true, includeContentDesc = true) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }
    
    // 按优先级排序文本数组，中文优先
    const sortedTexts = this._sortTextsByPriority(texts);
    
    if (platform === PLATFORMS.android || platform === PLATFORMS.ios) {
      // 为每个文本构建 XPath 条件，按优先级顺序（中文在前）
      const textConditions = sortedTexts
        .map(text => this._buildTextXPathCondition(text, includeHint, includeContentDesc))
        .join(' or ');
      
      // 组合所有条件，支持多种元素类型
      // 将中文条件放在前面，确保优先匹配中文元素
      return element.$(`//*[${textConditions}]`);
    }
    
    // Web 环境使用不同的选择器，同样优先使用中文
    const textSelectors = sortedTexts.map(text => `text()="${text}"`).join(' or ');
    return element.$(`//*[${textSelectors}]`);
  },
};

export default by;
