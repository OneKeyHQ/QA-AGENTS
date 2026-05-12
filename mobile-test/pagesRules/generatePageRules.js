#!/usr/bin/env node

/**
 * PageRules 自动生成工具
 * 基于命名规律自动生成 pageRules 文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * 扫描所有页面文件，建立页面索引
 */
async function scanPages() {
  // 扫描 pages 目录下的页面文件
  const pageFiles = await glob('pages/**/*Page.js', {
    cwd: projectRoot,
    absolute: true,
  });
  
  // 扫描 popup 目录下的弹层文件
  const popupFiles = await glob('popup/**/*.popup.js', {
    cwd: projectRoot,
    absolute: true,
  });
  
  const allFiles = [...pageFiles, ...popupFiles];

  const pageIndex = new Map();

  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 提取导出名：export const xxxPage = new XxxPage();
      const exportMatch = content.match(/export\s+const\s+(\w+)\s*=\s*new\s+(\w+)/);
      if (!exportMatch) continue;

      const exportName = exportMatch[1];
      const className = exportMatch[2];
      
      // 提取文件名
      const fileName = path.basename(filePath);
      
      // 提取类名中的关键词（用于匹配）
      const keywords = extractKeywords(className, exportName);
      
      pageIndex.set(exportName, {
        exportName,
        className,
        fileName,
        filePath,
        keywords,
        relativePath: path.relative(path.join(projectRoot, 'pages'), filePath),
      });
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error.message);
    }
  }

  return pageIndex;
}

/**
 * 从类名或导出名中提取关键词
 */
function extractKeywords(className, exportName) {
  const keywords = new Set();
  
  // 移除常见的后缀
  const cleanName = className.replace(/Page$/, '') || exportName.replace(/Page$/, '');
  
  // 按驼峰分割
  const words = cleanName.split(/(?=[A-Z])/).map(w => w.toLowerCase());
  
  // 添加完整名称的变体
  keywords.add(cleanName.toLowerCase());
  keywords.add(exportName.toLowerCase());
  
  // 添加关键词
  words.forEach(word => {
    if (word.length > 2) {
      keywords.add(word);
    }
  });
  
  // 添加组合关键词
  if (words.length > 1) {
    keywords.add(words.slice(-2).join(''));
    keywords.add(words.slice(-1)[0]);
  }
  
  return Array.from(keywords);
}

/**
 * 从按钮名中提取关键词
 */
function extractButtonKeywords(buttonName) {
  const keywords = new Set();
  
  // 移除常见后缀
  const cleanName = buttonName
    .replace(/Btn$/, '')
    .replace(/Button$/, '')
    .replace(/Link$/, '')
    .replace(/Icon$/, '')
    .replace(/Trigger$/, '');
  
  // 按驼峰分割
  const words = cleanName.split(/(?=[A-Z])/).map(w => w.toLowerCase());
  
  // 过滤停用词
  const stopWords = new Set(['with', 'the', 'and', 'for', 'to', 'continue', 'click', 'open', 'go', 'select']);
  
  words.forEach(word => {
    if (word.length > 2 && !stopWords.has(word)) {
      keywords.add(word);
    }
  });
  
  // 添加组合关键词（优先考虑后面的词，通常是主要功能词）
  if (words.length > 1) {
    // 提取主要关键词（通常是最后一个或倒数第二个）
    const mainKeywords = words.slice(-2).filter(w => !stopWords.has(w));
    mainKeywords.forEach(kw => keywords.add(kw));
    if (mainKeywords.length > 0) {
      keywords.add(mainKeywords.join(''));
    }
    
    // 特殊处理：continueWithXxx -> 提取 Xxx
    if (cleanName.match(/^continueWith/i)) {
      const afterWith = cleanName.replace(/^continueWith/i, '');
      if (afterWith) {
        keywords.add(afterWith.toLowerCase());
      }
    }
    
    // 特殊处理：connectXxx -> 提取 Xxx
    if (cleanName.match(/^connect/i)) {
      const afterConnect = cleanName.replace(/^connect/i, '');
      if (afterConnect) {
        keywords.add(afterConnect.toLowerCase());
      }
    }
  }
  
  return Array.from(keywords);
}

