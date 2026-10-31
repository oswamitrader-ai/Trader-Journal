const path = require('path');
const { createWorker } = require('tesseract.js');

const POLL_INTERVAL_MS = 1800;
const CAPTURE_SIZE = { width: 1600, height: 1000 };

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function getLines(data) {
  const lines = Array.isArray(data?.lines)
    ? data.lines
    : (data?.blocks || []).flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []));
  return lines.map((line) => ({
    text: String(line.text || '').trim(),
    confidence: Number(line.confidence) || 0,
    left: Number(line.bbox?.x0) || 0,
    top: Number(line.bbox?.y0) || 0,
  })).filter((line) => line.text);
}

function toTargetAmount(state) {
  if (!state?.enforceBrokerStakeLock) return null;
  const fixed = Number(state.fixedStakeAmount) || 50;
  const wins = Math.max(0, Number(state.consecutiveWins) || 0);
  const losses = Math.max(0, Number(state.consecutiveLosses) || 0);
  const style = String(state.managementStyle || 'MAO_FIXA').toUpperCase();
  if (style === 'SOROS_1' && wins === 1) return Number(state.sorosLevel1Stake) || 93.5;
  if (style === 'SOROS_2') {
    if (wins === 1) return Number(state.sorosLevel1Stake) || 93.5;
    if (wins === 2) return Number(state.sorosLevel2Stake) || 174.8;
  }
  if (style === 'SOROS_3') {
    if (wins === 1) return Number(state.sorosLevel1Stake) || 93.5;
    if (wins === 2) return Number(state.sorosLevel2Stake) || 174.8;
    if (wins === 3) return Number(state.sorosLevel3Stake) || 326.9;
  }
  if (style === 'MARTINGALE' || style === 'SOROSGALE') {
    if (losses === 1) return Number(state.martingaleLevel1Stake) || 100;
    if (losses === 2) return Number(state.martingaleLevel2Stake) || 200;
  }
  return fixed;
}

function getImageLines(worker, image) {
  return worker.recognize(image.toPNG(), {}, { blocks: true }).then(({ data }) => getLines(data));
}

function compareWindowWithScreen(windowImage, screenImage, display) {
  const size = { width: 320, height: 180 };
  const win = windowImage.resize(size);
  const screenSize = screenImage.getSize();
  const bounds = display.bounds;
  const workArea = display.workArea;
  const crop = {
    x: Math.max(0, Math.round((workArea.x - bounds.x) / bounds.width * screenSize.width)),
    y: Math.max(0, Math.round((workArea.y - bounds.y) / bounds.height * screenSize.height)),
    width: Math.round(workArea.width / bounds.width * screenSize.width),
    height: Math.round(workArea.height / bounds.height * screenSize.height),
  };
  crop.width = Math.min(crop.width, screenSize.width - crop.x);
  crop.height = Math.min(crop.height, screenSize.height - crop.y);
  if (crop.width < 100 || crop.height < 100) return 0;
  const scr = screenImage.crop(crop).resize(size);
  const a = Buffer.from(win.toBitmap());
  const b = Buffer.from(scr.toBitmap());
  let sum = 0;
  let count = 0;
  for (let y = 15; y < 165; y += 3) {
    for (let x = 12; x < 280; x += 3) {
      // Ignore the window header and the upper-right stake shield itself.
      if (x > 250 && y < 55) continue;
      const offset = (y * size.width + x) * 4;
      const diff = (Math.abs(a[offset] - b[offset]) + Math.abs(a[offset + 1] - b[offset + 1]) + Math.abs(a[offset + 2] - b[offset + 2])) / 3;
      sum += Math.min(255, diff);
      count += 1;
    }
  }
  return count ? 1 - sum / (count * 255) : 0;
}

