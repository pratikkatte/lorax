#!/bin/bash
set -e

# Lorax Backend VM Startup Script
# This script is run on VM startup to install Docker and start the backend container.
# Uses GCP Memorystore for Valkey/Redis Cluster (managed service).
#
# Usage: Set this script as the startup-script metadata when creating the VM:
#   --metadata-from-file startup-script=scripts/backend-startup.sh
#
# Required substitutions before deployment:
#   - PROJECT_ID: Your GCP project ID
#   - AR_REGION: Artifact Registry region where your Docker repo exists (e.g., us-west1)
#   - AR_REPO: Artifact Registry repository name (docker format), e.g. "lorax"
#   - REDIS_HOST: Memorystore Valkey/Redis cluster IP (e.g., 10.0.0.3)
#   - REDIS_CLUSTER: uses REDIS_HOST for the cluster endpoint
#   - GCS_BUCKET_NAME: Your GCS bucket name for tree files
#   - ALLOWED_ORIGINS: Your frontend domain(s)
#
# Memorystore setup (run once before VM creation):
#   gcloud redis instances create lorax-redis \
#     --size=1 \
#     --region=us-central1 \
#     --redis-version=redis_7_0 \
#     --network=default
#
#   # Get the IP address:
#   gcloud redis instances describe lorax-redis --region=us-central1 --format="get(host)"

echo "Starting Lorax backend setup..."

# Ensure we're running as root (startup scripts usually are, but this helps for manual testing)
if [ "$(id -u)" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

# Install Docker
apt-get update
apt-get install -y docker.io

# Create cache directory with proper permissions
mkdir -p /var/lorax/cache
chmod 755 /var/lorax/cache

# Pull and run the backend container
get_md () {
  curl -fsS -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1" 2>/dev/null || true
}

AR_REGION="$(get_md AR_REGION | tr -d '\r\n')"
AR_REPO="$(get_md AR_REPO | tr -d '\r\n')"
REDIS_HOST="$(get_md REDIS_HOST | tr -d '\r\n')"
GCS_BUCKET_NAME="$(get_md GCS_BUCKET_NAME | tr -d '\r\n')"
ALLOWED_ORIGINS="$(get_md ALLOWED_ORIGINS | tr -d '\r\n')"
PROJECT_ID="$(curl -fsS -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/project/project-id)"

if [ -z "$AR_REGION" ] || [ -z "$AR_REPO" ] || [ -z "$REDIS_HOST" ] || [ -z "$GCS_BUCKET_NAME" ] || [ -z "$ALLOWED_ORIGINS" ] || [ -z "$PROJECT_ID" ]; then
  echo "[ERROR] Missing required metadata. Ensure these instance metadata keys exist:"
  echo "  AR_REGION, AR_REPO, REDIS_HOST, GCS_BUCKET_NAME, ALLOWED_ORIGINS"
  echo "[ERROR] And project metadata provides PROJECT_ID."
  exit 1
fi

IMAGE_URI="${AR_REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/lorax-backend:latest"

# Authenticate Docker with Artifact Registry
gcloud auth configure-docker "${AR_REGION}-docker.pkg.dev" --quiet

# Pull and run the backend container
docker pull "$IMAGE_URI"

docker stop lorax-backend 2>/dev/null || true
docker rm lorax-backend 2>/dev/null || true

docker run -d --name lorax-backend --restart always \
  -p 8080:8080 \
  -e REDIS_CLUSTER="redis://${REDIS_HOST}:6379" \
  -e GCS_BUCKET_NAME="${GCS_BUCKET_NAME}" \
  -e LORAX_MODE=production \
  -e ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
  -e DISK_CACHE_DIR=/cache \
  -e DISK_CACHE_MAX_GB=50 \
  -e MAX_SOCKETS_PER_SESSION=5 \
  -v /var/lorax/cache:/cache \
  "$IMAGE_URI"

echo "Lorax backend started successfully"
