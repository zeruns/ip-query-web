/**
 * IP 数据库更新模块（镜像加速版）
 *
 * 通过 GitHub 镜像下载最新的 qqwry.ipdb / qqwry.dat。
 * 不再依赖 GitHub API，直接使用 releases/latest/download 直链。
 * 镜像地址通过 GITHUB_MIRROR 环境变量配置，留空直连。
 *
 * 数据源：
 *   - qqwry.ipdb: https://github.com/nmgliangwei/qqwry.ipdb (IPv4 + IPv6)
 *   - qqwry.dat:  https://github.com/nmgliangwei/qqwry (IPv4)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = config.dataDir || path.join(__dirname, '..', 'data');
const MIRROR = config.githubMirror || '';  // 空字符串 = 直连

// ── 仓库配置（全是直链，不含 api.github.com） ──

const REPOS = [
  {
    name: 'qqwry.ipdb',
    url: 'https://github.com/nmgliangwei/qqwry.ipdb/releases/latest/download/qqwry.ipdb',
    outputFile: 'qqwry.ipdb',
    description: '纯真IP库综合版 (IPv4 + IPv6)'
  },
  {
    name: 'qqwry.dat',
    url: 'https://github.com/nmgliangwei/qqwry/releases/latest/download/qqwry.dat',
    outputFile: 'qqwry.dat',
    description: '纯真IP库经典版 (IPv4)'
  }
];

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── 镜像 URL 拼接 ──

function mirrorURL(originalURL) {
  if (!MIRROR) return originalURL;
  return MIRROR + '/' + originalURL;
}

// ── HTTP/HTTPS 请求 ──

function fetchURL(url, redirects) {
  redirects = redirects || 0;
  if (redirects > 10) return Promise.reject(new Error('重定向次数过多'));

  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'IPQueryBot/2.0' },
      timeout: 60000
    }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchURL(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

// ── 下载文件到临时路径 ──

function downloadToTemp(url) {
  return new Promise((resolve, reject) => {
    fetchURL(url).then(res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const tmpPath = path.join(DATA_DIR, '.tmp_download_' + Date.now());
      const stream = fs.createWriteStream(tmpPath);
      let size = 0;
      res.on('data', chunk => { size += chunk.length; });
      res.pipe(stream);
      stream.on('finish', () => resolve({ path: tmpPath, size }));
      stream.on('error', reject);
    }).catch(reject);
  });
}

// ── 更新单个数据库 ──

async function updateSingleDb(repoName) {
  const repo = REPOS.find(r => r.name === repoName);
  if (!repo) return { success: false, error: '未知仓库: ' + repoName };

  const outputPath = path.join(DATA_DIR, repo.outputFile);
  const dlURL = mirrorURL(repo.url);

  console.log('[更新器] 检查 ' + repo.name + ' (' + repo.description + ')');
  console.log('[更新器] 下载: ' + dlURL);

  try {
    // 下载到临时文件
    const tmp = await downloadToTemp(dlURL);
    if (!tmp.size || tmp.size < 1024) {
      try { fs.unlinkSync(tmp.path); } catch (e) {}
      return { success: false, error: '下载文件过小，可能失败', repo: repo.name };
    }

    // 与本地文件对比
    const localSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    const diff = Math.abs(tmp.size - localSize);

    if (localSize > 0 && diff <= 1024) {
      console.log('[更新器] ' + repo.name + ' 无需更新（大小一致: ' + (tmp.size / 1024 / 1024).toFixed(2) + ' MB）');
      try { fs.unlinkSync(tmp.path); } catch (e) {}
      return { success: true, repo: repo.name, updated: false, size: localSize, reason: 'up-to-date' };
    }

    // 原子替换：先写临时文件，再 rename
    fs.renameSync(tmp.path, outputPath);
    console.log('[更新器] ' + repo.name + ' 更新完成: ' + (tmp.size / 1024 / 1024).toFixed(2) + ' MB');

    return { success: true, repo: repo.name, updated: true, size: tmp.size, file: repo.outputFile };
  } catch (e) {
    console.error('[更新器] ' + repo.name + ' 更新失败:', e.message);
    return { success: false, error: e.message, repo: repo.name };
  }
}

// ── 更新所有数据库 ──

async function updateAll(targets) {
  targets = targets || null;
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

// ── 检查更新（通过下载对比文件大小） ──

async function checkUpdates() {
  const repo = REPOS[0];  // 只检查 qqwry.ipdb
  const outputPath = path.join(DATA_DIR, repo.outputFile);
  const dlURL = mirrorURL(repo.url);

  try {
    const res = await fetchURL(dlURL);
    const remoteSize = parseInt(res.headers['content-length'] || '0', 10);
    res.resume();
    const localSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    const diff = Math.abs(remoteSize - localSize);

    return {
      hasUpdate: localSize === 0 || diff > 1024,
      reason: localSize === 0 ? '本地无数据库文件' : (diff > 1024 ? '文件大小差异显著' : '文件大小一致'),
      current: localSize > 0 ? { size: localSize, mtime: fs.statSync(outputPath).mtime } : null,
      remote: { size: remoteSize }
    };
  } catch (e) {
    return { hasUpdate: false, reason: '检查失败: ' + e.message };
  }
}

// ── 数据库状态 ──

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

// ── 定时更新（每周一凌晨 3:00） ──

function scheduleWeeklyUpdate(onUpdate) {
  const cron = require('node-cron');

  const task = cron.schedule('0 3 * * 1', async () => {
    console.log('[更新器] 执行每周定时 IP 库更新...');
    try {
      const results = await updateAll();
      console.log('[更新器] 定时更新完成');
      results.forEach(r => {
        if (r.success) {
          console.log('  ' + (r.updated ? '✅' : '✔️') + ' ' + r.repo + ': ' + (r.size / 1024 / 1024).toFixed(2) + ' MB' + (r.updated ? ' (已更新)' : ' (无需更新)'));
        } else {
          console.log('  ❌ ' + r.repo + ': ' + r.error);
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

  console.log('[更新器] 已设置定时更新：每周一 03:00 (Asia/Shanghai)');
  if (MIRROR) console.log('[更新器] 使用镜像: ' + MIRROR);
  return task;
}

module.exports = {
  updateAll,
  updateSingleDb,
  checkUpdates,
  getDatabaseStatus,
  scheduleWeeklyUpdate,
  DATA_DIR,
  REPOS
};

// ── 命令行直接运行 ──

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'update';

  if (cmd === 'update') {
    updateAll().then(results => {
      console.log('\n========== 更新结果 ==========');
      results.forEach(r => {
        if (r.success) {
          const status = r.updated ? '✅ 已更新' : '✔️ 无需更新';
          console.log(status + ' ' + r.repo + ': ' + (r.size / 1024 / 1024).toFixed(2) + ' MB');
        } else {
          console.log('❌ ' + r.repo + ': ' + r.error);
        }
      });
    }).catch(e => {
      console.error('更新失败:', e.message);
      process.exit(1);
    });
  } else if (cmd === 'check') {
    checkUpdates().then(info => {
      console.log('当前:', info.current ? (info.current.size / 1024 / 1024).toFixed(2) + ' MB' : '无本地数据库');
      console.log('远程:', info.remote && info.remote.size ? (info.remote.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A');
      console.log('需更新:', info.hasUpdate ? '是' : '否');
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
        console.log('  ✅ ' + s.name + ': ' + (s.size / 1024 / 1024).toFixed(2) + ' MB (' + s.mtime.toISOString().slice(0, 10) + ')');
      } else {
        console.log('  ❌ ' + s.name + ': 未下载');
      }
    });
  } else {
    console.log('用法: node src/updater.js [update|check|status]');
  }
}
