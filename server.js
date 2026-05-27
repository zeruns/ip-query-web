/**
 * 纯真IP库在线查询系统 - Express 服务器
 *
 * 模块化架构，集成 IP 库查询 + 自动更新
 * 所有 API 支持 JSON 和纯文本双格式
 */

// 加载 .env 环境变量（优先级低于已有进程环境变量）
try { require('dotenv').config(); } catch(e) {}

const express = require('express');
const compression = require('compression');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const rateLimit = require('express-rate-limit');

// ──────────── 模块引入 ────────────
const config = require('./src/config');
const ipdb = require('./src/ipdb');
const updater = require('./src/updater');
const { init: initCC, ccProtection, getCCStatus, getRateLimitKey } = require('./src/ccProtection');
const stats = require('./src/stats');

// ──────────── 配置 ────────────
const app = express();

// 仅信任本机 Nginx 反代（localhost），防止 IP 伪造
const TRUSTED_PROXY = process.env.TRUSTED_PROXY || 'loopback';
app.set('trust proxy', TRUSTED_PROXY);

const PORT = config.port;
const HOST = config.host;

// ──────────── 限流配置 ────────────

// 限流 key 生成器 → 复用 getClientIP，确保 CDN 头优先
const rateLimitKey = (req) => getClientIP(req);

// 初始化 CC 防护
initCC(config.cc);

// 每个IP的速率限制
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `请求过于频繁，请稍后再试 (限流: ${config.rateLimit.max}次/分钟/IP)` },
  keyGenerator: rateLimitKey
});

// 域名解析接口限流（DNS查询耗时长，限制更严格）
const dnsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.dns,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `域名解析请求过于频繁，请稍后再试 (限流: ${config.rateLimit.dns}次/分钟/IP)` },
  keyGenerator: rateLimitKey
});

// ──────────── 安全中间件（必须最先执行） ────────────

// 反 IP 伪造：非可信代理来源剥离 CDN 头，防止限流/CC 防护被绕过
app.use((req, res, next) => {
  const remoteIp = req.socket?.remoteAddress || '';
  const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  const isTrusted = isLoopback || (TRUSTED_PROXY !== 'loopback' && remoteIp && app.get('trust proxy') !== false);
  if (!isTrusted) {
    // 非可信来源：剥离所有可能被伪造的代理头
    delete req.headers['x-forwarded-for'];
    delete req.headers['x-real-ip'];
    delete req.headers['cf-connecting-ip'];
    delete req.headers['true-client-ip'];
    delete req.headers['ali-real-client-ip'];
    delete req.headers['ali-cdn-real-ip'];
  }
  next();
});

