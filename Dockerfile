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

# Production default: gunicorn + uvicorn workers. Set WEB_CONCURRENCY to override worker count.
CMD ["python", "-m", "gunicorn", "-c", "/app/backend/gunicorn_config.py", "lorax.lorax_app:sio_app"]