/**
 * 推断目标页面
 */
function inferTargetPage(buttonName, pageIndex, currentPagePath) {
  const buttonKeywords = extractButtonKeywords(buttonName);
  
  // 特殊规则：返回按钮
  // 注意：onboarding 页面的返回按钮应该回到 homePage
  if (buttonName.match(/^back(Button|Btn)?$/i)) {
    // 检查当前页面是否是 onboarding
    if (currentPagePath && currentPagePath.includes('onboarding')) {
      return { target: 'homePage', confidence: 'high' };
    }
    return { target: 'previous', confidence: 'high' };
  }
  
  // 特殊规则：关闭按钮
  if (buttonName.match(/^close(Button|Btn)?$/i)) {
    return { target: 'closeButton', confidence: 'high', action: 'click' };
  }
  
  // 特殊规则：右上角按钮可能打开弹层
  if (buttonName.match(/topRight/i) || buttonName.match(/top.*right/i)) {
    // 查找 popup，优先匹配 languageSelectPopup
    for (const [exportName, pageInfo] of pageIndex.entries()) {
      if (exportName.toLowerCase().includes('languageselect') || 
          exportName.toLowerCase().includes('languageSelect') ||
          exportName === 'languageSelectPopup') {
        return { target: exportName, confidence: 'high' };
      }
    }
    // 查找其他 popup
    for (const [exportName, pageInfo] of pageIndex.entries()) {
      if (exportName.toLowerCase().includes('popup') || 
          pageInfo.fileName.includes('.popup.')) {
        return { target: exportName, confidence: 'medium' };
      }
    }
  }
  
  // 在页面索引中查找匹配
  const matches = [];
  
  for (const [exportName, pageInfo] of pageIndex.entries()) {
    // 跳过当前页面
    if (pageInfo.relativePath === currentPagePath) continue;
    
    // 计算匹配度
    let score = 0;
    let exactMatch = false;
    
    for (const keyword of buttonKeywords) {
      // 精确匹配得分更高
      if (exportName.toLowerCase().includes(keyword) || 
          pageInfo.className.toLowerCase().includes(keyword)) {
        score += 2;
        if (exportName.toLowerCase().includes(keyword) && keyword.length > 3) {
          exactMatch = true;
        }
      } else if (pageInfo.keywords.some(k => k.includes(keyword) || keyword.includes(k))) {
        score += 1;
      }
    }
    
    // 特殊匹配规则
    // continueWithGoogle -> useGooglePage
    if (buttonName.includes('Google') && exportName.includes('Google')) {
      score += 5;
      exactMatch = true;
    }
    // continueWithApple -> useApplePage
    if (buttonName.includes('Apple') && exportName.includes('Apple')) {
      score += 5;
      exactMatch = true;
    }
    // connectHardwareWallet -> selectHardwareWallet
    if (buttonName.includes('HardwareWallet') && exportName.includes('HardwareWallet')) {
      score += 5;
      exactMatch = true;
    }
    // moreOptions -> addWallet (需要特殊处理)
    if (buttonName.includes('MoreOptions') || buttonName.includes('moreOptions')) {
      if (exportName.includes('AddWallet') || exportName.includes('addWallet')) {
        score += 5;
        exactMatch = true;
      }
    }
    
    if (score > 0) {
      matches.push({ exportName, score, pageInfo, exactMatch });
    }
  }
  
  // 按分数排序，精确匹配优先
  matches.sort((a, b) => {
    if (a.exactMatch && !b.exactMatch) return -1;
    if (!a.exactMatch && b.exactMatch) return 1;
    return b.score - a.score;
  });
  
  if (matches.length > 0 && matches[0].score >= 1) {
    const confidence = matches[0].exactMatch && matches.length === 1 ? 'high' : 
                      matches[0].score >= 3 ? 'high' : 'medium';
    return {
      target: matches[0].exportName,
      confidence,
      alternatives: matches.slice(1).map(m => m.exportName),
    };
  }
  
  return null;
}

