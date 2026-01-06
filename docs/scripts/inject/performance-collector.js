/**
 * 性能指标采集脚本
 * 此脚本由系统自动注入到页面中执行，无需手动操作
 * 
 * 使用方法：在执行冒烟测试时，系统会自动在页面中执行此脚本
 */

// Core Web Vitals 采集
function collectCoreWebVitals() {
  const vitals = {
    lcp: null,
    fid: null,
    cls: 0
  };

  // LCP (Largest Contentful Paint)
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
  });
  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

  // FID (First Input Delay)
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      const firstInput = entries[0];
      vitals.fid = firstInput.processingStart - firstInput.startTime;
    }
  });
  fidObserver.observe({ entryTypes: ['first-input'] });

  // CLS (Cumulative Layout Shift)
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    vitals.cls = clsValue;
  });
  clsObserver.observe({ entryTypes: ['layout-shift'] });

  return vitals;
}

// 加载性能指标
function collectLoadingMetrics() {
  const perf = performance.timing;
  const paint = performance.getEntriesByType('paint');
  
  const fcp = paint.find(e => e.name === 'first-contentful-paint')?.startTime;
  const navigation = performance.getEntriesByType('navigation')[0];
  
  return {
    fcp: fcp,
    domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
    loadComplete: perf.loadEventEnd - perf.navigationStart,
    tti: calculateTTI(),
    tbt: calculateTBT()
  };
}

// 计算 TTI (Time to Interactive)
function calculateTTI() {
  const perf = performance.timing;
  return perf.domInteractive - perf.navigationStart;
}

// 计算 TBT (Total Blocking Time)
function calculateTBT() {
  const longTasks = performance.getEntriesByType('long-task');
  let tbt = 0;
  longTasks.forEach(task => {
    if (task.duration > 50) {
      tbt += task.duration - 50;
    }
  });
  return tbt;
}

// 资源性能指标
function collectResourceMetrics() {
  const resources = performance.getEntriesByType('resource');
  const resourceStats = {
    js: { count: 0, totalSize: 0, totalTime: 0 },
    css: { count: 0, totalSize: 0, totalTime: 0 },
    image: { count: 0, totalSize: 0, totalTime: 0 },
    other: { count: 0, totalSize: 0, totalTime: 0 }
  };

  resources.forEach(resource => {
    const type = getResourceType(resource.name);
    resourceStats[type].count++;
    resourceStats[type].totalSize += resource.transferSize || 0;
    resourceStats[type].totalTime += resource.duration || 0;
  });

  return resourceStats;
}

function getResourceType(url) {
  if (url.match(/\.(js|mjs)$/i)) return 'js';
  if (url.match(/\.css$/i)) return 'css';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
  return 'other';
}

// 网络性能指标
function collectNetworkMetrics() {
  const resources = performance.getEntriesByType('resource');
  const requests = resources.map(r => ({
    url: r.name,
    duration: r.duration,
    size: r.transferSize,
    status: r.responseStatus || 200
  }));

  const durations = requests.map(r => r.duration).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p90 = durations[Math.floor(durations.length * 0.9)];
  const p95 = durations[Math.floor(durations.length * 0.95)];

  const failed = requests.filter(r => r.status >= 400).length;
  const redirects = requests.filter(r => r.status >= 300 && r.status < 400).length;

  return {
    total: requests.length,
    p50: p50,
    p90: p90,
    p95: p95,
    failureRate: (failed / requests.length) * 100,
    redirects: redirects
  };
}

// 运行时性能指标
function collectRuntimeMetrics() {
  const memory = performance.memory;
  return {
    memoryUsed: memory ? memory.usedJSHeapSize : null,
    memoryTotal: memory ? memory.totalJSHeapSize : null,
    memoryLimit: memory ? memory.jsHeapSizeLimit : null
  };
}

// 主函数：收集所有性能指标
function collectAllMetrics() {
  return {
    coreWebVitals: collectCoreWebVitals(),
    loading: collectLoadingMetrics(),
    resources: collectResourceMetrics(),
    network: collectNetworkMetrics(),
    runtime: collectRuntimeMetrics(),
    timestamp: Date.now()
  };
}

// 导出（供系统调用）
if (typeof window !== 'undefined') {
  window.__performanceMetrics = collectAllMetrics;
}

// 自动执行并输出结果（供控制台查看）
console.log('性能指标采集脚本已加载');
console.log('执行 window.__performanceMetrics() 获取所有指标');

