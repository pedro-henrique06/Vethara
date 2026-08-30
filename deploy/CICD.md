# Deploy automático pelo GitHub Actions

Todo push na `main` compila a API e o front e, se passar, publica no VPS.
Pull requests e outras branches só compilam — não tocam em produção.

## 1. Instalar o script de deploy no VPS

```bash
cd ~/Vethara && git pull
chmod +x deploy/deploy-remoto.sh
```

## 2. Criar a chave que o Actions vai usar

No VPS:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/actions -N '' -C "github-actions"
```

Autorize essa chave **presa a um único comando**:

```bash
printf 'command="%s/deploy/deploy-remoto.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' \
  "$HOME/Vethara" "$(cat ~/.ssh/actions.pub)" >> ~/.ssh/authorized_keys
```

O `command=` é o que torna isso seguro: essa chave **não dá shell**. Qualquer
comando enviado por ela é ignorado, e o script de deploy roda no lugar. Se a
chave privada vazar do GitHub, o pior que alguém consegue é disparar um deploy.

Confirme que ficou correto:

```bash
tail -1 ~/.ssh/authorized_keys
```

A linha precisa começar com `command="`, não com `ssh-ed25519`.

## 3. Cadastrar os segredos no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Segredo | Valor |
| --- | --- |
| `VPS_SSH_KEY` | conteúdo de `~/.ssh/actions` — a chave **privada**, inteira |
| `VPS_HOST` | `vethara.com.br` |
| `VPS_USER` | `tibia` |

```bash
cat ~/.ssh/actions
```

Copie tudo, incluindo as linhas `BEGIN` e `END`.

> ⚠️ Essa é a chave **privada**. Ela vai para o cofre de segredos do GitHub, que
> nunca a exibe de volta nem a imprime nos logs. Não cole em nenhum outro lugar.

## 4. Testar

**Actions → Deploy → Run workflow**.

O job compila, publica, e só passa se `https://vethara.com.br/api/saude` responder
200 depois — ele tenta por até dois minutos, dando tempo do stack subir.

Daí em diante, `git push` na `main` publica sozinho.

## Como o workflow se protege

**Compila antes de publicar.** Código que não compila não chega ao VPS. O build
do front roda o `tsc`, então erro de tipo também reprova.

**Um deploy por vez.** Dois simultâneos deixariam o VPS num estado imprevisível.
O segundo espera o primeiro terminar — cancelar no meio de um `docker compose up`
seria pior que enfileirar.

**Chave do host fixada** no workflow, em vez de `ssh-keyscan`. Buscar a chave na
hora aceita o que o servidor apresentar, e isso confia em quem atender. A que está
fixada tem o fingerprint `SHA256:WdmPWG2mw70lcsAKoBY1aIAFnYJFdreGnobi35eZ85E`,
o mesmo que aparece quando você conecta por SSH.

**`git merge --ff-only`** no VPS. Se alguém editou arquivos direto no servidor,
o deploy para em vez de criar um merge silencioso que ninguém revisou.

**Verificação depois de publicar.** O deploy só é considerado bem-sucedido se o
site voltar a responder. Sem isso, um deploy que derruba tudo apareceria verde.

**Rollback automático.** O próprio VPS confere `/api/saude` logo depois de subir,
por até dois minutos. Se não responder, ele volta para o commit anterior, sobe de
novo e falha o job. O site fica no ar com a versão antiga em vez de fora com a
nova — e você fica sabendo pelo job vermelho, não por um jogador.

O `git reset --hard` do rollback anda com a `main` local para trás de propósito.
Como o commit é ancestral do `origin/main`, o `git merge --ff-only` do próximo
deploy avança sozinho: não há divergência para resolver na mão.

**shellcheck nos scripts de deploy.** A sintaxe passar diz pouco. O que quebra um
script com `set -euo pipefail` em produção é variável sem aspas, `$*` onde devia
ser `$@`, comparação que sempre dá verdadeiro — tudo sintaxe válida.

## Se o deploy falhar