function findWindowOnScreen(windowImage, screenImage) {
  const screenSize = screenImage.getSize();
  const windowSize = windowImage.getSize();
  if (screenSize.width < 320 || screenSize.height < 180 || windowSize.width < 250 || windowSize.height < 160) return null;
  const scale = Math.min(640 / screenSize.width, 1);
  const screenSmall = screenImage.resize({ width: Math.round(screenSize.width * scale) });
  const windowSmall = windowImage.resize({ width: Math.max(1, Math.round(windowSize.width * scale)) });
  const smallScreenSize = screenSmall.getSize();
  const smallWindowSize = windowSmall.getSize();
  if (smallWindowSize.width > smallScreenSize.width || smallWindowSize.height > smallScreenSize.height) return null;
  const screenPixels = Buffer.from(screenSmall.toBitmap());
  const windowPixels = Buffer.from(windowSmall.toBitmap());
  const samples = [];
  const columns = 18;
  const rows = 12;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(smallWindowSize.width - 1, Math.floor((column + 0.5) * smallWindowSize.width / columns));
      const y = Math.min(smallWindowSize.height - 1, Math.floor((row + 0.5) * smallWindowSize.height / rows));
      // The card itself can cover the top-right area of the screen capture.
      if (x > smallWindowSize.width * 0.82 && y < smallWindowSize.height * 0.40) continue;
      samples.push({ x, y, offset: (y * smallWindowSize.width + x) * 4 });
    }
  }
  if (samples.length < 80) return null;

  function scoreAt(originX, originY) {
    let difference = 0;
    for (const sample of samples) {
      const screenOffset = ((originY + sample.y) * smallScreenSize.width + originX + sample.x) * 4;
      difference += Math.abs(windowPixels[sample.offset] - screenPixels[screenOffset]);
      difference += Math.abs(windowPixels[sample.offset + 1] - screenPixels[screenOffset + 1]);
      difference += Math.abs(windowPixels[sample.offset + 2] - screenPixels[screenOffset + 2]);
    }
    return 1 - difference / (samples.length * 3 * 255);
  }

  const step = Math.max(2, Math.round(smallScreenSize.width / 240));
  let best = { x: 0, y: 0, score: -1 };
  for (let y = 0; y <= smallScreenSize.height - smallWindowSize.height; y += step) {
    for (let x = 0; x <= smallScreenSize.width - smallWindowSize.width; x += step) {
      const score = scoreAt(x, y);
      if (score > best.score) best = { x, y, score };
    }
  }
  const refineFromX = Math.max(0, best.x - step);
  const refineToX = Math.min(smallScreenSize.width - smallWindowSize.width, best.x + step);
  const refineFromY = Math.max(0, best.y - step);
  const refineToY = Math.min(smallScreenSize.height - smallWindowSize.height, best.y + step);
  for (let y = refineFromY; y <= refineToY; y += 1) {
    for (let x = refineFromX; x <= refineToX; x += 1) {
      const score = scoreAt(x, y);
      if (score > best.score) best = { x, y, score };
    }
  }
  if (best.score < 0.90) return { ...best, scale, windowSize, smallScreenSize, smallWindowSize };
  return { ...best, scale, windowSize, smallScreenSize, smallWindowSize };
}

