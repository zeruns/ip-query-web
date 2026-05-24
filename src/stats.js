/**
 * 网站统计模块
 *
 * 记录页面访问量与 API 调用次数，按日期聚合。
 * 数据存储在内存中，每隔 10 秒自动落盘到 data/stats.json。
 */

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');

// ── 加载已有统计 ──
let stats = {};
try {
  if (fs.existsSync(STATS_FILE)) {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    if (raw.trim()) {
      stats = JSON.parse(raw);
    }
  }
  console.log('[统计] 已加载历史数据，共', Object.keys(stats).length, '天记录');
} catch (e) {
  console.error('[统计] 加载历史数据失败:', e.message);
}

// ── 工具函数 ──

function getDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function ensureDate(key) {
  if (!stats[key]) {
    stats[key] = { pageviews: 0, api: {}, total_api: 0 };
  }
}

// ── 异步防抖保存 ──

let saveTimer = null;
let dirty = false;

function markDirty() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(flush, 10000);
}

function flush() {
  saveTimer = null;
  if (!dirty) return;
  dirty = false;
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats), 'utf8');
  } catch (e) {
    console.error('[统计] 写入文件失败:', e.message);
    // 标记回 dirty，下次重试
    dirty = true;
  }
}

// 进程退出时保存
process.on('exit', () => { if (dirty) flush(); });
process.on('SIGINT', () => { flush(); process.exit(); });
process.on('SIGTERM', () => { flush(); process.exit(); });

// ── 记录函数（纯内存操作，极快） ──

function recordPageview() {
  const key = getDateKey();
  ensureDate(key);
  stats[key].pageviews++;
  markDirty();
}

function recordApiCall(name) {
  const key = getDateKey();
  ensureDate(key);
  const api = name || 'other';
  stats[key].api[api] = (stats[key].api[api] || 0) + 1;
  stats[key].total_api = (stats[key].total_api || 0) + 1;
  markDirty();
}

// ── 查询 ──

/**
 * @param {number} days - 统计天数
 * @returns {{ total_pv: number, total_api: number, api_breakdown: object, daily: array }}
 */
function getStats(days) {
  const result = { total_pv: 0, total_api: 0, api_breakdown: {}, daily: [] };
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const entry = stats[key] || { pageviews: 0, api: {}, total_api: 0 };

    result.total_pv += entry.pageviews || 0;
    result.total_api += entry.total_api || 0;

    const apiEntry = {};
    if (entry.api) {
      for (const [k, v] of Object.entries(entry.api)) {
        apiEntry[k] = v;
        result.api_breakdown[k] = (result.api_breakdown[k] || 0) + v;
      }
    }

    result.daily.push({
      date: key,
      pageviews: entry.pageviews || 0,
      api_calls: entry.total_api || 0,
      api: apiEntry
    });
  }

  return result;
}

// ── Express 中间件（同步记录到内存，不阻塞请求） ──

function trackingMiddleware(req, res, next) {
  try {
    if (req.path.startsWith('/api/')) {
      // 不统计统计接口自身
      if (req.path !== '/api/stats') {
        const apiName = req.path.split('/')[2] || 'other';
        recordApiCall(apiName);
      }
    } else if (req.method === 'GET' && !/\.(js|css|png|ico|jpg|jpeg|svg|woff|woff2|ttf|map|gif|webp)(\?|$)/i.test(req.path)) {
      // 排除组件片段加载
      if (!req.path.startsWith('/components/')) {
        recordPageview();
      }
    }
  } catch (e) {
    // 统计失败不影响请求
  }
  next();
}

module.exports = { getStats, trackingMiddleware };
