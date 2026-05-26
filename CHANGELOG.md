# 更新日志

本文档记录 ip-query-web 项目的主要版本更新内容。

---

## v2.2.0 (2026-05-27)

### 性能优化

- **服务端 IP 查询 LRU 缓存**：1000 条/30 分钟 TTL，重复查询命中 <1ms
- **Express 升级**：4.18.2 → 4.21.x，修复 CVE-2024-45590 安全漏洞
- **静态资源缓存**：`maxAge: 1d`（HTML 除外），减少 30% 无效条件请求
- **ccProtection 内存泄漏修复**：`activeConns` Map 每 10s 清理 60s+ 死连接
- **tracking.js 异步加载**：`<script async>` 消除渲染阻塞
- **ip-api 代理连接池**：`keepAlive Agent` + 1 次超时重试
- **fs.existsSync 优化**：仅缓存未命中时检查文件存在
- **DNS 解析超时控制**：`Promise.race` 5s 单次超时，防止级联阻塞

---

## v2.1.13 (2026-05-27)

### 新功能

- **全页面 QPS 限流**：新增 `pageLimiter` 中间件覆盖静态页面（`RATE_LIMIT_PAGE=120`）
- **IPv4/IPv6 双库分离**：IPv4 使用 `lib-qqwry` 解析 `qqwry.dat`，IPv6 使用 `ipdb` 解析 `qqwry.ipdb`

### 修复

- IPIP.NET 错误提示 I18N 未加载时显示原始 key 的问题（增加硬编码 fallback）

### 文档

- 优化中英文 README、`.env.example` 等文档

---

## v2.1.12 (2026-05-26)

### 修复

- **ipapi.is** 字段解析修正：从 `location` 嵌套对象中正确提取 country/region/city/lat/lon/timezone

### 文档

- 优化项目专属 skill，更新 API 路由表

---

## v2.1.11 (2026-05-26)

### 新功能

- **ip-api.com 服务端代理**：查自身 IP 时用 `getClientIP` 获取用户真实 IP 后转发，响应 `query` 字段为用户 IP，不暴露服务器公网 IP；手动输入 IP 时直接转发

---

## v2.1.10 (2026-05-26)

### 修复

- 彻底移除 `/api/recommend` 代理端点，确认所有第三方 API 仅在客户端调用

---

## v2.1.9 (2026-05-26)

### 修复

- ip-api.com 支持指定 IP 查询代理，移除本站 API 卡片
- 移除第三方 API 列表中的"本站（纯真IP库）"卡片

---

## v2.1.8 (2026-05-26)

### 修复

- 回滚 ip-api.com 服务端代理，改为前端 HTTPS 页面检测后直接提示不可用

---

## v2.1.7 (2026-05-26)

### 修复

- 添加 ip-api.com 服务端代理，解决免费版仅支持 HTTP 在 HTTPS 页面的混合内容拦截

---

## v2.1.6 (2026-05-26)

### 修复

- 修正 freeipapi.com 302 跨域重定向导致的 CORS 失败（改用 `free.freeipapi.com` 直连）
- IPIP.NET 添加 `selfOnly` 标记，手动输入 IP 时直接提示不支持
- 更新 freeipapi 限频说明为 60次/分钟

---

## v2.1.5 (2026-05-26)

### 新功能

- **统计代码集中化重构**：新增 `public/tracking.js` 统一管理百度/Google/Cloudflare 统计
- 4 个 HTML 页面改用 `<script src="/tracking.js">` 替代内联百度统计脚本
- `footer.html` 移除重复的统计脚本
- 统计 ID 在开发目录使用占位符，生产目录使用真实 ID

---

## v2.1.4 及更早版本

<details>
<summary>展开查看更多</summary>

### v2.1.4 (2026-05-26)

- 文档审计修正：版本号统一、清理未使用配置、CDN 表补充、路由注释修正
- 百度统计移入 `<head>` 中加载，dev 用 `YOUR_ID` 占位
- Referrer-Policy 改为 `strict-origin-when-cross-origin`
- 移除 git 中的统计追踪 ID，改为占位注释

### v2.1.3 (2026-05-26)

- 统计分析代码注入方案：Express 中间件在 HTML 响应前自动插入追踪代码

### v2.1.2 (2026-05-26)

- Docker 部署完善：V1/V2 兼容、Alpine 国内镜像、`GITHUB_MIRROR` 环境变量
- 修复双栈监听时 IPv4 被映射为 `::ffff:` 格式的问题

### v2.1.0 (2026-05-25)

- 修复部署问题：添加 `dotenv` 自动加载 `.env`、修正 `start.sh`、优化 Dockerfile

### v2.0.0 (2026-05-23)

- 全新模块化架构：IP 库查询引擎、CC 防护、自动更新、中英文双语
- 基于纯真 IP 数据库（qqwry.ipdb）的在线查询系统
- RESTful API 支持 JSON 和纯文本双格式
- 暗色 Web 界面，Chart.js 统计面板

</details>
