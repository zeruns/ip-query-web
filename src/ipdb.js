/**
 * IPDB 查询封装模块
 * 
 * 封装 IP 地理位置数据库的查询操作，
 * 支持 IPv4、IPv6、域名解析（指定公共 DNS 获取全球节点）、多 IP 批量查询。
 */

const IPDB = require('ipdb');
const dns = require('dns');
const net = require('net');
const path = require('path');
const fs = require('fs');

// 数据库路径
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'qqwry.ipdb');
const NPM_DB_PATH = require.resolve('qqwry.ipdb');

// 使用公共 DNS 服务器获取全球节点，避免本地 DNS 只返回就近节点
// 支持配置多个 DNS，按顺序尝试
const PUBLIC_DNS_SERVERS = process.env.PUBLIC_DNS
  ? process.env.PUBLIC_DNS.split(',').map(s => s.trim())
  : ['8.8.8.8', '8.8.4.4'];  // 默认 Google DNS

// 中国大陆备用 DNS
const CN_DNS_SERVERS = ['114.114.114.114', '223.5.5.5'];

// 数据库实例（懒加载）
let _db = null;
let _dbPath = null;

/**
 * 初始化/获取数据库实例
 */
function getDatabase() {
  const localPath = DB_FILE;
  const npmPath = path.join(path.dirname(NPM_DB_PATH), 'qqwry.ipdb');
  let targetPath = null;
  if (fs.existsSync(localPath)) targetPath = localPath;
  else if (fs.existsSync(npmPath)) targetPath = npmPath;

  if (_db && _dbPath === targetPath) return _db;
  if (!targetPath) throw new Error('IP 数据库文件未找到。请运行 npm install qqwry.ipdb');

  try {
    _db = new IPDB(targetPath);
    _dbPath = targetPath;
    return _db;
  } catch (e) {
    throw new Error(`加载 IP 数据库失败 (${targetPath}): ${e.message}`);
  }
}

/**
 * 强制重新加载数据库（更新后调用）
 */
function reloadDatabase() {
  _db = null;
  _dbPath = null;
  return getDatabase();
}

/**
 * 判断是否为有效域名
 */
