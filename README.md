# IP 归属地查询系统

纯真 IP 库在线查询服务，支持 IPv4 / IPv6 / 域名解析，双格式 API（JSON + TXT），自带 Web 管理界面。

## 快速开始

### 方式一：裸机安装（推荐）

```bash
# 需要 Node.js 18+
git clone <repo-url> /path/to/ip-query-web
cd /path/to/ip-query-web

# 一键安装（自动安装依赖、创建 .env、可选 Systemd/Docker/PM2）
sudo bash install.sh
```

### 方式二：Docker 部署

```bash
# 构建并启动
docker compose up -d --build
```

### 方式三：手动启动

```bash
cp .env.example .env
npm install --production
node server.js
# 或使用 start.sh（自动加载 .env）
./start.sh
```

## 访问

| 地址 | 说明 |
|------|------|
| `http://localhost:6688` | Web 界面 + API 文档 |
| `http://<服务器IP>:6688` | 局域网/公网访问 |

## 配置

所有配置通过环境变量或 `.env` 文件管理：

```bash
cp .env.example .env   # 复制默认配置
vim .env               # 按需修改
./start.sh             # 重启生效
```

**关键配置项：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `6688` | 服务端口 |
| `HOST` | `::` | 监听地址（`::`=双栈, `0.0.0.0`=仅IPv4, `127.0.0.1`=仅本地） |
| `RATE_LIMIT_MAX` | `120` | 普通 API 限流（次/分钟/IP） |
| `RATE_LIMIT_SENSITIVE` | `5` | 敏感接口限流（update/reload） |
| `RATE_LIMIT_DNS` | `30` | 域名解析接口限流 |
| `PUBLIC_DNS` | `8.8.8.8,8.8.4.4` | 公共 DNS 服务器 |
| `DATA_DIR` | `./data` | IP 数据库存放目录 |
| `PUBLIC_IP_SOURCES` | ipinfo.io, ipify.org, checkip.amazonaws.com | 公网 IP 查询源 |
| `LOG_LEVEL` | `info` | 日志级别 |

## API 接口

所有接口支持 JSON 和纯文本（后缀 `.txt`）双格式。

| 接口 | 说明 | 限流 |
|------|------|------|
| `GET /api/myip` | 获取本机公网 IP | 120次/分钟 |
| `GET /api/location?q=1.1.1.1` | IP 地址查地理位置 | 120次/分钟 |
| `GET /api/mylocation` | 获取本机地理位置 | 120次/分钟 |
| `GET /api/resolve4?q=example.com` | 域名解析 IPv4 | 30次/分钟 |
| `GET /api/resolve6?q=example.com` | 域名解析 IPv6 | 30次/分钟 |
| `GET /api/query?q=<IP或域名>` | 综合查询 | 30次/分钟 |
| `GET /api/info` | 数据库信息 | 120次/分钟 |
| `GET /api/status` | 数据库状态 | 120次/分钟 |
| `POST /api/batch` | 批量 IP 查询 | 120次/分钟 |
| `POST /api/reload` | 重新加载数据库 | **5次/分钟** |
| `GET /health` | 健康检查 | ∞ |

## 命令行查询

```bash
# 查 IP 归属地
node cli.js 114.114.114.114

# 查域名（解析 + 归属地）
node cli.js home.zeruns.com

# IPv6
node cli.js -6 ipv6.google.com
```

## 安全防护

系统内置三层防护链，部署到公网时无需额外配置：

1. **CC 防护**（纯 Node 实现）— 单 IP 并发限制 + 突发检测 + 慢速攻击防御 + 自动封禁
2. **应用层限流**（express-rate-limit）— 按接口类型分级限流
3. **安全头**（X-Frame-Options, XSS-Protection 等）— 防止点击劫持

## Nginx 反代配置

建议在前面加 Nginx 做 SSL 终端 + WAF 防护：

```nginx
server {
    listen 443 ssl http2;
    server_name ip.example.com;

    # SSL 配置...
    ssl_certificate /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;

    # 传递客户端真实 IP（必须）
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;

    # Cloudflare CDN 用户需额外（在 server 块中）
    # real_ip_header CF-Connecting-IP;

    location / {
        proxy_pass http://127.0.0.1:6688;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 60s;
    }
}

# HTTP → HTTPS 跳转
server {
    listen 80;
    server_name ip.example.com;
    return 301 https://$host$request_uri;
}
```

### CDN 支持

| CDN | 请求头 | 服务端自动识别 |
|-----|-------|:------------:|
| Cloudflare | `CF-Connecting-IP` | ✅ |
| Cloudflare / Google Cloud / 阿里云 | `True-Client-IP` | ✅ |
| 阿里云 CDN | `Ali-CDN-Real-IP` | ✅ |
| Nginx 反代 | `X-Real-IP` / `X-Forwarded-For` | ✅ |

```bash
# 验证客户端 IP 识别是否正常
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:6688/api/mylocation
# 应该返回 {"ip":"1.2.3.4", ...}
```

## 迁移到新服务器

复制整个项目目录到新服务器：

```bash
# 源服务器：打包（不含 node_modules）
cd /path/to/ip-query-web
tar czf ip-query-web.tar.gz \
  --exclude=node_modules \
  --exclude=data \
  --exclude=.env \
  .

# 传输
scp ip-query-web.tar.gz 新服务器:/opt/

# 新服务器
cd /opt
tar xzf ip-query-web.tar.gz
cd ip-query-web

# 方式1: 一键安装
sudo bash install.sh

# 方式2: Docker
docker compose up -d --build
```

首次启动会自动：
- 安装 Node.js 依赖
- 从 npm 获取纯真 IP 数据库（qqwry.ipdb）
- 每周一凌晨 3 点自动更新 IP 库

## 项目结构

```
├── server.js          # Express 服务器入口
├── cli.js             # 命令行查询工具
├── start.sh           # 通用启动脚本
├── install.sh         # 一键安装脚本
├── Dockerfile         # Docker 构建
├── docker-compose.yml # Docker Compose
├── .env.example       # 环境变量模板
├── package.json
├── src/
│   ├── config.js      # 统一配置层
│   ├── ipdb.js        # IP 库查询引擎
│   └── updater.js     # 自动更新模块
├── public/
│   ├── index.html     # 主查询页面
│   ├── api-docs.html  # API 文档
│   └── api-recommend.html  # API 对比
└── data/
    ├── qqwry.ipdb     # 纯真 IPv4+v6 数据库
    └── qqwry.dat      # 纯真 IPv4 数据库
```

## 运行条件

- **Node.js** 18+（推荐 18 LTS）
- **内存** 最低 256MB（推荐 512MB+）
- **存储** 约 150MB（含数据库 ~40MB）
- **系统** Linux / macOS / Windows (WSL)
- **架构** x86_64 / ARM64 / ARMv7

## 许可证

MIT
