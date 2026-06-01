@echo off
setlocal
chcp 65001 >nul
REM Publica SÓ o Portal do Cliente (Firebase Hosting). Grátis — não precisa Blaze.
cd /d "C:\Users\Leonardo\Downloads\walkers-kanban-v4\walkers-kanban-v3"

echo ============================================================
echo   PUBLICAR PORTAL DO CLIENTE (Firebase Hosting - gratis)
echo ============================================================
echo.

echo [1/5] Verificando Firebase CLI...
where firebase >nul 2>nul
if errorlevel 1 (
  echo    Instalando firebase-tools...
  call npm install -g firebase-tools
  if errorlevel 1 ( echo ERRO ao instalar firebase-tools. & pause & exit /b 1 )
) else ( echo    OK. )
echo.

echo [2/5] Login no Firebase (abre o navegador se precisar)...
call firebase login
if errorlevel 1 ( echo ERRO no login. & pause & exit /b 1 )
echo.

echo [3/5] Instalando dependencias do app...
call npm install
if errorlevel 1 ( echo ERRO no npm install. & pause & exit /b 1 )
echo.

echo [4/5] Compilando o app...
call npm run build
if errorlevel 1 ( echo ERRO no build. & pause & exit /b 1 )
echo.

echo [5/5] Publicando regras + site (hosting)...
call firebase deploy --only hosting,firestore:rules
if errorlevel 1 ( echo. & echo ERRO no deploy. Veja a mensagem acima. & pause & exit /b 1 )

echo.
echo ============================================================
echo   PORTAL PUBLICADO!
echo ============================================================
echo.
echo   Os links https://walkerskambam.web.app/#/c/... agora abrem
echo   pra qualquer pessoa. Teste o link da Isabela de novo.
echo.
pause
endlocal
