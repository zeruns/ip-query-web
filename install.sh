#!/bin/bash
# ══════════════════════════════════════════════════════════
#  IP Query Web — 一键安装脚本
#  支持：Linux (x86_64 / ARM64 / ARMv7) / macOS
#  可选部署模式：Systemd / Docker / PM2 / 裸启动
#  通用设计，任何服务器上都能用
# ══════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BLUE='\033[0;34m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}==>${NC} $1"; }

# ─── 检测系统 ───
ARCH=$(uname -m)
OS=$(uname -s)

case "$ARCH" in
  x86_64|amd64)   ARCH_NAME="x86_64 (AMD64)" ;;
  aarch64|arm64)  ARCH_NAME="ARM64" ;;
  armv7l|armhf)   ARCH_NAME="ARMv7" ;;
  armv6l)         ARCH_NAME="ARMv6" ;;
  *)              ARCH_NAME="$ARCH" ;;
esac

echo "=========================================="
echo "  IP 归属地查询系统 v2.0"
echo "  一键安装脚本"
echo "=========================================="
echo ""
log_info "系统: $OS  |  架构: $ARCH_NAME"
echo ""

# ─── 检测 Node.js ───
log_step "检测 Node.js 环境..."
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    log_info "Node.js $NODE_VER 已安装"
else
    log_warn "未检测到 Node.js，尝试自动安装..."
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    elif command -v brew &> /dev/null; then
        brew install node@18
    else
        log_error "无法自动安装 Node.js，请手动安装后重试"
        log_info "下载: https://nodejs.org/"
        exit 1
    fi
    NODE_VER=$(node --version)
    log_info "Node.js $NODE_VER 安装完成"
fi

# ─── 进入项目目录 ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── 数据目录 ───
log_step "准备数据目录..."
mkdir -p ./data
cp -n .env.example .env 2>/dev/null || true
log_info "数据目录: $(pwd)/data"
log_info "配置文件: $(pwd)/.env $( [ -f .env ] && echo '(已存在)' || echo '(已创建，请编辑)' )"

# ─── 安装 Node.js 依赖 ───
log_step "安装项目依赖..."
npm install --production 2>&1 | tail -3
log_info "依赖安装完成"

# ─── 选择部署模式 ───
echo ""
echo "请选择部署方式:"
echo "  1) Systemd 服务 (推荐，Linux 系统)"
echo "  2) Docker 容器 (需要 Docker)"
echo "  3) PM2 进程管理 (需要 pm2)"
echo "  4) 仅启动 (前台运行)"
echo ""
read -p "请输入 [1-4] (默认: 1): " DEPLOY_MODE
DEPLOY_MODE="${DEPLOY_MODE:-1}"

case "$DEPLOY_MODE" in
  1)
    log_step "配置 Systemd 服务..."
    mkdir -p /etc/systemd/system
    cat > /etc/systemd/system/ip-query.service << EOF
[Unit]
Description=IP 归属地查询系统
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
EnvironmentFile=-${SCRIPT_DIR}/.env
ExecStart=$(which node) ${SCRIPT_DIR}/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable ip-query
    systemctl restart ip-query
    log_info "Systemd 服务已创建并启动: ip-query"
    log_info "  查看日志: journalctl -u ip-query -f"
    ;;

  2)
    log_step "配置 Docker 部署..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    docker compose up -d --build
    log_info "Docker 容器已启动"
    log_info "  查看日志: docker logs -f ip-query-web"
    ;;

  3)
    log_step "配置 PM2..."
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    pm2 start server.js --name ip-query-web
    pm2 save
    pm2 startup
    log_info "PM2 已启动: ip-query-web"
    log_info "  查看状态: pm2 status"
    log_info "  查看日志: pm2 logs ip-query-web"
    ;;

  4)
    log_step "前台启动..."
    echo ""
    echo "按 Ctrl+C 停止"
    exec node server.js
    ;;
esac

# ─── 完成提示 ───
echo ""
echo "=========================================="
echo -e "${GREEN}  安装/启动完成!${NC}"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  http://localhost:6688"
echo "  http://<本机IP>:6688"
echo ""
echo "命令行查询:"
echo "  node cli.js 114.114.114.114"
echo "  node cli.js -6 ipv6.google.com"
echo ""
echo "配置文件:"
echo "  $(pwd)/.env  — 修改后重启服务生效"
echo ""
echo "=========================================="