/**
 * 推断 action 类型
 */
function inferAction(elementName, elementType) {
  // 输入类元素
  if (elementName.match(/(Input|Field|Search)$/)) {
    return 'input';
  }
  
  // 按钮类元素
  if (elementName.match(/(Btn|Button|Link|Icon|Trigger)$/)) {
    return 'navigate';
  }
  
  // 文本类（可能是外部链接）
  if (elementName.match(/(Text|Link)$/) && elementType === 'external') {
    return 'navigate';
  }
  
  return 'tap';
}

/**
 * 推断 target
 */
function inferTarget(elementName, action, pageIndex, currentPagePath) {
  if (action === 'input') {
    // 输入类：提取字段名
    const fieldName = elementName
      .replace(/Input$/, '')
      .replace(/Field$/, '')
      .replace(/Search$/, '');
    return fieldName.toLowerCase();
  }
  
  if (action === 'navigate') {
    const result = inferTargetPage(elementName, pageIndex, currentPagePath);
    if (result) {
      return result;
    }
  }
  
  // 默认：使用操作名
  const actionName = elementName
    .replace(/Btn$/, '')
    .replace(/Button$/, '')
    .replace(/Link$/, '')
    .toLowerCase();
  
  return actionName;
}

/**
 * 生成 description
 */
function generateDescription(elementName, action, target) {
  if (action === 'navigate') {
    if (target === 'previous') {
      return '返回上一级页面';
    }
    if (target === 'homePage') {
      return '返回首页';
    }
    if (target === 'external') {
      return '跳转外部浏览器查看协议';
    }
    if (typeof target === 'string') {
      // 转换 camelCase 为中文描述
      let targetName = target;
      if (target.includes('Page')) {
        targetName = target.replace(/Page$/, '');
        // 常见页面名称映射
        const pageNameMap = {
          'selectHardwareWallet': '选择硬件钱包页面',
          'useGoogle': 'Google登录页面',
          'useApple': 'Apple登录页面',
          'addWallet': '添加钱包页面',
          'languageSelectPopup': '语言选择弹层',
        };
        if (pageNameMap[targetName]) {
          return `打开${pageNameMap[targetName]}`;
        }
        return `打开${targetName}`;
      }
      if (target.includes('Popup')) {
        targetName = target.replace(/Popup$/, '');
        const popupNameMap = {
          'languageSelect': '语言选择弹层',
        };
        if (popupNameMap[targetName]) {
          return `打开${popupNameMap[targetName]}`;
        }
        return `打开${targetName}弹层`;
      }
      return `跳转到${target}`;
    }
    return `跳转到${target}`;
  }
  
  if (action === 'input') {
    return `输入${target}`;
  }
  
  const name = elementName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
  return `点击${name}`;
}

/**
 * 解析页面对象文件，提取元素
 */
