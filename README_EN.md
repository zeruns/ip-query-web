# IP Query Web — Online IP Geolocation & Client IP Query

<p align="center">
  <strong>Precise IP geolocation service powered by CZ88.NET IP database</strong><br>
  Supports IPv4 / IPv6 / Domain Resolution · Dual-format API (JSON + TXT) · Dark Web UI · Bilingual (Chinese/English)
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#api-endpoints">API Docs</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#security">Security</a>
</p>

---

## Overview

**ip-query-web** is an online IP geolocation query system based on the CZ88.NET IP database (qqwry.ipdb). Use it to:

- **Query IP geolocation** — Look up any IPv4/IPv6 address to get country, province, city, district, and ISP information
- **Domain resolution** — Automatically resolve A/AAAA records and query geolocation for each resolved IP
- **Get client IP** — Retrieve the visitor's real source IP via `/api/myip` or `/api/mylocation`
- **Batch query** — Query up to 50 IP addresses in a single POST `/api/batch` request
- **API service** — RESTful API with JSON and plaintext dual-format support, easy integration into applications
- **Website statistics** — Built-in PV and API call statistics dashboard with Chart.js charts (daily/weekly/monthly/yearly)
- **Auto-update** — Automatically fetches the latest IP database from GitHub every Monday at 3:00 AM
- **Bilingual UI** — Supports Chinese / English interface switching with automatic browser language detection
- **CLI tool** — `node cli.js <IP/domain>` for direct terminal queries

### Use Cases

- Identifying website visitor locations (Nginx reverse proxy supports real IP identification with Cloudflare/Aliyun CDN)
- Providing IP geolocation API for other applications
- Custom query tools or automation scripts
- Learning Node.js/Express web development and project architecture

## Quick Start

### Method 1: Bare Metal (Recommended)

```bash
# Requires Node.js 18+
git clone https://github.com/zeruns/ip-query-web.git
cd ip-query-web
npm install --production
cp .env.example .env
node server.js
```

### Method 2: Docker

```bash
docker compose up -d --build
```

### Method 3: aaPanel (BT Panel)

Add a Node.js project in aaPanel, with start command `node server.js` and port 6688.

## Access

| URL | Description |
|------|------|
| `http://localhost:6688` | Main query interface |
| `http://localhost:6688/api-docs.html` | API documentation (online testing) |
| `http://localhost:6688/stats.html` | Website statistics (Chart.js charts) |

## Live Demo

