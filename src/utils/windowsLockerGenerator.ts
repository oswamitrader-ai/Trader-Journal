import { DEFAULT_BLOCKED_DOMAINS } from './extensionGenerator';

/**
 * Gerador do Script de Blindagem para Windows (.BAT)
 * Bloqueia a resolução DNS no arquivo C:\Windows\System32\drivers\etc\hosts
 * e encerra processos de softwares desktop (.msi / .exe) como Exnova e IQ Option.
 */
export function generateWindowsLockerBat(blockedDomains?: string[]): string {
  const domains = blockedDomains && blockedDomains.length > 0 ? blockedDomains : DEFAULT_BLOCKED_DOMAINS;

  // Garante inclusão dos domínios principais e seus subdomínios de WebSocket/API
  const allDomainsSet = new Set<string>();
  domains.forEach((d) => {
    const clean = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (clean) {
      allDomainsSet.add(clean);
      allDomainsSet.add(`trade.${clean}`);
      allDomainsSet.add(`ws.${clean}`);
      allDomainsSet.add(`api.${clean}`);
    }
  });

  const domainLines = Array.from(allDomainsSet)
    .map((dom) => `echo 127.0.0.1 ${dom} # TRADELOCK_BLOCK >> "%HOSTS_FILE%"`)
    .join('\r\n');

  return `@echo off
:: TradeLock Windows Shield v1.0 - Anti-Fúria Desktop Locker
title TradeLock Windows Shield - Blindagem de Aplicativos Desktop
color 0A

echo ====================================================================
echo 🛡️ TRADELOCK WINDOWS SHIELD - BLINDAGEM DE APPS DESKTOP (.MSI/.EXE)
echo ====================================================================
echo.
echo Verificando permissoes de Administrador...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ATENCAO] Este script precisa ser executado como ADMINISTRADOR.
    echo Solicitando elevacao de privilegio...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

echo [OK] Permissoes de Administrador confirmadas.
echo.
echo 1. Aplicando bloqueio de DNS no arquivo hosts do Windows...

set HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts

:: Criar Backup de Seguranca do arquivo hosts
copy /y "%HOSTS_FILE%" "%HOSTS_FILE%.tradelock.bak" >nul

:: Remover marcacoes antigas do TradeLock se existirem
powershell -Command "(Get-Content '%HOSTS_FILE%') | Where-Object { $_ -notmatch 'TRADELOCK_BLOCK' } | Set-Content '%HOSTS_FILE%'"

:: Adicionar novos dominios bloqueados no arquivo hosts do Windows
echo. >> "%HOSTS_FILE%"
echo # --- TRADELOCK_BLOCK_START --- >> "%HOSTS_FILE%"
${domainLines}
echo # --- TRADELOCK_BLOCK_END --- >> "%HOSTS_FILE%"

echo.
echo 2. Limpando cache de DNS do Windows (ipconfig /flushdns)...
ipconfig /flushdns >nul

echo.
echo 3. Encerrando processos de softwares de corretoras (.exe) em execucao...
taskkill /F /IM exnova.exe /IM iqoption.exe /IM quotex.exe /IM pocketoption.exe /IM binomo.exe >nul 2>&1

echo.
echo ====================================================================
echo ✅ BLINDAGEM DO WINDOWS CONCLUIDA COM SUCESSO!
echo Os aplicativos desktop (.msi/.exe) e navegadores estao blindados pelo TradeLock.
echo ====================================================================
echo.
pause
`;
}

/**
 * Dispara o download do arquivo .bat de blindagem do Windows no navegador
 */
export function downloadWindowsLockerBat(blockedDomains?: string[]): void {
  const content = generateWindowsLockerBat(blockedDomains);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tradelock-blindagem-windows.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
