# Deploy no VPS

Passo a passo de zero até o servidor no ar com HTTPS. Nada é compilado no VPS — o
servidor vem como imagem Docker.

## Antes de começar

- Docker com Compose v2 instalado no VPS
- Um **domínio já apontando para o IP do VPS** (registro A). O Caddy só consegue emitir
  o certificado se o DNS já estiver propagado.

## 1. Clonar

```bash
git clone git@github.com:pedro-henrique06/Vethara.git
cd Vethara
```

## 2. Gerar o `.env` com senhas fortes

```bash
bash deploy/gerar-env.sh SEU_DOMINIO.com
```

O script gera senhas aleatórias, desativa as contas de teste e grava `docker/.env` com
permissão `600`. **As senhas aparecem na tela uma única vez** — guarde num gerenciador.

Elas nascem no VPS de propósito: nunca passam por chat, e-mail ou git.

### Sem domínio ainda?

Passe o IP público do VPS no lugar do domínio. Descubra qual é com:

```bash
curl -4 ifconfig.me
```

O script detecta que é um IP e ajusta o site para `http://IP:8080`. Nesse caminho **não
há HTTPS** — não existe certificado para endereço IP — então as senhas dos jogadores
trafegam em texto claro. Serve para testar; antes de abrir para jogadores de verdade,
registre um domínio e rode o script de novo.

## 3. Subir

**Com domínio** — inclui o Caddy e o HTTPS:

```bash
docker compose -f docker/docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

**Só com IP** — sem o Caddy:

```bash
docker compose -f docker/docker-compose.yml up -d
```

A sobreposição de produção fixa as imagens por digest e põe o Caddy na frente, com
HTTPS automático.

Acompanhe a primeira subida — ela baixa o mapa:

```bash
docker compose -f docker/docker-compose.yml logs -f server
```

Espere por `Vethara server online!`.

## 4. Trocar a senha do god

```bash
bash deploy/trocar-senha-god.sh
```

A conta `@god` vem com a senha `god` e poder total. **Não é conta de teste** — ela existe
mesmo com `CANARY_TEST_ACCOUNTS=false`, porque vem do schema do próprio Canary.

## 5. Fechar as portas internas

O compose base publica 8080 (site), 8088 e 9090 (login). Em produção elas não precisam
ficar abertas: o Caddy fala com esses serviços pela rede interna do Docker.

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp                  # SSH — não se tranque para fora
sudo ufw allow 80,443/tcp              # site e login, via Caddy
sudo ufw allow 7171:7175/tcp           # jogo
sudo ufw enable
```

> O Docker costuma escrever direto no iptables e passar por cima do ufw. Depois de
> habilitar, **confirme de fora** que 8080 e 8088 estão fechadas:
> `nmap -Pn -p 8080,8088,9090 SEU_DOMINIO.com`

## 6. Backup

```bash
crontab -e
# 0 4 * * * /home/SEU_USUARIO/Vethara/deploy/backup.sh >> /home/SEU_USUARIO/backup.log 2>&1
```

O script mantém 14 dias e recusa dumps pequenos demais — um backup que falhou calado é
pior que nenhum.

**Backup no mesmo VPS não é backup.** Copie para fora (rclone, S3, outro servidor).

## 7. Apontar o client

No `init.lua` do client, troque o endereço local pelo seu domínio:

```lua
["https://SEU_DOMINIO.com/login"] = {
    port = 443,
    protocol = 1525,
    httpLogin = true
}
```

---

## Atualizar o servidor depois

As imagens estão fixadas por digest, então `docker compose pull` **não** troca a versão
sozinho — isso é proposital. Para atualizar de propósito:

```bash
docker compose -f docker/docker-compose.yml pull server
docker inspect ghcr.io/opentibiabr/canary:latest --format '{{json .RepoDigests}}'
# copie o digest novo para deploy/docker-compose.prod.yml e suba de novo
```

Faça backup antes. Atualização de servidor pode migrar o schema do banco.
