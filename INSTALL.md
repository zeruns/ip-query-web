# 安装与使用说明

## 环境要求

| 项目 | 最低要求 | 推荐 |
|------|---------|------|
| **Node.js** | 18.x | 18 LTS 或更高 |
| **内存** | 256 MB | 512 MB+ |
| **存储** | 150 MB（含 IP 数据库 ~40 MB） | 256 MB+ |
| **系统** | Linux / macOS / Windows (WSL) | Linux |
| **架构** | x86_64 / ARM64 / ARMv7 | 任意 |

---

## 安装方式

### 方式一：裸机安装（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/zeruns/ip-query-web.git /opt/ip-query-web
cd /opt/ip-query-web

# 2. 一键安装（推荐）
# 脚本会自动安装依赖、创建 .env、弹出部署方式选择菜单
sudo bash install.sh

# 3. 启动服务
systemctl start ip-query
systemctl enable ip-query   # 设为开机自启

# 4. 查看状态
systemctl status ip-query
```

### 方式二：手动安装

```bash
# 1. 进入项目目录
cd /opt/ip-query-web

# 2. 创建环境变量文件
cp .env.example .env
# 编辑 .env 按需修改配置
vim .env

# 3. 安装依赖
npm install --production

# 4. 启动服务
./start.sh

# 或直接用 node
node server.js
```

### 方式三：Docker 部署

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f
```

### 方式四：宝塔面板

在宝塔「Node 项目管理」中：
1. 添加项目，选择项目目录
2. 启动命令：`node server.js`
3. 端口：`6688`
4. 如需 Nginx 反代，在网站中添加反向代理到 `http://127.0.0.1:6688`

---

## 快速验证

服务启动后，用 curl 测试基本功能：

```bash
# 页面访问
curl http://localhost:6688

# API 测试 - 获取访问者 IP
curl http://localhost:6688/api/myip
# → {"success":true,"ip":"1.2.3.4"}

# API 测试 - IP 归属地查询
curl http://localhost:6688/api/location?q=114.114.114.114

# API 测试 - 纯文本格式
curl http://localhost:6688/api/location.txt?q=114.114.114.114

# API 测试 - 域名解析
curl http://localhost:6688/api/resolve4?q=blog.zeruns.com

# API 测试 - 综合查询（IP 或域名）
curl http://localhost:6688/api/query?q=blog.zeruns.com

# 命令行查询
node cli.js 114.114.114.114
node cli.js blog.zeruns.com
```

---

## 配置说明

所有配置通过 `.env` 文件管理，修改后需重启服务：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `6688` | 服务端口 |
| `HOST` | `::` | 监听地址（`::`=IPv4+IPv6 双栈） |
| `RATE_LIMIT_MAX` | `120` | 普通 API 限流（次/分钟/IP） |
| `RATE_LIMIT_DNS` | `30` | DNS 解析接口限流 |
| `GITHUB_MIRROR` | `https://gh-proxy.com/` | GitHub 镜像加速（国内必配，留空直连） |
| `PUBLIC_DNS` | `8.8.8.8,8.8.4.4` | 域名解析用公共 DNS |
| `DATA_DIR` | `./data` | IP 数据库目录 |
| `LOG_LEVEL` | `info` | 日志级别（debug/info/warn/error） |
| `CC_MAX_CONCURRENT` | `20` | 单 IP 最大并发连接数 |
| `CC_BURST_WINDOW` | `2000` | 突发检测窗口（毫秒） |
| `CC_BURST_MAX` | `40` | 窗口内最大新建连接数 |
| `CC_SLOW_TIMEOUT` | `15000` | 慢速攻击超时（毫秒） |
| `CC_BLOCK_DURATION` | `60000` | 封禁时长（毫秒） |
| `CC_WHITELIST` | 空 | IP 白名单（逗号分隔） |
| `CC_BLACKLIST` | 空 | IP 黑名单（逗号分隔） |
| `SSL_KEY` | 空 | SSL 私钥路径（Nginx 反代时无需配置） |
| `SSL_CERT` | 空 | SSL 证书路径 |

> 网站域名和 ICP 备案号通过静态文件配置，详见各 HTML 页面中的 `<meta name="site-url">` 和 `components/footer.html`。

---

## 作为系统服务（systemd）

一键安装（`install.sh`）会自动创建 systemd 服务，也可以手动创建：

**创建 `/etc/systemd/system/ip-query.service`：**

```ini
[Unit]
Description=纯真IP库在线查询系统
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ip-query-web
EnvironmentFile=-/opt/ip-query-web/.env
ExecStart=/usr/bin/node /opt/ip-query-web/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**启用并启动：**

```bash
sudo systemctl daemon-reload
sudo systemctl enable ip-query
sudo systemctl start ip-query
```

**常用操作：**

```bash
systemctl status ip-query         # 查看状态
journalctl -u ip-query -f         # 实时查看日志
systemctl restart ip-query        # 重启
systemctl stop ip-query           # 停止
```

---

## Nginx 反代配置

建议在前面加 Nginx 做 SSL 终端：

```nginx
server {
    listen 443 ssl http2;
    server_name ip.example.com;

    ssl_certificate /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;

    # 阿里云 ESA CDN 真实IP
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    location / {
        proxy_pass http://127.0.0.1:6688;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name ip.example.com;
    return 301 https://$host$request_uri;
}
```

---

## 数据库更新

IP 数据库默认 **每周一凌晨 3:00** 自动更新。也可以手动操作：

```bash
# 手动更新（通过 GitHub 镜像加速）
GITHUB_MIRROR=https://gh-proxy.com/ node src/updater.js update

# 检查更新
node src/updater.js check

# 查看数据库状态
node src/updater.js status
```

数据库文件位于 `data/` 目录：
- `qqwry.ipdb` — 纯真 IP 库综合版（IPv4 + IPv6）
- `qqwry.dat` — 纯真 IP 库经典版（IPv4）

若 `data/` 目录无文件，系统会自动使用 npm 包 `qqwry.ipdb` 中的自带数据库。

---

## 安全建议

1. **公网部署** — 务必使用 systemd 或 Docker 保证进程存活，建议加 Nginx SSL 反代
2. **CC 防护** — 系统已内置纯 Node 实现的 CC 防护，通过 `.env` 中的 `CC_*` 变量调整参数
3. **IP 黑白名单** — 在 `.env` 中设置 `CC_WHITELIST` 和 `CC_BLACKLIST`
4. **限流** — 内置分级限流，普通接口 120 次/分钟/IP，DNS 接口 30 次/分钟/IP
5. **CDN** — 使用 CDN 时需在 ESA 控制台开启真实 IP 传递，并在 Nginx 中配置 `real_ip_header`

---

## 迁移到新服务器

```bash
# 源服务器：打包（不含 node_modules 和数据文件）
cd /opt/ip-query-web
tar czf ip-query-web.tar.gz \
  --exclude=node_modules \
  --exclude=data \
  --exclude=.env \
  .

# 传输
scp ip-query-web.tar.gz 新服务器:/opt/

# 新服务器上
cd /opt
tar xzf ip-query-web.tar.gz
cd ip-query-web
sudo bash install.sh
```
