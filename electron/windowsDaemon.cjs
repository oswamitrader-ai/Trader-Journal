const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HOSTS_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

const DEFAULT_BROKER_DOMAINS = [
  'exnova.com',
  'trade.exnova.com',
  'iqoption.com',
  'trade.iqoption.com',
  'quotex.com',
  'qxbroker.com',
  'pocketoption.com',
  'binomo.com',
  'olymptrade.com',
];

const BROKER_EXE_NAMES = [
  'exnova.exe',
  'iqoption.exe',
  'quotex.exe',
  'qxbroker.exe',
  'pocketoption.exe',
  'binomo.exe',
  'olymptrade.exe',
];

const START_MARKER = '# --- TRADELOCK ANTI-FURIA SHIELD START ---';
const END_MARKER = '# --- TRADELOCK ANTI-FURIA SHIELD END ---';

let watchdogInterval = null;

function getBaseDomain(domainStr) {
  const clean = domainStr.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return clean;
}

/**
 * Atualiza o arquivo hosts do Windows adicionando ou removendo os domínios de corretoras
 */
function updateHostsFile(isLockActive, domains = DEFAULT_BROKER_DOMAINS) {
  try {
    if (!fs.existsSync(HOSTS_PATH)) return false;

    let content = fs.readFileSync(HOSTS_PATH, 'utf8');

    // Remove bloco existente do TradeLock
    const regex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'g');
    content = content.replace(regex, '');

    if (isLockActive) {
      const uniqueDomains = Array.from(new Set([...DEFAULT_BROKER_DOMAINS, ...domains]));
      const entries = new Set();

      uniqueDomains.forEach((dom) => {
        const clean = dom.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        if (!clean) return;
        const base = getBaseDomain(clean);

        entries.add(clean);
        entries.add(`www.${clean}`);
        entries.add(base);
        entries.add(`www.${base}`);
        entries.add(`trade.${base}`);
        entries.add(`app.${base}`);
        entries.add(`platform.${base}`);
        entries.add(`client.${base}`);
        entries.add(`api.${base}`);
        entries.add(`ws.${base}`);
        entries.add(`web.${base}`);
      });

      const lines = [START_MARKER];
      entries.forEach((hostEntry) => {
        lines.push(`127.0.0.1 ${hostEntry}`);
      });
      lines.push(END_MARKER);
      lines.push(''); // nova linha

      content = content.trimEnd() + '\n\n' + lines.join('\n');
    }

    try {
      fs.writeFileSync(HOSTS_PATH, content, 'utf8');
    } catch (writeErr) {
      if (writeErr && (writeErr.code === 'EPERM' || writeErr.code === 'EACCES')) {
        const tempPath = path.join(require('os').tmpdir(), 'tradelock_hosts_tmp.txt');
        fs.writeFileSync(tempPath, content, 'utf8');
        const psCmd = `powershell -Command "Start-Process powershell -ArgumentList '-Command Copy-Item -Path ''${tempPath}'' -Destination ''${HOSTS_PATH}'' -Force' -Verb RunAs -WindowStyle Hidden"`;
        exec(psCmd, (psErr) => {
          if (!psErr) {
            console.log('🛡️ [TradeLock Daemon] Arquivo hosts atualizado com privilégios de Administrador via UAC.');
            if (process.platform === 'win32') {
              exec('ipconfig /flushdns');
            }
          } else {
            console.warn('[TradeLock Daemon] Privilégio de Administrador negado pelo usuário no UAC.');
          }
        });
        return true;
      }
      throw writeErr;
    }

    // Flush DNS no Windows
    if (process.platform === 'win32') {
      exec('ipconfig /flushdns', (err) => {
        if (err) console.warn('[TradeLock Daemon] Erro ao executar flushdns:', err.message);
        else console.log('🛡️ [TradeLock Daemon] DNS Flush executado com sucesso no Windows.');
      });
    }

    return true;
  } catch (err) {
    console.error('[TradeLock Daemon] Falha ao atualizar arquivo hosts (requer privilégios de Administrador):', err.message);
    return false;
  }
}

/**
 * Monitor de Processos Executáveis do Windows (Taskkill em apps desktop de corretoras)
 */
function startProcessWatchdog(isLockActive) {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  if (!isLockActive || process.platform !== 'win32') return;

  watchdogInterval = setInterval(() => {
    BROKER_EXE_NAMES.forEach((exe) => {
      exec(`taskkill /F /IM ${exe}`, (err, stdout) => {
        if (!err && stdout && stdout.includes('SUCCESS')) {
          console.warn(`🛡️ [TradeLock Daemon] Processo executável de corretora encerrado: ${exe}`);
        }
      });
    });
  }, 2500);
}

/**
 * Aplica o estado unificado do bloqueio nativo no Windows
 */
function setNativeLockState(isLockActive, customDomains = []) {
  console.log(`🛡️ [TradeLock Daemon] Estado da Trava Nativa Windows alterado: isLockActive = ${isLockActive}`);
  const hostsUpdated = updateHostsFile(isLockActive, customDomains);
  startProcessWatchdog(isLockActive);
  return { success: true, isLockActive, hostsUpdated };
}

module.exports = {
  updateHostsFile,
  startProcessWatchdog,
  setNativeLockState,
  DEFAULT_BROKER_DOMAINS,
};
