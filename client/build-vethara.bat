@echo off
rem Build do OTClient (opentibiabr) para o Vethara, e opcionalmente o instalador.
rem O preset windows-release ja mira o toolset v145 e triplet x64-windows-static-release.
rem
rem   build-vethara.bat          compila o client
rem   build-vethara.bat 1.2.0    compila e gera o VetharaSetup.exe dessa versao
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 exit /b 1

set "VCPKG_ROOT=C:\Repo\vcpkg"
set "CMAKE=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

rem Pasta do client compilado: e ela que o instalador empacota inteira, e e a
rem mesma que vira o vethara-client.zip.
set "ORIGEM=C:\Repo\Vethara\client-modern"
set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

pushd "%ORIGEM%"
rem sccache nao esta instalado nesta maquina; sem desligar, o configure falha.
rem CMAKE_BUILD_TYPE=Release: o preset usa RelWithDebInfo, que linka com
rem /SUBSYSTEM:CONSOLE e deixa uma janela de terminal aberta junto do jogo.
"%CMAKE%" --preset windows-release -DOPTIONS_ENABLE_SCCACHE=OFF -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 (popd & exit /b 1)
"%CMAKE%" --build --preset windows-release
set RC=%errorlevel%
popd
if not "%RC%"=="0" exit /b %RC%

rem --- Instalador -----------------------------------------------------------
rem Sem versao na linha de comando, o comportamento e o de antes: so compila.
if "%~1"=="" (
  echo.
  echo Client compilado. Para gerar o instalador tambem:  build-vethara.bat 1.2.0
  exit /b 0
)

rem Falhar aqui e muito melhor que empacotar uma pasta sem o jogo dentro: o
rem instalador sairia com tamanho plausivel e so quebraria na maquina do jogador.
if not exist "%ORIGEM%\otclient.exe" (
  echo ERRO: nao achei o otclient.exe em "%ORIGEM%". >&2
  echo Ajuste ORIGEM neste script para a pasta onde o build deixou o executavel. >&2
  exit /b 1
)

if not exist "%ISCC%" (
  echo ERRO: nao achei o ISCC.exe em "%ISCC%". >&2
  echo Instale o Inno Setup 6 ^(jrsoftware.org^) ou ajuste ISCC neste script. >&2
  exit /b 1
)

echo.
echo == Gerando o instalador da versao %~1
"%ISCC%" /DOrigem="%ORIGEM%" /DVersao="%~1" "%~dp0instalador.iss"
set RC=%errorlevel%
if not "%RC%"=="0" exit /b %RC%

echo.
echo Instalador pronto em "%~dp0Output\VetharaSetup.exe".
echo Anexe esse arquivo ao release com este nome exato.
exit /b 0
