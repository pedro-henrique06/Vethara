#!/usr/bin/env bash
# Gera o docker/.env de produção com senhas fortes.
#
# Rode ESTE script no VPS, não na sua máquina. As senhas nascem no servidor e nunca
# passam por chat, e-mail ou git — o .env está no .gitignore.
#
#   bash deploy/gerar-env.sh vethara.com.br
set -euo pipefail

DOMINIO="${1:-}"
if [[ -z "$DOMINIO" ]]; then
	echo "uso: bash deploy/gerar-env.sh SEU_DOMINIO" >&2
	echo "exemplo: bash deploy/gerar-env.sh vethara.com.br" >&2
	exit 1
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/docker/.env"

if [[ -e "$DESTINO" ]]; then
	echo "ERRO: $DESTINO ja existe. Nao vou sobrescrever." >&2
	echo "Se quiser refazer, mova o atual: mv docker/.env docker/.env.bak" >&2
	exit 1
fi

senha() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-24; }

DB_PASS="$(senha)"
DB_ROOT="$(senha)"
AAC_PASS="$(senha)"

cp "$RAIZ/docker/.env.dist" "$DESTINO"

troca() { sed -i "s|^$1=.*|$1=$2|" "$DESTINO"; }

troca CANARY_SERVER_NAME   "Vethara"
# O valor anunciado ao client. Se ficar 127.0.0.1, cada jogador tenta conectar
# na propria maquina: o servidor sobe e ninguem entra, sem erro no log.
troca CANARY_SERVER_IP     "$DOMINIO"
troca CANARY_DB_PASSWORD   "$DB_PASS"
troca CANARY_DB_ROOT_PASSWORD "$DB_ROOT"
troca CANARY_TEST_ACCOUNTS "false"
troca MYAAC_ADMIN_PASSWORD "$AAC_PASS"
# Sem dominio nao ha HTTPS: nao existe certificado para endereco IP.
if [[ "$DOMINIO" =~ ^[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+$ ]]; then
	EH_IP=1
	troca MYAAC_SITE_URL "http://$DOMINIO:8080"
else
	EH_IP=0
	troca MYAAC_SITE_URL "https://$DOMINIO"
fi

# Lido pelo Caddy na sobreposicao de producao. So faz sentido com dominio.
if [[ "$EH_IP" -eq 0 ]] && ! grep -q '^VETHARA_DOMAIN=' "$DESTINO"; then
	printf '\n# Dominio usado pelo Caddy para emitir o certificado HTTPS\nVETHARA_DOMAIN=%s\n' "$DOMINIO" >>"$DESTINO"
fi

# Segredo que assina os tokens de sessao do site. Sem ele a API gera um aleatorio
# a cada reinicio, e todo mundo logado no painel cai junto.
if ! grep -q '^VETHARA_JWT_SECRET=' "$DESTINO"; then
	printf '
# Assina os tokens de sessao do site
VETHARA_JWT_SECRET=%s
' "$(openssl rand -base64 48 | tr -d '
')" >>"$DESTINO"
fi

chmod 600 "$DESTINO"

if [[ "$EH_IP" -eq 1 ]]; then
	AVISO_HTTPS=$(cat <<'AV'
ATENCAO: sem dominio nao ha HTTPS. As senhas dos jogadores trafegam em texto claro
entre o client e o login-server. Serve para testar; antes de abrir para jogadores de
verdade, registre um dominio e rode este script novamente.

AV
)
else
	AVISO_HTTPS=""
fi

cat <<FIM

.env criado em docker/.env (permissao 600, fora do git).

  dominio ............. $DOMINIO
  senha do banco ...... $DB_PASS
  senha root do banco . $DB_ROOT
  admin do MyAAC ...... $AAC_PASS
  contas de teste ..... desativadas

Anote essas senhas num gerenciador AGORA. Elas nao aparecem em outro lugar.

${AVISO_HTTPS}
FALTA UM PASSO: a conta @god ainda esta com a senha padrao "god".
Rode, depois de subir o stack:

  bash deploy/trocar-senha-god.sh

FIM
