#!/usr/bin/env bash
# run_cleanup.sh
# Safely backup and remove rows in `user_ip_history` with NULL user_id
# Requires: psql and appropriate PG env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)

set -euo pipefail

TS=$(date +%Y%m%d%H%M%S)
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
CSV="$BACKUP_DIR/user_ip_history_null_user_id_$TS.csv"
SQL_FILE="./scripts/cleanup_user_ip_history.sql"

echo "Dumping rows with NULL user_id to $CSV"
psql -c "\copy (SELECT * FROM user_ip_history WHERE user_id IS NULL) TO '$CSV' CSV HEADER"

echo "Running cleanup SQL: $SQL_FILE"
psql -f "$SQL_FILE"

echo "Done. Backup at: $CSV"
