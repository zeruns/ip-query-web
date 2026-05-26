# ip-query-web 项目专属 Skill

## 项目简介

**ip-query-web** 是一个基于 Node.js/Express 的 IP 地理信息在线查询 Web 服务，使用纯真 IP 库（qqwry.ipdb）提供 IPv4/IPv6 归属地查询、域名 DNS 解析等功能。

- **技术栈**: Node.js 18+ / Express 4.18.2 / ipdb 0.4.0 / qqwry.ipdb / Chart.js
- **许可证**: GPL-3.0
- **作者**: zeruns
- **GitHub**: https://github.com/zeruns/ip-query-web
- **Gitee**: https://gitee.com/zeruns/ip-query-web
- **生产地址**: https://ip-query.zeruns.com

## 目录结构（双目录模式）

| 目录 | 用途 | Git |
|------|------|-----|
| `/www/wwwroot/ip-query-web/` | **生产目录** — 实际运行环境 | 无 .git |
| `/www/wwwroot/ip-query-web-dev/` | **开发目录** — Git 仓库，提交推送 | master 分支，remote: gitee + github |

## 修改流程

必须严格遵循以下顺序：

1. **在开发目录修改** (`/www/wwwroot/ip-query-web-dev/`)
2. 根据修改类型递增版本号（见下方版本规则）
3. 更新相关文档（README.md、STRUCTURE.md 等）
4. 提交代码并推送到 Gitee 和 GitHub
5. **同步到生产目录** (`/www/wwwroot/ip-query-web/`)

## 版本号规则

版本号格式：`主版本.次版本.修订号`（语义化版本 SemVer）

| 修改类型 | 递增位 | 示例 |
|----------|--------|------|
| Bug 修复（fix） | 修订号 +1 | 2.1.5 → 2.1.6 |
| 新功能（feat） | 次版本号 +1 | 2.1.6 → 2.2.0 |
| 破坏性变更 | 主版本号 +1 | 2.1.6 → 3.0.0 |
| 文档/配置/chore | 修订号 +1 | 2.1.5 → 2.1.6 |

版本号需要在以下三个文件中同步更新：
- `package.json` → `"version": "x.y.z"`
- `src/config.js` → `version: 'x.y.z'`
- `server.js` → `console.log('... vx.y.z ...')`

## 敏感信息保护

以下信息**严禁**出现在开发目录（Git 仓库）中，仅存在于生产目录：

| 类型 | 内容 | 生产目录 | 开发目录 |
|------|------|----------|----------|
| 统计代码 | 百度统计 ID、Google Analytics ID、Cloudflare Token | 真实 ID | 占位符（YOUR_XXX） |
| 环境配置 | .env（含 IP 白名单、ICP 备案号等） | 真实配置 | 仅模板 .env.example |
| 数据文件 | data/ 目录（IP 数据库、统计 JSON） | 真实数据 | 不提交（.gitignore） |

### 统计代码处理

- 生产目录：`public/tracking.js` 包含真实统计 ID
- 开发目录：`public/tracking.js` 使用占位符 `YOUR_BAIDU_ID` / `YOUR_GA_ID` / `YOUR_CF_TOKEN` 并附注释说明格式
- 开发目录的追踪代码为模板，供开发者替换后使用

### .gitignore 关键规则

```
.env
data/
node_modules/
```

## 提交规范

### 提交信息格式

使用中文描述，遵循 Conventional Commits 风格：

```
<type>: <简短中文描述>

<详细说明（可选）>
```

### 常用 type

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/配置变更 |

### 推送目标

每次提交后需同时推送到两个远程仓库：
```bash
git push gitee master && git push github master
```

## 项目架构

### 后端模块 (`src/`)

| 文件 | 功能 |
|------|------|
| `config.js` | 统一配置层（环境变量 → 配置对象） |
| `ipdb.js` | IP 库查询引擎（查询 + DNS 解析 + 缓存） |
| `updater.js` | 数据库自动更新（每周一 03:00） |
| `ccProtection.js` | CC 防护中间件 |
| `stats.js` | 服务端 PV/API 统计 |
| `classifier.js` | 纯真 IP 库智能分类器 |

### 前端页面 (`public/`)

| 文件 | 功能 |
|------|------|
| `index.html` | 主查询页面 |
| `api-docs.html` | API 文档页 |
| `api-recommend.html` | 第三方 API 推荐/对比页 |
| `stats.html` | 统计面板（Chart.js） |
| `i18n.js` | 中英文切换引擎 |
| `tracking.js` | 统一统计代码（百度/Google/Cloudflare） |
| `components/header.html` | 导航栏组件 |
| `components/footer.html` | 页尾组件 |

### 语言文件

- `public/lang/zh-CN.json` — 中文翻译
- `public/lang/en.json` — 英文翻译

修改页面文案时需同时更新两个语言文件。

## 相关 Skill

本 Skill 提供项目背景和开发规范。涉及具体操作时可配合以下系统 Skill：

- `/commit` — 提交代码（自动生成规范的中文 commit message）
- 搜索相关 skill 时优先查找本项目 `.codebuddy/skills/` 目录
