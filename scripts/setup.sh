#!/usr/bin/env bash
# Wallet Backend Service — first-time local setup
# Usage: ./scripts/setup.sh
# Optional: POSTGRES_SUPERUSER=postgres ./scripts/setup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"

echo "==> Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required (20+)."; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "Error: Yarn 1.x is required."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "Error: PostgreSQL client (psql) is required."; exit 1; }

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Error: Node.js 20+ required (found $(node -v))."
  exit 1
fi

echo "==> Environment file..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example"
  echo "    Review JWT_SECRET and DB_* values before running in a shared environment."
else
  echo "    .env already exists — leaving unchanged"
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-wallet_user}"
DB_PASSWORD="${DB_PASSWORD:-wallet_password}"
DB_NAME="${DB_NAME:-wallet_db}"

echo "==> PostgreSQL database..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
  echo "    Database $DB_NAME is reachable as $DB_USERNAME"
else
  echo "    Creating user/database (superuser: $POSTGRES_SUPERUSER)..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_SUPERUSER" -d postgres -v ON_ERROR_STOP=1 -f scripts/setup-db.sql
fi

echo "==> Installing dependencies..."
yarn install

echo "==> Running database migrations..."
yarn migration:run

echo "==> Building application..."
yarn build

echo ""
echo "Setup complete."
echo ""
echo "Start the service:"
echo "  yarn start:prod            # compiled app (recommended after setup)"
echo "  yarn start:dev             # development with hot reload"
echo ""
echo "Swagger: http://localhost:${PORT:-3000}/swagger"
echo ""
echo "Run tests (stop the server first):"
echo "  yarn test"
