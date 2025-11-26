# ===============================
# 1️⃣ Backend Build Stage
# ===============================
FROM python:3.11-slim AS python-builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /wheels
COPY requirements.txt .

RUN pip install --upgrade pip wheel && pip wheel --no-cache-dir -r requirements.txt

# RUN pip install --upgrade pip setuptools wheel && \
#     pip install --prefer-binary -r requirements.txt
    

# ===============================
# 2️⃣ Frontend Build Stage
# ===============================
FROM node:22 AS frontend-builder
WORKDIR /frontend

COPY frontend/ .


RUN yarn install --frozen-lockfile

RUN yarn build

# ===============================
# 3️⃣ Final Runtime Stage
# ===============================
FROM python:3.11-slim

# Install runtime deps: Nginx + curl + certs
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nginx curl ca-certificates && \
    # Disable Debian's default site configs
    sed -i 's|include /etc/nginx/sites-enabled/\*;|# include /etc/nginx/sites-enabled/*;|g' /etc/nginx/nginx.conf && \
    rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create directories
WORKDIR /app
RUN mkdir -p /app/uploads /var/www/html

# # Copy backend venv and app
# COPY --from=python-builder /opt/venv /opt/venv
# ENV PATH="/opt/venv/bin:$PATH"

COPY --from=python-builder /wheels /wheels
# RUN pip install --no-cache-dir /wheels/*
RUN find /wheels -name '*.whl' -print0 | xargs -0 pip install --no-cache-dir

# ENV PATH="/opt/venv/bin:$PATH"


COPY lorax/ /app/lorax/
# COPY uploads/ /app/uploads/
COPY gunicorn_config.py /app/
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

# Copy frontend built assets
COPY --from=frontend-builder /frontend/dist /var/www/html/

# Copy Nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

RUN rm -rf /etc/nginx/sites-enabled


EXPOSE 80 8080

ENTRYPOINT ["/app/entrypoint.sh"]

