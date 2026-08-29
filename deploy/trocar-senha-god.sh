#!/usr/bin/env bash
# Troca a senha da conta @god, que vem como "god" no schema do Canary.
#
# Nao e conta de teste: ela existe mesmo com CANARY_TEST_ACCOUNTS=false, tem tipo 6
# (poder total) e os personagens GOD e ADM2..ADM9. Exposta na internet com a senha
# padrao, o servidor e tomado no primeiro dia.
#
#   bash deploy/trocar-senha-god.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$RAIZ/docker/.env"

[[ -f "$ENV_FILE" ]] || { echo "ERRO: docker/.env nao encontrado. Rode gerar-env.sh antes." >&2; exit 1; }

DB_NAME="$(grep -E '^CANARY_DB_NAME=' "$ENV_FILE" | cut -d= -f2-)"
DB_USER="$(grep -E '^CANARY_DB_USER=' "$ENV_FILE" | cut -d= -f2-)"
DB_PASS="$(grep -E '^CANARY_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

read -rsp "Nova senha para a conta @god: " NOVA; echo
read -rsp "Repita: " CONFIRMA; echo
[[ "$NOVA" == "$CONFIRMA" ]] || { echo "As senhas nao conferem." >&2; exit 1; }
[[ ${#NOVA} -ge 12 ]] || { echo "Use pelo menos 12 caracteres." >&2; exit 1; }

# O Canary guarda a senha como SHA1 do texto puro (confirmado no banco: o hash da
# conta @god e exatamente sha1("god")).
HASH="$(printf '%s' "$NOVA" | sha1sum | cut -d' ' -f1)"

CONTAINER="$(docker compose -f "$RAIZ/docker/docker-compose.yml" ps -q db)"
[[ -n "$CONTAINER" ]] || { echo "ERRO: container do banco nao esta rodando." >&2; exit 1; }

docker exec -i "$CONTAINER" mariadb -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
UPDATE accounts SET password = '$HASH' WHERE name = 'god';
SELECT id, name, email, type FROM accounts WHERE name = 'god';
SQL

echo
echo "Senha da conta @god trocada."
echo "Confira tambem a conta myaacadmin do site, se ainda nao trocou."
