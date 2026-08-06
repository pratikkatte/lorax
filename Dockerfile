FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install from the same metadata used to publish the wheel. This avoids the
# former backend requirements file pulling unrelated ML/NLP dependencies into
# the image.
COPY pyproject.toml /app/pyproject.toml
COPY packages/app /app/packages/app
COPY packages/backend /app/packages/backend
RUN pip install --no-cache-dir ".[prod]"

EXPOSE 8080

# Production default: gunicorn + uvicorn workers. Set WEB_CONCURRENCY to override worker count.
CMD ["python", "-m", "gunicorn", "-c", "/app/packages/backend/gunicorn_config.py", "lorax.lorax_app:sio_app"]
