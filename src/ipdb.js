/**
 * IPDB 查询封装模块
 * 
 * 双数据库架构：
 * - IPv4 查询使用 qqwry.dat（lib-qqwry 解析，数据更详细）
 * - IPv6 查询使用 qqwry.ipdb（ipdb 库解析，支持 IPv6）
 * 
 * 支持单IP查询、域名解析（指定公共 DNS 获取全球节点）、多 IP 批量查询。
 */

const QQWry = require('lib-qqwry');
const IPDB = require('ipdb');
const dns = require('dns');
const net = require('net');
const path = require('path');
const fs = require('fs');

// 数据库路径
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE_DAT = path.join(DATA_DIR, 'qqwry.dat');     // IPv4 数据库
const DB_FILE_IPDB = path.join(DATA_DIR, 'qqwry.ipdb');    // IPv6 数据库
const NPM_DB_PATH = require.resolve('qqwry.ipdb');

// 使用公共 DNS 服务器获取全球节点
const PUBLIC_DNS_SERVERS = process.env.PUBLIC_DNS
  ? process.env.PUBLIC_DNS.split(',').map(s => s.trim())
  : ['8.8.8.8', '8.8.4.4'];
const CN_DNS_SERVERS = ['114.114.114.114', '223.5.5.5'];

// ─── 数据库实例（懒加载） ───

let _qqwry = null;     // qqwry.dat reader (IPv4)
let _qqwryPath = null;
let _ipdb = null;       // qqwry.ipdb reader (IPv6)
let _ipdbPath = null;

function getQqwry() {
  if (_qqwry && _qqwryPath === DB_FILE_DAT) return _qqwry;
  if (!fs.existsSync(DB_FILE_DAT)) {
    throw new Error('IPv4 数据库文件未找到: data/qqwry.dat，请运行 npm install qqwry.ipdb 或等待自动更新');
  }
  try {
    _qqwry = new QQWry({ dataPath: DB_FILE_DAT });
    _qqwryPath = DB_FILE_DAT;
    return _qqwry;
  } catch (e) {
    throw new Error(`加载 IPv4 数据库失败 (${DB_FILE_DAT}): ${e.message}`);
  }
}

function getIpdb() {
  if (_ipdb && _ipdbPath) return _ipdb;

  const localPath = DB_FILE_IPDB;
  const npmPath = path.join(path.dirname(NPM_DB_PATH), 'qqwry.ipdb');
  let targetPath = null;
  if (fs.existsSync(localPath)) targetPath = localPath;
  else if (fs.existsSync(npmPath)) targetPath = npmPath;
  if (!targetPath) throw new Error('IPv6 数据库文件未找到。请运行 npm install qqwry.ipdb');

  try {
    _ipdb = new IPDB(targetPath);
    _ipdbPath = targetPath;
    return _ipdb;
  } catch (e) {
    throw new Error(`加载 IPv6 数据库失败 (${targetPath}): ${e.message}`);
  }
}

function reloadDatabase() {
  _qqwry = null; _qqwryPath = null;
  _ipdb = null; _ipdbPath = null;
  clearQueryCache();
}

// ─── .dat 结果解析 ───

/**
 * 解析 qqwry.dat 的 Country 字段为 country/region/city
 *
 * .dat 格式：Country="广东省深圳市" / "美国加利福尼亚州圣克拉拉县山景市"
 *            Area="电信" / "谷歌公司DNS服务器"
 */
function parseQqwryCountry(countryStr) {
  if (!countryStr) return { country: '', region: '', city: '' };

  let country = '', region = '', city = '';

  // 提取国家前缀（如 "中国"、"美国"、"日本"）
  const cMatch = countryStr.match(/^(.+?[国])/);
  if (cMatch) { country = cMatch[1]; countryStr = countryStr.slice(cMatch[1].length); }

  // 提取省/州（如 "江苏省"、"加利福尼亚州"、"广东省"）
  const rMatch = countryStr.match(/^(.+?[省市州自治区])/);
  if (rMatch) { region = rMatch[1]; countryStr = countryStr.slice(rMatch[1].length); }

  // 剩余部分为市/县
  city = countryStr || '';

  // 如果没有提取到国家，但提取到了省份，默认中国
  if (!country && region) country = '中国';

  return { country, region, city };
}

/**
 * 查询 IPv4（使用 qqwry.dat）
 */
function queryIPv4(ip) {
  const db = getQqwry();
  const result = db.searchIP(ip);
  if (!result) return { success: false, error: '未找到该IP对应的地理位置信息', ip };

  const { country, region, city } = parseQqwryCountry(result.Country);
  const isp = result.Area || '';

  return {
    success: true,
    ip,
    type: 'IPv4',
    country,
    region,
    city,
    district: '',
    isp,
    owner: '',
    bitmask: 32,
    country_code: '',
    continent_code: ''
  };
}

