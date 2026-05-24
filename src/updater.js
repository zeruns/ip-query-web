/**
 * IP 数据库自动更新模块
 * 
 * 从 GitHub Releases 下载最新的 qqwry.ipdb 和 qqwry 数据库文件。
 * 支持 IPv4 和 IPv6 数据。
 * 
 * 数据源：
 *   - IPv4/IPv6 综合库: https://github.com/nmgliangwei/qqwry.ipdb
 *   - 纯真 IPv4 库:    https://github.com/nmgliangwei/qqwry
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'qqwry.ipdb');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * GitHub Release 信息
 */
const REPOS = [
  {
    name: 'qqwry.ipdb',
    api: 'https://api.github.com/repos/nmgliangwei/qqwry.ipdb/releases/latest',
    assetPattern: /\.ipdb$/i,
    outputFile: 'qqwry.ipdb',
    description: '纯真IP库综合版 (IPv4 + IPv6, IPIP格式)'
  },
  {
    name: 'qqwry.dat',
    api: 'https://api.github.com/repos/nmgliangwei/qqwry/releases/latest',
    assetPattern: /\.dat$/i,
    outputFile: 'qqwry.dat',
    description: '纯真IP库经典版 (IPv4, DAT格式)'
  }
];

/**
 * HTTP/HTTPS 请求包装
 */
function request(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'IPQueryBot/1.0',
        'Accept': 'application/octet-stream, application/json'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        return request(res.headers.location).then(resolve).catch(reject);
      }
      resolve(res);
    }).on('error', reject).on('timeout', function() {
      this.destroy();
      reject(new Error(`请求超时: ${url}`));
    });
  });
}

/**
 * 收集 response 数据
 */
function collectResponse(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
}

/**
 * 获取 GitHub Release 信息
 */
async function getReleaseInfo(apiUrl) {
  const res = await request(apiUrl);
  const body = await collectResponse(res);
  if (res.statusCode !== 200) {
    throw new Error(`GitHub API 返回 ${res.statusCode}: ${body.toString().slice(0, 200)}`);
  }
  const data = JSON.parse(body.toString());
  return {
    tag: data.tag_name || data.name || 'unknown',
    publishedAt: data.published_at || data.created_at || '',
    assets: (data.assets || []).map(a => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
      updatedAt: a.updated_at
    }))
  };
}

/**
 * 获取当前版本号（从已下载的文件或 package.json 中的 npm 版本）
 */
function getCurrentVersion() {
  const dbPath = DB_FILE;
  if (fs.existsSync(dbPath)) {
    try {
      const stat = fs.statSync(dbPath);
      return {
        exists: true,
        fileSize: stat.size,
        mtime: stat.mtime
      };
    } catch (e) {
      return { exists: false };
    }
  }
  return { exists: false };
}

/**
 * 下载文件到目标路径
 */
async function downloadFile(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await request(url);
      const stream = fs.createWriteStream(outputPath);
      
      let downloadedSize = 0;
      const totalSize = parseInt(res.headers['content-length'] || '0', 10);

      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
      });

      stream.on('finish', () => {
        resolve({ size: downloadedSize, path: outputPath });
      });
      stream.on('error', reject);
      res.pipe(stream);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 更新指定的 IP 数据库
 * @param {string} repoName - 仓库名称
 * @returns {Promise<object>} 更新结果
 */
