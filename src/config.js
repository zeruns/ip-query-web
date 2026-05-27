/**
 * IP Query Web — 统一配置模块
 *
 * 从环境变量读取配置，优先 .env 文件（由 start.sh 加载），
 * 所有值均有合理默认值，开箱即用。
 */
'use strict';

const path = require('path');

// ─── 基本配置 ───
const config = {
  // 服务端口
  port: parseInt(process.env.PORT, 10) || 6688,

  // 监听地址（:: = 双栈, 0.0.0.0 = IPv4 only, 127.0.0.1 = 本地仅限）
  host: process.env.HOST || '::',

  // ─── 限流配置 ───
  rateLimit: {
    // 普通 API 查询：次/分钟/IP
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 120,
    // 域名解析接口：次/分钟/IP
    dns: parseInt(process.env.RATE_LIMIT_DNS, 10) || 30,
    // 页面/静态资源：次/分钟/IP
    page: parseInt(process.env.RATE_LIMIT_PAGE, 10) || 120,
  },

  // ─── CC 防护配置（纯 Node 实现，不依赖系统防火墙） ───
  cc: {
    // 单 IP 最大并发连接数
    maxConcurrent: parseInt(process.env.CC_MAX_CONCURRENT, 10) || 20,
    // 突发检测窗口（毫秒）
    burstWindow: parseInt(process.env.CC_BURST_WINDOW, 10) || 2000,
    // 窗口内最大新建连接数
    burstMax: parseInt(process.env.CC_BURST_MAX, 10) || 40,
    // 慢速攻击超时（毫秒），DNS 解析最长可达 20s，需留余量
    slowTimeout: parseInt(process.env.CC_SLOW_TIMEOUT, 10) || 30000,
    // 封禁时长（毫秒）
    blockDuration: parseInt(process.env.CC_BLOCK_DURATION, 10) || 60000,
    // IP 白名单（逗号分隔，永远放行）
    whitelist: (process.env.CC_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean),
    // IP 黑名单（逗号分隔，永远拦截）
    blacklist: (process.env.CC_BLACKLIST || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // ─── DNS 配置 ───
  dnsServers: (process.env.PUBLIC_DNS || '8.8.8.8,8.8.4.4')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // ─── HTTPS 配置（Nginx 反代模式下无需配置） ───
  ssl: {
    key: process.env.SSL_KEY || null,
    cert: process.env.SSL_CERT || null,
  },

  // ─── 数据目录 ───
  dataDir: path.resolve(process.env.DATA_DIR || './data'),

  // ─── 日志级别 ───
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  // ─── GitHub 镜像（用于下载 IP 数据库） ───
  githubMirror: (process.env.GITHUB_MIRROR || '').replace(/\/+$/, ''),

  // ─── 应用信息 ───
  app: {
    name: 'IP 归属地查询系统',
    version: '2.2.6',
    description: '纯真IP库在线查询 - 支持IPv4/IPv6/域名解析',
  },
};

module.exports = config;
