#!/usr/bin/env bash
# Dump diario de MySQL a /var/backups/mysql, gzip + retención de 7 días.
# Uso: cron en el VPS, corriendo desde /app (donde vive docker-compose.yml).
#   0 8 * * * /app/backend/scripts/backup-db.sh >> /var/log/mysql-backup.log 2>&1
#
# ponytail: sin alertas si falla — upgrade path: si el cron falla en silencio
# más de una vez, mandar el stderr a un webhook (Slack/email) en vez de solo loguear.
set -euo pipefail

BACKUP_DIR=/var/backups/mysql
RETENTION_DAYS=7
STAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cd "$(dirname "$0")/../.."

docker compose --env-file backend/.env exec -T db \
  sh -c 'exec mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/app_turnos_${STAMP}.sql.gz"

find "$BACKUP_DIR" -name 'app_turnos_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
