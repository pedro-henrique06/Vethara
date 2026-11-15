#!/usr/bin/env bash
# Instala no VPS os arquivos de download do client, a partir de um release.
#
# Roda pela chave do GitHub Actions, que esta presa a um command= no
# authorized_keys — ver deploy/deploy-remoto.sh. Nao da shell.
#
# O VPS baixa os arquivos direto do GitHub em vez de receber por scp: o runner
# nao precisa carregar dezenas de MB, e nao existe caminho de escrita arbitraria
# daqui para dentro do servidor.
#
# Publica dois arquivos:
#
#   VetharaSetup.exe     o instalador — baixar, dois cliques, jogar
#   vethara-client.zip   o pacote solto, para quem prefere descompactar
#
# O instalador e opcional: releases antigos nao o tem, e nesse caso so o zip e
# publicado. O zip continua obrigatorio.
#
#   bash deploy/publicar-client.sh v1.0.0
set -euo pipefail

TAG="${1:-}"
REPO="${VETHARA_REPO:-pedro-henrique06/Vethara}"
RAIZ="${VETHARA_RAIZ:-$HOME/Vethara}"
DESTINO="$RAIZ/download"
ZIP="vethara-client.zip"
INSTALADOR="VetharaSetup.exe"

if [[ -z "$TAG" ]]; then
	echo "uso: publicar-client.sh <tag-do-release>" >&2
	exit 1
fi

# A tag vem de fora e entra numa URL. So aceita o que uma tag de git precisa
# ter: sem barra, sem espaco, sem '..' — nada que consiga escapar do caminho
# pretendido ou virar outra opcao do curl.
if [[ ! "$TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || [[ "$TAG" == *..* ]]; then
	echo "tag invalida: $TAG" >&2
	exit 1
fi

mkdir -p "$DESTINO"

url_de() { echo "https://github.com/$REPO/releases/download/$TAG/$1"; }

existe_no_release() {
	local codigo
	codigo="$(curl -sIL -o /dev/null -w '%{http_code}' --max-time 60 "$(url_de "$1")" || echo 000)"
	[[ "$codigo" == "200" ]]
}

# Baixa, confere e instala. Devolve "<tamanho> <sha256>" na saida padrao.
#
# A checagem dos primeiros bytes existe porque um 404 do GitHub sai como pagina
# HTML, e o -f do curl nem sempre pega redirecionamento para pagina de erro.
# Publicar uma pagina de erro de 2 KB no lugar do client seria pior que falhar.
publicar() {
	local arquivo="$1" magica="$2" temp tamanho sha
	temp="$(mktemp "$DESTINO/.$arquivo.XXXXXX")"
	# shellcheck disable=SC2064
	trap "rm -f '$temp'" RETURN

	curl -fL --retry 3 --retry-delay 5 --max-time 900 -o "$temp" "$(url_de "$arquivo")" >&2

	tamanho="$(stat -c %s "$temp")"
	if [[ "$tamanho" -lt 1000000 ]]; then
		echo "$arquivo: pequeno demais ($tamanho bytes) — o release tem mesmo esse arquivo?" >&2
		return 1
	fi
	if [[ "$(head -c 2 "$temp")" != "$magica" ]]; then
		echo "$arquivo: os primeiros bytes nao sao '$magica' — conteudo inesperado." >&2
		return 1
	fi

	sha="$(sha256sum "$temp" | cut -d' ' -f1)"

	# mv dentro do mesmo sistema de arquivos e atomico: quem estiver baixando
	# durante a troca pega a versao antiga inteira, nunca um arquivo truncado.
	chmod 644 "$temp"
	mv "$temp" "$DESTINO/$arquivo"
	trap - RETURN

	echo "$tamanho $sha"
}

echo "== publicando $TAG de $REPO"

existe_no_release "$ZIP" || {
	echo "$ZIP nao encontrado no release $TAG." >&2
	echo "Anexe o arquivo com esse nome exato e rode de novo." >&2
	exit 1
}
read -r TAM_ZIP SHA_ZIP < <(publicar "$ZIP" "PK")
echo "== $ZIP: $TAM_ZIP bytes"

TAM_EXE=""
SHA_EXE=""
if existe_no_release "$INSTALADOR"; then
	read -r TAM_EXE SHA_EXE < <(publicar "$INSTALADOR" "MZ")
	echo "== $INSTALADOR: $TAM_EXE bytes"
else
	# Release sem instalador: tirar o antigo do ar. Deixa-lo ali faria a pagina
	# oferecer um instalador de outra versao, ao lado de um zip atual.
	if [[ -e "$DESTINO/$INSTALADOR" ]]; then
		rm -f "$DESTINO/$INSTALADOR"
		echo "== $INSTALADOR nao esta em $TAG — o antigo foi removido"
	else
		echo "== $INSTALADOR nao esta em $TAG — publicando so o zip"
	fi
fi

# A pagina de download le isto para mostrar versao, tamanho e hash. Ler daqui,
# em vez de deixar o hash fixo no React, evita o pior caso: publicar um client
# novo e a pagina seguir mostrando o hash do antigo — quem conferisse concluiria
# que baixou um arquivo adulterado.
#
# Os campos do zip ficam no topo, como sempre estiveram: uma pagina antiga
# continua funcionando depois desta mudanca. O instalador entra como objeto
# proprio, presente so quando existe.
{
	echo '{'
	echo "  \"versao\": \"$TAG\","
	echo "  \"arquivo\": \"$ZIP\","
	echo "  \"tamanho\": $TAM_ZIP,"
	echo "  \"sha256\": \"$SHA_ZIP\","
	if [[ -n "$TAM_EXE" ]]; then
		echo '  "instalador": {'
		echo "    \"arquivo\": \"$INSTALADOR\","
		echo "    \"tamanho\": $TAM_EXE,"
		echo "    \"sha256\": \"$SHA_EXE\""
		echo '  },'
	fi
	echo "  \"publicado\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
	echo '}'
} > "$DESTINO/versao.json"
chmod 644 "$DESTINO/versao.json"

echo "== publicado: $TAG"
