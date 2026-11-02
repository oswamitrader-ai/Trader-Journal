const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function createWindowTracker(onUpdate) {
  let child, latest, receivedAt = 0;
  return {
    start() {
      if (child || process.platform !== 'win32') return;
      const script = fs.readFileSync(path.join(__dirname, 'exnovaWindowTracker.ps1'), 'utf8');
      // One read-only, hidden process; no elevation, input injection, or repeated shells.
      const command = `& { ${script} } -ParentProcessId ${process.pid}`;
      child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let buffer = '';
      child.stdout.on('data', chunk => {
        buffer += chunk.toString();
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try { latest = JSON.parse(line); receivedAt = Date.now(); onUpdate?.(latest); } catch {}
        }
      });
      child.stderr.on('data', () => { latest = null; });
      child.on('error', () => { latest = null; child = null; });
      child.on('exit', () => { latest = null; child = null; });
    },
    getState() { return Date.now() - receivedAt < 1500 ? latest : null; },
    stop() { const running = child; child = null; latest = null; running?.kill(); },
  };
}
module.exports = { createWindowTracker };
