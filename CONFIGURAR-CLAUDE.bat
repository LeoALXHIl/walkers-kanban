@echo off
title Walkers Kanban - Configurar Claude Desktop
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo    Configurar Claude Desktop
echo ========================================
echo.

REM Verifica se mcp-server.js existe
if not exist "%~dp0mcp-server.js" (
    echo [ERRO] mcp-server.js nao encontrado em:
    echo %~dp0
    echo.
    pause
    exit /b 1
)

REM Verifica se Node esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Instale: https://nodejs.org/
    pause
    exit /b 1
)

set "CLAUDE_CFG=%APPDATA%\Claude\claude_desktop_config.json"
set "CLAUDE_DIR=%APPDATA%\Claude"
set "MCP_PATH=%~dp0mcp-server.js"

REM Substitui \ por \\ pra ficar valido em JSON
set "MCP_PATH_JSON=%MCP_PATH:\=\\%"

echo Servidor MCP em:
echo   %MCP_PATH%
echo.
echo Config do Claude Desktop:
echo   %CLAUDE_CFG%
echo.

REM Cria pasta do Claude se nao existir
if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"

REM Se config nao existe, cria do zero
if not exist "%CLAUDE_CFG%" (
    echo Criando configuracao nova...
    (
        echo {
        echo   "mcpServers": {
        echo     "walkers-kanban": {
        echo       "command": "node",
        echo       "args": ["%MCP_PATH_JSON%"]
        echo     }
        echo   }
        echo }
    ) > "%CLAUDE_CFG%"
    goto :success
)

REM Se ja existe, faz backup e usa Node pra fazer merge JSON correto
echo Configuracao ja existe. Fazendo backup e atualizando...
copy "%CLAUDE_CFG%" "%CLAUDE_CFG%.backup" >nul

node -e "const fs=require('fs');const path=process.argv[1];const mcpPath=process.argv[2];let cfg={};try{cfg=JSON.parse(fs.readFileSync(path,'utf-8'));}catch(e){cfg={};}if(!cfg.mcpServers)cfg.mcpServers={};cfg.mcpServers['walkers-kanban']={command:'node',args:[mcpPath]};fs.writeFileSync(path,JSON.stringify(cfg,null,2));console.log('OK');" "%CLAUDE_CFG%" "%MCP_PATH%"

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao atualizar config.
    echo Backup salvo em: %CLAUDE_CFG%.backup
    pause
    exit /b 1
)

:success
echo.
echo ========================================
echo  CONFIGURADO COM SUCESSO
echo ========================================
echo.
echo Proximos passos:
echo.
echo   1. FECHE o Claude Desktop COMPLETAMENTE
echo      (botao direito no icone da bandeja - Quit/Sair)
echo.
echo   2. Abra o Claude Desktop novamente
echo.
echo   3. Verifique o icone de ferramentas (parafuso)
echo      no canto inferior do chat - deve aparecer
echo      "walkers-kanban" na lista de MCPs
echo.
echo   4. Pergunte algo tipo:
echo      "Quais cards estao no meu kanban?"
echo      "Crie um card pra Tech Store em A Iniciar"
echo      "Mova o Alivemed pra Concluido"
echo.
echo Configuracao salva em:
echo   %CLAUDE_CFG%
echo.

pause
