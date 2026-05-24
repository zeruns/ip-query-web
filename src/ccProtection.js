/**
 * CC 防护模块（纯 Node 实现，不依赖系统防火墙）
 *
 * 功能：并发连接限制 + 突发检测 + 慢速攻击防御 + IP 黑白名单
 * 提供 Express 中间件和状态查询函数
 */

// ── 单 IP 并发连接数记录 ──
const activeConns = new Map();     // ip → Set<socket.id>
const connHist = new Map();        // ip → { count, time }
const blockedIPs = new Map();      // ip → expire_time
let totalBlocked = 0;
let socketIdCounter = 0;

// 配置（由 init 时传入或使用默认值）
let config = {
  maxConcurrent: 20,
  burstWindow: 2000,
  burstMax: 40,
  slowTimeout: 15000,
  blockDuration: 60000,
  whitelist: new Set(),
  blacklist: new Set(),
};

// ── 定时清理 ──
setInterval(() => {
  const now = Date.now();
  for (const [ip, expire] of blockedIPs) {
    if (now > expire) blockedIPs.delete(ip);
  }
  for (const [ip, h] of connHist) {
    if (now - h.time > 30000) connHist.delete(ip);
  }
}, 10000);

/**
 * 初始化 CC 防护配置
 * @param {object} ccConfig - CC 防护配置对象（来自 config.cc）
 */
function init(ccConfig) {
  if (!ccConfig) return;
  config = {
    maxConcurrent: parseInt(ccConfig.maxConcurrent, 10) || 20,
    burstWindow: parseInt(ccConfig.burstWindow, 10) || 2000,
    burstMax: parseInt(ccConfig.burstMax, 10) || 40,
    slowTimeout: parseInt(ccConfig.slowTimeout, 10) || 15000,
    blockDuration: parseInt(ccConfig.blockDuration, 10) || 60000,
    whitelist: new Set((ccConfig.whitelist || []).map(s => s.trim()).filter(Boolean)),
    blacklist: new Set((ccConfig.blacklist || []).map(s => s.trim()).filter(Boolean)),
  };
}

/**
 * 获取客户端 IP（辅助函数，接受外部 keyGenerator 调用）
 */
function getRateLimitKey(req) {
  // 优先级从高到低：CDN 头 → req.ip → 直连 IP
  const cdnHeaders = [
    'cf-connecting-ip',
    'true-client-ip',
    'ali-cdn-real-ip',
    'x-real-ip',
    'x-forwarded-for',
  ];
  for (const header of cdnHeaders) {
    const value = req.headers[header];
    if (value) {
      if (header === 'x-forwarded-for') {
        const firstIP = value.split(',')[0].trim();
        if (firstIP) return firstIP;
      }
      return value.trim();
    }
  }
  return req.ip || req.socket.remoteAddress;
}

/**
 * CC 防护中间件
 * 必须在路由前注册
 */
function ccProtection(req, res, next) {
  const ip = getRateLimitKey(req);
  const now = Date.now();

  // 白名单放行
  if (config.whitelist.has(ip)) return next();
  // 黑名单拦截
  if (config.blacklist.has(ip)) {
    totalBlocked++;
    return res.status(403).json({ success: false, error: '访问被拒绝' });
  }
  // 检查是否在封禁期
  if (blockedIPs.has(ip)) {
    totalBlocked++;
    return res.status(429).json({ success: false, error: '连接过于频繁，已被临时封禁，请稍后再试' });
  }

  // ── 连接数检测 ──
  const currentConns = activeConns.get(ip);
  const connCount = currentConns ? currentConns.size : 0;
  if (connCount >= config.maxConcurrent) {
    if (!blockedIPs.has(ip)) {
      blockedIPs.set(ip, now + config.blockDuration);
      console.log(`[CC防护] IP ${ip} 并发${connCount}超限，封禁${config.blockDuration/1000}秒`);
    }
    totalBlocked++;
    return res.status(429).json({ success: false, error: '连接过于频繁，已被临时封禁，请稍后再试' });
  }

  // ── 突发连接检测 ──
  const hist = connHist.get(ip);
  if (hist && (now - hist.time) < config.burstWindow) {
    hist.count++;
    if (hist.count > config.burstMax) {
      blockedIPs.set(ip, now + config.blockDuration);
      connHist.delete(ip);
      console.log(`[CC防护] IP ${ip} 突发${hist.count}连接超限，封禁${config.blockDuration/1000}秒`);
      totalBlocked++;
      return res.status(429).json({ success: false, error: '连接过于频繁，已被临时封禁，请稍后再试' });
    }
  } else {
    connHist.set(ip, { count: 1, time: now });
  }

  // ── 注册连接跟踪 ──
  const sockId = ++socketIdCounter;
  if (!activeConns.has(ip)) activeConns.set(ip, new Set());
  activeConns.get(ip).add(sockId);

  // ── 慢速攻击检测（请求超时） ──
  let bodyDone = false;
  const slowTimer = setTimeout(() => {
    if (!bodyDone) {
      totalBlocked++;
      blockedIPs.set(ip, now + config.blockDuration);
      console.log(`[CC防护] IP ${ip} 慢速攻击（请求体超时），封禁${config.blockDuration/1000}秒`);
      try { res.status(408).json({ success: false, error: '请求超时' }); } catch(e) {}
    }
  }, config.slowTimeout);

  const cleanup = () => {
    bodyDone = true;
    clearTimeout(slowTimer);
    const s = activeConns.get(ip);
    if (s) {
      s.delete(sockId);
      if (s.size === 0) activeConns.delete(ip);
    }
    res.removeListener('close', cleanup);
    res.removeListener('finish', cleanup);
  };
  res.once('close', cleanup);
  res.once('finish', cleanup);

  next();
}

/**
 * 获取 CC 防护状态
 */
function getCCStatus() {
  return {
    activeIPs: activeConns.size,
    blockedIPs: blockedIPs.size,
    totalBlocked,
    blockList: Array.from(blockedIPs.entries()).slice(0, 20).map(([ip, expire]) => ({
      ip, remaining: Math.max(0, expire - Date.now())
    })),
    config: {
      MAX_CONCURRENT: config.maxConcurrent,
      BURST_WINDOW: config.burstWindow,
      BURST_MAX: config.burstMax,
      SLOW_TIMEOUT: config.slowTimeout,
      BLOCK_DURATION: config.blockDuration
    }
  };
}

module.exports = { init, ccProtection, getCCStatus, getRateLimitKey };
