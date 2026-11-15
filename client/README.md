# Client do Vethara

O que e nosso no client fica aqui. O resto vem do
[opentibiabr/otclient](https://github.com/opentibiabr/otclient) e nao e copiado
para este repositorio.

| Arquivo | O que e |
| --- | --- |
| `init.lua` | aponta o client para `https://vethara.com.br/login` |
| `modules/game_helper/` | o Assistente |
| `modules/game_gm/` | o menu de GM, que cria itens pelo nome |
| `build-vethara.bat` | script de compilacao, e do instalador |
| `instalador.iss` | script do Inno Setup que gera o VetharaSetup.exe |
| `mods/client_mods/mods.otmod` | lista de mods, sem o bot antigo |

## Assistente

Equivalente ao helper oficial do Rubinot, em duas abas. Abre pelo botao da barra
do `game_mainpanel` — o mesmo que era do bot antigo.

| Aba | O que tem |
| --- | --- |
| **Cura e apoio** | cura por magia, cura por item, treino de mana, auto haste, comer e reconectar |
| **Ataque** | magia de ataque com piso de mana, runa no alvo por vida do alvo, e o limite de nao atacar jogadores |

Os itens sao escolhidos da mochila, e nao de uma lista: arraste para o quadro, ou
use Escolher e aponte. Botao direito no quadro limpa. Assim qualquer item do
servidor serve, inclusive item custom.

Nao e um bot de scripts — nao anda, nao procura alvo, nao coleta. So automatiza o
que o jogador faria apertando teclas, e **nada da aba de ataque dispara sem um
alvo que ele mesmo escolheu**. Por isso e uma ferramenta do servidor, e nao algo
que ele precise coibir.

### Decisoes que valem registro

**Intervalo minimo de 1 segundo entre magias.** Magia e enviada como fala, e o
servidor corta em `maxMessageBuffer = 4`. Sem o limite, o assistente mutaria o
proprio jogador.

**Uma acao por verificacao, na ordem de urgencia.** Curar antes de treinar mana,
treinar antes de correr. Duas acoes no mesmo ciclo so gastariam o limite de fala
mais rapido sem chegar antes em lugar nenhum.

**Reconexao com atraso e uma tentativa por queda.** Reconectar em laco
transformaria um kick por regra numa enxurrada de logins.

**Cura ganha do ataque, sempre.** A verificacao roda a cura antes do ataque, e a
magia de ataque tem piso de mana proprio. Sem isso, o ataque gastaria a mana de
que a cura vai precisar e o jogador morreria com a barra de mana no chao.

**Ataque nao escolhe alvo, e o filtro de jogador vem desligado.** A runa no alvo
sempre disparou contra quem o jogador estivesse atacando; manter o padrao evita
mudar em silencio o comportamento de quem ja usava. Quem caca perto de outros
jogadores liga "Nao atacar jogadores" e o assistente ignora alvo humano.

**As duas abas sao dois paineis fixos, e so a visibilidade muda.** Nao ha widget
criado em tempo de execucao — a mesma razao pela qual a tela inteira e estatica
(ver abaixo). A aba escolhida tambem muda de cor, porque em alguns temas o estado
`on` de um botao nao pinta nada.

### Instalar para testar

Copie a pasta para o client compilado e reinicie:

```bash
cp -r client/modules/game_helper ../Vethara/client-modern/modules/
```

O modulo tem `autoload: true`, entao carrega sozinho.

## Instalador

O jogador baixa um `VetharaSetup.exe` e da dois cliques. Antes eram tres passos
— baixar o zip, descompactar a pasta inteira, achar o `otclient.exe` la dentro —
e o segundo era o que mais gerava duvida, porque rodar o executavel de dentro do
zip nao funciona.

```bat
build-vethara.bat 1.2.0
```

Compila o client e gera `client\Output\VetharaSetup.exe`. Sem a versao na linha
de comando, so compila, como antes. Precisa do Inno Setup 6 instalado.

O zip continua sendo publicado ao lado, para quem prefere escolher a pasta ou ja
tem uma instalacao. Anexe os dois ao release; o `deploy/publicar-client.sh` pega
os dois, e o instalador e opcional — release sem ele publica so o zip.

### Decisoes que valem registro

**Instala em `%LOCALAPPDATA%\Vethara`, nao em Arquivos de Programas.** E o que
faz a atualizacao automatica funcionar: o updater escreve dentro da pasta do
client, e sob `Program Files` isso exigiria elevacao a cada boot — ou falharia em
silencio, deixando o jogador num client velho sem saber.

**Nao traz mecanismo de atualizacao proprio.** O updater do OTClient ja compara o
CRC32 de cada arquivo com o manifesto de `/api/updater` e baixa so o que mudou. O
instalador resolve a primeira instalacao; o resto ja funcionava.

**Os arquivos graficos continuam vindo depois.** Sao da CipSoft e nao podem ser
redistribuidos — por isso estao no `.gitignore` e o `clientAssets` do `init.lua`
os baixa na primeira abertura. O instalador leva client e modulos; o exe fica
pequeno e nos ficamos longe de problema de direito autoral.

**O desinstalador apaga a pasta inteira.** Assets e atualizacoes chegam depois da
instalacao, entao o Inno nao os conhece e os deixaria para tras — centenas de MB
orfaos.

## O bot antigo

O `mods/game_bot` do OTClientV8 vinha junto e colocava um botao "Bot" na barra
do `game_mainpanel`. Ele saiu da lista `load-later` do `mods/client_mods/mods.otmod`
e nao vai no pacote.

O Assistente assumiu o lugar dele: mesmo id de botao (`botButton`), mesmo icone
(`/images/options/bot`) e mesmo indice na barra. Para o jogador, o botao continua
onde estava — o que muda e o que ele abre.

Para trazer o bot de volta, basta devolver `- game_bot` aquela lista: a pasta do
mod continua intacta no checkout do otclient, so nao e distribuida.

## O updater e o certificado

Vale registrar porque o sintoma aponta para o lugar errado com muita forca, e
porque o conserto exige recompilar — entao e facil alguem refazer a investigacao
inteira do zero.

**Sintoma.** No boot, o updater abre uma caixa de erro:

```
Cannot connect to url: https://vethara.com.br/api/updater
error : error in handshake : X509 - Certificate verification failed, e.g. CRL, CA or signature check failed
```

O site abre normalmente no navegador, e **o login no jogo funciona**. So o
updater falha.

### A causa

O client tem **duas** implementacoes de HTTPS, e so uma recebe lista de CAs:

| | Biblioteca | CA configurada | Resultado |
| --- | --- | --- | --- |
| Login | cpp-httplib | `./cacert.pem`, em `src/framework/net/httplogin.cpp` | funciona |
| `g_http` (updater) | IXWebSocket + mbedTLS | nenhuma | falha sempre |

O `ix::SocketTLSOptions` tem `caFile = "SYSTEM"` por padrao. O comentario do
proprio header diz que isso significa "leverage the system defaults" — mas com
mbedTLS no Windows esse "SYSTEM" nao resolve para lista nenhuma. Nenhuma CA e
carregada, e **toda** verificacao falha, com qualquer certificado.

O `g_ixHttpClient` e criado em `Http::init()` e nunca recebe `setTLSOptions`.

### O patch

Em `src/framework/net/protocolhttp.cpp`, no bloco nativo (`#else`), junto do
`#include <ixwebsocket/IXNetSystem.h>`:

```cpp
#include <ixwebsocket/IXSocketTLSOptions.h>
```

Depois do `std::shared_ptr<ix::HttpClient> g_ixHttpClient;`:

```cpp
// O IXWebSocket usa mbedTLS no Windows, e SocketTLSOptions::caFile vem como
// "SYSTEM" por padrao — que ali nao resolve para lista de CAs nenhuma. Sem
// isto, toda verificacao de certificado falha. O httplogin.cpp ja aponta o
// mesmo arquivo com set_ca_cert_path; e por isso que o login funciona e o
// updater nao.
static ix::SocketTLSOptions vetharaTlsOptions()
{
    ix::SocketTLSOptions options;
    options.caFile = "./cacert.pem";
    return options;
}
```

Em `Http::init()`:

```cpp
    if (!g_ixHttpClient) {
        g_ixHttpClient = std::make_shared<ix::HttpClient>(true);
        g_ixHttpClient->setTLSOptions(vetharaTlsOptions());
    }
```

E no websocket, logo depois do `make_shared`:

```cpp
    auto websocket = std::make_shared<ix::WebSocket>();
    websocket->setTLSOptions(vetharaTlsOptions());
    websocket->setUrl(url);
```

O caminho e relativo (`./cacert.pem`), igual ao do `httplogin.cpp`, entao depende
do diretorio de trabalho ser o da instalacao. E a mesma exposicao que o login ja
tem hoje; se um dia um deles quebrar por atalho com "Iniciar em" diferente, os
dois quebram junto e vale trocar os dois por caminho absoluto.

### O que foi descartado no caminho

Util para nao repetir:

**Nao e o servidor.** O job de deploy faz `curl` com verificacao TLS completa em
`/api/saude` de um runner do GitHub e recebe 200. Certificado valido, cadeia
fechando.

**Nao e a raiz do certificado.** A cadeia do Let's Encrypt foi trocada de ECDSA
(ISRG Root X2) para RSA (ISRG Root X1) pelo `key_type rsa2048` no Caddyfile, e o
erro continuou identico. O `cacert.pem` que acompanha o client tem 127
certificados e **tem** a ISRG Root X1.

**Nao e `SSL_CERT_FILE`.** Essa variavel so vale para OpenSSL. A mensagem de erro
e texto literal do mbedTLS, que a ignora.

**Nao e o `cacert.pem` faltando.** Ele esta na raiz da instalacao, com 201 KB.

### Como diagnosticar

**Logar funcionar e o sinal que importa.** Se o login entra e o updater falha com
erro de certificado, o problema nao e certificado — e configuracao diferente
entre as duas pilhas HTTP do client. Nao adianta mexer no servidor.

**Rodar o client de dentro do zip produz o mesmo erro, por outro motivo.** O
Windows extrai so o `otclient.exe` para uma pasta em `%TEMP%`, sem o
`cacert.pem` e sem os modulos. Antes de investigar qualquer coisa, confira de
onde o client esta rodando: `vethara.log` fica no diretorio de trabalho, e se
nao existe nenhum, provavelmente e isso.

**O updater nao pode usar `http://`.** O `updater.lua` chama
`g_resources.updateExecutable(binary)` — ele substitui o executavel. Em HTTP
puro, qualquer um na rede entrega um exe no lugar. Nao e atalho aceitavel.

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