// 安全头中间件
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');  // 现代浏览器已废弃，显式禁用
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Content-Security-Policy
  // script-src: CDN (Chart.js) + 统计脚本 + 自身内联脚本
  // img-src: 统计追踪像素（new Image()）需要外部域名
  // 如需添加其他统计/广告域名，在此处追加：
  //   环境变量 CSP_EXTRA_SCRIPT / CSP_EXTRA_IMG / CSP_EXTRA_CONNECT
  const cspExtraScript = (process.env.CSP_EXTRA_SCRIPT || '').split(',').filter(Boolean);
  const cspExtraImg = (process.env.CSP_EXTRA_IMG || '').split(',').filter(Boolean);
  const cspExtraConnect = (process.env.CSP_EXTRA_CONNECT || '').split(',').filter(Boolean);
  const cspScript = ['\'self\'', '\'unsafe-inline\'',
    'https://cdn.jsdelivr.net',   // Chart.js
    'https://hm.baidu.com',        // 百度统计
    'https://www.googletagmanager.com',  // Google Analytics
    'https://static.cloudflareinsights.com', // Cloudflare Analytics
    ...cspExtraScript
  ].join(' ');
  const cspImg = ['\'self\'', 'data:',
    'https://hm.baidu.com',        // 百度统计追踪像素
    'https://www.googletagmanager.com',
    'https://static.cloudflareinsights.com',
    ...cspExtraImg
  ].join(' ');
  const cspConnect = ['\'self\'', 'https:',
    ...cspExtraConnect
  ].join(' ');
  res.setHeader('Content-Security-Policy',
    `default-src 'self'; script-src ${cspScript}; style-src 'self' 'unsafe-inline'; img-src ${cspImg}; connect-src ${cspConnect}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  );
  // HSTS：仅 HTTPS 场景生效（Nginx SSL 终端时由 Nginx 设置更合适）
  if (config.ssl && config.ssl.key && config.ssl.cert) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ──────────── 中间件 ────────────

// CC 防护（纯 Node 实现，必须放在最前面）
app.use(ccProtection);

// 压缩中间件（在静态文件之前）
app.use(compression());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 统计中间件（记录 PV 和 API 调用）
app.use(stats.trackingMiddleware);

// 页面/静态资源限流（API 路由有独立限流，此处跳过）
const pageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.page,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/'),
  message: `请求过于频繁，请稍后再试 (限流: ${config.rateLimit.page}次/分钟/IP)`,
  keyGenerator: rateLimitKey
});
app.use(pageLimiter);

// 请求日志（简化）
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// JSON 解析
app.use(express.json());

// 静态文件（HTML 不缓存，其余 1 天）
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ──────────── 工具函数 ────────────

/**
 * 从请求头中获取访问者真实 IP
 * 
 * 优先级（从高到低）：
 *   1. CDN 专用头: CF-Connecting-IP (Cloudflare), True-Client-IP (Cloudflare/阿里云),
 *      X-Real-IP (Nginx), Ali-CDN-Real-IP (阿里云), X-Forwarded-For (通用)
 *   2. req.ip (Express 根据 trust proxy 解析)
 *   3. req.socket.remoteAddress (直连)
 * 
 * Nginx 反代需配置:
 *   proxy_set_header X-Real-IP $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 * 
 * Cloudflare CDN 需在 Nginx 中:
 *   server { real_ip_header CF-Connecting-IP; }
 */
function getClientIP(req) {
  // CDN 专用头（优先）
  const cdnHeaders = [
    'cf-connecting-ip',      // Cloudflare
    'true-client-ip',        // Cloudflare / 阿里云 / Google Cloud
    'ali-real-client-ip',    // 阿里云 ESA 托管转换
    'ali-cdn-real-ip',       // 阿里云 CDN
    'x-real-ip',             // Nginx
    'x-forwarded-for',       // 通用（取第一个）
  ];
  let ip = null;
  for (const header of cdnHeaders) {
    const value = req.headers[header];
    if (value) {
      if (header === 'x-forwarded-for') {
        // X-Forwarded-For: client, proxy1, proxy2 → 取第一个
        ip = value.split(',')[0].trim();
        if (ip) break;
      } else {
        ip = value.trim();
        break;
      }
    }
  }
  if (!ip) {
    // Express req.ip（受 trust proxy 设置影响）
    ip = req.ip || req.socket.remoteAddress;
  }
  // 过滤 IPv4-mapped IPv6 格式（双栈监听时 IPv4 连接会被映射为 ::ffff:x.x.x.x）
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  return ip;
}

/**
 * 根据请求判断是否期望纯文本响应
 * 逻辑：如果 URL 以 .txt 结尾则强制纯文本；
 *       如果查询参数 ?format=txt 则强制纯文本；
 *       如果查询参数 ?format=json 则强制 JSON；
 *       否则根据 Accept 头判断
 */
function wantsText(req) {
  if (req.path.endsWith('.txt')) return true;
  const format = req.query.format;
  if (format === 'txt') return true;
  if (format === 'json') return false;
  const accept = req.headers['accept'] || '';
  return accept.includes('text/plain') && !accept.includes('application/json');
}

/**
 * 统一响应包装：
 *   JSON 模式：调用 jsonFn(req) 获取对象，res.json(obj)
 *   纯文本模式：调用 txtFn(req) 获取字符串，res.type('text/plain; charset=utf-8').send(str)
 */
function respond(req, res, jsonFn, txtFn) {
  if (wantsText(req)) {
    res.type('text/plain; charset=utf-8');
    try {
      const result = txtFn(req);
      if (result && typeof result.then === 'function') {
        result.then(str => res.send(str)).catch(err => res.status(500).send(`error: ${err.message}`));
      } else {
        res.send(result);
      }
    } catch (e) {
      res.status(500).send(`error: ${e.message}`);
    }
  } else {
    try {
      const result = jsonFn(req);
      if (result && typeof result.then === 'function') {
        result.then(obj => res.json(obj)).catch(err => res.json({ success: false, error: err.message }));
      } else {
        res.json(result);
      }
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  }
}

// ──────────── API 路由 ────────────

// ── 1. GET /api/myip — 返回访问者 IP ──
app.get('/api/myip', limiter, (req, res) => {
  const clientIP = getClientIP(req);
  respond(req, res,
    // JSON
    () => ({ success: true, ip: clientIP }),
    // TXT
    () => clientIP
  );
});

app.get('/api/myip.txt', limiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(getClientIP(req));
});

// ── 2. GET /api/location?q={ip} — 输入 IP 查地理位置 ──
app.get('/api/location', limiter, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: false, error: '请输入IP地址，示例: /api/location?q=8.8.8.8' });
  }
  if (!net.isIP(q)) {
    return res.json({ success: false, error: '请输入有效的IP地址，示例: /api/location?q=8.8.8.8' });
  }

  respond(req, res,
    // JSON
    () => {
      const r = ipdb.query(q);
      return r;
    },
    // TXT
    () => {
      const r = ipdb.query(q);
      if (!r.success) return `错误: ${r.error}`;
      return ipdb.formatLocationText(r);
    }
  );
});

app.get('/api/location.txt', limiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const q = (req.query.q || '').trim();
  if (!q || !net.isIP(q)) {
    return res.status(400).send('error: 请输入有效的IP地址，示例: /api/location.txt?q=8.8.8.8');
  }
  const r = ipdb.query(q);
  if (!r.success) return res.status(404).send(`error: ${r.error}`);
  res.send(ipdb.formatLocationTextSimple(r));
});

// ── 3. GET /api/mylocation — 获取访问者地理位置 ──
// 返回服务端看到的请求来源 IP 及其地理位置
// 注意：通过 Tailscale/代理访问时，看到的是隧道入口 IP 而非客户端公网 IP
app.get('/api/mylocation', limiter, (req, res) => {
  const clientIP = getClientIP(req);
  respond(req, res,
    // JSON
    () => {
      return ipdb.query(clientIP);
    },
    // TXT
    () => {
      const r = ipdb.query(clientIP);
      if (!r.success) return `错误: ${r.error}`;
      return `你的访问来源 IP: ${clientIP}\n${ipdb.formatLocationText(r)}`;
    }
  );
});

app.get('/api/mylocation.txt', limiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const clientIP = getClientIP(req);
  const r = ipdb.query(clientIP);
  if (!r.success) return res.status(404).send(`error: ${r.error}`);
  res.send(ipdb.formatLocationTextSimple(r));
});

// ── 4. GET /api/resolve4?q={domain} — 域名解析 IPv4 ──
app.get('/api/resolve4', dnsLimiter, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: false, error: '请输入域名，示例: /api/resolve4?q=example.com' });
  }

  respond(req, res,
    // JSON
    () => ipdb.resolveIPv4(q).then(addrs => {
      if (!addrs || addrs.length === 0) {
        return { success: false, error: '该域名无 IPv4 记录', domain: q };
      }
      return {
        success: true,
        domain: q,
        type: 'IPv4',
        count: addrs.length,
        ips: addrs
      };
    }).catch(err => ({
      success: false,
      error: `解析失败: ${err.message}`,
      domain: q
    })),
    // TXT
    () => ipdb.resolveIPv4(q).then(addrs => {
      if (!addrs || addrs.length === 0) {
        throw new Error('该域名无 IPv4 记录');
      }
      return addrs[0];
    })
  );
});

app.get('/api/resolve4.txt', dnsLimiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const q = (req.query.q || '').trim();
  if (!q)     return res.status(400).send('error: 请输入域名，示例: /api/resolve4.txt?q=example.com');
  ipdb.resolveIPv4(q)
    .then(addrs => {
      if (!addrs || addrs.length === 0) return res.status(404).send('error: 该域名无 IPv4 记录');
      res.send(addrs[0]);
    })
    .catch(err => res.status(404).send(`error: ${err.message}`));
});

// ── 5. GET /api/resolve6?q={domain} — 域名解析 IPv6 ──
app.get('/api/resolve6', dnsLimiter, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: false, error: '请输入域名，示例: /api/resolve6?q=example.com' });
  }

  respond(req, res,
    // JSON
    () => ipdb.resolveIPv6(q).then(addrs => {
      if (!addrs || addrs.length === 0) {
        return { success: false, error: '该域名无 IPv6 记录', domain: q };
      }
      return {
        success: true,
        domain: q,
        type: 'IPv6',
        count: addrs.length,
        ips: addrs
      };
    }).catch(err => ({
      success: false,
      error: `解析失败: ${err.message}`,
      domain: q
    })),
    // TXT
    () => ipdb.resolveIPv6(q).then(addrs => {
      if (!addrs || addrs.length === 0) {
        throw new Error('该域名无 IPv6 记录');
      }
      return addrs[0];
    })
  );
});

app.get('/api/resolve6.txt', dnsLimiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).send('error: 请输入域名，示例: /api/resolve6.txt?q=example.com');
  ipdb.resolveIPv6(q)
    .then(addrs => {
      if (!addrs || addrs.length === 0) return res.status(404).send('error: 该域名无 IPv6 记录');
      res.send(addrs[0]);
    })
    .catch(err => res.status(404).send(`error: ${err.message}`));
});

// ── 6. GET /api/query?q={ip或域名} — 综合查询（保留原有接口） ──
app.get('/api/query', dnsLimiter, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: false, error: '请输入IP地址或域名，示例: /api/query?q=8.8.8.8' });
  }

  respond(req, res,
    // JSON
    () => ipdb.queryWithResolve(q).then(data => data),
    // TXT
    () => ipdb.queryWithResolve(q).then(data => {
      if (!data || !data.success) {
        return data && data.error ? `错误: ${data.error}` : '查询失败';
      }
      return ipdb.formatLocationText(data);
    })
  );
});

app.get('/api/query.txt', dnsLimiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).send('error: 请输入IP地址或域名，示例: /api/query.txt?q=8.8.8.8');
  
  ipdb.queryWithResolve(q).then(data => {
    if (!data || !data.success) {
      return res.status(404).send(`error: ${data && data.error ? data.error : '查询失败'}`);
    }
    res.send(ipdb.formatLocationText(data));
  }).catch(err => {
    res.status(500).send(`error: ${err.message}`);
  });
});

// ── 7. GET /api/info — 数据库信息 ──
app.get('/api/info', limiter, (req, res) => {
  respond(req, res,
    // JSON
    () => ipdb.getInfo(),
    // TXT
    () => {
      const info = ipdb.getInfo();
      if (!info.success) return `错误: ${info.error}`;
      return `IP 数据库信息
版本: ${info.version || '未知'}
描述: ${info.description || '纯真IP库'}
数据库路径: ${info.dbPath || '未知'}`;
    }
  );
});

// ── 8. POST /api/batch — 批量 IP 查询 ──
app.post('/api/batch', limiter, (req, res) => {
  const { ips } = req.body || {};
  if (!ips || !Array.isArray(ips) || ips.length === 0) {
    return res.json({ success: false, error: '请提交 IP 地址数组，示例: {"ips":["8.8.8.8","1.1.1.1"]}' });
  }
  if (ips.length > 50) {
    return res.json({ success: false, error: '单次最多查询 50 个 IP' });
  }
  const results = ips.map(ip => {
    const trimmed = (ip || '').trim();
    if (!trimmed || !net.isIP(trimmed)) {
      return { input: trimmed, success: false, error: '无效的 IP 地址' };
    }
    const r = ipdb.query(trimmed);
    return { input: trimmed, ...r };
  });
  res.json({ success: true, count: results.length, results });
});

// ── 9. GET /api/status — 数据库状态 ──
app.get('/api/status', limiter, (req, res) => {
  respond(req, res,
    // JSON
    () => {
      const databases = updater.getDatabaseStatus();
      return { success: true, databases };
    },
    // TXT
    () => {
      const databases = updater.getDatabaseStatus();
      let output = 'IP 数据库状态:\n\n';
      databases.forEach(db => {
        if (db.exists) {
          const sizeMB = (db.size / 1024 / 1024).toFixed(2);
          const date = db.mtime ? new Date(db.mtime).toISOString().slice(0, 10) : '未知';
          output += `✅ ${db.name} (${db.description})\n`;
          output += `   文件: ${db.file}\n`;
          output += `   大小: ${sizeMB} MB\n`;
          output += `   更新: ${date}\n\n`;
        } else {
          output += `❌ ${db.name} (${db.description})\n`;
          output += `   文件: ${db.file}\n`;
          output += `   状态: 未下载\n\n`;
        }
      });
      return output.trim();
    }
  );
});

// ── 兼容旧版路径 .txt 后缀的直接访问 ──
app.get('/api/info.txt', limiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const info = ipdb.getInfo();
  if (!info.success) return res.status(500).send(`error: ${info.error}`);
  res.send(`IP 数据库信息
版本: ${info.version || '未知'}
描述: ${info.description || '纯真IP库'}
数据库路径: ${info.dbPath || '未知'}`);
});

app.get('/api/status.txt', limiter, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const databases = updater.getDatabaseStatus();
  let output = 'IP 数据库状态:\n\n';
  databases.forEach(db => {
    if (db.exists) {
      const sizeMB = (db.size / 1024 / 1024).toFixed(2);
      const date = db.mtime ? new Date(db.mtime).toISOString().slice(0, 10) : '未知';
      output += `✅ ${db.name} (${db.description})\n`;
      output += `   文件: ${db.file}\n`;
      output += `   大小: ${sizeMB} MB\n`;
      output += `   更新: ${date}\n\n`;
    } else {
      output += `❌ ${db.name} (${db.description})\n`;
      output += `   文件: ${db.file}\n`;
      output += `   状态: 未下载\n\n`;
    }
  });
  res.send(output.trim());
});

// ── 10. GET /api/stats?range=daily|weekly|monthly|yearly — 网站统计 ──
app.get('/api/stats', limiter, (req, res) => {
  const range = (req.query.range || 'daily').toLowerCase();
  const daysMap = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
  const days = daysMap[range] || 1;

  const data = stats.getStats(days);
  res.json({
    success: true,
    range,
    days,
    ...data
  });
});

// ── 11. GET /api/recommend/ip-api?q={ip} — ip-api.com 代理 ──
// 查自身 IP：无参数时用 getClientIP 获取用户真实 IP 再转发（响应中 query 为用户 IP）
// 查指定 IP：直接转发 q 参数，响应中 query 为用户提供的 IP
// 两种方式均不暴露服务器公网 IP
// 使用 keepAlive Agent 复用连接 + 1 次超时重试

const ipApiAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });

function doIpApiRequest(targetIP, res) {
  return new Promise((resolve, reject) => {
    const apiUrl = `http://ip-api.com/json/${encodeURIComponent(targetIP)}?lang=zh-CN`;
    const proxyReq = http.get(apiUrl, { timeout: 8000, agent: ipApiAgent }, (proxyRes) => {
      proxyRes.setTimeout(8000);
      let body = '';
      proxyRes.on('data', chunk => { body += chunk; });
      proxyRes.on('end', () => {
        if (proxyRes.headers['x-rl']) res.setHeader('X-Rl', proxyRes.headers['x-rl']);
        if (proxyRes.headers['x-ttl']) res.setHeader('X-Ttl', proxyRes.headers['x-ttl']);
        if (proxyRes.statusCode !== 200) {
          if (proxyRes.statusCode === 429) {
            return reject({ status: 429, msg: 'ip-api.com 请求频率过高，请稍后再试' });
          }
          return reject({ status: 502, msg: `ip-api.com 返回 HTTP ${proxyRes.statusCode}` });
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject({ status: 502, msg: 'ip-api.com 响应解析失败' }); }
      });
      proxyRes.on('timeout', () => { proxyRes.destroy(); reject({ status: 504, msg: 'ip-api.com 请求超时' }); });
      proxyRes.on('error', (e) => reject({ status: 502, msg: `ip-api.com 请求失败: ${e.message}` }));
    });
    proxyReq.on('timeout', () => { proxyReq.destroy(); reject({ status: 504, msg: 'ip-api.com 请求超时' }); });
    proxyReq.on('error', (e) => reject({ status: 502, msg: `ip-api.com 请求失败: ${e.message}` }));
  });
}

