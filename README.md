# 纯真IP库在线查询系统 - IP地理位置查询、本机IP查询、域名解析

<p align="center">
  <strong>基于纯真IP库的精确地理定位服务</strong><br>
  支持 IPv4 / IPv6 / 域名解析 · 双格式 API（JSON + TXT）· 自带暗色 Web 界面 · 中英文双语切换
</p>

<p align="center">
  <a href="#项目简介">项目简介</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#api-接口">API 文档</a> ·
  <a href="#配置">配置说明</a> ·
  <a href="#安全防护">安全防护</a>
</p>

---

## 项目简介

**ip-query-web** 是一个基于纯真 IP 数据库（qqwry.ipdb）的 IP 地理位置在线查询系统。你可以用它：

- **查询 IP 归属地** — 输入任意 IPv4/IPv6 地址，获取国家、省份、城市、区县、运营商等信息
- **域名解析** — 自动解析域名的 A/AAAA 记录并查询每个 IP 的地理位置
- **获取客户端 IP** — 通过 `/api/myip` 或 `/api/mylocation` 获取访问者真实的来源 IP
- **批量查询** — 通过 POST `/api/batch` 单次最多查询 50 个 IP 地址
- **API 服务** — 提供 RESTful API，支持 JSON 和纯文本双格式，方便集成到各类应用中
- **网站统计** — 内置 PV 和 API 调用统计面板，基于 Chart.js 图表展示日/周/月/年数据
- **自动更新** — 每周一凌晨 3:00 自动从纯真 IP 库 GitHub 仓库拉取最新数据
- **中英文双语** — 支持中文 / English 界面切换，自动检测浏览器语言
- **命令行工具** — `node cli.js <IP/域名>` 直接查询

### 适用场景

- 获取网站访客来源信息（配合 Nginx 反代可识别真实 IP，支持 Cloudflare / 阿里云 CDN 等）
- 为其他应用提供 IP 地理位置查询 API
- 用作自定义查询工具或集成到自动化脚本中
- 学习 Node.js/Express Web 开发与项目架构

## 安装部署

### 方式一：裸机安装（推荐）

```bash
# 需要 Node.js 18+
git clone https://github.com/zeruns/ip-query-web.git
cd ip-query-web
npm install --production
cp .env.example .env
node server.js
```

### 方式二：Docker 部署

```bash
docker compose up -d --build
```

### 方式三：宝塔面板

在宝塔「Node 项目管理」中添加项目，启动命令 `node server.js`，端口 6688。

## 访问

| 地址 | 说明 |
|------|------|
| `http://localhost:6688` | 主查询界面 |
| `http://localhost:6688/api-docs.html` | API 文档（在线测试） |
| `http://localhost:6688/stats.html` | 网站统计（Chart.js 图表） |

## 在线演示

