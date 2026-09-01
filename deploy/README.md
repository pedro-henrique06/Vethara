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
bash deploy/gerar-env.sh vethara.com.br
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

```bash
bash deploy/subir.sh
```

O script confere a configuração antes de subir e escolhe os arquivos de compose
sozinho: com `VETHARA_DOMAIN` no `.env` ele inclui o Caddy e o HTTPS; sem domínio,
sobe só o base.

Ele **recusa** subir se encontrar servidor anunciando `127.0.0.1`, contas de teste
abertas ou senhas padrão. Um `docker compose up` direto não avisa nada disso — o
servidor sobe, o site abre, e nenhum jogador consegue entrar.

Para ambiente local, sem jogadores, dá para ignorar os avisos:

```bash
bash deploy/subir.sh --forcar
```

Acompanhe a primeira subida — a do host baixa o mapa antes de subir:

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

## 5. Firewall

As portas do site e do login **já não são publicadas** pela sobreposição de produção:
elas ficam em `127.0.0.1` e o Caddy fala com os serviços pela rede interna do Docker.
Isso não depende de firewall — e é de propósito, porque **o Docker escreve direto no
iptables e passa por cima do ufw**. Porta publicada fica aberta mesmo com o ufw ligado.

Ainda assim, feche o resto:

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp          # SSH — não se tranque para fora
sudo ufw allow 80,443/tcp      # site e login, via Caddy
sudo ufw allow 7171:7175/tcp   # jogo
sudo ufw enable
```

### Confirme de fora

Do seu PC, não do VPS. No Windows, sem instalar nada:

```powershell
8080,8088,9090 | ForEach-Object { Test-NetConnection vethara.com.br -Port $_ }
```

`TcpTestSucceeded : False` nas três é o resultado correto.

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
["https://vethara.com.br/login"] = {
    port = 443,
    protocol = 1525,
    httpLogin = true
}
```

## 8. Publicar o client para os jogadores

O client nao entra no git: o zip tem dezenas de MB e o executavel e reconstruivel.
Ele e servido pelo proprio VPS, em `https://vethara.com.br/download`.

Gere o pacote na maquina onde voce compila — so os arquivos versionados do OTClient
mais o `otclient.exe`, sem os assets da CipSoft, que o client baixa sozinho:

```bash
cd client-modern
git archive HEAD | tar -x -C /tmp/vethara-client
cp otclient.exe /tmp/vethara-client/
# o que e nosso vem do repositorio, e nao do checkout do otclient: sao os mesmos
# bytes que o updater vai anunciar, entao o client recem-instalado ja nasce em dia
cp ../vethara-repo/client/init.lua /tmp/vethara-client/
cp -r ../vethara-repo/client/modules/game_helper /tmp/vethara-client/modules/
# o bot antigo (mods/game_bot) sai da lista de carga e nao vai no pacote:
# quem faz o papel dele agora e o Assistente, no mesmo botao
cp ../vethara-repo/client/mods/client_mods/mods.otmod /tmp/vethara-client/mods/client_mods/
rm -rf /tmp/vethara-client/mods/game_bot
# os assets da CipSoft: estao no .gitignore do otclient, entao o git archive nao
# os inclui. Sem os graficos o client abre e falha em catalog-content.json;
# sem os sons ele roda mudo, so com um aviso no log.
cp -r data/things/1525 /tmp/vethara-client/data/things/
cp -r data/sounds/1525 /tmp/vethara-client/data/sounds/
# compacte /tmp/vethara-client como vethara-client.zip
```

A partir dai a publicacao e automatica: crie um **release no GitHub** com o zip
anexado como `vethara-client.zip` e o workflow leva ao VPS sozinho, calcula o
SHA-256 e atualiza a pagina de download. Passo a passo em [CICD.md](CICD.md).

## Taxas do servidor

Respawn, experiencia e velocidade ficam em `servidor/Dockerfile`, que parte da
imagem oficial do Canary e aplica as alteracoes.

| Ajuste | Onde | Valor |
| --- | --- | --- |
| Respawn | `rateSpawn` no config.lua | `3` — os 90s do mapa global viram 30s |
| Experiencia | `rateExp` no config.lua | `50` — 50x, com `rateUseStages = false` |
| Velocidade | `basespeed` em data/XML/vocations.xml | `220` — o dobro da base |
| Premium | `freePremium` no config.lua | `true` — libera o multiplicador de stamina x1.5 |
| Magias | `toggleLearnSpells` no config.lua | `false` — liberadas por level, sem comprar de NPC |
| Magias de quest | `needLearn` em data/scripts/spells | `false` nas 18 que exigiam aprendizado proprio |

**Nao edite o config.lua com `docker exec`.** Ele fica dentro da imagem (o
Dockerfile do Canary faz `COPY config.lua.dist /canary/config.lua`), e o volume
`/data` so guarda o dump do banco. A edicao funciona ate o proximo deploy recriar
o container a partir da imagem — e ai some sem aviso.