function parsePageFile(filePath, pageIndex) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 提取导出名
  const exportMatch = content.match(/export\s+const\s+(\w+)\s*=\s*new\s+(\w+)/);
  if (!exportMatch) return null;
  
  const exportName = exportMatch[1];
  const className = exportMatch[2];
  const fileName = path.basename(filePath);
  const relativePath = path.relative(path.join(projectRoot, 'pages'), filePath);
  
  // 提取所有 getter
  const getterPattern = /get\s+(\w+)\s*\([^)]*\)\s*\{[^}]*return[^}]*\}/g;
  const getters = [];
  let match;
  
  while ((match = getterPattern.exec(content)) !== null) {
    const elementName = match[1];
    
    // 跳过内部辅助元素（但保留可点击的文本元素，如协议文本）
    if (elementName === 'keyElement' || 
        elementName.match(/^(back|close)Icon$/)) {
      continue;
    }
    
    // 文本元素：只保留可交互的（如协议文本、链接等）
    if (elementName.match(/Text$/) && !elementName.match(/(Input|Field|Search|Link)$/)) {
      // 检查是否是协议文本或其他可点击文本
      // 获取 getter 前后的上下文（包括注释）
      const beforeMatch = content.substring(Math.max(0, match.index - 1000), match.index);
      const afterMatch = content.substring(match.index, Math.min(content.length, match.index + 300));
      const contextMatch = beforeMatch + afterMatch;
      
      // 检查元素名和上下文
      const isClickable = elementName.toLowerCase().includes('agreement') ||
                          elementName.toLowerCase().includes('terms') ||
                          elementName.toLowerCase().includes('privacy') ||
                          contextMatch.includes('协议') ||
                          contextMatch.includes('使用条款') ||
                          contextMatch.includes('隐私政策') ||
                          contextMatch.includes('Terms') ||
                          contextMatch.includes('Privacy') ||
                          contextMatch.includes('点击') || 
                          contextMatch.includes('跳转') ||
                          contextMatch.includes('链接') ||
                          contextMatch.includes('link') ||
                          contextMatch.includes('http') ||
                          contextMatch.includes('外部');
      
      if (!isClickable) {
        continue;
      }
    }
    
    // 检查是否已废弃
    const beforeMatch = content.substring(0, match.index);
    const isDeprecated = beforeMatch.includes('@deprecated') || 
                         beforeMatch.match(/已废弃|deprecated/i);
    
    getters.push({ name: elementName, deprecated: isDeprecated });
  }
  
  // 提取元素规则
  const elements = {};
  const todos = [];
  
  for (const { name: elementName, deprecated } of getters) {
    // 跳过已废弃的元素（可选：也可以保留但标记为废弃）
    if (deprecated && elementName !== 'rightSideButton') {
      continue;
    }
    // 推断 action
    let action = inferAction(elementName);
    
    // 推断 target
    let targetResult = inferTarget(elementName, action, pageIndex, relativePath);
    
    let target;
    let confidence = 'low';
    let needsReview = false;
    
    if (typeof targetResult === 'object' && targetResult !== null) {
      target = targetResult.target;
      confidence = targetResult.confidence || 'low';
      needsReview = confidence === 'low' || confidence === 'medium';
    } else if (typeof targetResult === 'string') {
      target = targetResult;
    } else {
      target = elementName.toLowerCase();
      needsReview = true;
    }
    
    // 特殊处理：外部链接（协议文本等）
    if (elementName.match(/agreement/i) || 
        elementName.match(/Text$/) && (content.includes('http') || content.includes('external') || content.includes('协议'))) {
      action = 'navigate';
      target = 'external';
      needsReview = false;
    }
    
    // 生成 description
    const description = generateDescription(elementName, action, target);
    
    elements[elementName] = {
      action,
      target,
      description,
    };
    
    if (needsReview) {
      todos.push(elementName);
    }
  }
  
  return {
    page: exportName,
    pageFile: fileName,
    elements,
    todos,
    className,
  };
}

/**
 * 生成 pageRules 文件内容
 */
