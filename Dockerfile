# ─── Docker Build ───
FROM node:18-bookworm-slim AS builder

WORKDIR /app

# 仅复制依赖清单，利用 Docker layer 缓存
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ─── Runtime ───
FROM node:18-alpine

LABEL org.opencontainers.image.title="IP Query Web"
LABEL org.opencontainers.image.description="纯真IP库在线查询系统 - 支持IPv4/IPv6/域名解析"
LABEL org.opencontainers.image.version="2.1.2"

# 安装运行时依赖（dns 工具等），使用国内镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache bind-tools curl ca-certificates tzdata

WORKDIR /app

# 从 builder 复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 复制应用代码
COPY package.json ./
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/
COPY cli.js ./

# 启动入口（Docker 中环境变量通过 compose 传入，无需 start.sh 加载 .env）
EXPOSE 6688
CMD ["node", "server.js"]