🔗 [https://ip-query.zeruns.com/](https://ip-query.zeruns.com/)

## 功能特性

- **IPv4 / IPv6 双栈** — 同时支持两种协议的地理位置查询
- **域名解析** — 自动解析 A / AAAA 记录并查询每个 IP
- **双格式 API** — JSON 和纯文本（`.txt`）输出，适应不同场景
- **暗色 Web 界面** — 自带查询页面、API 文档、统计面板
- **中英文双语** — 支持中文和 English 界面切换，自动检测浏览器语言偏好
- **命令行工具** — `node cli.js <IP/域名>` 直接查询
- **IP 库自动更新** — 每周一凌晨 3:00 自动拉取最新纯真 IP 库（支持 GitHub 镜像加速）
- **网站统计** — PV 和 API 调用统计，基于 Chart.js 图表展示
- **三层安全防护** — CC 防护 + 分级限流 + 安全头

## API 接口

所有接口支持 JSON 和纯文本（后缀 `.txt` 或 `?format=txt`）双格式。

| 接口 | 说明 | 限流（次/分钟） |
|------|------|:---:|
| `GET /api/query?q=<IP或域名>` | 综合查询（推荐，支持IP和域名） | 30 |
| `GET /api/myip` | 获取客户端 IP 地址（通过请求头识别） | 120 |
| `GET /api/location?q=<IP>` | IP 查地理位置（仅支持 IP） | 120 |
| `GET /api/mylocation` | 获取访问者来源 IP 及地理位置 | 120 |
| `GET /api/resolve4?q=<域名>` | 域名解析 IPv4 地址 | 30 |
| `GET /api/resolve6?q=<域名>` | 域名解析 IPv6 地址 | 30 |
| `GET /api/info` | 数据库版本信息 | 120 |
| `GET /api/status` | 数据库状态（含可用性检查） | 120 |
| `GET /api/stats?range=daily\|weekly\|monthly\|yearly` | 网站统计数据 | 120 |
| `POST /api/batch` | 批量 IP 查询（≤50） | 120 |
| `GET /health` | 健康检查（无限制） | ∞ |

### 调用示例

```bash
# JSON 格式 — 综合查询（支持 IP 和域名）
curl http://localhost:6688/api/query?q=8.8.8.8

# 纯文本格式
curl http://localhost:6688/api/query.txt?q=8.8.8.8

# 获取客户端 IP
curl http://localhost:6688/api/myip

# 批量查询
curl -X POST http://localhost:6688/api/batch \
  -H "Content-Type: application/json" \
  -d '{"ips":["8.8.8.8","1.1.1.1","2001:4860:4860::8888"]}'
```

## 命令行查询

```bash
node cli.js 114.114.114.114     # 查 IP 归属地
node cli.js blog.zeruns.com     # 查域名（解析 + 归属地）
node cli.js -6 ipv6.google.com  # 强制 IPv6
```

## 配置

所有配置通过环境变量或 `.env` 文件管理。源码中配置位于 `src/config.js`，`.env.example` 包含完整模板。

```bash
cp .env.example .env   # 复制默认配置
vim .env               # 按需修改
```

### 服务配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `6688` | 服务端口 |
| `HOST` | `::` | 监听地址：`::`=双栈（推荐）、`0.0.0.0`=仅IPv4、`127.0.0.1`=仅本地 |
| `LOG_LEVEL` | `info` | 日志级别：`debug`、`info`、`warn`、`error` |

### 限流配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RATE_LIMIT_MAX` | `120` | 普通 API 查询限流（次/分钟/单IP） |
| `RATE_LIMIT_DNS` | `30` | 域名查询接口限流（涉及 DNS 解析，限制更严） |

### CC 防护配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CC_MAX_CONCURRENT` | `20` | 单 IP 最大并发连接数，超限自动封禁 |
| `CC_BURST_WINDOW` | `2000` | 突发检测窗口（毫秒） |
| `CC_BURST_MAX` | `40` | 窗口内最大新建连接数 |
| `CC_SLOW_TIMEOUT` | `15000` | 慢速攻击超时（毫秒），超时未完成请求视为攻击 |
| `CC_BLOCK_DURATION` | `60000` | 自动封禁时长（毫秒），默认 60 秒 |
| `CC_WHITELIST` | 空 | IP 白名单（逗号分隔），白名单内 IP 不受任何限制 |
| `CC_BLACKLIST` | 空 | IP 黑名单（逗号分隔），永远拦截 |

### DNS 和网络配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PUBLIC_DNS` | `8.8.8.8,8.8.4.4` | 域名解析用公共 DNS 服务器（逗号分隔，依次尝试） |
| `PUBLIC_IP_SOURCES` | `https://ipinfo.io/ip,https://api.ipify.org,https://checkip.amazonaws.com` | 获取公网 IP 的查询源（逗号分隔，取最快响应） |

### IP 库更新配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GITHUB_MIRROR` | `https://gh-proxy.com/` | GitHub 镜像加速地址。境内服务器必配，境外留空直连 |
| `DATA_DIR` | `./data` | IP 数据库和统计文件存放目录 |

### HTTPS 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SSL_KEY` | 空 | SSL 私钥文件路径，设置后启用 HTTPS |
| `SSL_CERT` | 空 | SSL 证书文件路径 |

> 如使用 Nginx/Caddy 反向代理做 SSL 终端，这两个变量保持注释即可。

### 网站信息配置（静态文件）

> 以下配置项通过修改 HTML 静态文件完成，详见各文件内的标签：

| 配置项 | 修改位置 | 说明 |
|------|--------|------|
| 网站域名 | 各 HTML 页面 `<meta name="site-url">` | 用于 SEO 的 canonical URL |
| ICP 备案号 | `public/components/footer.html` | 底部备案号链接 |
| SEO 标题/描述/关键词 | 各 HTML 页面 `<title>`、`<meta name="description">`、`<meta name="keywords">` | 搜索引擎优化 |

### 示例 `.env`

```bash
# 服务端口
PORT=6688

# 国内服务器推荐配置
GITHUB_MIRROR=https://gh-proxy.com/

# 限流调大（高并发场景）
RATE_LIMIT_MAX=300
RATE_LIMIT_DNS=60

# CC 防护调宽松
CC_MAX_CONCURRENT=50
CC_BLOCK_DURATION=30000
```

## 安全防护

系统内置三层防护链，公网部署无需额外配置：

| 层级 | 实现 | 功能 |
|:---:|------|------|
| 1 | CC 防护（纯 Node） | 并发限制 + 突发检测 + 慢速攻击防御 + 自动封禁 + IP 黑白名单 |
| 2 | express-rate-limit | 按接口类型分级限流（普通 / DNS 解析） |
| 3 | 安全头 | `X-Frame-Options`、`X-XSS-Protection`、`X-Content-Type-Options`、`Referrer-Policy`、`CORS` 控制 |

## Nginx 反向代理

建议前面加 Nginx 做 SSL 终端：

```nginx
server {
    listen 443 ssl http2;
    server_name ip.example.com;

    ssl_certificate /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;

    location / {
        proxy_pass http://127.0.0.1:6688;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }
}
```

### CDN 兼容

系统通过 `getClientIP()` 函数智能识别客户端真实 IP，优先级从高到低：

| CDN / 代理 | 请求头 | 自动识别 |
|-----------|-------|:---:|
| Cloudflare | `CF-Connecting-IP` | ✅ |
| Cloudflare / 阿里云 / Google Cloud | `True-Client-IP` | ✅ |
| 阿里云 CDN | `Ali-CDN-Real-IP` | ✅ |
| Nginx 反代 | `X-Real-IP` | ✅ |
| 通用 | `X-Forwarded-For`（取第一个） | ✅ |

## 第三方API推荐

除了自建服务，也可以用以下第三方 IP 查询 API：[第三方API推荐](https://ip-query.zeruns.com/api-recommend.html)

## 项目结构

```
├── server.js              # Express 服务器入口
├── cli.js                 # 命令行查询工具
├── package.json           # 项目配置与依赖
├── .env.example           # 环境变量模板
├── LICENSE                # GPL-3.0 许可证
├── src/
│   ├── config.js          # 统一配置层
│   ├── ipdb.js            # IP 库查询引擎
│   ├── updater.js         # 数据库自动更新（支持镜像加速）
│   ├── ccProtection.js    # CC 防护中间件
│   ├── stats.js           # 网站统计模块
│   └── classifier.js      # 智能字段分类器
├── public/
│   ├── index.html         # 主查询页面（暗色主题）
│   ├── api-docs.html      # API 文档（在线测试）
│   ├── api-recommend.html # 第三方 API 对比
│   ├── stats.html         # 统计面板（Chart.js 图表）
│   ├── i18n.js            # 中英文双语切换
│   ├── favicon.ico        # 网站图标
│   ├── favicon.png        # 网站图标
│   └── components/        # 页头/页尾组件
└── data/                  # IP 数据库 & 统计数据
```

## 运行条件

- **Node.js** 18+
- **内存** 256MB+
- **存储** ~150MB（含 IP 库 ~40MB）
- **系统** Linux / macOS / Windows (WSL)

## 数据来源

IP 地理位置数据来自 [纯真 IP 库 (CZ88.NET)](https://github.com/nmgliangwei/qqwry.ipdb)，通过 npm 包 `qqwry.ipdb` 分发，每周一凌晨 3:00 自动更新。

## 作者

[Zeruns's Blog](https://blog.zeruns.com/)

## VPS/云服务器推荐

需要服务器部署本项目？可参考这篇推荐：

👉 [VPS/云服务器推荐列表](https://blog.vpszj.cn/archives/41.html)

## 推荐阅读

- **高性价比和便宜的VPS/云服务器推荐：** [https://blog.zeruns.com/archives/383.html](https://blog.zeruns.com/archives/383.html)
- 我的世界开服教程：[https://blog.zeruns.com/tag/mc/](https://blog.zeruns.com/tag/mc/)
- 跨境电商独立站搭建教程，WordPress外贸建站指南：[https://blog.zeruns.com/archives/889.html](https://blog.zeruns.com/archives/889.html)
- Hermes Agent 部署全指南，手把手教你搭建你的第一个AI助手：[https://blog.zeruns.com/archives/939.html](https://blog.zeruns.com/archives/939.html)
- 阿里云ESA（CDN）测评，免费不限流量，全球节点（含境内）：[https://blog.zeruns.com/archives/920.html](https://blog.zeruns.com/archives/920.html)
- Discourse论坛搭建教程，零基础部署Discourse开源社区论坛网站：[https://blog.zeruns.com/archives/919.html](https://blog.zeruns.com/archives/919.html)

## 许可证

[GNU General Public License v3.0](LICENSE)
