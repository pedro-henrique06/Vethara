#!/usr/bin/env bash
# Cria arquivo de swap no VPS.
#
# O servidor caiu em 31/08 por falta de memoria, e sem swap o kernel nao tinha
# para onde escorrer: em vez de matar um processo, ficou descartando cache em
# laco. O host parou de responder por inteiro — site, banco, SSH — e nem
# `docker ps` rodava, porque o daemon do Docker tambem estava pendurado.
#
# Swap nao resolve consumo excessivo, e nem deveria: quem contem isso e o
# mem_limit do container no compose de producao. O que a swap faz e dar folga
# para o sistema continuar respondendo enquanto o limite age — a diferenca entre
# um container reiniciando e um VPS inalcancavel.
#
#   sudo bash deploy/criar-swap.sh        # 4G, o padrao
#   sudo bash deploy/criar-swap.sh 8      # outro tamanho, em GB
set -euo pipefail

TAMANHO="${1:-4}"
ARQUIVO=/swapfile

if [[ $EUID -ne 0 ]]; then
	echo "Rode com sudo: sudo bash deploy/criar-swap.sh" >&2
	exit 1
fi

if swapon --show | grep -q "$ARQUIVO"; then
	echo "Swap ja esta ativa:"
	swapon --show
	exit 0
fi

if [[ -e "$ARQUIVO" ]]; then
	echo "$ARQUIVO existe mas nao esta ativo. Ativando o que ja esta la."
else
	echo "== criando $ARQUIVO com ${TAMANHO}G"
	# fallocate falha em alguns sistemas de arquivos; dd e mais lento porem
	# sempre funciona, entao serve de reserva.
	fallocate -l "${TAMANHO}G" "$ARQUIVO" 2>/dev/null ||
		dd if=/dev/zero of="$ARQUIVO" bs=1M count=$((TAMANHO * 1024)) status=progress
	chmod 600 "$ARQUIVO"
	mkswap "$ARQUIVO"
fi

swapon "$ARQUIVO"

# Sem a linha no fstab, a swap some no proximo reboot — e o problema volta
# exatamente quando ninguem esta olhando.
if ! grep -q "^$ARQUIVO " /etc/fstab; then
	printf '%s none swap sw 0 0\n' "$ARQUIVO" >>/etc/fstab
	echo "== registrado no /etc/fstab"
fi

# 10 em vez do padrao 60: usar swap so quando faltar mesmo. Trocar paginas de um
# servidor de jogo para disco cedo demais vira travamento perceptivel no jogo.
sysctl -w vm.swappiness=10 >/dev/null
if ! grep -q '^vm.swappiness' /etc/sysctl.conf; then
	echo 'vm.swappiness=10' >>/etc/sysctl.conf
fi

echo
echo "== swap ativa:"
swapon --show
free -h
