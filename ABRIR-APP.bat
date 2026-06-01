@echo off
title Walkers Kanban
cd /d "%~dp0"

if not exist node_modules (
    echo Primeira execucao detectada. Instalando dependencias...
    call npm install
)

start "" cmd /c "npm start"
exit
