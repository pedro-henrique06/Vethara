#!/usr/bin/env bash
# Deixa o mapa no HOST, para que ele sobreviva a recriacao do container.
#
# O .otbm nao vem na imagem do Canary: o start.sh dela baixa o arquivo na
# primeira subida, e ele fica na camada gravavel do container. Como todo deploy
# que mexe no servidor recria esse container, o mapa era baixado de novo —
# 176 MB e alguns minutos de servidor fora do ar, sempre a mesma release.
#
# Com o arquivo aqui e montado no compose, o start.sh encontra o mapa ja no
# lugar (ele so baixa quando o arquivo nao existe) e nao baixa nada.
#
#   bash deploy/baixar-mapa.sh
#
# Idempotente: com o mapa presente e integro, nao faz nada.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$RAIZ/docker/.env"
DESTINO="$RAIZ/mapa"
ARQUIVO="otservbr.otbm"

# Mesma release que o docker/docker-compose.yml usa por padrao. Se o .env
# apontar para outra, ela ganha — assim o mapa do host e o que o compose
# mandaria o container baixar sao sempre o mesmo arquivo.
PADRAO='https://github.com/opentibiabr/canary/releases/download/v3.6.1/otservbr.otbm'
URL="${CANARY_MAP_URL:-}"
if [[ -z "$URL" && -f "$ENV_FILE" ]]; then
	URL="$(grep -E '^CANARY_MAP_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
fi
URL="${URL:-$PADRAO}"

# O otservbr.otbm da v3.6.1 tem 184.776.037 bytes. O piso e generoso de
# proposito: serve para rejeitar pagina de erro e download interrompido, nao
# para casar com uma versao especifica.
MINIMO=$((50 * 1024 * 1024))

# Um .otbm comeca com 4 bytes de identificador de versao (zerados nesta release)
# seguidos de 0xFE, que abre o no raiz da arvore de nos do formato. Conferir
# isso pega o caso em que o download trouxe HTML com codigo 200.
parece_otbm() {
	[[ "$(od -An -tu1 -j4 -N1 "$1" | tr -d ' ')" == "254" ]]
}

# O proprio erro que este script existe para evitar deixa um diretorio com o
# nome do mapa. Sem tratar, o `mv` la embaixo moveria o download para DENTRO
# dele e o container continuaria vendo um diretorio onde espera o .otbm.
if [[ -e "$DESTINO/$ARQUIVO" && ! -f "$DESTINO/$ARQUIVO" ]]; then
	if [[ -d "$DESTINO/$ARQUIVO" ]] && rmdir "$DESTINO/$ARQUIVO" 2>/dev/null; then
		echo "removido o diretorio vazio que o Docker criou no lugar do mapa."
	else
		echo "$DESTINO/$ARQUIVO existe e nao e um arquivo. Confira antes de seguir." >&2
		exit 1
	fi
fi

if [[ -f "$DESTINO/$ARQUIVO" ]]; then
	TAMANHO=$(stat -c %s "$DESTINO/$ARQUIVO")
	if [[ "$TAMANHO" -ge "$MINIMO" ]] && parece_otbm "$DESTINO/$ARQUIVO"; then
		echo "mapa ja esta no host ($((TAMANHO / 1024 / 1024)) MB) — nada a baixar."
		exit 0
	fi
	echo "o mapa que esta aqui nao serve ($TAMANHO bytes) — baixando de novo."
fi

echo "== baixando o mapa de $URL"
mkdir -p "$DESTINO"

# Arquivo temporario no mesmo diretorio: o mv final vira uma operacao atomica
# dentro do mesmo sistema de arquivos, e nunca existe um .otbm pela metade no
# lugar onde o container vai procurar.
TEMP="$(mktemp "$DESTINO/.$ARQUIVO.XXXXXX")"
trap 'rm -f "$TEMP"' EXIT

# --max-time alto porque sao 176 MB, e o link do VPS nem sempre esta livre.
curl -fL --retry 3 --retry-delay 5 --max-time 1800 -o "$TEMP" "$URL"

TAMANHO=$(stat -c %s "$TEMP")
if [[ "$TAMANHO" -lt "$MINIMO" ]]; then
	echo "o arquivo baixado tem so $TAMANHO bytes — a URL do mapa esta certa?" >&2
	exit 1
fi
if ! parece_otbm "$TEMP"; then
	echo "o arquivo baixado nao tem cara de .otbm." >&2
	exit 1
fi

chmod 644 "$TEMP"
mv "$TEMP" "$DESTINO/$ARQUIVO"
trap - EXIT

echo "== mapa no host: $DESTINO/$ARQUIVO ($((TAMANHO / 1024 / 1024)) MB)"
