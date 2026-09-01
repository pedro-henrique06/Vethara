#!/usr/bin/env bash
# Sobe o servidor conferindo antes se a configuração está de pé.
#
# Existe porque `docker compose up` sozinho é silencioso demais: sem o docker/.env
# ele cai nos valores padrão do compose e o servidor sobe anunciando 127.0.0.1, com
# senha de banco "canary" e contas de teste abertas. Tudo parece certo, o site abre,
# e nenhum jogador consegue entrar.
#
#   bash deploy/subir.sh            # confere e sobe
#   bash deploy/subir.sh --forcar   # sobe mesmo com pendências (para testes locais)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$RAIZ/docker/.env"
FORCAR=0
[[ "${1:-}" == "--forcar" ]] && FORCAR=1

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }

if [[ ! -f "$ENV_FILE" ]]; then
	vermelho "docker/.env nao existe."
	echo
	echo "Sem ele o compose usa os padroes: servidor anunciando 127.0.0.1, banco com"
	echo "senha 'canary' e contas de teste abertas. Gere o arquivo antes:"
	echo
	echo "    bash deploy/gerar-env.sh SEU_DOMINIO.com"
	echo "    bash deploy/gerar-env.sh SEU_IP        # se ainda nao tem dominio"
	exit 1
fi

valor() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }

PENDENCIAS=()

IP="$(valor CANARY_SERVER_IP)"
if [[ -z "$IP" || "$IP" == "127.0.0.1" || "$IP" == "localhost" ]]; then
	PENDENCIAS+=("CANARY_SERVER_IP=$IP -- e o endereco anunciado ao client. Assim, cada jogador tenta conectar na propria maquina.")
fi

if [[ "$(valor CANARY_TEST_ACCOUNTS)" != "false" ]]; then
	PENDENCIAS+=("CANARY_TEST_ACCOUNTS nao esta false -- qualquer um entra com @test1 / test.")
fi

if [[ "$(valor CANARY_DB_PASSWORD)" == "canary" ]]; then
	PENDENCIAS+=("CANARY_DB_PASSWORD ainda e a padrao 'canary'.")
fi

if [[ "$(valor CANARY_DB_ROOT_PASSWORD)" == "root" ]]; then
	PENDENCIAS+=("CANARY_DB_ROOT_PASSWORD ainda e a padrao 'root'.")
fi

if [[ "$(valor MYAAC_ADMIN_PASSWORD)" == "admin123" ]]; then
	PENDENCIAS+=("MYAAC_ADMIN_PASSWORD ainda e a padrao 'admin123'.")
fi

if [[ ${#PENDENCIAS[@]} -gt 0 ]]; then
	vermelho "Configuracao incompleta para producao:"
	echo
	for p in "${PENDENCIAS[@]}"; do echo "  - $p"; done
	echo
	if [[ "$FORCAR" -eq 0 ]]; then
		echo "Corrija o docker/.env e rode de novo."
		echo "Para subir assim mesmo (ambiente local, sem jogadores): bash deploy/subir.sh --forcar"
		exit 1
	fi
	amarelo "--forcar informado: subindo com as pendencias acima."
	echo
fi

# Com dominio entra o Caddy e o HTTPS; so com IP, nao ha certificado a emitir.
ARQUIVOS=(-f "$RAIZ/docker/docker-compose.yml")
USA_CADDY=0
if [[ -n "$(valor VETHARA_DOMAIN)" ]]; then
	ARQUIVOS+=(-f "$RAIZ/deploy/docker-compose.prod.yml")
	USA_CADDY=1
	verde "Dominio $(valor VETHARA_DOMAIN) -- subindo com Caddy e HTTPS."

	# O compose de producao monta o mapa do host dentro do container, e um bind
	# mount de arquivo que nao existe faz o Docker criar um DIRETORIO no lugar.
	# O servidor subiria sem mapa por causa disso, entao o download vem antes do
	# `up`. Depois da primeira vez, isto nao faz nada.
	echo
	bash "$RAIZ/deploy/baixar-mapa.sh"
else
	amarelo "Sem VETHARA_DOMAIN -- subindo sem Caddy. O site e o login ficam em HTTP."
fi

# --build e obrigatorio: sem ele, o compose reaproveita a imagem existente dos
# servicos com build (api, web, myaac). O git pull traria codigo novo e o deploy
# subiria o antigo, sem avisar. O cache de camadas faz isso ser rapido quando nada mudou.
docker compose "${ARQUIVOS[@]}" up -d --build

# O Caddyfile e bind mount: mudar o conteudo nao faz o Compose recriar o container,
# e o Caddy nao rele o arquivo sozinho. Sem este reload, um git pull que mexeu nas
# rotas sobe os containers novos e mesmo assim serve a configuracao antiga.
if [[ "$USA_CADDY" -eq 1 ]]; then
	echo
	if docker compose "${ARQUIVOS[@]}" exec -T caddy caddy reload --config /etc/caddy-conf/Caddyfile 2>/dev/null; then
		verde "Caddy recarregado com a configuracao atual."
	else
		amarelo "Nao consegui recarregar o Caddy. Se mexeu no Caddyfile, rode:"
		echo "    docker compose ${ARQUIVOS[*]} exec caddy caddy reload --config /etc/caddy-conf/Caddyfile"
	fi
fi

echo
verde "No ar. Acompanhe o servidor ate ver 'Vethara server online!':"
echo
echo "    docker compose ${ARQUIVOS[*]} logs -f server"
