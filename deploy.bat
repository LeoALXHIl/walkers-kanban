@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   WALKERS KANBAN - Deploy de Cloud Functions + Regras
echo ============================================================
echo.
echo Este script faz:
echo   1. Garante o Firebase CLI instalado
echo   2. Garante login no Firebase
echo   3. Instala dependencias da funcao
echo   4. (opcional) Configura os segredos (email + Power BI)
echo   5. Faz o deploy das functions + regras do Firestore
echo.
echo IMPORTANTE: o projeto precisa estar no plano Blaze.
echo   https://console.firebase.google.com/project/walkerskambam/usage/details
echo.
pause
echo.

REM ---------- 1. Firebase CLI ----------
echo [1/5] Verificando Firebase CLI...
where firebase >nul 2>nul
if errorlevel 1 (
  echo    Nao encontrado. Instalando firebase-tools globalmente...
  call npm install -g firebase-tools
  if errorlevel 1 (
    echo    ERRO ao instalar o firebase-tools. Verifique o Node/npm.
    pause & exit /b 1
  )
) else (
  echo    OK, ja instalado.
)
echo.

REM ---------- 2. Login ----------
echo [2/5] Conferindo login no Firebase...
call firebase login
if errorlevel 1 (
  echo    ERRO no login do Firebase.
  pause & exit /b 1
)
echo.

REM ---------- 3. Dependencias ----------
echo [3/5] Instalando dependencias da funcao...
cd functions
call npm install
if errorlevel 1 (
  echo    ERRO no npm install da funcao.
  cd .. & pause & exit /b 1
)
cd ..
echo.

REM ---------- 4. Segredos (opcional) ----------
echo [4/5] Configuracao de segredos
echo    Voce so precisa fazer isso UMA vez (ou quando trocar uma chave).
set /p SETSECRETS="    Configurar os segredos agora? (S/N): "
if /i "!SETSECRETS!"=="S" (
  echo.
  echo    -- EMAIL_USER: seu Gmail (ex: voce@gmail.com)
  call firebase functions:secrets:set EMAIL_USER
  echo.
  echo    -- EMAIL_PASS: a senha de app de 16 digitos
  echo       Crie em https://myaccount.google.com/apppasswords
  call firebase functions:secrets:set EMAIL_PASS
  echo.
  echo    -- POWERBI_KEY: uma senha forte que vai na URL do Power BI
  call firebase functions:secrets:set POWERBI_KEY
  echo.
) else (
  echo    Pulando configuracao de segredos.
)
echo.

REM ---------- 5. Deploy ----------
echo [5/5] Deploy
set /p DOHOST="    Publicar tambem o Portal do Cliente (site)? (S/N): "
if /i "!DOHOST!"=="S" (
  echo    Compilando o app pro portal...
  call npm install
  call npm run build
  if errorlevel 1 ( echo    ERRO no build. & pause & exit /b 1 )
  echo    Fazendo deploy (functions + regras + hosting)...
  call firebase deploy --only functions,firestore:rules,hosting
) else (
  echo    Fazendo deploy (functions + regras do Firestore)...
  call firebase deploy --only functions,firestore:rules
)
if errorlevel 1 (
  echo.
  echo    ERRO no deploy. Veja a mensagem acima.
  echo    Dica comum: confirme que o projeto esta no plano Blaze.
  pause & exit /b 1
)

echo.
echo ============================================================
echo   DEPLOY CONCLUIDO!
echo ============================================================
echo.
echo   - Email de atribuicao: ativo (atribua alguem num card pra testar)
echo   - Endpoint Power BI: a URL aparece acima como "powerbi(...)"
echo     Use assim no Power BI (Obter Dados - Web):
echo     https://us-central1-walkerskambam.cloudfunctions.net/powerbi?key=SUA_CHAVE^&table=cards
echo.
echo   Guias: CONFIGURAR-EMAIL.md  e  CONFIGURAR-POWERBI.md
echo.
pause
endlocal