app.get('/api/recommend/ip-api', limiter, (req, res) => {
  const q = (req.query.q || '').trim();
  const targetIP = q || getClientIP(req);
  if (!net.isIP(targetIP)) {
    return res.status(400).json({ success: false, error: '无法获取有效的 IP 地址' });
  }

  // 首次尝试
  doIpApiRequest(targetIP, res).then(data => res.json(data)).catch(async (err) => {
    // 超时或网络错误则重试 1 次
    if (err.status === 504 || (err.status === 502 && err.msg.includes('请求失败'))) {
      try {
        const data = await doIpApiRequest(targetIP, res);
        return res.json(data);
      } catch (e2) {
        return res.status(e2.status || 502).json({ success: false, error: e2.msg });
      }
    }
    return res.status(err.status || 502).json({ success: false, error: err.msg });
  });
});

// ── 健康检查 ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── 404 兜底 ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.json({ success: false, error: `未知接口: ${req.method} ${req.path}` });
  } else {
    res.status(404).type('text/plain').send('Not Found');
  }
});

// ──────────── 全局错误处理 ────────────
app.use((err, req, res, next) => {
  console.error(`[错误] ${req.method} ${req.originalUrl}:`, err.message);
  // 生产环境过滤敏感路径信息
  const safeMessage = (err.message || '').replace(/\/root\/[^\s,)]+/g, '(路径已隐藏)');
  if (req.path.startsWith('/api/')) {
    res.json({ success: false, error: `服务器内部错误: ${safeMessage}` });
  } else {
    res.status(500).type('text/plain').send('Internal Server Error');
  }
});