function generatePageRulesContent(pageRules) {
  const { page, pageFile, elements, className } = pageRules;
  
  // 按功能分组元素
  const navigationElements = [];
  const inputElements = [];
  const actionElements = [];
  
  for (const [name, rule] of Object.entries(elements)) {
    if (rule.action === 'navigate') {
      navigationElements.push({ name, ...rule });
    } else if (rule.action === 'input') {
      inputElements.push({ name, ...rule });
    } else {
      actionElements.push({ name, ...rule });
    }
  }
  
  let content = `/**\n`;
  content += ` * ${className.replace(/Page$/, '')}页面 - 可交互元素规则\n`;
  content += ` * 对应页面对象: ${page} (${pageFile})\n`;
  content += ` * 用于生成测试用例\n`;
  content += ` * \n`;
  if (pageRules.todos.length > 0) {
    content += ` * ⚠️ 以下元素需要人工确认：${pageRules.todos.join(', ')}\n`;
  }
  content += ` */\n`;
  content += `export default {\n`;
  content += `  page: '${page}',\n`;
  content += `  pageFile: '${pageFile}',\n`;
  content += `  elements: {\n`;
  
  // 输出导航类元素
  if (navigationElements.length > 0) {
    content += `    // ========== 导航类元素 ==========\n`;
    for (const elem of navigationElements) {
      content += `    ${elem.name}: {\n`;
      content += `      action: '${elem.action}',\n`;
      content += `      target: ${typeof elem.target === 'string' ? `'${elem.target}'` : JSON.stringify(elem.target)},\n`;
      content += `      description: '${elem.description}',\n`;
      if (pageRules.todos.includes(elem.name)) {
        content += `      // TODO: 需要人工确认目标页面\n`;
      }
      content += `    },\n`;
    }
  }
  
  // 输出输入类元素
  if (inputElements.length > 0) {
    content += `    // ========== 输入类元素 ==========\n`;
    for (const elem of inputElements) {
      content += `    ${elem.name}: {\n`;
      content += `      action: '${elem.action}',\n`;
      content += `      target: '${elem.target}',\n`;
      content += `      description: '${elem.description}',\n`;
      content += `    },\n`;
    }
  }
  
  // 输出操作类元素
  if (actionElements.length > 0) {
    content += `    // ========== 操作类元素 ==========\n`;
    for (const elem of actionElements) {
      content += `    ${elem.name}: {\n`;
      content += `      action: '${elem.action}',\n`;
      content += `      target: '${elem.target}',\n`;
      content += `      description: '${elem.description}',\n`;
      if (pageRules.todos.includes(elem.name)) {
        content += `      // TODO: 需要人工确认操作类型\n`;
      }
      content += `    },\n`;
    }
  }
  
  content += `  },\n`;
  content += `};\n`;
  
  return content;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const targetPage = args[0]; // 可选：指定页面文件路径
  
  console.log('🔍 扫描页面文件...');
  const pageIndex = await scanPages();
  console.log(`✅ 找到 ${pageIndex.size} 个页面对象\n`);
  
  // 确定要处理的页面
  let pagesToProcess = [];
  
  if (targetPage) {
    // 处理指定页面
    const fullPath = path.isAbsolute(targetPage) 
      ? targetPage 
      : path.join(projectRoot, targetPage);
    pagesToProcess.push(fullPath);
  } else {
    // 处理所有页面
    pagesToProcess = Array.from(pageIndex.values()).map(p => p.filePath);
  }
  
  for (const filePath of pagesToProcess) {
    console.log(`📝 处理: ${path.relative(projectRoot, filePath)}`);
    
    const pageRules = parsePageFile(filePath, pageIndex);
    if (!pageRules) {
      console.log(`  ⚠️  跳过：无法解析页面对象\n`);
      continue;
    }
    
    // 生成文件内容
    const content = generatePageRulesContent(pageRules);
    
    // 确定输出路径
    const relativePath = path.relative(path.join(projectRoot, 'pages'), filePath);
    const dirParts = path.dirname(relativePath).split(path.sep);
    const fileName = path.basename(filePath, 'Page.js');
    
    // 转换为 pageRules 目录结构
    const outputDir = path.join(projectRoot, 'pagesRules', ...dirParts);
    // 使用导出名作为文件名（camelCase）
    const outputFileName = `${pageRules.page}.js`;
    const outputFile = path.join(outputDir, outputFileName);
    
    // 创建目录
    fs.mkdirSync(outputDir, { recursive: true });
    
    // 检查文件是否已存在
    if (fs.existsSync(outputFile)) {
      console.log(`  ⚠️  文件已存在: ${path.relative(projectRoot, outputFile)}`);
      console.log(`  💡 如需覆盖，请手动删除后重新运行\n`);
      continue;
    }
    
    // 写入文件
    fs.writeFileSync(outputFile, content, 'utf-8');
    
    console.log(`  ✅ 生成: ${path.relative(projectRoot, outputFile)}`);
    if (pageRules.todos.length > 0) {
      console.log(`  ⚠️  需要人工确认的元素: ${pageRules.todos.join(', ')}`);
    }
    console.log('');
  }
  
  console.log('✨ 完成！');
}

// 运行
main().catch(console.error);
