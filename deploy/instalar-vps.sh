#!/usr/bin/env bash
# Instala o Vethara do zero numa VPS Ubuntu recem-criada.
#
# Junta num comando so o que o deploy/README.md descreve em cinco passos:
# Docker, usuario do deploy, clone, .env e o `subir.sh`. Existe porque
# reconstruir o servidor nao pode depender de alguem lembrar a ordem certa --
# e porque a ordem errada custa caro (o Caddy so emite certificado se o dominio
# ja resolver para esta maquina).
#
#   ssh root@IP_DA_VPS
#   curl -fsSL https://raw.githubusercontent.com/pedro-henrique06/Vethara/main/deploy/instalar-vps.sh -o instalar-vps.sh
#   bash instalar-vps.sh vethara.com.br
#
# Pode rodar de novo com seguranca: cada etapa confere se ja esta feita. O
# docker/.env, em especial, nunca e regerado -- senha nova com banco antigo
# deixaria o servidor sem conseguir abrir o proprio banco.
set -euo pipefail

DOMINIO="${1:-}"
USUARIO="${VETHARA_USUARIO:-tibia}"
REPO="${VETHARA_REPO_URL:-https://github.com/pedro-henrique06/Vethara.git}"

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }
passo()    { printf '\n\033[36m== %s\033[0m\n' "$1"; }

if [[ -z "$DOMINIO" ]]; then
	echo "uso: bash instalar-vps.sh SEU_DOMINIO" >&2
	echo "exemplo: bash instalar-vps.sh vethara.com.br" >&2
	echo >&2
	echo "Sem dominio ainda? passe o IP publico -- sobe sem HTTPS, so para testar." >&2
	exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
	vermelho "Rode como root: a instalacao do Docker e a criacao do usuario precisam."
	exit 1
fi

CASA="/home/$USUARIO"
RAIZ="$CASA/Vethara"

passo "1/5  Pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends ca-certificates curl git
verde "ok"

passo "2/5  Docker"
if command -v docker >/dev/null 2>&1; then
	verde "ja instalado: $(docker --version)"
else
	curl -fsSL https://get.docker.com | sh
	verde "instalado: $(docker --version)"
fi
# O compose v2 vem como plugin do Docker. Sem ele o subir.sh nao roda, e o erro
# aparece la na frente, depois de varios minutos -- melhor falhar agora.
docker compose version >/dev/null 2>&1 || {
	vermelho "docker compose v2 nao esta disponivel. Confira a instalacao do Docker."
	exit 1
}

passo "3/5  Usuario $USUARIO"
if id "$USUARIO" >/dev/null 2>&1; then
	verde "ja existe"
else
	adduser --disabled-password --gecos '' "$USUARIO"
	verde "criado"
fi
usermod -aG docker "$USUARIO"

# A chave que voce usou para entrar como root serve para entrar como o usuario
# do deploy. Sem isto, a conta nova nasce sem forma de login.
if [[ -f /root/.ssh/authorized_keys ]]; then
	install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$CASA/.ssh"
	install -m 600 -o "$USUARIO" -g "$USUARIO" /root/.ssh/authorized_keys "$CASA/.ssh/authorized_keys"
	verde "chave SSH do root copiada para $USUARIO"
else
	vermelho "AVISO: /root/.ssh/authorized_keys nao existe -- $USUARIO ficara sem chave."
fi

passo "4/5  Repositorio e configuracao"
if [[ -d "$RAIZ/.git" ]]; then
	su - "$USUARIO" -c "cd '$RAIZ' && git pull --ff-only"
	verde "repositorio atualizado"
else
	su - "$USUARIO" -c "git clone '$REPO' '$RAIZ'"
	verde "repositorio clonado em $RAIZ"
fi

if [[ -f "$RAIZ/docker/.env" ]]; then
	verde "docker/.env ja existe -- mantido como esta"
else
	echo
	vermelho "ATENCAO: as senhas aparecem a seguir UMA unica vez. Guarde-as agora."
	echo
	su - "$USUARIO" -c "cd '$RAIZ' && bash deploy/gerar-env.sh '$DOMINIO'"
fi

passo "5/5  Subindo o servidor"
echo "A primeira subida baixa o mapa (176 MB) e constroi as imagens. Leva alguns minutos."
echo
su - "$USUARIO" -c "cd '$RAIZ' && bash deploy/subir.sh"

cat <<TEXTO

$(verde "Pronto.")

Acompanhe o servidor de jogo ate ver 'Vethara server online!':

    ssh $USUARIO@$DOMINIO
    cd Vethara
    docker compose -f docker/docker-compose.yml -f deploy/docker-compose.prod.yml logs -f server

Depois, dois passos que ficam faltando e estao no deploy/CICD.md:

  - a chave do GitHub Actions, presa a um command= no authorized_keys
  - o backup diario no cron (deploy/backup.sh)

TEXTO
