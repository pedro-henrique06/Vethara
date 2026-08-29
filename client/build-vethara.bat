@echo off
rem Build do OTClient (opentibiabr) para o Vethara.
rem O preset windows-release ja mira o toolset v145 e triplet x64-windows-static-release.
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 exit /b 1

set "VCPKG_ROOT=C:\Repo\vcpkg"
set "CMAKE=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

pushd "C:\Repo\Vethara\client-modern"
rem sccache nao esta instalado nesta maquina; sem desligar, o configure falha.
rem CMAKE_BUILD_TYPE=Release: o preset usa RelWithDebInfo, que linka com
rem /SUBSYSTEM:CONSOLE e deixa uma janela de terminal aberta junto do jogo.
"%CMAKE%" --preset windows-release -DOPTIONS_ENABLE_SCCACHE=OFF -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 (popd & exit /b 1)
"%CMAKE%" --build --preset windows-release
set RC=%errorlevel%
popd
exit /b %RC%
