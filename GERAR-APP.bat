@echo off
title Walkers Kanban - Gerar app
cd /d "%~dp0"

echo ========================================
echo    Walkers Kanban - Build do .exe
echo ========================================
echo.

if exist node_modules (
    echo Limpando instalacao antiga...
    rmdir /s /q node_modules
)
if exist package-lock.json del package-lock.json
if exist WalkersKanban-win32-x64 (
    echo Limpando build anterior...
    rmdir /s /q WalkersKanban-win32-x64
)

echo.
echo [1/2] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar.
    pause
    exit /b 1
)

echo.
echo [2/2] Empacotando o app...
call npm run package
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao empacotar.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCESSO!
echo ========================================
echo.
echo App gerado em: WalkersKanban-win32-x64\WalkersKanban.exe
echo.
echo IMPORTANTE: o servidor MCP fica em:
echo   WalkersKanban-win32-x64\resources\app.asar.unpacked\mcp-server.js
echo.
echo Ao configurar o Claude Desktop, aponte para esse caminho
echo (ou rode o CONFIGURAR-CLAUDE.bat ANTES de empacotar pra usar
echo o caminho da pasta de desenvolvimento).
echo.

explorer WalkersKanban-win32-x64
pause
