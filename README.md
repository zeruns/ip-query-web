# IP 归属地查询系统

<p align="center">
  <strong>纯真IP库在线查询服务</strong><br>
  支持 IPv4 / IPv6 / 域名解析 · 双格式 API（JSON + TXT）· 自带暗色 Web 界面
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#api-接口">API 文档</a> ·
  <a href="#配置">配置说明</a> ·
  <a href="#安全防护">安全防护</a> ·
  <a href="#第三方API推荐">第三方API推荐</a>
</p>

---

## 快速开始

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
| `http://localhost:6688/stats.html` | 网站统计 |

## 在线演示

🔗 [https://ip-query.zeruns.com/](https://ip-query.zeruns.com/)

## 功能特性

- **IPv4 / IPv6 双栈** — 同时支持两种协议的地理位置查询
- **域名解析** — 自动解析 A / AAAA 记录并查询每个 IP
- **双格式 API** — JSON 和纯文本（`.txt`）输出，适应不同场景
- **暗色 Web 界面** — 自带查询页面、API 文档、统计面板
- **命令行工具** — `node cli.js <IP/域名>` 直接查询
- **IP 库自动更新** — 每周一凌晨自动拉取最新纯真 IP 库（支持 GitHub 镜像加速）
- **三层安全防护** — CC 防护 + 分级限流 + 安全头

## API 接口

所有接口支持 JSON 和纯文本（后缀 `.txt` 或 `?format=txt`）双格式。

| 接口 | 说明 | 限流（次/分钟） |
|------|------|:---:|
| `GET /api/query?q=<IP或域名>` | 综合查询（推荐） | 30 |
| `GET /api/myip` | 获取本机公网 IP | 120 |
| `GET /api/location?q=<IP>` | IP 查地理位置 | 120 |
| `GET /api/mylocation` | 获取访问者地理位置 | 120 |
| `GET /api/resolve4?q=<域名>` | 域名解析 IPv4 | 30 |
| `GET /api/resolve6?q=<域名>` | 域名解析 IPv6 | 30 |
| `GET /api/info` | 数据库版本信息 | 120 |
| `GET /api/status` | 数据库状态 | 120 |
| `GET /api/stats?range=daily\|weekly\|monthly\|yearly` | 网站统计 | 120 |
| `POST /api/batch` | 批量 IP 查询（≤50） | 120 |
| `POST /api/reload` | 重新加载数据库 | 5 |
| `GET /health` | 健康检查 | ∞ |

### 调用示例

```bash
# JSON 格式
curl http://localhost:6688/api/query?q=8.8.8.8

# 纯文本格式
curl http://localhost:6688/api/query.txt?q=8.8.8.8

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
| `RATE_LIMIT_SENSITIVE` | `5` | 敏感接口限流（update/reload） |
| `RATE_LIMIT_DNS` | `30` | 域名解析接口限流（DNS 查询较慢，限制更严） |

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
| `PUBLIC_IP_SOURCES` | `ipinfo.io,ipify.org,checkip.amazonaws.com` | 获取公网 IP 的查询源（逗号分隔，取最快响应） |

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
| 2 | express-rate-limit | 按接口类型分级限流（普通 / DNS / 敏感） |
| 3 | 安全头 | `X-Frame-Options`, `XSS-Protection`, `CORS` 控制 |

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

| CDN | 请求头 | 自动识别 |
|-----|-------|:---:|
| Cloudflare | `CF-Connecting-IP` | ✅ |
| 阿里云 CDN | `Ali-CDN-Real-IP` | ✅ |
| Google Cloud | `True-Client-IP` | ✅ |
| Nginx 反代 | `X-Real-IP` / `X-Forwarded-For` | ✅ |

## 第三方API推荐

除了自建服务，也可以用以下第三方 IP 查询 API：[第三方API推荐](https://ip-query.zeruns.com/api-recommend.html)

## 项目结构

```
├── server.js              # Express 服务器入口
├── cli.js                 # 命令行查询工具
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
│   ├── stats.html         # 统计面板
│   └── components/        # 页头/页尾组件
└── data/                  # IP 数据库 & 统计数据
```

## 运行条件

- **Node.js** 18+
- **内存** 256MB+
- **存储** ~150MB（含 IP 库 ~40MB）
- **系统** Linux / macOS / Windows (WSL)

## 数据来源

IP 地理位置数据来自 [纯真 IP 库 (CZ88.NET)](https://github.com/nmgliangwei/qqwry.ipdb)，通过 npm 包 `qqwry.ipdb` 分发，每周自动更新。

## 作者

[Zeruns's Blog](https://blog.zeruns.com/)

## VPS/云服务器推荐

需要服务器部署本项目？可参考这篇推荐：

👉 [VPS/云服务器推荐列表](https://blog.vpszj.cn/archives/41.html)

## 许可证

MIT
