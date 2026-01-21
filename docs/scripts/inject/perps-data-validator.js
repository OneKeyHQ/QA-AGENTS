/**
 * Perps 数据验证脚本
 * 此脚本用于验证 Perps 模块的 WebSocket 数据与 UI 显示一致性
 * 
 * 功能：
 * - Token 列表数据提取（crypto + hip3 xyz 订阅）
 * - 订单簿数据验证（10 档排序、总计计算、背景色百分比）
 * - K线图数据提取（标记价格、预言机价格、资金费率）
 * - BBO 数据验证（buy1/sell1）
 * 
 * 使用方法：
 * - window.__perpsValidator.getTokenListData()     获取 Token 列表数据
 * - window.__perpsValidator.getOrderbookData()     获取订单簿数据
 * - window.__perpsValidator.validateOrderbook()    验证订单簿计算
 * - window.__perpsValidator.getKlineData()         获取 K 线数据
 * - window.__perpsValidator.getBBOData()           获取 BBO 数据
 * - window.__perpsValidator.getReport()            获取完整报告
 * - window.__perpsValidator.clear()                清空所有数据
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__perpsValidator) {
    console.log('[Perps Validator] 脚本已加载，跳过重复注入');
    return;
  }

  // 保存原始 WebSocket 构造函数
  const OriginalWebSocket = window.WebSocket;

  // 数据存储
  const validatorData = {
    // Token 列表数据
    tokenList: {
      crypto: [],           // crypto 数据源
      hip3: [],             // hip3 xyz 数据源
      merged: [],           // 合并后的数据
      lastUpdate: null,
      subscriptions: []     // 订阅信息
    },
    
    // 订单簿数据
    orderbook: {
      bids: [],             // 买单（从高到低）
      asks: [],             // 卖单（从低到高）
      coin: null,
      lastUpdate: null,
      rawMessages: []       // 原始消息（最近 50 条）
    },
    
    // K线数据
    kline: {
      markPrice: null,      // 标记价格
      oraclePrice: null,    // 预言机价格
      fundingRate: null,    // 资金费率
      volume24h: null,      // 24h 成交量
      openInterest: null,   // 持仓量
      candles: [],          // K线数据
      interval: null,       // 当前周期
      lastUpdate: null
    },
    
    // BBO 数据
    bbo: {
      buy1: null,           // 买1价
      sell1: null,          // 卖1价
      buy1Size: null,       // 买1量
      sell1Size: null,      // 卖1量
      coin: null,
      lastUpdate: null,
      updateCount: 0,
      history: []           // 历史记录（最近 100 条）
    },
    
    // WebSocket 连接信息
    connections: [],
    messages: [],           // 所有消息（最近 500 条）
    
    // 统计信息
    stats: {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      tokenListUpdates: 0,
      orderbookUpdates: 0,
      klineUpdates: 0,
      bboUpdates: 0
    }
  };

  // 生成唯一 ID
  let connectionIdCounter = 0;
  function generateId() {
    return `ws_${Date.now()}_${++connectionIdCounter}`;
  }

  // 解析 JSON 消息
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

  // ============ Token 列表数据处理 ============
  
  function processTokenListData(parsedData) {
    try {
      // Hyperliquid 资产信息格式
      // { "channel": "allMids", "data": { "mids": { "BTC": "100000.5", "ETH": "3500.2" } } }
      if (parsedData.channel === 'allMids' && parsedData.data?.mids) {
        const mids = parsedData.data.mids;
        Object.keys(mids).forEach(coin => {
          updateTokenData(coin, { lastPrice: parseFloat(mids[coin]) }, 'crypto');
        });
        validatorData.stats.tokenListUpdates++;
        return true;
      }

      // 资产统计信息
      // { "channel": "webData2", "data": { "assetCtxs": [...] } }
      if (parsedData.channel === 'webData2' && parsedData.data?.assetCtxs) {
        parsedData.data.assetCtxs.forEach(ctx => {
          if (ctx.coin) {
            updateTokenData(ctx.coin, {
              fundingRate: parseFloat(ctx.funding || 0),
              volume24h: parseFloat(ctx.dayNtlVlm || 0),
              openInterest: parseFloat(ctx.openInterest || 0),
              change24h: parseFloat(ctx.premium || 0)
            }, 'crypto');
          }
        });
        validatorData.stats.tokenListUpdates++;
        return true;
      }

      // Meta 信息（资产列表）
      if (parsedData.channel === 'subscriptionResponse' || parsedData.type === 'meta') {
        validatorData.tokenList.subscriptions.push({
          type: parsedData.channel || parsedData.type,
          timestamp: new Date().toISOString()
        });
        return true;
      }

      // HIP3 数据格式（如果有）
      if (parsedData.source === 'hip3' || parsedData.channel?.includes('hip3')) {
        if (parsedData.data?.tokens) {
          parsedData.data.tokens.forEach(token => {
            updateTokenData(token.symbol, token, 'hip3');
          });
          validatorData.stats.tokenListUpdates++;
          return true;
        }
      }

      return false;
    } catch (e) {
      console.error('[Perps Validator] Token 列表处理错误:', e);
      return false;
    }
  }

  function updateTokenData(coin, data, source) {
    const sourceList = source === 'hip3' ? validatorData.tokenList.hip3 : validatorData.tokenList.crypto;
    
    let existing = sourceList.find(t => t.coin === coin);
    if (!existing) {
      existing = { coin, source };
      sourceList.push(existing);
    }
    
    Object.assign(existing, data, { lastUpdate: new Date().toISOString() });
    validatorData.tokenList.lastUpdate = new Date().toISOString();
    
    // 更新合并列表
    mergeTokenLists();
  }

  function mergeTokenLists() {
    const merged = {};
    
    // 先添加 crypto 数据
    validatorData.tokenList.crypto.forEach(token => {
      merged[token.coin] = { ...token };
    });
    
    // 合并 hip3 数据
    validatorData.tokenList.hip3.forEach(token => {
      if (merged[token.coin]) {
        Object.assign(merged[token.coin], token);
      } else {
        merged[token.coin] = { ...token };
      }
    });
    
    validatorData.tokenList.merged = Object.values(merged);
  }

  // ============ 订单簿数据处理 ============
  
  function processOrderbookData(parsedData) {
    try {
      // L2 订单簿数据
      // { "channel": "l2Book", "data": { "coin": "BTC", "levels": [[bids], [asks]] } }
      if (parsedData.channel === 'l2Book' && parsedData.data?.levels) {
        const { coin, levels } = parsedData.data;
        const time = parsedData.data.time;
        
        if (Array.isArray(levels) && levels.length >= 2) {
          // 买单（bids）- 按价格从高到低
          const bids = (levels[0] || []).map(level => ({
            price: parseFloat(level.px || level.p || level[0]),
            size: parseFloat(level.sz || level.s || level[1]),
            orders: level.n || 1
          })).sort((a, b) => b.price - a.price);
          
          // 卖单（asks）- 按价格从低到高
          const asks = (levels[1] || []).map(level => ({
            price: parseFloat(level.px || level.p || level[0]),
            size: parseFloat(level.sz || level.s || level[1]),
            orders: level.n || 1
          })).sort((a, b) => a.price - b.price);
          
          validatorData.orderbook.bids = bids;
          validatorData.orderbook.asks = asks;
          validatorData.orderbook.coin = coin;
          validatorData.orderbook.lastUpdate = new Date().toISOString();
          
          // 保存原始消息
          validatorData.orderbook.rawMessages.push({
            data: parsedData,
            timestamp: new Date().toISOString()
          });
          if (validatorData.orderbook.rawMessages.length > 50) {
            validatorData.orderbook.rawMessages.shift();
          }
          
          // 同时更新 BBO
          if (bids.length > 0 && asks.length > 0) {
            updateBBOData({
              coin,
              buy1: bids[0].price,
              sell1: asks[0].price,
              buy1Size: bids[0].size,
              sell1Size: asks[0].size
            });
          }
          
          validatorData.stats.orderbookUpdates++;
          return true;
        }
      }

      // 订单簿增量更新
      if (parsedData.channel === 'l2Updates' || parsedData.type === 'l2Updates') {
        // 处理增量更新...
        validatorData.stats.orderbookUpdates++;
        return true;
      }

      return false;
    } catch (e) {
      console.error('[Perps Validator] 订单簿处理错误:', e);
      return false;
    }
  }

  // 验证订单簿数据
  function validateOrderbook() {
    const { bids, asks } = validatorData.orderbook;
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      calculations: {}
    };

    // 1. 验证买单排序（从高到低）
    for (let i = 1; i < bids.length; i++) {
      if (bids[i].price > bids[i - 1].price) {
        results.valid = false;
        results.errors.push(`买单排序错误: 第${i}档价格(${bids[i].price}) > 第${i-1}档价格(${bids[i-1].price})`);
      }
    }

    // 2. 验证卖单排序（从低到高）
    for (let i = 1; i < asks.length; i++) {
      if (asks[i].price < asks[i - 1].price) {
        results.valid = false;
        results.errors.push(`卖单排序错误: 第${i}档价格(${asks[i].price}) < 第${i-1}档价格(${asks[i-1].price})`);
      }
    }

    // 3. 计算买单总计和百分比
    const bidCalculations = calculateCumulativeAndPercent(bids);
    results.calculations.bids = bidCalculations;

    // 4. 计算卖单总计和百分比
    const askCalculations = calculateCumulativeAndPercent(asks);
    results.calculations.asks = askCalculations;

    // 5. 验证买1价 < 卖1价（正常情况）
    if (bids.length > 0 && asks.length > 0) {
      if (bids[0].price >= asks[0].price) {
        results.warnings.push(`价差异常: 买1价(${bids[0].price}) >= 卖1价(${asks[0].price})`);
      }
    }

    return results;
  }

  // 计算累计量和百分比
  function calculateCumulativeAndPercent(levels) {
    if (levels.length === 0) return [];
    
    const N = levels.length;
    const totalSize = levels.reduce((sum, level) => sum + level.size, 0);
    
    let cumulative = 0;
    return levels.map((level, index) => {
      cumulative += level.size;
      const percent = totalSize > 0 ? (cumulative / totalSize * 100) : 0;
      
      return {
        index: index + 1,
        price: level.price,
        size: level.size,
        cumulative: cumulative,
        percent: percent.toFixed(2) + '%',
        percentValue: percent
      };
    });
  }

  // ============ K线数据处理 ============
  
  function processKlineData(parsedData) {
    try {
      // K线数据
      // { "channel": "candle", "data": { "t": timestamp, "o": open, "h": high, "l": low, "c": close, "v": volume } }
      if (parsedData.channel === 'candle' && parsedData.data) {
        const candle = parsedData.data;
        validatorData.kline.candles.push({
          time: candle.t || candle.T,
          open: parseFloat(candle.o || candle.O),
          high: parseFloat(candle.h || candle.H),
          low: parseFloat(candle.l || candle.L),
          close: parseFloat(candle.c || candle.C),
          volume: parseFloat(candle.v || candle.V || 0)
        });
        
        // 保留最近 500 根 K 线
        if (validatorData.kline.candles.length > 500) {
          validatorData.kline.candles.shift();
        }
        
        validatorData.kline.lastUpdate = new Date().toISOString();
        validatorData.stats.klineUpdates++;
        return true;
      }

      // 标记价格、预言机价格
      if (parsedData.channel === 'activeAssetCtx' || parsedData.data?.markPx) {
        const data = parsedData.data || parsedData;
        if (data.markPx) {
          validatorData.kline.markPrice = parseFloat(data.markPx);
        }
        if (data.oraclePx) {
          validatorData.kline.oraclePrice = parseFloat(data.oraclePx);
        }
        if (data.funding) {
          validatorData.kline.fundingRate = parseFloat(data.funding);
        }
        if (data.dayNtlVlm) {
          validatorData.kline.volume24h = parseFloat(data.dayNtlVlm);
        }
        if (data.openInterest) {
          validatorData.kline.openInterest = parseFloat(data.openInterest);
        }
        validatorData.kline.lastUpdate = new Date().toISOString();
        validatorData.stats.klineUpdates++;
        return true;
      }

      // webData2 中的价格信息
      if (parsedData.channel === 'webData2' && parsedData.data?.activeAssetCtx) {
        const ctx = parsedData.data.activeAssetCtx;
        if (ctx.markPx) {
          validatorData.kline.markPrice = parseFloat(ctx.markPx);
        }
        if (ctx.oraclePx) {
          validatorData.kline.oraclePrice = parseFloat(ctx.oraclePx);
        }
        if (ctx.funding) {
          validatorData.kline.fundingRate = parseFloat(ctx.funding);
        }
        validatorData.kline.lastUpdate = new Date().toISOString();
        return true;
      }

      return false;
    } catch (e) {
      console.error('[Perps Validator] K线处理错误:', e);
      return false;
    }
  }

  // ============ BBO 数据处理 ============
  
  function updateBBOData(data) {
    const oldBuy1 = validatorData.bbo.buy1;
    const oldSell1 = validatorData.bbo.sell1;
    
    const priceChanged = (oldBuy1 !== data.buy1) || (oldSell1 !== data.sell1);
    
    validatorData.bbo.buy1 = data.buy1;
    validatorData.bbo.sell1 = data.sell1;
    validatorData.bbo.buy1Size = data.buy1Size;
    validatorData.bbo.sell1Size = data.sell1Size;
    validatorData.bbo.coin = data.coin;
    validatorData.bbo.lastUpdate = new Date().toISOString();
    validatorData.bbo.updateCount++;
    
    // 保存历史记录
    validatorData.bbo.history.push({
      buy1: data.buy1,
      sell1: data.sell1,
      coin: data.coin,
      priceChanged,
      timestamp: Date.now()
    });
    if (validatorData.bbo.history.length > 100) {
      validatorData.bbo.history.shift();
    }
    
    if (priceChanged) {
      validatorData.stats.bboUpdates++;
      console.log(`[Perps Validator] BBO 更新: buy1=${data.buy1}, sell1=${data.sell1}`);
    }
  }

  // ============ WebSocket 代理 ============
  
  function ProxyWebSocket(url, protocols) {
    const ws = protocols 
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    const connectionId = generateId();
    const connectionInfo = {
      id: connectionId,
      url: url,
      state: 'connecting',
      openTime: null,
      messageCount: 0
    };

    validatorData.connections.push(connectionInfo);
    validatorData.stats.totalConnections++;
    validatorData.stats.activeConnections++;

    console.log(`[Perps Validator] 新连接: ${url}`);

    // 监听 open 事件
    ws.addEventListener('open', function(event) {
      connectionInfo.state = 'open';
      connectionInfo.openTime = new Date().toISOString();
      console.log(`[Perps Validator] 连接已打开: ${connectionId}`);
    });

    // 监听 message 事件
    ws.addEventListener('message', function(event) {
      connectionInfo.messageCount++;
      validatorData.stats.totalMessages++;

      const parsedData = parseMessage(event.data);
      
      // 保存消息
      validatorData.messages.push({
        connectionId,
        data: parsedData,
        timestamp: new Date().toISOString()
      });
      if (validatorData.messages.length > 500) {
        validatorData.messages.shift();
      }

      // 处理不同类型的数据
      processTokenListData(parsedData);
      processOrderbookData(parsedData);
      processKlineData(parsedData);
    });

    // 监听 close 事件
    ws.addEventListener('close', function(event) {
      connectionInfo.state = 'closed';
      validatorData.stats.activeConnections--;
      console.log(`[Perps Validator] 连接已关闭: ${connectionId}`);
    });

    // 监听 error 事件
    ws.addEventListener('error', function(event) {
      console.error(`[Perps Validator] 连接错误: ${connectionId}`);
    });

    // 拦截 send 方法
    const originalSend = ws.send.bind(ws);
    ws.send = function(data) {
      const parsedData = parseMessage(data);
      validatorData.messages.push({
        connectionId,
        direction: 'sent',
        data: parsedData,
        timestamp: new Date().toISOString()
      });
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

  // ============ 导出接口 ============
  
  window.__perpsValidator = {
    // 获取 Token 列表数据
    getTokenListData: function() {
      return {
        crypto: validatorData.tokenList.crypto,
        hip3: validatorData.tokenList.hip3,
        merged: validatorData.tokenList.merged,
        lastUpdate: validatorData.tokenList.lastUpdate,
        totalTokens: validatorData.tokenList.merged.length
      };
    },

    // 获取订单簿数据
    getOrderbookData: function(levels = 10) {
      return {
        coin: validatorData.orderbook.coin,
        bids: validatorData.orderbook.bids.slice(0, levels),
        asks: validatorData.orderbook.asks.slice(0, levels),
        lastUpdate: validatorData.orderbook.lastUpdate,
        totalBidLevels: validatorData.orderbook.bids.length,
        totalAskLevels: validatorData.orderbook.asks.length
      };
    },

    // 验证订单簿数据
    validateOrderbook: function() {
      return validateOrderbook();
    },

    // 获取 K 线数据
    getKlineData: function() {
      return {
        markPrice: validatorData.kline.markPrice,
        oraclePrice: validatorData.kline.oraclePrice,
        fundingRate: validatorData.kline.fundingRate,
        volume24h: validatorData.kline.volume24h,
        openInterest: validatorData.kline.openInterest,
        candleCount: validatorData.kline.candles.length,
        lastCandle: validatorData.kline.candles[validatorData.kline.candles.length - 1],
        lastUpdate: validatorData.kline.lastUpdate
      };
    },

    // 获取 BBO 数据
    getBBOData: function() {
      return {
        buy1: validatorData.bbo.buy1,
        sell1: validatorData.bbo.sell1,
        buy1Size: validatorData.bbo.buy1Size,
        sell1Size: validatorData.bbo.sell1Size,
        coin: validatorData.bbo.coin,
        lastUpdate: validatorData.bbo.lastUpdate,
        updateCount: validatorData.bbo.updateCount,
        history: validatorData.bbo.history.slice(-10)
      };
    },

    // 获取完整报告
    getReport: function() {
      return {
        tokenList: this.getTokenListData(),
        orderbook: this.getOrderbookData(),
        orderbookValidation: this.validateOrderbook(),
        kline: this.getKlineData(),
        bbo: this.getBBOData(),
        stats: { ...validatorData.stats },
        connections: validatorData.connections.map(c => ({
          id: c.id,
          url: c.url,
          state: c.state,
          messageCount: c.messageCount
        })),
        timestamp: new Date().toISOString()
      };
    },

    // 获取最近的消息
    getMessages: function(limit = 50) {
      return validatorData.messages.slice(-limit);
    },

    // 按类型过滤消息
    getMessagesByChannel: function(channel, limit = 20) {
      return validatorData.messages
        .filter(m => m.data?.channel === channel)
        .slice(-limit);
    },

    // 获取统计信息
    getStats: function() {
      return { ...validatorData.stats };
    },

    // 清空所有数据
    clear: function() {
      validatorData.tokenList.crypto = [];
      validatorData.tokenList.hip3 = [];
      validatorData.tokenList.merged = [];
      validatorData.tokenList.lastUpdate = null;
      
      validatorData.orderbook.bids = [];
      validatorData.orderbook.asks = [];
      validatorData.orderbook.coin = null;
      validatorData.orderbook.rawMessages = [];
      
      validatorData.kline.markPrice = null;
      validatorData.kline.oraclePrice = null;
      validatorData.kline.fundingRate = null;
      validatorData.kline.volume24h = null;
      validatorData.kline.candles = [];
      
      validatorData.bbo.buy1 = null;
      validatorData.bbo.sell1 = null;
      validatorData.bbo.history = [];
      validatorData.bbo.updateCount = 0;
      
      validatorData.messages = [];
      
      Object.keys(validatorData.stats).forEach(key => {
        if (key !== 'totalConnections' && key !== 'activeConnections') {
          validatorData.stats[key] = 0;
        }
      });
      
      console.log('[Perps Validator] 数据已清空');
    },

    // 获取原始 WebSocket（用于调试）
    getOriginalWebSocket: function() {
      return OriginalWebSocket;
    }
  };

  console.log('[Perps Validator] ========================================');
  console.log('[Perps Validator] Perps 数据验证脚本已加载');
  console.log('[Perps Validator] ----------------------------------------');
  console.log('[Perps Validator] 可用命令：');
  console.log('[Perps Validator]   __perpsValidator.getTokenListData()  - Token 列表');
  console.log('[Perps Validator]   __perpsValidator.getOrderbookData()  - 订单簿数据');
  console.log('[Perps Validator]   __perpsValidator.validateOrderbook() - 验证订单簿');
  console.log('[Perps Validator]   __perpsValidator.getKlineData()      - K线数据');
  console.log('[Perps Validator]   __perpsValidator.getBBOData()        - BBO数据');
  console.log('[Perps Validator]   __perpsValidator.getReport()         - 完整报告');
  console.log('[Perps Validator] ========================================');

})();
