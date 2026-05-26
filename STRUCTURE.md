# 项目结构说明

## 概述

`ip-query-web` 是一个基于 Node.js/Express 的 IP 地理信息查询 Web 服务，使用纯真 IP 库 (`qqwry.ipdb`) 提供 IPv4/IPv6 归属地查询、域名 DNS 解析等功能，支持 JSON 和纯文本双格式输出，自带暗色 Web 界面和中英文切换。

---

## 目录树

```
ip-query-web/
├── server.js                    # Express 服务器入口（含路由 + CC 防护）
├── cli.js                       # 命令行 IP/域名查询工具
├── start.sh                     # 通用启动脚本（加载 .env）
├── install.sh                   # 一键安装脚本
├── package.json                 # npm 依赖与元信息
├── package-lock.json            # 依赖锁定文件
├── .env.example                 # 环境变量模板
├── .gitignore                   # Git 忽略规则
├── .dockerignore                # Docker 忽略规则
├── Dockerfile                   # Docker 构建文件
├── docker-compose.yml           # Docker Compose 编排
├── LICENSE                      # GPL-3.0 许可证
├── README.md                    # 项目自述文件（中文）
├── README_EN.md                 # 项目自述文件（英文）
├── STRUCTURE.md                 # 本文档 — 项目结构说明
├── INSTALL.md                   # 安装使用说明
│
├── src/                         # 核心源码模块
│   ├── config.js                # 统一配置层（环境变量 → 配置对象）
│   ├── ipdb.js                  # IP 库查询引擎（查询 + DNS 解析 + 缓存）
│   ├── updater.js               # 数据库自动更新（支持 GitHub 镜像加速）
│   ├── ccProtection.js           # CC 防护中间件（并发限制 + 突发检测 + IP黑白名单）
│   ├── stats.js                 # 网站统计模块（PV + API 调用计数）
│   └── classifier.js            # 纯真IP库智能分类器（前端/CLI 共用）
│
├── public/                      # Web 前端静态文件
│   ├── index.html               # 主查询页面（暗色主题，IP/域名输入）
│   ├── api-docs.html            # API 文档页（在线测试）
│   ├── api-recommend.html       # 第三方 API 对比页面
│   ├── stats.html               # 统计面板（Chart.js 图表）
│   ├── tracking.js               # 统一统计代码（百度/Google/Cloudflare，模板）
│   ├── i18n.js                  # 中英文双语切换引擎
│   ├── classifier.js            # 智能分类器（浏览器版）
│   ├── favicon.ico              # 网站图标
│   ├── favicon.png              # 网站图标（PNG 格式）
│   ├── components/              # 共享组件
│   │   ├── header.html          # 页头（导航栏 + 语言切换）
│   │   └── footer.html          # 页尾（友情链接 + ICP备案）
│   └── lang/                    # 翻译文件
│       ├── zh-CN.json           # 中文翻译
│       └── en.json              # 英文翻译
│
└── data/                        # IP 数据库文件目录
    ├── qqwry.ipdb               # 纯真 IP 库综合版（IPv4 + IPv6）
    ├── qqwry.dat                # 纯真 IP 库经典版（IPv4）
    └── stats.json               # 网站统计数据
```

---

## 各文件/模块说明

### 📄 入口文件

| 文件 | 说明 |
|------|------|
| `server.js` | Express 服务器入口，包含：路由注册、CC 防护中间件、限流中间件、安全头、错误处理、启动逻辑 |
| `cli.js` | 命令行工具，支持 `node cli.js <IP/域名>` 快速查询 |

### 📁 src/ — 核心模块

#### `src/config.js` — 统一配置层

- 从环境变量读取所有配置项
- 支持 `.env` 文件（由 `server.js` 通过 `dotenv` 库自动加载）
- 所有值均有合理默认值，开箱即用
- 配置项包括：端口、限流参数、CC 防护、DNS 服务器、GitHub 镜像加速、SSL 证书等

#### `src/ipdb.js` — IP 库查询引擎

核心功能模块，封装纯真 IP 库的查询操作：

- **`query(ip)`** — 查询单个 IP 的地理位置
- **`queryWithResolve(input)`** — 综合查询，自动判断 IP 或域名
- **`resolveIPv4(domain)` / `resolveIPv6(domain)`** — 域名 DNS 解析（使用公共 DNS 获取全球节点）
- **`resolveAll(domain)`** — 同时解析 A + AAAA 记录
- **`isDomain(str)`** — 判断输入是否为有效域名
- **`formatLocationText(data)`** — 格式化为纯文本（含 IP）
- **`formatLocationTextSimple(data)`** — 格式化为纯文本（仅位置，不含 IP）
- **`getInfo()`** — 获取数据库版本信息
- **`reloadDatabase()`** — 强制重新加载数据库（更新后调用）

DNS 解析策略：系统 DNS → Google Public DNS (8.8.8.8/8.8.4.4) → 中国大陆 DNS (114.114.114.114/223.5.5.5) 逐级兜底，结果合并去重。DNS 缓存 TTL 5 分钟。

