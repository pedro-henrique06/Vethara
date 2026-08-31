# Client do Vethara

O que e nosso no client fica aqui. O resto vem do
[opentibiabr/otclient](https://github.com/opentibiabr/otclient) e nao e copiado
para este repositorio.

| Arquivo | O que e |
| --- | --- |
| `init.lua` | aponta o client para `https://vethara.com.br/login` |
| `modules/game_helper/` | o Assistente |
| `build-vethara.bat` | script de compilacao |
| `mods/client_mods/mods.otmod` | lista de mods, sem o bot antigo |

## Assistente

Equivalente ao helper oficial do Rubinot: cura por magia, cura por item, runa no
alvo, treino de mana, auto haste, comer e reconectar. Abre pelo botao da barra do
`game_mainpanel` — o mesmo que era do bot antigo.

Os itens sao escolhidos da mochila, e nao de uma lista: arraste para o quadro, ou
use Escolher e aponte. Botao direito no quadro limpa. Assim qualquer item do
servidor serve, inclusive item custom.

Nao e um bot de scripts — nao anda, nao procura alvo, nao coleta. So automatiza o
que o jogador faria apertando teclas, e a runa de ataque so dispara contra o alvo
que ele mesmo escolheu. Por isso e uma ferramenta do servidor, e nao algo que ele
precise coibir.

### Decisoes que valem registro

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

O modulo tem `autoload: true`, entao carrega sozinho.

## O bot antigo

O `mods/game_bot` do OTClientV8 vinha junto e colocava um botao "Bot" na barra
do `game_mainpanel`. Ele saiu da lista `load-later` do `mods/client_mods/mods.otmod`
e nao vai no pacote.

O Assistente assumiu o lugar dele: mesmo id de botao (`botButton`), mesmo icone
(`/images/options/bot`) e mesmo indice na barra. Para o jogador, o botao continua
onde estava — o que muda e o que ele abre.

Para trazer o bot de volta, basta devolver `- game_bot` aquela lista: a pasta do
mod continua intacta no checkout do otclient, so nao e distribuida.

## O travamento do fit-children

Vale registrar porque custou horas e porque o sintoma engana.

O painel rolavel do Assistente tinha `fit-children: true` junto com ancoras em
cima e embaixo. As duas regras se contradizem: a ancora fixa a altura, o
`fit-children` manda ajustar ao conteudo. O layout nunca converge, e o client
trava em laco — sem erro, sem log e sem janela.

O que se ve de fora: o processo fica vivo, carrega os 6.039 assets, chega a
350 MB e ate cria a janela com o titulo certo. Ela so nunca fica visivel.

### Como diagnosticar

**Processo vivo nao prova que abriu.** O que prova e enumerar as janelas do
processo e olhar `IsWindowVisible`, filtrando por PID com `EnumWindows`.

**Log vazio nao prova carga limpa.** O client sempre escreve o cabecalho
`Operating system: Windows` no inicio. Se nem ele aparece no arquivo, o processo
travou antes do primeiro descarregamento do buffer, e o arquivo vazio nao e
evidencia de nada. Erro forca o flush — foi por isso que a execucao com o bug do
`tr('%')` mostrou tudo, e as seguintes ficaram mudas.

**Bissecao resolve.** Sem o modulo a janela abre; com o modulo e `fit-children`
nao abre; com o modulo e sem `fit-children` abre.
