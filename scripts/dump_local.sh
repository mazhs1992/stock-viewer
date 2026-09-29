#!/usr/bin/env bash
# Dump the local Supabase database to a timestamped SQL file.
# Usage: ./scripts/dump_local.sh

set -euo pipefail

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DUMP_DIR="$(dirname "$0")/../backups"
mkdir -p "$DUMP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$DUMP_DIR/local_${TIMESTAMP}.sql"

pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --data-only \
  > "$DUMP_FILE"

echo "Dump saved to $DUMP_FILE ($(wc -c < "$DUMP_FILE" | tr -d ' ') bytes)"
