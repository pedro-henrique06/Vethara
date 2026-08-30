# Client do Vethara

O que e nosso no client fica aqui. O resto vem do
[opentibiabr/otclient](https://github.com/opentibiabr/otclient) e nao e copiado
para este repositorio.

| Arquivo | O que e |
| --- | --- |
| `init.lua` | aponta o client para `https://vethara.com.br/login` |
| `modules/game_helper/` | o Assistente |
| `build-vethara.bat` | script de compilacao |

## Assistente

Equivalente ao helper oficial do Rubinot: cura por magia, cura por pocao, treino
de mana, auto haste, comer e reconectar. Abre pelo botao no menu superior.

Nao e um bot de scripts — nao anda, nao ataca, nao coleta. So automatiza o que o
jogador faria apertando teclas, e por isso e uma ferramenta do servidor e nao
algo que ele precise coibir.

### Duas decisoes que valem registro

**Intervalo minimo de 1 segundo entre magias.** Magia e enviada como fala, e o
servidor corta em `maxMessageBuffer = 4`. Sem o limite, o assistente mutaria o
proprio jogador.

**Uma acao por verificacao, na ordem de urgencia.** Curar antes de treinar mana,
treinar antes de correr. Duas acoes no mesmo ciclo so gastariam o limite de fala
mais rapido sem chegar antes em lugar nenhum.

**Reconexao com atraso e uma tentativa por queda.** Reconectar em laco
transformaria um kick por regra numa enxurrada de logins.

### Instalar para testar

Copie a pasta para o client compilado e reinicie:

```bash
cp -r client/modules/game_helper ../Vethara/client-modern/modules/
```

O modulo tem `autoload: true`, entao carrega sozinho. Se algo quebrar, o erro
aparece em `client-modern/vethara.log` — e so aparece se houver erro: o logger so
descarrega o buffer nesse caso, entao arquivo vazio significa carga limpa.