#### `src/updater.js` — 数据库自动更新模块

- 从 GitHub Releases 下载最新 IP 数据库，支持 GitHub 镜像加速
- 下载到临时文件后原子替换，避免文件损坏
- 支持两种数据源：
  - `qqwry.ipdb` — 纯真 IP 库综合版（IPv4 + IPv6）
  - `qqwry.dat` — 纯真 IP 库经典版（IPv4）
- **`scheduleWeeklyUpdate()`** — 设置每周一 03:00 (Asia/Shanghai) 自动更新
- **`updateAll()`** — 立即更新所有数据库
- **`checkUpdates()`** — 通过文件大小对比检查是否有新版本
- **`getDatabaseStatus()`** — 获取数据库文件状态
- 镜像地址通过 `GITHUB_MIRROR` 环境变量配置，留空直连
- 支持命令行独立运行：`node src/updater.js [update|check|status]`

#### `src/ccProtection.js` — CC 防护模块

纯 Node 实现的 CC 防护中间件，不依赖系统防火墙：

- 单 IP 并发连接限制
- 突发连接检测（滑动窗口）
- 慢速攻击防御（请求超时检测）
- 自动封禁 + IP 黑白名单
- 参数通过 `CC_*` 环境变量调整

#### `src/stats.js` — 网站统计模块

记录网站 PV 和 API 调用次数，按日期聚合：

- 异步防抖落盘（每 10 秒），不阻塞请求
- 查询支持按日/周/月/年范围聚合
- Express 中间件自动区分 PV 和 API 调用
- 数据存储于 `data/stats.json`

### 📁 public/ — 前端页面

| 文件 | 功能 |
|------|------|
| `index.html` | 主查询页面，暗色主题，支持 IP 或域名输入，多 IP 折叠展示 |
| `api-docs.html` | API 文档页，每个接口带在线测试按钮 |
| `api-recommend.html` | 第三方 IP 查询 API 对比推荐页面 |
| `stats.html` | 网站统计面板，Chart.js 复合图表（折线+柱状） |
| `tracking.js` | 统一统计代码，聚合百度/Google/Cloudflare 三个平台，使用占位符 ID |
| `i18n.js` | 中英文切换引擎，支持浏览器语言检测和手动切换 |
| `components/header.html` | 页头导航栏组件（含语言切换按钮） |
| `components/footer.html` | 页尾组件（友情链接、备案号、统计代码） |
| `lang/zh-CN.json` | 中文翻译文件 |
| `lang/en.json` | 英文翻译文件 |

### 📁 data/ — 数据库

| 文件 | 格式 | 数据范围 |
|------|------|---------|
| `qqwry.ipdb` | IPIP 格式 | IPv4 + IPv6 综合地理位置 |
| `qqwry.dat` | 纯真 DAT 格式 | IPv4 地理位置 |
| `stats.json` | JSON | 网站统计数据 |

---

## API 路由一览

| 路由 | 功能 | 限流 |
|------|------|------|
| `GET /api/myip` | 获取访问者 IP | 120次/分钟 |
| `GET /api/location?q={ip}` | IP 查地理位置 | 120次/分钟 |
| `GET /api/mylocation` | 获取访问者地理位置 | 120次/分钟 |
| `GET /api/resolve4?q={domain}` | 域名解析 IPv4 | 30次/分钟 |
| `GET /api/resolve6?q={domain}` | 域名解析 IPv6 | 30次/分钟 |
| `GET /api/query?q={ip\|domain}` | 综合查询 | 30次/分钟 |
| `GET /api/info` | 数据库信息 | 120次/分钟 |
| `GET /api/status` | 数据库状态 | 120次/分钟 |
| `GET /api/stats?range=daily\|weekly\|monthly\|yearly` | 网站统计 | 120次/分钟 |
| `GET /api/recommend/ip-api?q={ip}` | ip-api.com 指定IP查询代理 | 120次/分钟 |
| `POST /api/batch` | 批量 IP 查询（≤50） | 120次/分钟 |
| `GET /health` | 健康检查 | 无限制 |

所有 API 支持 **JSON** 和 **纯文本（.txt 后缀 / ?format=txt）** 双格式。

---

## 安全架构

1. **CC 防护**（纯 Node 实现）— 单 IP 并发限制 + 突发连接检测 + 慢速攻击防御 + 自动封禁，支持 IP 黑白名单
2. **应用层限流**（`express-rate-limit`）— 按接口类型分级限流（普通 / DNS）
3. **安全头** — `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
4. **CORS** — 跨域访问控制

---

## 依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `express` | 4.18.2 | Web 框架 |
| `compression` | ^1.8.1 | HTTP 响应压缩中间件 |
| `dotenv` | ^16.4.0 | 环境变量加载（.env 文件） |
| `express-rate-limit` | ^8.5.2 | API 限流 |
| `ipdb` | 0.4.0 | IP 数据库解析引擎 |
| `node-cron` | ^3.0.2 | 定时任务（IP 库自动更新） |
| `qqwry.ipdb` | 2026.4.15 | 纯真 IP 数据库（npm 包） |
