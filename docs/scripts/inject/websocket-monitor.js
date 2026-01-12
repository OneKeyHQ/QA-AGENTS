/**
 * WebSocket 监听脚本
 * 此脚本由系统自动注入到页面中执行，无需手动操作
 * 
 * 重要：必须在页面加载前注入，以确保能拦截所有 WebSocket 连接
 * 
 * 功能：
 * - 拦截所有 WebSocket 连接
 * - 监听连接状态（打开、关闭、错误、重连）
 * - 记录所有发送和接收的消息
 * - 自动提取 Perps BBO 数据（buy1/sell1）
 * - 统计消息数量、大小、时间戳
 * 
 * 使用方法：
 * - window.__wsMonitor.getReport()      获取完整报告
 * - window.__wsMonitor.getBBOData()     获取 BBO 数据
 * - window.__wsMonitor.getConnections() 获取连接信息
 * - window.__wsMonitor.getMessages()    获取消息列表
 * - window.__wsMonitor.clear()          清空所有数据
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__wsMonitor) {
    console.log('[WS Monitor] 脚本已加载，跳过重复注入');
    return;
  }

  // 保存原始 WebSocket 构造函数
  const OriginalWebSocket = window.WebSocket;

  // 监控数据存储
  const monitorData = {
    connections: [],        // 所有连接
    messages: [],           // 所有消息
    bboData: {              // Perps BBO 数据
      buy1: null,
      sell1: null,
      lastUpdate: null,
      updateCount: 0,
      history: []           // BBO 历史记录（最近 100 条）
    },
    stats: {
      totalConnections: 0,
      activeConnections: 0,
      reconnectCount: 0,
      totalMessages: 0,
      totalBytes: 0,
      errorCount: 0
    }
  };

  // 生成唯一 ID
  let connectionIdCounter = 0;
  function generateId() {
    return `ws_${Date.now()}_${++connectionIdCounter}`;
  }

  // 解析消息内容
  function parseMessage(data) {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  }

  // 提取 BBO 数据（适配 Hyperliquid 格式）
  function extractBBOData(parsedData) {
    try {
      // Hyperliquid BBO 格式示例：
      // { "channel": "l2Book", "data": { "coin": "BTC", "levels": [[{ "px": "100.01", "sz": "1.5" }], [{ "px": "100.05", "sz": "2.0" }]] } }
      // 或者：
      // { "channel": "allMids", "data": { "mids": { "BTC": "100.03" } } }
      
      if (!parsedData || typeof parsedData !== 'object') return null;

      // 检查是否是 L2 订单簿数据
      if (parsedData.channel === 'l2Book' && parsedData.data?.levels) {
        const levels = parsedData.data.levels;
        if (Array.isArray(levels) && levels.length >= 2) {
          const bids = levels[0]; // 买单
          const asks = levels[1]; // 卖单
          
          if (bids?.length > 0 && asks?.length > 0) {
            return {
              coin: parsedData.data.coin,
              buy1: parseFloat(bids[0].px || bids[0].p),
              sell1: parseFloat(asks[0].px || asks[0].p),
              buy1Size: parseFloat(bids[0].sz || bids[0].s),
              sell1Size: parseFloat(asks[0].sz || asks[0].s),
              timestamp: Date.now()
            };
          }
        }
      }

      // 检查是否是订单簿更新数据
      if (parsedData.type === 'l2Updates' || parsedData.channel === 'orderbook') {
        const data = parsedData.data || parsedData;
        if (data.bids && data.asks) {
          const bestBid = data.bids[0];
          const bestAsk = data.asks[0];
          if (bestBid && bestAsk) {
            return {
              coin: data.coin || data.symbol,
              buy1: parseFloat(bestBid[0] || bestBid.price),
              sell1: parseFloat(bestAsk[0] || bestAsk.price),
              timestamp: Date.now()
            };
          }
        }
      }

      // 通用 BBO 格式检测
      if (parsedData.buy1 !== undefined || parsedData.bid !== undefined ||
          parsedData.sell1 !== undefined || parsedData.ask !== undefined) {
        return {
          buy1: parseFloat(parsedData.buy1 || parsedData.bid || parsedData.bestBid),
          sell1: parseFloat(parsedData.sell1 || parsedData.ask || parsedData.bestAsk),
          timestamp: Date.now()
        };
      }

      return null;
    } catch (e) {
      console.error('[WS Monitor] BBO 解析错误:', e);
      return null;
    }
  }

  // 更新 BBO 数据
  function updateBBOData(bboInfo) {
    if (!bboInfo) return;

    const oldBuy1 = monitorData.bboData.buy1;
    const oldSell1 = monitorData.bboData.sell1;

    // 检查价格是否真的变化（用于验证节流逻辑）
    const priceChanged = (oldBuy1 !== bboInfo.buy1) || (oldSell1 !== bboInfo.sell1);

    monitorData.bboData.buy1 = bboInfo.buy1;
    monitorData.bboData.sell1 = bboInfo.sell1;
    monitorData.bboData.lastUpdate = new Date().toISOString();
    monitorData.bboData.updateCount++;
    monitorData.bboData.priceChanged = priceChanged;
    monitorData.bboData.coin = bboInfo.coin;

    // 保存历史记录（最近 100 条）
    monitorData.bboData.history.push({
      buy1: bboInfo.buy1,
      sell1: bboInfo.sell1,
      coin: bboInfo.coin,
      priceChanged,
      timestamp: bboInfo.timestamp
    });
    if (monitorData.bboData.history.length > 100) {
      monitorData.bboData.history.shift();
    }

    // 如果价格变化，输出日志
    if (priceChanged) {
      console.log(`[WS Monitor] BBO 价格更新: buy1=${bboInfo.buy1}, sell1=${bboInfo.sell1}`);
    }
  }

  // 代理 WebSocket 构造函数
  function ProxyWebSocket(url, protocols) {
    const ws = protocols 
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    const connectionId = generateId();
    const connectionInfo = {
      id: connectionId,
      url: url,
      protocols: protocols,
      state: 'connecting',
      openTime: null,
      closeTime: null,
      closeCode: null,
      closeReason: null,
      messageCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: []
    };

    monitorData.connections.push(connectionInfo);
    monitorData.stats.totalConnections++;
    monitorData.stats.activeConnections++;

    console.log(`[WS Monitor] 新连接: ${url} (ID: ${connectionId})`);

    // 监听 open 事件
    const originalOnOpen = ws.onopen;
    ws.addEventListener('open', function(event) {
      connectionInfo.state = 'open';
      connectionInfo.openTime = new Date().toISOString();
      console.log(`[WS Monitor] 连接已打开: ${connectionId}`);
      
      if (originalOnOpen) {
        originalOnOpen.call(ws, event);
      }
    });

    // 监听 message 事件
    ws.addEventListener('message', function(event) {
      const data = event.data;
      const size = typeof data === 'string' ? data.length : (data.byteLength || 0);
      
      connectionInfo.messageCount++;
      connectionInfo.bytesReceived += size;
      monitorData.stats.totalMessages++;
      monitorData.stats.totalBytes += size;

      const parsedData = parseMessage(data);
      
      // 记录消息
      const messageInfo = {
        connectionId,
        direction: 'received',
        data: parsedData,
        rawSize: size,
        timestamp: new Date().toISOString()
      };
      monitorData.messages.push(messageInfo);

      // 限制消息历史数量（最多 1000 条）
      if (monitorData.messages.length > 1000) {
        monitorData.messages.shift();
      }

      // 尝试提取 BBO 数据
      const bboInfo = extractBBOData(parsedData);
      if (bboInfo) {
        updateBBOData(bboInfo);
      }
    });

    // 监听 close 事件
    ws.addEventListener('close', function(event) {
      connectionInfo.state = 'closed';
      connectionInfo.closeTime = new Date().toISOString();
      connectionInfo.closeCode = event.code;
      connectionInfo.closeReason = event.reason;
      monitorData.stats.activeConnections--;

      console.log(`[WS Monitor] 连接已关闭: ${connectionId} (code: ${event.code})`);

      // 检测是否为重连
      if (event.code !== 1000 && event.code !== 1001) {
        monitorData.stats.reconnectCount++;
      }
    });

    // 监听 error 事件
    ws.addEventListener('error', function(event) {
      connectionInfo.errors.push({
        timestamp: new Date().toISOString(),
        message: 'WebSocket error'
      });
      monitorData.stats.errorCount++;
      
      console.error(`[WS Monitor] 连接错误: ${connectionId}`);
    });

    // 拦截 send 方法
    const originalSend = ws.send.bind(ws);
    ws.send = function(data) {
      const size = typeof data === 'string' ? data.length : (data.byteLength || 0);
      connectionInfo.bytesSent += size;
      
      const messageInfo = {
        connectionId,
        direction: 'sent',
        data: parseMessage(data),
        rawSize: size,
        timestamp: new Date().toISOString()
      };
      monitorData.messages.push(messageInfo);

      return originalSend(data);
    };

    return ws;
  }

  // 保留原型链
  ProxyWebSocket.prototype = OriginalWebSocket.prototype;
  ProxyWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  ProxyWebSocket.OPEN = OriginalWebSocket.OPEN;
  ProxyWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  ProxyWebSocket.CLOSED = OriginalWebSocket.CLOSED;

  // 替换全局 WebSocket
  window.WebSocket = ProxyWebSocket;

  // 导出监控接口
  window.__wsMonitor = {
    // 获取完整报告
    getReport: function() {
      return {
        connections: {
          total: monitorData.stats.totalConnections,
          active: monitorData.stats.activeConnections,
          reconnects: monitorData.stats.reconnectCount,
          list: monitorData.connections.map(c => ({
            id: c.id,
            url: c.url,
            state: c.state,
            openTime: c.openTime,
            closeTime: c.closeTime,
            messageCount: c.messageCount,
            bytesSent: c.bytesSent,
            bytesReceived: c.bytesReceived
          }))
        },
        bbo: {
          buy1: monitorData.bboData.buy1,
          sell1: monitorData.bboData.sell1,
          coin: monitorData.bboData.coin,
          lastUpdate: monitorData.bboData.lastUpdate,
          updateCount: monitorData.bboData.updateCount
        },
        messages: {
          total: monitorData.stats.totalMessages,
          totalBytes: monitorData.stats.totalBytes,
          errors: monitorData.stats.errorCount
        },
        timestamp: new Date().toISOString()
      };
    },

    // 获取 BBO 数据
    getBBOData: function() {
      return {
        buy1: monitorData.bboData.buy1,
        sell1: monitorData.bboData.sell1,
        coin: monitorData.bboData.coin,
        lastUpdate: monitorData.bboData.lastUpdate,
        updateCount: monitorData.bboData.updateCount,
        history: monitorData.bboData.history.slice(-10) // 最近 10 条
      };
    },

    // 获取连接信息
    getConnections: function() {
      return monitorData.connections;
    },

    // 获取消息列表
    getMessages: function(limit = 50) {
      return monitorData.messages.slice(-limit);
    },

    // 按连接 ID 获取消息
    getMessagesByConnection: function(connectionId, limit = 50) {
      return monitorData.messages
        .filter(m => m.connectionId === connectionId)
        .slice(-limit);
    },

    // 获取统计信息
    getStats: function() {
      return { ...monitorData.stats };
    },

    // 清空所有数据
    clear: function() {
      monitorData.connections.length = 0;
      monitorData.messages.length = 0;
      monitorData.bboData.buy1 = null;
      monitorData.bboData.sell1 = null;
      monitorData.bboData.lastUpdate = null;
      monitorData.bboData.updateCount = 0;
      monitorData.bboData.history.length = 0;
      monitorData.stats.totalConnections = 0;
      monitorData.stats.activeConnections = 0;
      monitorData.stats.reconnectCount = 0;
      monitorData.stats.totalMessages = 0;
      monitorData.stats.totalBytes = 0;
      monitorData.stats.errorCount = 0;
      console.log('[WS Monitor] 数据已清空');
    },

    // 获取原始 WebSocket 构造函数（用于调试）
    getOriginalWebSocket: function() {
      return OriginalWebSocket;
    }
  };

  console.log('[WS Monitor] WebSocket 监听脚本已加载');
  console.log('[WS Monitor] 使用 window.__wsMonitor.getReport() 获取完整报告');
  console.log('[WS Monitor] 使用 window.__wsMonitor.getBBOData() 获取 BBO 数据');

})();
