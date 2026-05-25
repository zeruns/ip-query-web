#!/bin/bash
# ════════════════════════════════════════════════
#  IP Query Web — 通用启动脚本
#  支持：裸机 (Node.js) / Docker 环境
#  自动加载 .env，自动安装依赖，自动创建 data 目录
# ════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─── 加载 .env（如果有） ───
if [ -f .env ]; then
  echo "[start.sh] 加载配置: .env"
  set -a
  . ./.env
  set +a
fi

# ─── 默认值（仅当环境变量未设置时生效） ───
: "${PORT:=6688}"
: "${HOST:=::}"
: "${DATA_DIR:=./data}"

# ─── 数据目录 ───
mkdir -p "$DATA_DIR"

# ─── 安装依赖（Docker 中已有 node_modules，此步骤会跳过） ───
if [ ! -d node_modules ]; then
  echo "[start.sh] 安装 Node.js 依赖..."
  npm install --production
fi

# ─── 启动信息 ───
echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║      IP 归属地查询系统 v2.0               ║"
echo "  ║      纯真IP库 · IPv4/IPv6/域名解析         ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""
echo "  服务地址:  http://${HOST}:${PORT}"
echo "  数据目录:  ${DATA_DIR}"
echo "  限流配置:  ${RATE_LIMIT_MAX:-120}次/分钟 (普通) / ${RATE_LIMIT_DNS:-30}次/分钟 (DNS)"
echo "  DNS 服务器: ${PUBLIC_DNS:-8.8.8.8,8.8.4.4}"
echo ""

# ─── 启动 ───
exec node server.js
