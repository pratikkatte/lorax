#
# Single Dockerfile with two targets:
# - backend (GCP): backend-only image on :8080
# - full (default): website + backend via nginx on :3000
#

# ===============================
# 1) Website build stage (full image only)
# ===============================
FROM node:22 AS website-builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY packages/website ./packages/website

RUN npm ci
RUN VITE_API_BASE=/api npm --workspace packages/website run build

# ===============================
# 2) Backend runtime stage (backend target)
# ===============================
FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies (use requirements.txt; packaging lives at repo root)
COPY packages/backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Backend source (run directly from source)
COPY packages/backend /app/backend
ENV PYTHONPATH=/app/backend

EXPOSE 8080

CMD ["python", "-m", "lorax.cli", "serve", "--gunicorn", "--workers", "2", "--host", "0.0.0.0", "--port", "8080"]

# ===============================
# 3) Full runtime stage (default target)
# ===============================
FROM backend AS full

ENV LORAX_MODE=local

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx curl && \
    rm -rf /var/lib/apt/lists/*

# Ensure nginx uses our config only
RUN rm -rf /etc/nginx/sites-enabled /etc/nginx/sites-available && \
    mkdir -p /etc/nginx/conf.d

# Website static assets
COPY --from=website-builder /repo/packages/website/dist /usr/share/nginx/html

# Nginx config + entrypoint
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Optional uploads mount point (recommended)
RUN mkdir -p /app/UPLOADS

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
