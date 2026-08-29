# Vethara

Servidor de Tibia (OT). O mundo principal roda **Canary** com protocolo **15.25**, servido por
imagem Docker — não há nada para compilar no deploy.

Este repositório guarda **só o que é nosso**: configuração de deploy, patches e ferramentas.
O código do servidor e dos clients vem dos projetos originais, referenciados abaixo.

---

## Subir o servidor

Requisito único: Docker com Compose v2.

```bash
git clone git@github.com:pedro-henrique06/Vethara.git
cd Vethara/docker
cp .env.dist .env
docker compose up -d
```

O `.env` **não está versionado** (contém senhas). Crie-o a partir do `.env.dist` em cada máquina.

## Deploy em VPS

O passo a passo completo — HTTPS, firewall, backup — está em **[deploy/README.md](deploy/README.md)**.

Resumo:

```bash
git clone git@github.com:pedro-henrique06/Vethara.git && cd Vethara
bash deploy/gerar-env.sh vethara.com.br
bash deploy/subir.sh
bash deploy/trocar-senha-god.sh
```

### Antes de expor na internet

O `docker/DOCKER.md` do upstream é explícito: a configuração padrão é para uso local. Antes de
abrir qualquer porta:

- [ ] `CANARY_SERVER_IP` = domínio ou IP **público**. Se ficar `127.0.0.1`, cada jogador tenta
      conectar na própria máquina — o servidor sobe e ninguém entra, sem erro no log.
- [ ] Trocar a senha da conta **`@god`** (o padrão é `god`, com poder total).
- [ ] Trocar `MYAAC_ADMIN_PASSWORD` (padrão `admin123`).
- [ ] Trocar `CANARY_DB_PASSWORD` e `CANARY_DB_ROOT_PASSWORD`.
- [ ] `CANARY_TEST_ACCOUNTS=false` — senão qualquer um entra com `@test1` / `test`.
- [ ] Fixar a tag das imagens em vez de `latest`.
- [ ] Backup diário do volume do MariaDB. Perder o banco é perder todos os personagens.

### Portas

| Porta | Serviço |
| --- | --- |
| 7171 | Login do jogo |
| 7172 | Mundo 15.25 |
| 7174 / 7175 | Mundos 11.00 e 8.60 (o Canary serve os três) |
| 8088 | Login web service — o client 13+ não aceita IP direto |
| 8080 | Site (MyAAC) |

Site e login web devem ficar atrás de proxy reverso com HTTPS. Não exponha 8080 e 8088 direto.

---

## Client

`client/init.lua` é a configuração do nosso client, um fork do
[opentibiabr/otclient](https://github.com/opentibiabr/otclient) — o mesmo caminho que o RubinOT
segue com o RTC.

Para reconstruir:

```bash
git clone https://github.com/opentibiabr/otclient.git
cd otclient
# aplicar patches/client-modern-vethara.patch, ou copiar client/init.lua por cima
cmake --preset windows-release -DOPTIONS_ENABLE_SCCACHE=OFF
cmake --build --preset windows-release
```

O preset já mira toolset **v145** e triplet `x64-windows-static-release`. Compila sem nenhum patch
de compatibilidade.

Os **assets 15.25 não estão versionados** — são arquivos da CipSoft. O client baixa sozinho na
primeira execução (~395 MB, do repositório `dudantas/tibia-client`); basta aceitar o prompt.

---

## Site

| Pasta | O que é |
| --- | --- |
| `web/` | React + Vite. Gera arquivos estáticos, servidos por nginx atrás do Caddy |
| `api/` | ASP.NET Core Minimal API, lê o MariaDB com MySqlConnector |

Desenvolvimento local:

```bash
cd api && dotnet run                    # API em http://localhost:8080
cd web && npm install && npm run dev    # front em http://localhost:5173
```

O Vite encaminha `/api` para a API local, então o front se comporta igual ao de produção.
Em produção os dois viram containers e o Caddy roteia por caminho — mesma origem, sem CORS.

O MyAAC continua no ar em `/aac`, cuidando de criação de conta e do painel administrativo
até a API assumir essas partes.

---

## Ferramentas (`dev/`)

Testam o servidor no nível de protocolo, sem abrir client gráfico. Úteis para separar
"o servidor está quebrado" de "o client está mal configurado".

```bash
node dev/login-test.js god god      # autentica e lista personagens
node dev/enter-world.js god "Nome"  # entra no mundo e lê a descrição do mapa
```

Foram escritos para o protocolo **8.60** (RSA cru + XTEA). Não servem para o mundo 15.25, que usa
login por HTTP — nesse caso o teste equivalente é:

```bash
curl -X POST http://localhost:8088/login \
  -H "Content-Type: application/json" \
  -d '{"type":"login","email":"@god","password":"god"}'
```

---

## Patches (`patches/`)

| Arquivo | O que é |
| --- | --- |
| `client-modern-vethara.patch` | Rebrand do OTClient e `Servers_init` apontando para o nosso login |
| `client-otcv8-vethara.patch` | Rebrand do OTClientV8 (mundo 8.60) e ajustes do projeto VS |
| `server-860-codigo.patch` | Migrações de API no TFS 1.5 para compilar com Boost 1.92 / fmt 12 |
| `server-860-lua54.patch` | Correções de Lua 5.4 no datapack (variável de controle de `for` é const) |

Os dois últimos são do **mundo 8.60**, um experimento anterior que ficou funcionando mas não é o
mundo principal. Ficam aqui como registro — cada um custou uma investigação longa.

### Nota sobre o mundo 8.60

Não está neste repositório por inteiro porque depende de um mapa de 95 MB e de assets da CipSoft.
Para reconstruí-lo: `nekiro/TFS-1.5-Downgrades` (branch `8.60`) como engine, ou
`tranthao4/PatricAngly-RealMap-8.6-TFS-1.5`, que traz engine e datapack casados.

Duas armadilhas que custaram caro e valem registro:

1. O nome dos arquivos de spawn e house fica **gravado dentro do `.otbm`**, não vem do `mapName`
   do `config.lua`. Se não baterem, o mapa carrega e o mundo nasce vazio.
2. O datapack usa `<close>`, sintaxe de Lua 5.4. Compilar a engine com LuaJIT (Lua 5.1) faz o
   `global.lua` morrer, e aí *nenhum* script registra — centenas de erros com uma causa só.

---

## Origem do código

| Componente | Upstream |
| --- | --- |
| Servidor (15.25) | [opentibiabr/canary](https://github.com/opentibiabr/canary) |
| Client (15.25) | [opentibiabr/otclient](https://github.com/opentibiabr/otclient) |
| Site | [slawkens/myaac](https://github.com/slawkens/myaac) |
| Login web service | [opentibiabr/login-server](https://github.com/opentibiabr/login-server) |
