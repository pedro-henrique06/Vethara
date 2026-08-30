#!/usr/bin/env bash
# Único comando que a chave do GitHub Actions consegue executar no VPS.
#
# O authorized_keys prende essa chave a este script com command=, então mesmo
# que a chave privada vaze do GitHub, ela não dá shell: roda isto e encerra.
#
# Instalação no VPS descrita em deploy/README.md.
set -euo pipefail

RAIZ="${VETHARA_RAIZ:-$HOME/Vethara}"
cd "$RAIZ"

echo "== deploy iniciado em $(date '+%F %T')"

# --ff-only: se alguém editou arquivos direto no VPS, o deploy para em vez de
# criar merge silencioso. Melhor falhar e investigar.
git fetch --quiet origin main
git merge --ff-only origin/main

echo "== commit atual: $(git log --oneline -1)"

bash deploy/subir.sh

echo "== deploy concluido em $(date '+%F %T')"