/**
 * 查询 IPv6（使用 qqwry.ipdb）
 */
function queryIPv6(ip) {
  const db = getIpdb();
  const result = db.find(ip);
  if (result.code === 0 && result.data) {
    const d = result.data;
    let country = d.country_name || '';
    let region = d.region_name || '';
    let city = d.city_name || '';

    // 纯真库有时把省市区全塞在 country 字段（如 "中国–江苏–南京"）
    if (country && /[–-]/.test(country)) {
      const parts = country.split(/[–-]/).map(s => s.trim());
      country = parts[0];
      if (!region && parts.length >= 2) region = parts[1];
      if (!city && parts.length >= 3) city = parts[2];
    }

    return {
      success: true,
      ip,
      type: 'IPv6',
      country,
      region,
      city,
      district: d.district_name || '',
      isp: d.isp_domain || '',
      owner: d.owner_domain || '',
      bitmask: d.bitmask || 128,
      country_code: d.country_code || '',
      continent_code: d.continent_code || ''
    };
  }
  return { success: false, error: '未找到该IP对应的地理位置信息', ip };
}

/**
 * 查询单个 IP 地址（自动检测 IPv4/IPv6 路由到对应数据库）
 * 内置 LRU 缓存：1000 条，30 分钟 TTL
 */
const queryCache = new Map();
const QUERY_CACHE_MAX = 1000;
const QUERY_CACHE_TTL = 30 * 60 * 1000; // 30 分钟

function query(ip) {
  try {
    // 检查缓存
    const cached = queryCache.get(ip);
    if (cached && Date.now() - cached.time < QUERY_CACHE_TTL) {
      return cached.data;
    }

    let result;
    if (net.isIPv6(ip)) {
      result = queryIPv6(ip);
    } else {
      result = queryIPv4(ip);
    }

    // 仅缓存成功结果
    if (result.success) {
      queryCache.set(ip, { data: result, time: Date.now() });
      // LRU 淘汰：超出上限时删除最早条目
      if (queryCache.size > QUERY_CACHE_MAX) {
        const firstKey = queryCache.keys().next().value;
        queryCache.delete(firstKey);
      }
    }
    return result;
  } catch (e) {
    return { success: false, error: `查询出错: ${e.message}`, ip };
  }
}

// 清除查询缓存（数据库更新后调用）
function clearQueryCache() {
  queryCache.clear();
}

// ─── DNS 解析 ───

function isDomain(str) {
  if (!str || net.isIP(str)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(str);
}

function resolveWithPublicDNS(domain, recordType) {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 5000; // 单次 DNS 查询超时

    dns.resolve(domain, recordType, (err, addrs) => {
      if (err) {
        return tryResolveWithServers(domain, recordType, PUBLIC_DNS_SERVERS, 0, TIMEOUT_MS)
          .then(resolve)
          .catch(() => {
            tryResolveWithServers(domain, recordType, CN_DNS_SERVERS, 0, TIMEOUT_MS)
              .then(resolve)
              .catch(() => reject(new Error(`域名解析失败: ${domain}`)));
          });
      }
      tryResolveWithServers(domain, recordType, PUBLIC_DNS_SERVERS, 0, TIMEOUT_MS)
        .then(remoteAddrs => {
          resolve([...new Set([...addrs, ...remoteAddrs])]);
        })
        .catch(() => resolve(addrs));
    });
  });
}

function tryResolveWithServers(domain, recordType, servers, index, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (index >= servers.length) return reject(new Error('所有DNS服务器均失败'));
    const resolver = new dns.Resolver();
    resolver.setServers([servers[index]]);
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolver.cancel ? resolver.cancel() : null;
        tryResolveWithServers(domain, recordType, servers, index + 1, timeoutMs)
          .then(resolve).catch(reject);
      }
    }, timeoutMs);

    resolver.resolve(domain, recordType, (err, addrs) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err || !addrs || addrs.length === 0) {
        tryResolveWithServers(domain, recordType, servers, index + 1, timeoutMs)
          .then(resolve).catch(reject);
      } else {
        resolve(addrs);
      }
    });
  });
}

const dnsCache = new Map();
const DNS_CACHE_TTL = 300 * 1000;

function getCachedDNS(domain, recordType) {
  const key = `${domain}:${recordType}`;
  const entry = dnsCache.get(key);
  if (entry && Date.now() - entry.time < DNS_CACHE_TTL) return entry.addrs;
  return null;
}

function setCachedDNS(domain, recordType, addrs) {
  const key = `${domain}:${recordType}`;
  dnsCache.set(key, { addrs, time: Date.now() });
  if (dnsCache.size > 200) {
    dnsCache.delete(dnsCache.keys().next().value);
  }
}

