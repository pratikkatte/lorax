FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for certain Python packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend package and install
COPY . .
RUN pip install -e ".[prod]"

# Create cache directory
RUN mkdir -p /cache

ENV PORT=8080
EXPOSE 8080

CMD ["lorax", "serve", "--gunicorn", "--workers", "2", "--host", "0.0.0.0", "--port", "8080"]