O log do job mostra em qual etapa parou.

**Falhou no build:** o problema está no código; produção não foi tocada.

**Falhou no SSH:** confira os três segredos. `Permission denied (publickey)`
costuma ser a chave privada colada pela metade — ela tem várias linhas.

**Falhou depois de subir:** o site não respondeu, e o VPS já voltou sozinho para o
commit anterior — o log do job traz as últimas linhas de `api`, `web` e `caddy`,
que costumam dizer o motivo. Produção está no ar com a versão antiga; a nova é que
precisa de conserto. Para ver o estado atual:

```bash
cd ~/Vethara
git log --oneline -1        # em que commit o VPS ficou
docker compose ps
docker compose logs --tail 50 api
```

Depois de corrigir, um push novo na `main` publica por cima normalmente.

## Publicar o client

O client não é compilado na pipeline: o `otclient.exe` sai do MSVC no Windows,
com vcpkg, e runner Linux não reproduz isso. O que está automatizado é a
**publicação** — a parte que era um `scp` manual.

O fluxo passa a ser:

### 1. Gerar o zip na sua máquina, como já fazia

```bash
cd client-modern
git archive HEAD | tar -x -C /tmp/vethara-client
cp otclient.exe init.lua /tmp/vethara-client/
# compacte /tmp/vethara-client como vethara-client.zip
```

### 2. Criar um release no GitHub

**Releases → Draft a new release**, crie uma tag (`v1.0.0`, `v1.1.0`, …), e anexe
o zip. O nome do arquivo precisa ser exatamente **`vethara-client.zip`** — é por
ele que o VPS procura.

### 3. Publicar

Ao publicar o release, o workflow **Publicar client** dispara sozinho. Ele:

1. confere que o zip está mesmo anexado, antes de tocar no VPS;
2. manda o VPS baixar o arquivo direto do GitHub;
3. confere que o site já está servindo aquela versão.

Para republicar uma versão antiga — um rollback — use **Actions → Publicar client
→ Run workflow** e informe a tag.

### Por que o VPS baixa em vez de receber

O zip nunca passa pelo runner. São 41 MB que não sobem e não descem, e, mais
importante, não existe caminho de escrita arbitrária do GitHub para dentro do
servidor: a chave só consegue pedir `client <tag>`, e o script decide sozinho
qual URL buscar e onde gravar.

A troca do arquivo é um `mv` dentro da mesma partição, que é atômico — quem
estiver baixando durante a publicação recebe a versão antiga inteira, nunca um
zip pela metade.

### O hash na página de download

O `publicar-client.sh` grava um `versao.json` junto do zip, com tag, tamanho,
data e SHA-256, e a página de download lê dali.

Antes isso era um hash fixo no código React. O risco era concreto: publicar um
client novo e esquecer de trocar o hash faria o jogador que confere concluir que
baixou um arquivo adulterado.

Enquanto não houver nenhum release publicado, a página omite versão e hash — ela
prefere não mostrar nada a mostrar um valor velho. Se quiser preencher os dados
do zip que já está no ar sem cortar um release:

```bash
cd ~/Vethara/download
printf '{\n  "versao": "manual",\n  "arquivo": "vethara-client.zip",\n  "tamanho": %s,\n  "sha256": "%s",\n  "publicado": "%s"\n}\n' \
  "$(stat -c %s vethara-client.zip)" \
  "$(sha256sum vethara-client.zip | cut -d' ' -f1)" \
  "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > versao.json
```

### Se falhar

**`vethara-client.zip nao encontrado`:** o release existe mas o zip não foi
anexado, ou foi anexado com outro nome. Nada foi alterado no VPS.

**`arquivo pequeno demais`:** o VPS baixou uma página de erro em vez do zip. O
arquivo antigo continua no ar — o script só troca depois de validar.

**`o site ainda nao esta servindo <tag>`:** o download foi feito mas o Caddy está
servindo outra coisa. Confira no VPS:

```bash
cat ~/Vethara/download/versao.json
ls -la ~/Vethara/download/
```
