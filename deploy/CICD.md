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

## Se o deploy falhar

O log do job mostra em qual etapa parou.

**Falhou no build:** o problema está no código; produção não foi tocada.

**Falhou no SSH:** confira os três segredos. `Permission denied (publickey)`
costuma ser a chave privada colada pela metade — ela tem várias linhas.

**Falhou na verificação final:** o deploy rodou, mas o site não respondeu. Entre
no VPS e veja o que subiu:

```bash
cd ~/Vethara
docker compose ps
docker compose logs --tail 50 api
```
