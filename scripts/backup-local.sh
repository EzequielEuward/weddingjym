#!/usr/bin/env bash
set -euo pipefail

# Respaldo local rápido para Arch Linux (PostgreSQL + carpeta de fotos)
# Uso: ./scripts/backup-local.sh [directorio_destino]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${1:-${PROJECT_ROOT}/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

mkdir -p "${TARGET_DIR}"

echo "==> Exportando base de datos PostgreSQL..."
docker exec wedding-postgres pg_dump -U "${POSTGRES_USER:-wedding}" "${POSTGRES_DB:-wedding}" | gzip > "${TARGET_DIR}/wedding_db.sql.gz"

echo "==> Copiando fotos subidas..."
if [ -d "${PROJECT_ROOT}/data/photos" ]; then
  cp -a "${PROJECT_ROOT}/data/photos" "${TARGET_DIR}/photos"
fi

echo "==> Backup completado en: ${TARGET_DIR}"
