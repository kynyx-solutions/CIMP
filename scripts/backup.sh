#!/usr/bin/env bash
# Back up the portal database (and, with local storage, the uploaded files).
#
#   scripts/backup.sh                 # docker-compose stack: dumps from the `db` service
#   DATABASE_URL=... scripts/backup.sh --direct   # any reachable PostgreSQL (needs pg_dump)
#
# Writes backups/cimp-<timestamp>.dump (pg_dump custom format) and, when the uploads volume is
# used, backups/uploads-<timestamp>.tar.gz. Keeps the newest $KEEP_DAYS days (default 14).
# Schedule it daily, e.g. cron:  30 1 * * *  cd /srv/cimp && scripts/backup.sh >> backups/backup.log 2>&1
# Copy the backups folder off the server (S3, another machine): a backup on the same disk is not a backup.
#
# Restore (stops nothing by itself; take the app down first):
#   docker compose --env-file .env.production stop app
#   docker compose --env-file .env.production exec -T db pg_restore -U cimp -d cimp --clean --if-exists < backups/cimp-<ts>.dump
#   docker compose --env-file .env.production start app
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${BACKUP_DIR:-backups}
KEEP_DAYS=${KEEP_DAYS:-14}
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
COMPOSE=(docker compose --env-file .env.production)

if [[ "${1:-}" == "--direct" ]]; then
  : "${DATABASE_URL:?DATABASE_URL is required with --direct}"
  pg_dump --format=custom --no-owner --dbname="${DATABASE_URL%%\?*}" > "$OUT/cimp-$TS.dump"
else
  "${COMPOSE[@]}" exec -T db pg_dump -U cimp -d cimp --format=custom --no-owner > "$OUT/cimp-$TS.dump"
  # Uploaded files live in the app's `uploads` volume unless STORAGE_DRIVER=s3
  if ! grep -q '^STORAGE_DRIVER=s3' .env.production 2>/dev/null; then
    "${COMPOSE[@]}" exec -T app tar -czf - -C /data uploads > "$OUT/uploads-$TS.tar.gz"
  fi
fi

# A dump that is empty or unreadable is a failed backup
[[ -s "$OUT/cimp-$TS.dump" ]] || { echo "Backup failed: empty dump" >&2; exit 1; }
find "$OUT" -maxdepth 1 \( -name 'cimp-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $OUT/cimp-$TS.dump ($(du -h "$OUT/cimp-$TS.dump" | cut -f1))"