// ──────────── 启动服务器 ────────────

// 创建 HTTP 服务器
const httpServer = http.createServer(app);

// 如果配置了 SSL 证书，同时创建 HTTPS 服务器
let httpsServer = null;
if (config.ssl && config.ssl.key && config.ssl.cert) {
  try {
    const sslOptions = {
      key: fs.readFileSync(config.ssl.key),
      cert: fs.readFileSync(config.ssl.cert),
    };
    httpsServer = https.createServer(sslOptions, app);
    httpsServer.listen(443, HOST, () => {
      console.log(`  HTTPS:     https://${HOST === '::' ? '0.0.0.0' : HOST}:443`);
    });
    console.log('  已启用 HTTPS (SSL 证书已加载)');
  } catch (e) {
    console.error(`  ⚠ HTTPS 启动失败: ${e.message}`);
  }
}

httpServer.listen(PORT, HOST, () => {
  console.log('==================================================');
  console.log('  纯真IP库在线查询系统 v2.2.6 (模块化架构)');
  console.log('==================================================');
  console.log(`  服务地址:  http://${HOST}:${PORT}`);
  console.log(`  本地访问:  http://127.0.0.1:${PORT}`);
  console.log(`  IPv6访问:  http://[::1]:${PORT}`);
  console.log(`  远程访问:  http://<本机IP>:${PORT}`);
  console.log('--------------------------------------------------');
  console.log('  API 接口:');
  console.log('    GET /api/myip         - 获取本机公网IP');
  console.log('    GET /api/location?q=  - IP地址查地理位置');
  console.log('    GET /api/mylocation   - 获取本机地理位置');
  console.log('    GET /api/resolve4?q=  - 域名解析 IPv4');
  console.log('    GET /api/resolve6?q=  - 域名解析 IPv6');
  console.log('    GET /api/query?q=     - 综合查询(IP或域名)');
  console.log('    GET /api/info         - 数据库信息');
  console.log('    GET /api/status       - 数据库状态');
  console.log('    GET /api/recommend/ip-api - ip-api.com 代理(不暴露服务器IP)');
  console.log('  所有接口支持 JSON / .txt 纯文本双格式');
  console.log('==================================================');
  
  // ─── 启动内置定时更新 ───
  try {
    updater.scheduleWeeklyUpdate((results) => {
      // 更新成功后自动重新加载数据库
      try {
        ipdb.reloadDatabase();
        console.log('[服务器] 数据库已重新加载（更新后）');
      } catch (e) {
        console.error('[服务器] 重新加载数据库失败:', e.message);
      }
    });
  } catch (e) {
    console.error('[服务器] 设置定时更新失败:', e.message);
  }
});

module.exports = app;
