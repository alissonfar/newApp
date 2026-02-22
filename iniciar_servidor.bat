@echo off
title Iniciar Backend e Frontend
cls

:menu
echo =========================================
echo   DESEJA INICIAR A APLICACAO AGORA?
echo =========================================
echo [S] Sim, rodar Server e Front
echo [N] Nao, sair agora
echo =========================================

choice /c SN /m "Escolha uma opcao:"

if errorlevel 2 goto sair
if errorlevel 1 goto rodar

:rodar
echo.
echo Iniciando Backend...
start cmd /k "cd /d C:\Users\Alisson\Documents\NEW APP VERSION SERVER\newApp\backend && npm run dev"

echo Iniciando Frontend...
start cmd /k "cd /d C:\Users\Alisson\Documents\NEW APP VERSION SERVER\newApp\controle-gastos-frontend && npm start"

echo.
echo Tudo pronto! As janelas abriram separadamente.
pause
exit

:sair
echo Operacao cancelada pelo usuario.
pause
exit