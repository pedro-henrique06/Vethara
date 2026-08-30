#!/usr/bin/env bash
# Único comando que a chave do GitHub Actions consegue executar no VPS.
#
# O authorized_keys prende essa chave a este script com command=, então mesmo
# que a chave privada vaze do GitHub, ela não dá shell: roda isto e encerra.
#
# Instalação no VPS descrita em deploy/CICD.md.
set -euo pipefail

RAIZ="${VETHARA_RAIZ:-$HOME/Vethara}"
cd "$RAIZ"

# O que o Actions pediu chega em SSH_ORIGINAL_COMMAND. Ele nunca é executado:
# só é comparado com a lista fixa abaixo. Qualquer outra coisa é recusada, então
# a chave continua não dando shell mesmo tendo agora duas ações.
read -r ACAO ARGUMENTO _ <<<"${SSH_ORIGINAL_COMMAND:-deploy}"

case "$ACAO" in
	deploy|'')
		echo "== deploy iniciado em $(date '+%F %T')"

		# --ff-only: se alguém editou arquivos direto no VPS, o deploy para em vez
		# de criar merge silencioso. Melhor falhar e investigar.
		git fetch --quiet origin main
		git merge --ff-only origin/main

		echo "== commit atual: $(git log --oneline -1)"

		bash deploy/subir.sh

		echo "== deploy concluido em $(date '+%F %T')"
		;;

	client)
		# Publica o zip do client a partir de um release. Não mexe no servidor:
		# só troca um arquivo estático que o Caddy serve.
		bash deploy/publicar-client.sh "$ARGUMENTO"
		;;

	*)
		echo "comando nao permitido por esta chave: $ACAO" >&2
		exit 1
		;;
esac
