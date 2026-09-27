@echo off
title TradeLock - Desbloquear Corretoras
:: Verifica se possui privilegios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando privilegios de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ============================================================
echo   DESBLOQUEANDO CORRETORAS NO ARQUIVO HOSTS DO WINDOWS...
echo ============================================================
echo.

set HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts
attrib -r -s -h "%HOSTS_FILE%" >nul 2>&1

powershell -ExecutionPolicy Bypass -Command "$h='C:\Windows\System32\drivers\etc\hosts'; if (Test-Path $h) { (Get-Content $h) | Where-Object { $_ -notmatch 'TRADELOCK' -and $_ -notmatch '127.0.0.1 exnova' -and $_ -notmatch '127.0.0.1 iqoption' -and $_ -notmatch '127.0.0.1 quotex' -and $_ -notmatch '127.0.0.1 qxbroker' -and $_ -notmatch '127.0.0.1 pocketoption' -and $_ -notmatch '127.0.0.1 binomo' -and $_ -notmatch '127.0.0.1 olymptrade' -and $_ -notmatch '127.0.0.1 avalonbroker' -and $_ -notmatch '127.0.0.1 hiove' -and $_ -notmatch '127.0.0.1 bullex' -and $_ -notmatch '127.0.0.1 com.br' } | Set-Content $h -Force; ipconfig /flushdns }"

echo.
echo [SUCESSO] Arquivo hosts do Windows limpo com sucesso!
echo [SUCESSO] Cache DNS limpo (ipconfig /flushdns).
echo.
echo As corretoras (Exnova, Quotex, IQ Option, etc.) foram LIBERADAS!
echo.
pause
