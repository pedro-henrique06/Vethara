#!/usr/bin/env bash
# Instala no VPS o zip do client anexado a um release do GitHub.
#
# Roda pela chave do GitHub Actions, que esta presa a um command= no
# authorized_keys — ver deploy/deploy-remoto.sh. Nao da shell.
#
# O VPS baixa o arquivo direto do GitHub em vez de receber por scp: o runner
# nao precisa carregar 41 MB, e nao existe caminho de escrita arbitraria daqui
# para dentro do servidor.
#
#   bash deploy/publicar-client.sh v1.0.0
set -euo pipefail

TAG="${1:-}"
REPO="${VETHARA_REPO:-pedro-henrique06/Vethara}"
RAIZ="${VETHARA_RAIZ:-$HOME/Vethara}"
DESTINO="$RAIZ/download"
ARQUIVO="vethara-client.zip"

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

URL="https://github.com/$REPO/releases/download/$TAG/$ARQUIVO"
echo "== baixando $TAG de $URL"

mkdir -p "$DESTINO"
TEMP="$(mktemp "$DESTINO/.$ARQUIVO.XXXXXX")"
trap 'rm -f "$TEMP"' EXIT

curl -fL --retry 3 --retry-delay 5 --max-time 600 -o "$TEMP" "$URL"

# Um 404 do GitHub sai como pagina HTML, e o -f do curl nem sempre pega
# redirecionamento para pagina de erro. Conferir que e mesmo um zip evita
# publicar uma pagina de erro de 2 KB no lugar do client.
TAMANHO=$(stat -c %s "$TEMP")
if [[ "$TAMANHO" -lt 1000000 ]]; then
	echo "arquivo pequeno demais ($TAMANHO bytes) — o release tem mesmo o $ARQUIVO?" >&2
	exit 1
fi
if [[ "$(head -c 2 "$TEMP")" != "PK" ]]; then
	echo "o arquivo baixado nao e um zip." >&2
	exit 1
fi

SHA="$(sha256sum "$TEMP" | cut -d' ' -f1)"

# mv dentro do mesmo sistema de arquivos e atomico: quem estiver baixando
# durante a troca pega a versao antiga inteira, nunca um arquivo truncado.
chmod 644 "$TEMP"
mv "$TEMP" "$DESTINO/$ARQUIVO"
trap - EXIT

# A pagina de download le isto para mostrar versao, tamanho e hash. Sem esse
# arquivo o hash teria de ser editado a mao no React a cada publicacao — e um
# hash desatualizado faz o jogador que confere achar que baixou coisa errada.
cat > "$DESTINO/versao.json" <<JSON
{
  "versao": "$TAG",
  "arquivo": "$ARQUIVO",
  "tamanho": $TAMANHO,
  "sha256": "$SHA",
  "publicado": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
JSON
chmod 644 "$DESTINO/versao.json"

echo "== $ARQUIVO publicado: $TAG, $TAMANHO bytes"
echo "== sha256: $SHA"
