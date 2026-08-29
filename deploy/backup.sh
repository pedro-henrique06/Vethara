#!/usr/bin/env bash
# Dump diário do banco, com rotação. Perder o banco é perder todos os personagens —
# é o fim de um OT, e não tem como reconstruir.
#
# Instale no cron do VPS:
#   crontab -e
#   0 4 * * * /home/tibia/Vethara/deploy/backup.sh >> /home/tibia/backup.log 2>&1
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$RAIZ/docker/.env"
DESTINO="${VETHARA_BACKUP_DIR:-$HOME/backups-vethara}"
MANTER_DIAS="${VETHARA_BACKUP_DIAS:-14}"

[[ -f "$ENV_FILE" ]] || { echo "ERRO: docker/.env nao encontrado." >&2; exit 1; }

DB_NAME="$(grep -E '^CANARY_DB_NAME=' "$ENV_FILE" | cut -d= -f2-)"
DB_USER="$(grep -E '^CANARY_DB_USER=' "$ENV_FILE" | cut -d= -f2-)"
DB_PASS="$(grep -E '^CANARY_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

CONTAINER="$(docker compose -f "$RAIZ/docker/docker-compose.yml" ps -q db)"
[[ -n "$CONTAINER" ]] || { echo "ERRO: container do banco nao esta rodando." >&2; exit 1; }

mkdir -p "$DESTINO"
ARQUIVO="$DESTINO/vethara-$(date +%Y%m%d-%H%M).sql.gz"

# --single-transaction: dump consistente sem travar o servidor durante a copia.
docker exec "$CONTAINER" mariadb-dump \
	-u"$DB_USER" -p"$DB_PASS" \
	--single-transaction --quick --routines --events \
	"$DB_NAME" | gzip -9 >"$ARQUIVO"

# Um dump que "termina" vazio por erro de credencial nao serve de nada.
TAMANHO=$(stat -c%s "$ARQUIVO")
if [[ "$TAMANHO" -lt 10240 ]]; then
	echo "ERRO: dump saiu com $TAMANHO bytes, pequeno demais. Backup descartado." >&2
	rm -f "$ARQUIVO"
	exit 1
fi

find "$DESTINO" -name 'vethara-*.sql.gz' -mtime +"$MANTER_DIAS" -delete

echo "$(date '+%F %T') ok: $ARQUIVO ($(numfmt --to=iec "$TAMANHO"))"
echo "Backup local nao e backup. Copie para fora do VPS (rclone, scp, S3)."
