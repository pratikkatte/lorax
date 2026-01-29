#
# Monorepo single-container image:
# - Website (static) served by nginx on :3000
# - Backend (FastAPI + Socket.IO) runs on 127.0.0.1:8080
# - nginx proxies /api/* and /api/socket.io/* to backend
#

# ===============================
# 1) Website build stage
# ===============================
FROM node:22 AS website-builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY packages/website ./packages/website

RUN npm ci
RUN VITE_API_BASE=/api npm --workspace packages/website run build

# ===============================
# 2) Runtime stage (python + nginx)
# ===============================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LORAX_MODE=local

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Ensure nginx uses our config only
RUN rm -rf /etc/nginx/sites-enabled /etc/nginx/sites-available && \
    mkdir -p /etc/nginx/conf.d

WORKDIR /app

# Install backend
COPY packages/backend ./backend
WORKDIR /app/backend
RUN pip install --no-cache-dir ".[prod]"

# Website static assets
COPY --from=website-builder /repo/packages/website/dist /usr/share/nginx/html

# Nginx config + entrypoint
WORKDIR /app
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Optional uploads mount point (recommended)
RUN mkdir -p /app/UPLOADS

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]

