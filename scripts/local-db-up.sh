#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Docker is required for local MySQL setup.

Install Docker Desktop or Colima, then run:
  npm run local-db:up

Expected local database URL:
  mysql://essay_master:essay_master@127.0.0.1:3307/essay_master
EOF
  exit 1
fi

docker compose -f docker-compose.local-db.yml up -d

echo "Waiting for local MySQL to become healthy..."
for _ in $(seq 1 60); do
  status="$(docker inspect --format='{{.State.Health.Status}}' essay-master-local-mysql 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    echo "Local MySQL is healthy."
    break
  fi
  sleep 2
done

status="$(docker inspect --format='{{.State.Health.Status}}' essay-master-local-mysql 2>/dev/null || true)"
if [ "$status" != "healthy" ]; then
  echo "Local MySQL did not become healthy in time. Check logs with: npm run local-db:logs" >&2
  exit 1
fi

npm run db:migrate

echo "Local DB is ready."