function isDomain(str) {
  if (!str || net.isIP(str)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(str);
}

/**
 * 查询单个 IP 地址的地理位置
 */
function query(ip) {
  try {
    const db = getDatabase();
    const result = db.find(ip);
    if (result.code === 0 && result.data) {
      const d = result.data;
      let country = d.country_name || '';
      let region = d.region_name || '';
      let city = d.city_name || '';

      // 纯真库有时把省市区全塞在 country 字段（如 "中国–江苏–南京"）
      if (country && /[–-]/.test(country)) {
        const parts = country.split(/[–-]/).map(s => s.trim());
        country = parts[0];                           // "中国"
        if (!region && parts.length >= 2) region = parts[1];   // "江苏"
        if (!city && parts.length >= 3) city = parts[2];       // "南京"
      }

      return {
        success: true,
        ip,
        type: net.isIPv6(ip) ? 'IPv6' : 'IPv4',
        country,
        region,
        city,
        district: d.district_name || '',
        isp: d.isp_domain || '',
        owner: d.owner_domain || '',
        bitmask: d.bitmask || 32,
        country_code: d.country_code || '',
        continent_code: d.continent_code || ''
      };
    }
    return { success: false, error: '未找到该IP对应的地理位置信息', ip };
  } catch (e) {
    return { success: false, error: `查询出错: ${e.message}`, ip };
  }
}

/**
 * 使用指定 DNS 服务器解析域名，获取全球所有节点
 * 按顺序尝试各 DNS 服务器，全部失败时使用系统 DNS
 */
function resolveWithPublicDNS(domain, recordType) {
  return new Promise((resolve, reject) => {
    // 先用系统 DNS 获取（本地区域节点）
    dns.resolve(domain, recordType, (err, addrs) => {
      if (err) {
        // 系统 DNS 失败，按顺序尝试配置的 DNS
        return tryResolveWithServers(domain, recordType, PUBLIC_DNS_SERVERS, 0)
          .then(resolve)
          .catch(() => {
            // 配置的 DNS 也失败，尝试中国大陆 DNS 兜底
            tryResolveWithServers(domain, recordType, CN_DNS_SERVERS, 0)
              .then(resolve)
              .catch(() => reject(new Error(`域名解析失败: ${domain}`)));
          });
      }

      // 系统 DNS 成功，再用公共 DNS 补充获取全球节点
      tryResolveWithServers(domain, recordType, PUBLIC_DNS_SERVERS, 0)
        .then(remoteAddrs => {
          // 合并去重
          const all = [...new Set([...addrs, ...remoteAddrs])];
          resolve(all);
        })
        .catch(() => {
          // 公共 DNS 失败则用系统结果
          resolve(addrs);
        });
    });
  });
}

/**
 * 按顺序使用一组 DNS 服务器尝试解析
 */
function tryResolveWithServers(domain, recordType, servers, index) {
  return new Promise((resolve, reject) => {
    if (index >= servers.length) return reject(new Error('所有DNS服务器均失败'));
    
    const resolver = new dns.Resolver();
    resolver.setServers([servers[index]]);
    
    resolver.resolve(domain, recordType, (err, addrs) => {
      if (err || !addrs || addrs.length === 0) {
        tryResolveWithServers(domain, recordType, servers, index + 1)
          .then(resolve)
          .catch(reject);
      } else {
        resolve(addrs);
      }
    });
  });
}

// DNS 缓存（内存缓存，TTL = 300 秒）
const dnsCache = new Map();
const DNS_CACHE_TTL = 300 * 1000; // 5 分钟

function getCachedDNS(domain, recordType) {
  const key = `${domain}:${recordType}`;
  const entry = dnsCache.get(key);
  if (entry && Date.now() - entry.time < DNS_CACHE_TTL) {
    return entry.addrs;
  }
  return null;
}

function setCachedDNS(domain, recordType, addrs) {
  const key = `${domain}:${recordType}`;
  dnsCache.set(key, { addrs, time: Date.now() });
  // 限制缓存大小，防止内存泄露
  if (dnsCache.size > 200) {
    const oldestKey = dnsCache.keys().next().value;
    dnsCache.delete(oldestKey);
  }
}

/**
 * 解析域名的 A (IPv4) 记录 — 使用公共 DNS 获取全球节点
 */
function resolveIPv4(domain) {
  const cached = getCachedDNS(domain, 'A');
  if (cached) return Promise.resolve(cached);
  return resolveWithPublicDNS(domain, 'A').then(addrs => {
    setCachedDNS(domain, 'A', addrs);
    return addrs;
  });
}

/**
 * 解析域名的 AAAA (IPv6) 记录 — 使用公共 DNS 获取全球节点
 */
function resolveIPv6(domain) {
  const cached = getCachedDNS(domain, 'AAAA');
  if (cached) return Promise.resolve(cached);
  return resolveWithPublicDNS(domain, 'AAAA').then(addrs => {
    setCachedDNS(domain, 'AAAA', addrs);
    return addrs;
  });
}

/**
 * 同时解析 IPv4 和 IPv6
 */
function resolveAll(domain) {
  return Promise.all([
    resolveIPv4(domain).then(addrs => ({ type: 'IPv4', addrs })).catch(() => ({ type: 'IPv4', addrs: [] })),
    resolveIPv6(domain).then(addrs => ({ type: 'IPv6', addrs })).catch(() => ({ type: 'IPv6', addrs: [] }))
  ]);
}

/**
 * 综合查询：输入 IP 或域名，返回完整结果
 * 如果是域名，自动解析所有 A + AAAA 记录并查询每个 IP
 * 返回字段包含 primary_v4 和 primary_v6 供前端默认展示一个v4+一个v6
 */
async function queryWithResolve(input) {
  if (net.isIP(input)) {
    return query(input);
  }

  if (isDomain(input)) {
    const records = await resolveAll(input);
    const v4Addrs = records.find(r => r.type === 'IPv4').addrs || [];
    const v6Addrs = records.find(r => r.type === 'IPv6').addrs || [];
    const allAddrs = [...v4Addrs, ...v6Addrs];

    if (allAddrs.length === 0) {
      return { success: false, error: '域名解析失败，无 DNS 记录', input };
    }

    // 查询每个 IP
    const allResults = allAddrs.map(ip => {
      const q = query(ip);
      return { ...q, ip };
    });

    // 按类型分组
    const v4Results = allResults.filter(r => r.type === 'IPv4');
    const v6Results = allResults.filter(r => r.type === 'IPv6');

    // 取第一个有数据的作为主显示
    const primary = allResults.find(r => r.success) || allResults[0];
    const hasV4 = v4Results.length > 0;
    const hasV6 = v6Results.length > 0;
    const addrType = hasV4 && hasV6 ? 'IPv4 + IPv6' : (hasV6 ? 'IPv6' : 'IPv4');

    // 默认展示的 IP：v4选第一个，v6选第一个
    const primaryV4 = v4Results.length > 0 ? v4Results[0] : null;
    const primaryV6 = v6Results.length > 0 ? v6Results[0] : null;

    return {
      success: true,
      input,
      ip: primary.ip,
      type: addrType,
      count: allAddrs.length,
      ipv4_count: v4Addrs.length,
      ipv6_count: v6Addrs.length,
      // 默认展示的 v4 和 v6（前端用这两个作为主卡片展示）
      primary_v4: primaryV4 ? {
        ip: primaryV4.ip,
        country: primaryV4.country,
        region: primaryV4.region,
        city: primaryV4.city,
        district: primaryV4.district,
        isp: primaryV4.isp,
        owner: primaryV4.owner,
        location: [primaryV4.country, primaryV4.region, primaryV4.city, primaryV4.district].filter(Boolean).join('·') || '未知',
        country_code: primaryV4.country_code,
        bitmask: primaryV4.bitmask
      } : null,
      primary_v6: primaryV6 ? {
        ip: primaryV6.ip,
        country: primaryV6.country,
        region: primaryV6.region,
        city: primaryV6.city,
        district: primaryV6.district,
        isp: primaryV6.isp,
        owner: primaryV6.owner,
        location: [primaryV6.country, primaryV6.region, primaryV6.city, primaryV6.district].filter(Boolean).join('·') || '未知',
        country_code: primaryV6.country_code,
        bitmask: primaryV6.bitmask
      } : null,
      // 完整结果列表（全部，供手动点击展开）
      results: allResults.map(r => ({
        ip: r.ip,
        type: r.type,
        location: [r.country, r.region, r.city, r.district].filter(Boolean).join('·') || '未知',
        country: r.country,
        region: r.region,
        city: r.city,
        district: r.district,
        isp: r.isp,
        owner: r.owner,
        bitmask: r.bitmask,
        country_code: r.country_code,
        success: r.success
      })),
      // 主显示字段（向后兼容）
      country: primary.country || '',
      region: primary.region || '',
      city: primary.city || '',
      district: primary.district || '',
      isp: primary.isp || '',
      owner: primary.owner || '',
      bitmask: primary.bitmask || 32,
      country_code: primary.country_code || '',
      continent_code: primary.continent_code || ''
    };
  }

  return { success: false, error: '输入格式不正确，请输入 IP 地址或域名', input };
}

/**
 * 将地理位置对象格式化为纯文本行（含 IP）
 */
function formatLocationText(data) {
  if (!data || !data.success) {
    return data && data.error ? `错误: ${data.error}` : '未知';
  }
  const parts = [data.country, data.region, data.city, data.district].filter(Boolean);
  const loc = parts.length > 0 ? parts.join(' ') : '未知位置';
  const isp = data.isp || '';
  return `${data.ip} ${loc}${isp ? ` [${isp}]` : ''}`;
}

/**
 * 将地理位置对象格式化为纯文本行（仅位置信息，不含 IP）
 * 用于 .txt API 接口返回简洁的位置信息
 */
function formatLocationTextSimple(data) {
  if (!data || !data.success) {
    return data && data.error ? `错误: ${data.error}` : '未知';
  }
  const parts = [data.country, data.region, data.city, data.district].filter(Boolean);
  const loc = parts.length > 0 ? parts.join(' ') : '未知位置';
  const isp = data.isp || '';
  return `${loc}${isp ? ` [${isp}]` : ''}`;
}

/**
 * 获取数据库信息
 */
function getInfo() {
  try {
    getDatabase();
    let version = '未知';
    try {
      const pkg = require('qqwry.ipdb/package.json');
      version = pkg.version;
    } catch (e) { /* ignore */ }
    return {
      success: true,
      version,
      description: '纯真IP库 - qqwry.ipdb (支持IPv4 + IPv6)',
      dbPath: '/data/qqwry.ipdb'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  query,
  queryWithResolve,
  resolveIPv4,
  resolveIPv6,
  resolveAll,
  isDomain,
  getDatabase,
  reloadDatabase,
  formatLocationText,
  formatLocationTextSimple,
  getInfo
};