function resolveIPv4(domain) {
  const cached = getCachedDNS(domain, 'A');
  if (cached) return Promise.resolve(cached);
  return resolveWithPublicDNS(domain, 'A').then(addrs => {
    setCachedDNS(domain, 'A', addrs);
    return addrs;
  });
}

function resolveIPv6(domain) {
  const cached = getCachedDNS(domain, 'AAAA');
  if (cached) return Promise.resolve(cached);
  return resolveWithPublicDNS(domain, 'AAAA').then(addrs => {
    setCachedDNS(domain, 'AAAA', addrs);
    return addrs;
  });
}

function resolveAll(domain) {
  return Promise.all([
    resolveIPv4(domain).then(addrs => ({ type: 'IPv4', addrs })).catch(() => ({ type: 'IPv4', addrs: [] })),
    resolveIPv6(domain).then(addrs => ({ type: 'IPv6', addrs })).catch(() => ({ type: 'IPv6', addrs: [] }))
  ]);
}

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

    const allResults = allAddrs.map(ip => {
      const q = query(ip);
      return { ...q, ip };
    });

    const v4Results = allResults.filter(r => r.type === 'IPv4');
    const v6Results = allResults.filter(r => r.type === 'IPv6');
    const primary = allResults.find(r => r.success) || allResults[0];
    const hasV4 = v4Results.length > 0;
    const hasV6 = v6Results.length > 0;
    const addrType = hasV4 && hasV6 ? 'IPv4 + IPv6' : (hasV6 ? 'IPv6' : 'IPv4');

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
      primary_v4: primaryV4 ? {
        ip: primaryV4.ip, country: primaryV4.country, region: primaryV4.region,
        city: primaryV4.city, district: primaryV4.district, isp: primaryV4.isp,
        owner: primaryV4.owner,
        location: [primaryV4.country, primaryV4.region, primaryV4.city, primaryV4.district].filter(Boolean).join('·') || '未知',
        country_code: primaryV4.country_code, bitmask: primaryV4.bitmask
      } : null,
      primary_v6: primaryV6 ? {
        ip: primaryV6.ip, country: primaryV6.country, region: primaryV6.region,
        city: primaryV6.city, district: primaryV6.district, isp: primaryV6.isp,
        owner: primaryV6.owner,
        location: [primaryV6.country, primaryV6.region, primaryV6.city, primaryV6.district].filter(Boolean).join('·') || '未知',
        country_code: primaryV6.country_code, bitmask: primaryV6.bitmask
      } : null,
      results: allResults.map(r => ({
        ip: r.ip, type: r.type,
        location: [r.country, r.region, r.city, r.district].filter(Boolean).join('·') || '未知',
        country: r.country, region: r.region, city: r.city, district: r.district,
        isp: r.isp, owner: r.owner, bitmask: r.bitmask,
        country_code: r.country_code, success: r.success
      })),
      country: primary.country || '', region: primary.region || '',
      city: primary.city || '', district: primary.district || '',
      isp: primary.isp || '', owner: primary.owner || '',
      bitmask: primary.bitmask || 32, country_code: primary.country_code || '',
      continent_code: primary.continent_code || ''
    };
  }

  return { success: false, error: '输入格式不正确，请输入 IP 地址或域名', input };
}

// ─── 格式化 ───

function formatLocationText(data) {
  if (!data || !data.success) {
    return data && data.error ? `错误: ${data.error}` : '未知';
  }
  const parts = [data.country, data.region, data.city, data.district].filter(Boolean);
  const loc = parts.length > 0 ? parts.join(' ') : '未知位置';
  const isp = data.isp || '';
  return `${data.ip} ${loc}${isp ? ` [${isp}]` : ''}`;
}

function formatLocationTextSimple(data) {
  if (!data || !data.success) {
    return data && data.error ? `错误: ${data.error}` : '未知';
  }
  const parts = [data.country, data.region, data.city, data.district].filter(Boolean);
  const loc = parts.length > 0 ? parts.join(' ') : '未知位置';
  const isp = data.isp || '';
  return `${loc}${isp ? ` [${isp}]` : ''}`;
}

// ─── 数据库信息 ───

function getInfo() {
  try {
    const datExists = fs.existsSync(DB_FILE_DAT);
    const ipdbExists = fs.existsSync(DB_FILE_IPDB);
    let version = '未知';
    try {
      const pkg = require('qqwry.ipdb/package.json');
      version = pkg.version;
    } catch (e) { /* ignore */ }

    return {
      success: true,
      version,
      description: '纯真IP库 - IPv4: qqwry.dat / IPv6: qqwry.ipdb',
      databases: {
        ipv4: { file: 'qqwry.dat', exists: datExists, format: 'CZ88 (legacy)' },
        ipv6: { file: 'qqwry.ipdb', exists: ipdbExists, format: 'IPIP.net' }
      }
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
  reloadDatabase,
  clearQueryCache,
  formatLocationText,
  formatLocationTextSimple,
  getInfo
};