function makeShieldPage(amount) {
  const displayAmount = Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
    body{display:flex;align-items:center;justify-content:center;font:700 12px Segoe UI,Arial,sans-serif;color:#d1fae5}
    #shield{width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:5px;border:2px solid #10b981;border-radius:7px;background:rgba(6,78,59,.97);box-shadow:0 0 16px rgba(16,185,129,.72);white-space:nowrap;user-select:none}
  </style></head><body><div id="shield">🔒 ENTRADA R$ ${displayAmount}</div></body></html>`;
}

function createExnovaStakeShield({ desktopCapturer, screen, BrowserWindow, app, onStatus }) {
  let timer = null;
  let workerPromise = null;
  let overlay = null;
  let stopped = true;
  let processing = false;
  let lockState = { enforceBrokerStakeLock: false };
  let lastPublished = '';
  let lastGeometry = null;
  let lastAmount = null;

  function publish(state, message, extra = {}) {
    const value = { state, message, enabled: Boolean(lockState.enforceBrokerStakeLock), ...extra };
    const key = JSON.stringify(value);
    if (key === lastPublished) return;
    lastPublished = key;
    onStatus?.(value);
  }

  function getWorker() {
    if (!workerPromise) {
      const modelDirectory = app.isPackaged ? path.join(process.resourcesPath, 'tessdata') : path.join(__dirname, 'tessdata');
      const workerPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
        : path.join(__dirname, '..', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
      workerPromise = createWorker('eng+por', 1, { langPath: modelDirectory, workerPath, gzip: true, cacheMethod: 'none', logger: () => {} });
    }
    return workerPromise;
  }

  function ensureOverlay() {
    if (overlay && !overlay.isDestroyed()) return overlay;
    overlay = new BrowserWindow({
      width: 120,
      height: 42,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setIgnoreMouseEvents(false);
    overlay.on('closed', () => { overlay = null; lastGeometry = null; });
    return overlay;
  }

  function hideOverlay() {
    if (overlay && !overlay.isDestroyed() && overlay.isVisible()) overlay.hide();
    lastGeometry = null;
  }

  async function poll() {
    if (stopped || processing) return;
    processing = true;
    try {
      const amount = toTargetAmount(lockState);
      if (amount === null || !Number.isFinite(amount) || amount <= 0) {
        hideOverlay();
        publish('disabled', 'A trava de valor está desativada no TradeLock.');
        return;
      }

      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: CAPTURE_SIZE,
        fetchWindowIcons: false,
      });
      const target = sources.find((source) => /^window:\d+:/i.test(String(source.id || '')) && /\bEXNOVA\b/i.test(String(source.name || '')));
      if (!target?.thumbnail || target.thumbnail.isEmpty()) {
        hideOverlay();
        publish('waiting', 'Trava configurada; aguardando a janela da Exnova.');
        return;
      }

      const { width, height } = target.thumbnail.getSize();
      if (width < 300 || height < 200) {
        hideOverlay();
        publish('waiting', 'Não consegui validar a área visível da Exnova.');
        return;
      }

      const displays = screen.getAllDisplays();
      const screenSources = sources.filter((source) => /^screen:/i.test(String(source.id || '')) && source.thumbnail && !source.thumbnail.isEmpty());
      const locationCandidates = [];
      for (const source of screenSources) {
        const sourceIdPart = String(source.id).split(':')[1];
        const idMatchedDisplays = displays.filter((display) => String(display.id) === sourceIdPart);
        const aspect = source.thumbnail.getSize().width / source.thumbnail.getSize().height;
        const possibleDisplays = idMatchedDisplays.length ? idMatchedDisplays : displays.filter((display) =>
          Math.abs(display.bounds.width / display.bounds.height - aspect) < 0.18
        );
        for (const display of possibleDisplays) {
          const match = findWindowOnScreen(target.thumbnail, source.thumbnail);
          if (match) locationCandidates.push({ source, display, match });
        }
      }
      locationCandidates.sort((a, b) => b.match.score - a.match.score);
      const location = locationCandidates[0];
      if (!location || location.match.score < 0.90) {
        hideOverlay();
        publish('waiting', `Não consegui localizar a janela Exnova na tela (correspondência visual ${Math.round((location?.match.score || 0) * 100)}%). Deixe-a visível e em primeiro plano.`);
        return;
      }

      const worker = await getWorker();
      const lines = await getImageLines(worker, target.thumbnail);
      const label = lines
        .filter((line) => line.confidence >= 35 && /\b(?:INVEST|INVESTMENT|INVESTIMENTO)\b/.test(normalize(line.text)))
        .filter((line) => line.left >= width * 0.66 && line.top <= height * 0.30)
        .sort((a, b) => a.top - b.top)[0];
      if (!label) {
        hideOverlay();
        publish('waiting', 'Não localizei o campo “Invest” no painel da Exnova; o bloqueio está oculto.');
        return;
      }

      const { display, match } = location;
      const screenWidth = match.smallScreenSize.width;
      const screenHeight = match.smallScreenSize.height;
      const windowWidth = match.smallWindowSize.width;
      const windowHeight = match.smallWindowSize.height;
      const matchX = match.x / screenWidth * display.bounds.width;
      const matchY = match.y / screenHeight * display.bounds.height;
      const windowLogicalWidth = windowWidth / screenWidth * display.bounds.width;
      const windowLogicalHeight = windowHeight / screenHeight * display.bounds.height;
      const leftPx = Math.max(0, Math.round(label.left - width * 0.008));
      const topPx = Math.max(0, Math.round(label.top - 3));
      const rightPx = width;
      const bottomPx = Math.min(height, topPx + Math.max(38, Math.round(height * 0.058)));
      const geometry = {
        x: Math.round(display.bounds.x + matchX + leftPx / width * windowLogicalWidth),
        y: Math.round(display.bounds.y + matchY + topPx / height * windowLogicalHeight),
        width: Math.max(80, Math.round((rightPx - leftPx) / width * windowLogicalWidth)),
        height: Math.max(38, Math.round((bottomPx - topPx) / height * windowLogicalHeight)),
      };
      const shield = ensureOverlay();
      shield.setBounds(geometry, false);
      if (lastAmount !== amount || shield.webContents.isLoading() || !lastGeometry) {
        lastAmount = amount;
        shield.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(makeShieldPage(amount))}`);
      }
      if (!shield.isVisible()) shield.showInactive();
      lastGeometry = geometry;
      publish('locked', `Card nativo ativo sobre “Invest”: R$ ${amount.toFixed(2)}. O escudo bloqueia cliques e os controles +/- enquanto a Exnova está visível.`, { amount, bounds: geometry, visualMatch: Math.round(location.match.score * 100) });
    } catch (error) {
      hideOverlay();
      publish('error', `Não foi possível posicionar o bloqueio de entrada: ${String(error?.message || 'erro desconhecido').slice(0, 140)}`);
    } finally {
      processing = false;
    }
  }

  return {
    getStatus() {
      return lastPublished ? JSON.parse(lastPublished) : { state: 'disabled', message: 'Trava de valor ainda não inicializada.', enabled: false };
    },
    setLockState(state) {
      lockState = { ...lockState, ...(state || {}) };
      if (!lockState.enforceBrokerStakeLock) hideOverlay();
      if (!stopped) poll().catch(() => {});
    },
    async start() {
      if (!stopped) return this.getStatus();
      stopped = false;
      await poll();
      timer = setInterval(poll, POLL_INTERVAL_MS);
      timer.unref?.();
      return this.getStatus();
    },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      hideOverlay();
      if (workerPromise) {
        try { const worker = await workerPromise; await worker.terminate(); } catch {}
        workerPromise = null;
      }
      if (overlay && !overlay.isDestroyed()) overlay.destroy();
      overlay = null;
      publish('disabled', 'Trava nativa encerrada.');
    },
  };
}

module.exports = { createExnovaStakeShield, toTargetAmount, compareWindowWithScreen };