O build confere com `grep` que cada `sed` casou. Um `sed` que nao encontra o
padrao sai com sucesso e a imagem subiria com os valores padrao; assim o build
falha em vez de o servidor rodar errado.

Sobre a velocidade: a final e `basespeed + (level - 1)`, entao dobrar a base da
+110 em qualquer nivel — o dobro exato no level 1, cerca de 1,5x no level 100.
Dobrar em todos os niveis exigiria script Lua recalculando a cada level up.

## O mapa fica no host

A imagem do Canary nao traz o `.otbm`. O `start.sh` dela baixa o arquivo quando
nao o encontra, e ele fica na **camada gravavel do container** — que todo deploy
que mexe no servidor descarta. Eram 176 MB baixados de novo a cada vez, sempre a
mesma release, com o servidor fora do ar enquanto isso.

Agora o arquivo mora em `mapa/otservbr.otbm`, no host, e o compose de producao o
monta em `/canary/data-otservbr-global/world/otservbr.otbm` so para leitura. O
`start.sh` encontra o mapa no lugar e nao baixa nada; recriar o container deixa
de custar download.

Quem poe o arquivo la e o `deploy/baixar-mapa.sh`, chamado pelo `subir.sh`
**antes** do `docker compose up` — bind mount de arquivo que nao existe faz o
Docker criar um diretorio no lugar, e o servidor subiria sem mapa. O script e
idempotente: com o mapa presente e integro, nao faz nada.

Ele confere o que baixou antes de instalar: tamanho minimo e o `0xFE` que abre o
no raiz do formato OTBM. Um 404 que volte como pagina HTML com codigo 200 nao
chega a substituir o mapa bom.

Para trocar de mapa, mude o `CANARY_MAP_URL` no `docker/.env`, apague
`mapa/otservbr.otbm` e rode o deploy. **O container precisa ser recriado**: o
bind mount aponta para o inode, entao substituir o arquivo com o container de pe
nao muda o que ele esta lendo — a mesma armadilha do Caddyfile.

## Site: React + API .NET

O site publico e um projeto React (`web/`) consumindo uma API em ASP.NET Core
(`api/`). O MyAAC continua rodando, mas agora responde em `/aac` — e ele que ainda
cuida da criacao de conta e do painel administrativo.

Roteamento no Caddy:

| Caminho | Destino |
| --- | --- |
| `/` | React |
| `/api/*` | API .NET |
| `/aac` | MyAAC |
| `/login` | login-server |
| `/download` | arquivos do client |

**Ao subir pela primeira vez**, ajuste o endereco do MyAAC no `.env`, senao os links
internos dele apontam para a raiz, que agora e o React:

```bash
sed -i 's|^MYAAC_SITE_URL=.*|MYAAC_SITE_URL=https://vethara.com.br/aac|' docker/.env
bash deploy/subir.sh
```

Os dois projetos compilam dentro do Docker: o VPS nao precisa de SDK do .NET nem de
Node instalados.

### Painel de conta

O site tem login proprio: criacao de conta, lista de personagens, criacao de
personagem e troca de senha, tudo pela API .NET. O MyAAC em `/aac` ficou apenas
como painel administrativo.

A sessao usa um token assinado com `VETHARA_JWT_SECRET`, gerado pelo
`gerar-env.sh`. **Se um `.env` antigo nao tiver essa variavel**, a API sobe com um
segredo aleatorio e derruba as sessoes a cada reinicio. Para acrescentar:

```bash
printf '
VETHARA_JWT_SECRET=%s
' "$(openssl rand -base64 48 | tr -d '
')" >> docker/.env
bash deploy/subir.sh
```

## Deploy automatico

Todo push na main publica sozinho, via GitHub Actions. O passo a passo de
configuracao esta em [CICD.md](CICD.md).

## Acessar o banco de uma ferramenta grafica

O banco escuta apenas em `127.0.0.1` dentro do VPS — de fora continua inalcancavel.
Para usar DBeaver, HeidiSQL ou similar, abra um tunel SSH do seu PC:

```powershell
ssh -L 3307:127.0.0.1:3306 tibia@vethara.com.br
```

Deixe essa janela aberta e conecte a ferramenta em:

| Campo | Valor |
| --- | --- |
| Host | `127.0.0.1` |
| Porta | `3307` |
| Banco | `canary` |
| Usuario / senha | os de `CANARY_DB_USER` e `CANARY_DB_PASSWORD` no `.env` |

> **Cuidado ao editar personagens.** O Canary mantem o jogador em memoria e grava no
> banco no logout. Alterar um personagem online faz o servidor sobrescrever a mudanca
> quando ele sair. Edite com o jogador offline, ou use comandos de GM no jogo.

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
