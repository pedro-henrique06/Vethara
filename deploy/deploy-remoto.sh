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

# O dominio sai do mesmo docker/.env que o resto do stack usa. Sem ele nao ha
# Caddy nem API publicada, e entao nao ha o que conferir depois de subir.
DOMINIO="$(grep -E '^VETHARA_DOMAIN=' docker/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"

# Bate no mesmo /api/saude que o workflow consulta, mas de dentro do VPS e antes
# de o job terminar. E o caminho inteiro: Caddy, React, API e banco. Dois minutos
# dao tempo do stack subir; menos que isso reprovaria deploy bom.
saudavel() {
	local tentativa
	[[ -n "$DOMINIO" ]] || return 0
	for tentativa in $(seq 1 12); do
		if curl -fsS --max-time 15 "https://$DOMINIO/api/saude" >/dev/null 2>&1; then
			return 0
		fi
		echo "   tentativa $tentativa: ainda sem resposta"
		sleep 10
	done
	return 1
}

# O que o Actions pediu chega em SSH_ORIGINAL_COMMAND. Ele nunca é executado:
# só é comparado com a lista fixa abaixo. Qualquer outra coisa é recusada, então
# a chave continua não dando shell mesmo tendo agora duas ações.
read -r ACAO ARGUMENTO _ <<<"${SSH_ORIGINAL_COMMAND:-deploy}"

case "$ACAO" in
	deploy|'')
		echo "== deploy iniciado em $(date '+%F %T')"

		# Guardado antes de qualquer coisa: e para aqui que voltamos se o site nao
		# responder. Um deploy quebrado tira o servidor do ar ate alguem acordar e
		# entrar no VPS — a versao anterior no ar custa menos que isso.
		ANTERIOR="$(git rev-parse HEAD)"

		# --ff-only: se alguém editou arquivos direto no VPS, o deploy para em vez
		# de criar merge silencioso. Melhor falhar e investigar.
		git fetch --quiet origin main
		git merge --ff-only origin/main

		echo "== commit atual: $(git log --oneline -1)"

		bash deploy/subir.sh

		echo "== conferindo o site"
		if saudavel; then
			echo "== deploy concluido em $(date '+%F %T')"
			exit 0
		fi

		echo "== o site nao respondeu; voltando para ${ANTERIOR:0:7}" >&2
		docker compose -f docker/docker-compose.yml -f deploy/docker-compose.prod.yml \
			logs --tail 40 api web caddy 2>&1 || true

		# reset --hard e nao checkout: o deploy roda na main, e voltar o ponteiro
		# dela deixa o proximo `git merge --ff-only origin/main` avancar de novo
		# sozinho. ANTERIOR e ancestral do origin/main, entao nada diverge.
		git reset --hard "$ANTERIOR"
		bash deploy/subir.sh

		if saudavel; then
			echo "== rollback feito: ${ANTERIOR:0:7} esta no ar de novo." >&2
		else
			echo "== o rollback tambem nao respondeu. O site esta fora." >&2
		fi

		# Sai com erro de proposito: sem isso o job seguiria para a verificacao
		# final, veria a versao antiga respondendo 200 e ficaria verde.
		exit 1
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
