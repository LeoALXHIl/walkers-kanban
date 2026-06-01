@echo off
title Walkers Kanban - Instalacao
cd /d "%~dp0"

echo ========================================
echo    Walkers Kanban - Primeira execucao
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado.
    echo Instale: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias do app (1-2 min)...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [2/2] Tudo pronto! Abrindo o app...
echo.

call npm start
