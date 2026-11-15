; Instalador do client do Vethara.
;
; Gera um VetharaSetup.exe unico: o jogador baixa, da dois cliques e joga. Antes
; disto eram tres passos (baixar o zip, descompactar a pasta inteira, achar o
; otclient.exe la dentro), e o segundo era o que mais gerava duvida -- rodar o
; executavel de dentro do zip nao funciona, porque ele precisa dos arquivos ao
; lado.
;
; Nao traz mecanismo de atualizacao proprio: o updater do OTClient ja compara o
; CRC32 de cada arquivo com o manifesto de /api/updater no boot e baixa so o que
; mudou. O instalador resolve a primeira instalacao, e o updater cuida do resto.
;
; Compilado pelo ISCC.exe, chamado no fim do build-vethara.bat:
;
;   ISCC.exe /DOrigem="C:\Repo\Vethara\client-modern" /DVersao="1.2.0" instalador.iss
;
; Os dois parametros sao obrigatorios de proposito. Caminho de origem embutido
; aqui quebraria em qualquer maquina que nao fosse a sua, e versao fixa no script
; seria esquecida num release e publicaria um instalador mentindo a propria versao.

#ifndef Origem
  #error Faltou /DOrigem="caminho do client compilado"
#endif
#ifndef Versao
  #error Faltou /DVersao="1.2.0"
#endif

[Setup]
; Fixo e unico: e por ele que o Windows reconhece uma instalacao existente e
; atualiza no lugar, em vez de criar uma segunda entrada em Aplicativos.
AppId={{05B6D77F-4ED0-460A-A89B-197CC5B84E1C}
AppName=Vethara
AppVersion={#Versao}
AppPublisher=Vethara
AppPublisherURL=https://vethara.com.br
AppSupportURL=https://vethara.com.br
VersionInfoVersion={#Versao}

; %LOCALAPPDATA%\Vethara, e nao Arquivos de Programas. Esta e a decisao que faz
; a atualizacao automatica funcionar: o updater escreve dentro da pasta do
; client, e sob Program Files isso exigiria elevacao a cada boot -- ou falharia
; em silencio, deixando o jogador num client velho sem saber.
DefaultDirName={localappdata}\Vethara
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=auto

; O client e 64 bits.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; Se o jogador estiver com o client aberto, o Inno pede para fechar em vez de
; falhar ao sobrescrever o executavel em uso.
CloseApplications=yes
RestartApplications=no

OutputBaseFilename=VetharaSetup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\otclient.exe
UninstallDisplayName=Vethara

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na area de trabalho"; GroupDescription: "Atalhos:"

[Files]
; recursesubdirs + createallsubdirs leva a arvore inteira do client compilado.
; ignoreversion e necessario: os arquivos que o updater baixa nao carregam
; versao de arquivo, e sem isso o instalador os deixaria para tras numa
; reinstalacao.
;
; Os excludes tiram sobras do build MSVC que nao servem ao jogador e so engordam
; o download.
Source: "{#Origem}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: "*.pdb,*.ilk,*.exp,*.lib,*.obj,.git\*"

[Icons]
Name: "{autoprograms}\Vethara"; Filename: "{app}\otclient.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Vethara"; Filename: "{app}\otclient.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\otclient.exe"; WorkingDir: "{app}"; \
    Description: "Jogar agora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Os arquivos graficos e as atualizacoes chegam depois da instalacao, entao o
; Inno nao os conhece e os deixaria para tras -- centenas de MB orfaos.
Type: filesandordirs; Name: "{app}"
