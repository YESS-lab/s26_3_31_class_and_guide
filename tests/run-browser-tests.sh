#!/bin/bash
# Run Playwright browser tests, starting the Docker container if needed.
set -euo pipefail

CONTAINER_NAME="rocky-browser-test"
IMAGE_NAME="rocky-agent"
PORT=3099

cleanup() {
  echo "Cleaning up container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
}

# Check Docker daemon is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop first."
  exit 1
fi

# Build image if it doesn't exist or code changed
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Stop any existing test container
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Start container
echo "Starting container on port $PORT..."
docker run -d --name "$CONTAINER_NAME" -p "$PORT:3001" --env-file .env "$IMAGE_NAME" > /dev/null 2>&1

# Wait for server
echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  sleep 1
done

if ! curl -s "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
  echo "Server failed to start. Logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20
  cleanup
  exit 1
fi

# Run Playwright tests
trap cleanup EXIT
BASE_URL="http://localhost:$PORT" npx playwright test tests/browser-integration.spec.ts "$@"