async function updateSingleDb(repoName) {
  const repo = REPOS.find(r => r.name === repoName);
  if (!repo) {
    return { success: false, error: `未知仓库: ${repoName}` };
  }

  try {
    console.log(`[更新器] 检查 ${repo.name} (${repo.description})...`);
    
    const releaseInfo = await getReleaseInfo(repo.api);
    const matchedAsset = releaseInfo.assets.find(a => repo.assetPattern.test(a.name));
    
    if (!matchedAsset) {
      return { success: false, error: `未找到匹配 ${repo.assetPattern} 的附件`, repo: repo.name };
    }

    const outputPath = path.join(DATA_DIR, repo.outputFile);
    console.log(`[更新器] 发现最新版本: ${releaseInfo.tag}`);
    console.log(`[更新器] 下载 ${matchedAsset.name} (${(matchedAsset.size / 1024 / 1024).toFixed(2)} MB)...`);
    
    const result = await downloadFile(matchedAsset.url, outputPath);
    console.log(`[更新器] ${repo.name} 下载完成: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    
    return {
      success: true,
      repo: repo.name,
      tag: releaseInfo.tag,
      file: repo.outputFile,
      size: result.size,
      publishedAt: releaseInfo.publishedAt
    };
  } catch (e) {
    console.error(`[更新器] ${repo.name} 更新失败:`, e.message);
    return { success: false, error: e.message, repo: repo.name };
  }
}

/**
 * 更新所有 IP 数据库
 * @param {string[]} [targets] - 要更新的仓库名称数组，默认全部更新
 * @returns {Promise<object[]>} 所有仓库更新结果
 */
async function updateAll(targets = null) {
  const reposToUpdate = targets
    ? REPOS.filter(r => targets.includes(r.name))
    : REPOS;

  const results = [];
  for (const repo of reposToUpdate) {
    const r = await updateSingleDb(repo.name);
    results.push(r);
  }
  return results;
}

/**
 * 检查是否有新版本
 */
async function checkUpdates() {
  const current = getCurrentVersion();
  if (!current.exists) {
    return { hasUpdate: true, reason: '本地无数据库文件', current: null };
  }

  try {
    const releaseInfo = await getReleaseInfo(REPOS[0].api);
    const matchedAsset = releaseInfo.assets.find(a => REPOS[0].assetPattern.test(a.name));
    
    if (matchedAsset) {
      // 简单比较：如果远程文件大小不同则认为有更新
      const significantDiff = Math.abs(matchedAsset.size - current.fileSize) > 1024; // > 1KB 差异
      return {
        hasUpdate: significantDiff,
        reason: significantDiff ? '文件大小差异显著' : '文件大小一致，可能无更新',
        current: current,
        remote: {
          tag: releaseInfo.tag,
          size: matchedAsset.size,
          publishedAt: releaseInfo.publishedAt
        }
      };
    }
    return { hasUpdate: false, reason: '无法获取远程信息', current };
  } catch (e) {
    return { hasUpdate: false, reason: `检查失败: ${e.message}`, current };
  }
}

/**
 * 获取数据库状态
 */
function getDatabaseStatus() {
  const status = [];
  for (const repo of REPOS) {
    const fp = path.join(DATA_DIR, repo.outputFile);
    const exists = fs.existsSync(fp);
    let info = { name: repo.name, description: repo.description, exists, file: repo.outputFile };
    if (exists) {
      const stat = fs.statSync(fp);
      info.size = stat.size;
      info.mtime = stat.mtime;
    }
    status.push(info);
  }
  return status;
}

/**
 * 设置定时更新（每周一凌晨3:00自动更新）
 * @param {function} onUpdate - 更新完成后的回调，接收 results 数组
 * @returns {object} cron 任务对象
 */
function scheduleWeeklyUpdate(onUpdate) {
  const cron = require('node-cron');
  
  // 每周一凌晨 3:00 执行
  const task = cron.schedule('0 3 * * 1', async () => {
    console.log('[更新器] 执行每周定时 IP 库更新...');
    try {
      const results = await updateAll();
      console.log('[更新器] 定时更新完成');
      results.forEach(r => {
        if (r.success) {
          console.log(`  ✅ ${r.repo}: ${r.tag} (${(r.size/1024/1024).toFixed(2)} MB)`);
        } else {
          console.log(`  ❌ ${r.repo}: ${r.error}`);
        }
      });
      if (onUpdate) onUpdate(results);
    } catch (e) {
      console.error('[更新器] 定时更新失败:', e.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });
  
  console.log(`[更新器] 已设置定时更新：每周一 03:00 (Asia/Shanghai)`);
  return task;
}

module.exports = {
  updateAll,
  updateSingleDb,
  checkUpdates,
  getReleaseInfo,
  getCurrentVersion,
  getDatabaseStatus,
  scheduleWeeklyUpdate,
  DATA_DIR,
  DB_FILE,
  REPOS
};

// 命令行直接运行：node src/updater.js
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'update';

  if (cmd === 'update') {
    updateAll().then(results => {
      console.log('\n========== 更新结果 ==========');
      results.forEach(r => {
        if (r.success) {
          console.log(`✅ ${r.repo}: 更新成功 (${(r.size / 1024 / 1024).toFixed(2)} MB, ${r.tag})`);
        } else {
          console.log(`❌ ${r.repo}: ${r.error}`);
        }
      });
    }).catch(e => {
      console.error('更新失败:', e.message);
      process.exit(1);
    });
  } else if (cmd === 'check') {
    checkUpdates().then(info => {
      console.log('当前状态:', info.current ? `${(info.current.fileSize / 1024 / 1024).toFixed(2)} MB` : '无本地数据库');
      console.log('远程信息:', info.remote ? `${info.remote.tag} (${(info.remote.size / 1024 / 1024).toFixed(2)} MB)` : 'N/A');
      console.log('是否有更新:', info.hasUpdate ? '是' : '否');
      console.log('原因:', info.reason);
    }).catch(e => {
      console.error('检查失败:', e.message);
      process.exit(1);
    });
  } else if (cmd === 'status') {
    const status = getDatabaseStatus();
    console.log('IP 数据库状态:');
    status.forEach(s => {
      if (s.exists) {
        console.log(`  ✅ ${s.name}: ${(s.size / 1024 / 1024).toFixed(2)} MB (${s.mtime.toISOString().slice(0, 10)})`);
      } else {
        console.log(`  ❌ ${s.name}: 未下载`);
      }
    });
  } else {
    console.log('用法: node src/updater.js [update|check|status]');
  }
}