🔗 [https://ip-query.zeruns.com/](https://ip-query.zeruns.com/)

## Features

- **IPv4 / IPv6 dual-stack** — Geolocation queries for both protocols
- **Domain resolution** — Auto-resolve A/AAAA records and query each resolved IP
- **Dual-format API** — JSON and plaintext (`.txt`) output for different scenarios
- **Dark web UI** — Built-in query page, API docs, and statistics dashboard
- **Bilingual (Chinese/English)** — Interface language switching with automatic browser language detection
- **CLI tool** — `node cli.js <IP/domain>` for terminal queries
- **Auto-updating IP database** — Auto-fetches latest CZ88.NET IP database every Monday at 3:00 AM (supports GitHub mirror acceleration)
- **Website statistics** — PV and API call tracking with Chart.js visualization
- **Three-layer security** — CC protection + tiered rate limiting + security headers

## API Endpoints

All endpoints support JSON and plaintext (`.txt` suffix or `?format=txt`) dual format.

| Endpoint | Description | Rate Limit (req/min) |
|------|------|:---:|
| `GET /api/query?q=<IP or domain>` | Comprehensive query (recommended, supports IP and domain) | 30 |
| `GET /api/myip` | Get client IP address (from request headers) | 120 |
| `GET /api/location?q=<IP>` | Query IP geolocation (IP only) | 120 |
| `GET /api/mylocation` | Get visitor source IP and geolocation | 120 |
| `GET /api/resolve4?q=<domain>` | Resolve domain IPv4 addresses | 30 |
| `GET /api/resolve6?q=<domain>` | Resolve domain IPv6 addresses | 30 |
| `GET /api/info` | Database version info | 120 |
| `GET /api/status` | Database status (availability check) | 120 |
| `GET /api/stats?range=daily\|weekly\|monthly\|yearly` | Website statistics | 120 |
| `POST /api/batch` | Batch IP query (max 50) | 120 |
| `GET /health` | Health check (unlimited) | ∞ |

### Usage Examples

```bash
# JSON format — comprehensive query (supports IP and domain)
curl http://localhost:6688/api/query?q=8.8.8.8

# Plaintext format
curl http://localhost:6688/api/query.txt?q=8.8.8.8

# Get client IP
curl http://localhost:6688/api/myip

# Batch query
curl -X POST http://localhost:6688/api/batch \
  -H "Content-Type: application/json" \
  -d '{"ips":["8.8.8.8","1.1.1.1","2001:4860:4860::8888"]}'
```

## CLI Tool

```bash
node cli.js 114.114.114.114     # Query IP geolocation
node cli.js blog.zeruns.com     # Query domain (resolve + geolocation)
node cli.js -6 ipv6.google.com  # Force IPv6
```

## Configuration

All configuration is managed via environment variables or `.env` file. Source code configuration is in `src/config.js`. See `.env.example` for the complete template.

```bash
cp .env.example .env   # Copy default config
vim .env               # Edit as needed
```

### Server Configuration

| Variable | Default | Description |
|------|--------|------|
| `PORT` | `6688` | Server port |
| `HOST` | `::` | Listen address: `::` = dual-stack (recommended), `0.0.0.0` = IPv4 only, `127.0.0.1` = local only |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

### Rate Limit Configuration

| Variable | Default | Description |
|------|--------|------|
| `RATE_LIMIT_MAX` | `120` | Standard API rate limit (req/min/IP) |
| `RATE_LIMIT_DNS` | `30` | Domain query rate limit (involves DNS resolution, stricter) |

### CC Protection Configuration

| Variable | Default | Description |
|------|--------|------|
| `CC_MAX_CONCURRENT` | `20` | Max concurrent connections per IP, exceeded triggers auto-ban |
| `CC_BURST_WINDOW` | `2000` | Burst detection window (milliseconds) |
| `CC_BURST_MAX` | `40` | Max new connections within burst window |
| `CC_SLOW_TIMEOUT` | `15000` | Slow attack timeout (ms), incomplete requests past this time treated as attacks |
| `CC_BLOCK_DURATION` | `60000` | Auto-ban duration (ms), default 60 seconds |
| `CC_WHITELIST` | empty | IP whitelist (comma-separated), whitelisted IPs are unrestricted |
| `CC_BLACKLIST` | empty | IP blacklist (comma-separated), permanently blocked |

### DNS and Network Configuration

| Variable | Default | Description |
|------|--------|------|
| `PUBLIC_DNS` | `8.8.8.8,8.8.4.4` | Public DNS servers for domain resolution (comma-separated, tried in order) |
| `PUBLIC_IP_SOURCES` | `https://ipinfo.io/ip,https://api.ipify.org,https://checkip.amazonaws.com` | Public IP detection sources (comma-separated, fastest response wins) |

### IP Database Update Configuration

| Variable | Default | Description |
|------|--------|------|
| `GITHUB_MIRROR` | `https://gh-proxy.com/` | GitHub mirror acceleration URL. Required for mainland China servers, leave empty for direct connection |
| `DATA_DIR` | `./data` | IP database and statistics file directory |

### HTTPS Configuration

| Variable | Default | Description |
|------|--------|------|
| `SSL_KEY` | empty | SSL private key file path, enables HTTPS when set |
| `SSL_CERT` | empty | SSL certificate file path |

> Leave these commented out if using Nginx/Caddy reverse proxy for SSL termination.

### Site Info Configuration (Static Files)

> The following items are configured by modifying static HTML files:

| Setting | File | Description |
|------|--------|------|
| Site URL | HTML pages `<meta name="site-url">` | SEO canonical URL |
| ICP filing number | `public/components/footer.html` | Footer filing link |
| SEO title/description/keywords | HTML pages `<title>`, `<meta name="description">`, `<meta name="keywords">` | Search engine optimization |

### Example `.env`

```bash
# Server port
PORT=6688

# Recommended for mainland China servers
GITHUB_MIRROR=https://gh-proxy.com/

# Relaxed rate limits (high concurrency)
RATE_LIMIT_MAX=300
RATE_LIMIT_DNS=60

# Relaxed CC protection
CC_MAX_CONCURRENT=50
CC_BLOCK_DURATION=30000
```

## Security

The system has built-in three-layer protection, ready for public deployment:

| Layer | Implementation | Function |
|:---:|------|------|
| 1 | CC Protection (pure Node) | Connection limiting + burst detection + slow attack defense + auto-ban + IP whitelist/blacklist |
| 2 | express-rate-limit | Tiered rate limiting by endpoint type (standard / DNS resolution) |
| 3 | Security Headers | `X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`, `Referrer-Policy`, CORS |

## Nginx Reverse Proxy

It is recommended to put Nginx in front for SSL termination:

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

### CDN Compatibility

The system intelligently identifies the real client IP via `getClientIP()`, prioritized from highest to lowest:

| CDN / Proxy | Header | Auto-detected |
|-----------|-------|:---:|
| Cloudflare | `CF-Connecting-IP` | ✓ |
| Cloudflare / Aliyun / Google Cloud | `True-Client-IP` | ✓ |
| Aliyun CDN | `Ali-CDN-Real-IP` | ✓ |
| Nginx reverse proxy | `X-Real-IP` | ✓ |
| Generic | `X-Forwarded-For` (first value) | ✓ |

> **Two-step configuration required when using CDN:**

> **1. CDN side — Enable real IP passthrough:**
>
> * **Aliyun ESA** (Method 1, recommended): ESA Console → Site → **Rules → Transform Rules → Managed Transforms** → Enable "Add real client IP header", default header name `ali-real-client-ip`.
> * **Aliyun ESA** (Method 2): **Rules → Transform Rules** → Add a request header rule to pass the real client IP via `X-Forwarded-For`.
> * **Cloudflare**: Enabled by default, no extra configuration needed.
>
> **2. Nginx side — Trust proxy IPs:**
>
> ```nginx
> server {
>     set_real_ip_from 0.0.0.0/0;
>     real_ip_header X-Forwarded-For;
>     real_ip_recursive on;
>
>     location / {
>         proxy_pass http://127.0.0.1:6688;
>         proxy_set_header X-Real-IP $remote_addr;
>         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
>         ...
>     }
> }
> ```
>
> Change `real_ip_header` to `CF-Connecting-IP` for Cloudflare users.

## Third-Party API Recommendations

In addition to self-hosted services, you can also use these third-party IP query APIs: [Third-Party API Recommendations](https://ip-query.zeruns.com/api-recommend.html)

## Project Structure

```
├── server.js              # Express server entry point
├── cli.js                 # CLI query tool
├── package.json           # Project config & dependencies
├── .env.example           # Environment variable template
├── LICENSE                # GPL-3.0 license
├── src/
│   ├── config.js          # Unified configuration layer
│   ├── ipdb.js            # IP database query engine
│   ├── updater.js         # Auto-update (supports mirror acceleration)
│   ├── ccProtection.js    # CC protection middleware
│   ├── stats.js           # Website statistics module
│   └── classifier.js      # Smart field classifier
├── public/
│   ├── index.html         # Main query page (dark theme)
│   ├── api-docs.html      # API documentation (online testing)
│   ├── api-recommend.html # Third-party API comparison
│   ├── stats.html         # Statistics dashboard (Chart.js)
│   ├── i18n.js            # Bilingual (Chinese/English) switching
│   ├── favicon.ico        # Favicon
│   ├── favicon.png        # Favicon
│   └── components/        # Header/footer components
└── data/                  # IP database & statistics data
```

## Requirements

- **Node.js** 18+
- **RAM** 256MB+
- **Storage** ~150MB (including ~40MB IP database)
- **OS** Linux / macOS / Windows (WSL)

## Data Source

IP geolocation data comes from [CZ88.NET IP Database](https://github.com/nmgliangwei/qqwry.ipdb), distributed via the npm package `qqwry.ipdb`. Auto-updates every Monday at 3:00 AM.

## Author

[Zeruns's Blog](https://blog.zeruns.com/)

## VPS/Cloud Server Recommendations

Need a server to deploy this project? Check out these recommendations:

👉 [VPS/Cloud Server Recommendations](https://blog.vpszj.cn/archives/41.html)

## Recommended Reading

- **Affordable VPS/Cloud Server Recommendations:** [https://blog.zeruns.com/archives/383.html](https://blog.zeruns.com/archives/383.html)
- Minecraft Server Tutorial: [https://blog.zeruns.com/tag/mc/](https://blog.zeruns.com/tag/mc/)
- Cross-Border E-Commerce WordPress Guide: [https://blog.zeruns.com/archives/889.html](https://blog.zeruns.com/archives/889.html)
- Hermes Agent Deployment Guide: [https://blog.zeruns.com/archives/939.html](https://blog.zeruns.com/archives/939.html)
- Aliyun ESA (CDN) Review: [https://blog.zeruns.com/archives/920.html](https://blog.zeruns.com/archives/920.html)
- Discourse Forum Setup Tutorial: [https://blog.zeruns.com/archives/919.html](https://blog.zeruns.com/archives/919.html)

## License

[GNU General Public License v3.0](LICENSE)
