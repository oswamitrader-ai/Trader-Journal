import JSZip from 'jszip';

export interface ExtensionConfig {
  dailyLossLimit: number;
  blockedDomains: string[];
  appName: string;
  antiFuriaCustomWindowEnabled?: boolean;
  antiFuriaStartTime?: string;
  antiFuriaEndTime?: string;
}

export const DEFAULT_BLOCKED_DOMAINS = [
  'exnova.com',
  'trade.exnova.com',
  'xnova.com',
  'trade.xnova.com',
  'quotex.com',
  'qxbroker.com',
  'iqoption.com',
  'pocketoption.com',
  'binomo.com',
  'olymptrade.com',
];

// Generates an icon on an offscreen canvas and returns base64 PNG data URL
function generateIconDataUrl(size: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Shield background
  ctx.fillStyle = '#dc2626'; // solid crimson red
  ctx.beginPath();
  const r = size * 0.15;
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();

  // White Lock icon inside
  ctx.fillStyle = '#ffffff';
  const pad = size * 0.28;
  const bodyW = size - pad * 2;
  const bodyH = size * 0.38;
  const bodyY = size * 0.48;

  // Lock body
  ctx.beginPath();
  ctx.roundRect(pad, bodyY, bodyW, bodyH, size * 0.08);
  ctx.fill();

  // Lock shackle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.beginPath();
  const shackleR = bodyW * 0.32;
  const shackleCenterX = size / 2;
  const shackleCenterY = bodyY;
  ctx.arc(shackleCenterX, shackleCenterY, shackleR, Math.PI, 0, false);
  ctx.stroke();

  // Keyhole
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(size / 2, bodyY + bodyH * 0.42, size * 0.06, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/png').split(',')[1]; // returns base64 string
}

export async function generateExtensionZip(config?: Partial<ExtensionConfig>): Promise<Blob> {
  const zip = new JSZip();
  const domains = config?.blockedDomains && config.blockedDomains.length > 0
    ? config.blockedDomains
    : DEFAULT_BLOCKED_DOMAINS;

  const dailyLossLimit = config?.dailyLossLimit ?? 30;
  const customWindowEnabled = config?.antiFuriaCustomWindowEnabled ?? false;
  const startTime = config?.antiFuriaStartTime || '07:00';
  const endTime = config?.antiFuriaEndTime || '11:30';

  // 1. MANIFEST.JSON
  const manifest = {
    manifest_version: 3,
    name: 'Anti-Fúria Trader: Bloqueador Exnova & Corretoras',
    version: '1.0.0',
    description: 'Bloqueia o acesso a corretoras de Opções Binárias (Exnova, Quotex, etc.) imediatamente após o Stop Loss ser atingido no Diário de Trade.',
    permissions: [
      'storage',
      'tabs',
      'webNavigation',
      'alarms',
    ],
    host_permissions: [
      '<all_urls>',
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'Anti-Fúria Trader: Status da Trava',
    },
    background: {
      service_worker: 'background.js',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['injected.js'],
        run_at: 'document_start',
        world: 'MAIN',
      },
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_start',
      },
    ],
    web_accessible_resources: [
      {
        resources: ['blocked.html', 'blocked.js', 'icon.png', 'injected.js'],
        matches: ['<all_urls>'],
      },
    ],
  };

  // 2. BACKGROUND.JS
  const backgroundJs = `// Anti-Fúria Trader - Service Worker (Manifest V3)
const DEFAULT_DOMAINS = ${JSON.stringify(domains, null, 2)};

// Helper: Unblock all tabs currently showing blocked.html
function unblockAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url && tab.url.includes('blocked.html')) {
        try {
          const urlObj = new URL(tab.url);
          const orig = urlObj.searchParams.get('orig');
          if (orig) {
            chrome.tabs.update(tab.id, { url: decodeURIComponent(orig) });
          } else {
            chrome.tabs.reload(tab.id);
          }
        } catch (e) {
          console.error('[Anti-Fúria] Erro ao desbloquear aba:', e);
        }
      }
    });
  });
}

// Helper: Check if a URL matches any blocked domain
function isUrlBlocked(url, domains) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return domains.some(d => host === d.toLowerCase() || host.endsWith('.' + d.toLowerCase()));
  } catch (e) {
    return false;
  }
}

// Redirect or block tab if stop or subscription block is active
function enforceTabBlock(tabId, url, domains, isSubBlocked) {
  if (isUrlBlocked(url, domains)) {
    const param = isSubBlocked ? '?type=sub_blocked&orig=' : '?orig=';
    const blockedUrl = chrome.runtime.getURL('blocked.html' + param + encodeURIComponent(url));
    chrome.tabs.update(tabId, { url: blockedUrl });
    console.warn('[Anti-Fúria] Bloqueio acionado na aba:', url);
  }
}

// Initialize default state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedDomains', 'isStopHit', 'dailyLossLimit'], (res) => {
    const savedDoms = Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS;
    chrome.storage.local.set({
      blockedDomains: savedDoms,
      isStopHit: res.isStopHit || false,
      dailyLossLimit: res.dailyLossLimit || ${dailyLossLimit},
      antiFuriaCustomWindowEnabled: ${customWindowEnabled},
      antiFuriaStartTime: "${startTime}",
      antiFuriaEndTime: "${endTime}",
      todayPnl: 0,
      lastDate: new Date().toISOString().split('T')[0],
      strictMode: true,
      testMode: false,
    });
  });

  // Schedule alarm for midnight reset
  chrome.alarms.create('midnightReset', {
    periodInMinutes: 15,
  });
});

// Periodic check for new day (auto-unlock on the next morning)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'midnightReset') {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['lastDate'], (data) => {
      if (data.lastDate && data.lastDate !== today) {
        console.log('[Anti-Fúria] Novo dia iniciado. Resetando trava de stop.');
        chrome.storage.local.set({
          lastDate: today,
          isStopHit: false,
          testMode: false,
          todayPnl: 0,
        }, () => {
          unblockAllTabs();
        });
      }
    });
  }
});

// Intercept navigations via webNavigation
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return; // Only top level navigation
  chrome.storage.local.get(['isStopHit', 'isSubBlocked', 'blockedDomains'], (data) => {
    if ((data.isStopHit || data.isSubBlocked) && Array.isArray(data.blockedDomains)) {
      enforceTabBlock(details.tabId, details.url, data.blockedDomains, data.isSubBlocked);
    }
  });
});

// Message listener from web app, popup, or auto-capture
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AUTO_TRADE_CAPTURED' && msg.trade) {
    console.log('[Anti-Fúria Service Worker] Auto trade capturado:', msg.trade);

    // 1. Transmite o trade para todas as abas do Trader Journal abertas no navegador
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1') || tab.url.includes('trader') || tab.url.includes('vercel.app'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'TRADER_JOURNAL_AUTO_TRADE',
            trade: msg.trade,
          }).catch(() => {});
        }
      });
    });

    // 2. Atualiza PnL e verifica se acionou o Stop Loss
    chrome.storage.local.get(['todayPnl', 'dailyLossLimit', 'blockedDomains'], (res) => {
      const currentPnl = Number(res.todayPnl) || 0;
      const tradePnl = Number(msg.trade.pnl) || 0;
      const newPnl = currentPnl + tradePnl;
      const limit = Number(res.dailyLossLimit) || ${dailyLossLimit};
      const isHit = newPnl <= -limit;

      chrome.storage.local.set({
        todayPnl: newPnl,
        isStopHit: isHit,
        lastTradeCaptured: msg.trade,
      }, () => {
        if (isHit) {
          const doms = Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS;
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id && tab.url && isUrlBlocked(tab.url, doms)) {
                const blockedUrl = chrome.runtime.getURL('blocked.html?orig=' + encodeURIComponent(tab.url));
                chrome.tabs.update(tab.id, { url: blockedUrl });
              }
            });
          });
        }
        sendResponse({ success: true, isStopHit: isHit, newPnl: newPnl });
      });
    });
    return true;
  }

  if (msg.type === 'UPDATE_STOP_STATUS') {
    chrome.storage.local.get(['testMode'], (st) => {
      if (st && st.testMode && !msg.isStopHit && !msg.isSubBlocked) {
        sendResponse({ success: true, testMode: true });
        return;
      }

      const isSubBlocked = Boolean(msg.isSubBlocked);
      const isHit = Boolean(msg.isStopHit) || isSubBlocked;
      const pnl = Number(msg.todayPnl) || 0;
      const limit = Number(msg.dailyLossLimit) || ${dailyLossLimit};
      const today = new Date().toISOString().split('T')[0];

      chrome.storage.local.set({
        isStopHit: isHit,
        isSubBlocked: isSubBlocked,
        todayPnl: pnl,
        dailyLossLimit: limit,
        lastDate: today,
        winRate: Number(msg.winRate) || 0,
        profitFactor: Number(msg.profitFactor) || 0,
        todayTradesCount: Number(msg.todayTradesCount) || 0,
        currentCapital: Number(msg.currentCapital) || 0,
      }, () => {
        if (isHit) {
          chrome.storage.local.get(['blockedDomains'], (res) => {
            const doms = Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS;
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach((tab) => {
                if (tab.id && tab.url && isUrlBlocked(tab.url, doms)) {
                  enforceTabBlock(tab.id, tab.url, doms, isSubBlocked);
                }
              });
            });
          });
        } else {
          unblockAllTabs();
        }
        sendResponse({ success: true, isStopHit: isHit, isSubBlocked: isSubBlocked });
      });
    });
    return true;
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(null, (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.type === 'TEST_BLOCK_TRIGGER') {
    chrome.storage.local.set({ isStopHit: true, testMode: true, todayPnl: -${dailyLossLimit} }, () => {
      chrome.storage.local.get(['blockedDomains'], (res) => {
        const doms = Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS;
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id && tab.url && isUrlBlocked(tab.url, doms)) {
              const blockedUrl = chrome.runtime.getURL('blocked.html?orig=' + encodeURIComponent(tab.url));
              chrome.tabs.update(tab.id, { url: blockedUrl });
            }
          });
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === 'TEST_UNLOCK') {
    chrome.storage.local.set({ isStopHit: false, testMode: false, todayPnl: 0 }, () => {
      unblockAllTabs();
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === 'ADD_DOMAIN') {
    chrome.storage.local.get(['blockedDomains'], (res) => {
      const current = Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS;
      const clean = msg.domain.trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '');
      if (clean && !current.includes(clean)) {
        current.push(clean);
        chrome.storage.local.set({ blockedDomains: current }, () => {
          sendResponse({ success: true, domains: current });
        });
      } else {
        sendResponse({ success: false, domains: current });
      }
    });
    return true;
  }

  if (msg.type === 'REMOVE_DOMAIN') {
    chrome.storage.local.get(['blockedDomains'], (res) => {
      const current = (Array.isArray(res.blockedDomains) ? res.blockedDomains : DEFAULT_DOMAINS).filter(d => d !== msg.domain);
      chrome.storage.local.set({ blockedDomains: current }, () => {
        sendResponse({ success: true, domains: current });
      });
    });
    return true;
  }
});
`;

  // 3. INJECTED.JS (Hooks into WebSocket & DOM on broker platforms for Auto Capture)
  const injectedJs = `// Anti-Fúria Auto-Capture Engine v2 - Proxy WebSocket + XHR/Fetch Interceptor
(function() {
  if (window.__antiFuriaAutoCaptureInjected) return;
  window.__antiFuriaAutoCaptureInjected = true;

  const HOST = window.location.hostname;

  // ─── ONLY activate on broker domains, NEVER on localhost/Trader Journal ───
  const BROKER_DOMAINS = ['exnova.com', 'xnova.com', 'iqoption.com', 'quotex.com', 'qxbroker.com', 'pocketoption.com', 'binomo.com', 'olymptrade.com', 'deriv.com', 'binary.com'];
  const isBroker = BROKER_DOMAINS.some(d => HOST === d || HOST.endsWith('.' + d));
  if (!isBroker) {
    return; // Do NOT run on localhost, Trader Journal, or any non-broker site
  }

  const DEBUG = true;
  const processedIds = new Set();

  console.log('🛡️ [Anti-Fúria Auto-Capture v2] Módulo ativado em:', HOST);

  // ─── Broadcast helper ────────────────────────────────────────────
  function broadcastTrade(tradeData) {
    if (!tradeData) return;
    if (processedIds.has(tradeData.id)) return; // Dedup
    processedIds.add(tradeData.id);
    console.log('🚀 [Anti-Fúria] Transmitindo trade capturado:', JSON.stringify(tradeData));
    window.postMessage({ type: 'AUTO_TRADE_CAPTURED', trade: tradeData }, '*');
  }

  // ─── Build trade object from raw data ────────────────────────────
  function buildTrade(raw, source) {
    if (!raw || typeof raw !== 'object') return null;

    console.log('🔧 [Anti-Fúria] buildTrade raw data:', JSON.stringify(raw).substring(0, 500));

    // --- CRITICAL: Only process CLOSED trades with a definitive result ---
    // Exnova fires position-changed on OPEN and CLOSE. We MUST filter out opens.
    const resultField = String(raw.result || '').toLowerCase();
    const winField = String(raw.win || '').toLowerCase();
    const closedResults = ['win', 'loose', 'loss', 'equal', 'draw'];
    const isClosed = closedResults.includes(resultField) || closedResults.includes(winField);

    if (!isClosed) {
      console.log('⏩ [Anti-Fúria] Ignorando: sem resultado definitivo (result=' + resultField + ', win=' + winField + ')');
      return null;
    }

    // --- Dedup by option_id ---
    const optionId = raw.option_id || raw.id || raw.deal_id || '';
    if (optionId && processedIds.has('oid-' + optionId)) {
      console.log('⏩ [Anti-Fúria] Ignorando trade duplicado, option_id:', optionId);
      return null;
    }
    if (optionId) processedIds.add('oid-' + optionId);

    // --- Win/Loss detection ---
    const isWin = resultField === 'win' || winField === 'win';
    const isEqual = resultField === 'equal' || resultField === 'draw' || winField === 'equal';
    const isLoss = resultField === 'loose' || resultField === 'loss' || winField === 'loose' || winField === 'loss';

    // --- Amount invested ---
    const amount = Math.abs(Number(raw.amount || raw.enrolled_amount || raw.investment || raw.stake || raw.buy_amount) || 0);

    // --- PnL Extraction ---
    const profitAmount = Number(raw.profit_amount) || 0;
    const winEnrolled = Number(raw.win_enrolled_amount || raw.win_amount) || 0;
    let pnl = Number(raw.pnl || raw.profit || raw.net_pnl) || 0;

    if (pnl === 0 && profitAmount > 0) {
      // Exnova WIN: profit_amount IS the net profit
      pnl = profitAmount;
    } else if (pnl === 0 && winEnrolled > 0 && amount > 0) {
      // win_enrolled_amount is TOTAL return. Net PnL = return - investment
      pnl = winEnrolled - amount;
    } else if (pnl === 0 && isLoss && amount > 0) {
      // LOSS: trader lost the entire invested amount
      pnl = -Math.abs(amount);
    } else if (pnl === 0 && isWin && amount > 0) {
      // WIN without explicit profit data: use profit_percent
      // Exnova profit_percent=188 means TOTAL payout is 188% of amount (net profit = 88%)
      const profitPct = Number(raw.profit_percent) || 185;
      pnl = Math.abs(amount * ((profitPct - 100) / 100));
    } else if (isEqual) {
      pnl = 0;
    }

    // Asset - use active_id as fallback since Exnova uses numeric IDs
    const activeId = raw.active_id || raw.act || '';
    const asset = String(raw.active || raw.asset || raw.instrument || raw.active_name || (activeId ? 'ID_' + activeId : 'DIGITAL')).toUpperCase();

    // Direction
    const dir = String(raw.dir || raw.direction || '').toLowerCase();
    const type = (dir === 'put' || dir.includes('sell') || dir.includes('baixa')) ? 'SELL' : 'BUY';

    const now = new Date();
    const roundedPnl = Math.round(pnl * 100) / 100;
    const result = isWin ? 'GAIN' : (isLoss ? 'LOSS' : 'BREAKEVEN');
    const tradeId = optionId || Date.now();

    console.log('✅ [Anti-Fúria] Trade FECHADO:', result, 'PnL:', roundedPnl, 'Amount:', amount, 'Asset:', asset, 'Dir:', type);

    return {
      id: 'auto-' + tradeId + '-' + Math.random().toString(36).substring(2, 6),
      date: now.toISOString().split('T')[0],
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      asset: asset.replace(/[^A-Z0-9/._-]/g, '') || 'DIGITAL',
      type: type,
      strategy: 'Captura Automática (' + source + ')',
      result: result,
      pnl: roundedPnl,
      contractsOrQuantity: amount > 0 ? Math.round(amount * 100) / 100 : Math.abs(roundedPnl),
      notes: 'Capturado automaticamente em ' + HOST,
    };
  }

  // ─── Detect if a WS message is a trade-close event ───────────────
  function isTradeCloseEvent(parsed) {
    if (!parsed) return false;

    // Exnova / IQ Option format: { name: "option-closed", msg: {...} }
    const name = (parsed.name || '').toLowerCase();
    if (
      name === 'option-closed' ||
      name === 'digital-option-closed' ||
      name === 'position-changed' ||
      name === 'deal-closed' ||
      name === 'option' ||
      name === 'result'
    ) return true;

    // Quotex / generic format: look for keywords in stringified JSON
    const str = JSON.stringify(parsed).toLowerCase();
    if (
      (str.includes('"option-closed"') || str.includes('"deal-closed"')) ||
      (str.includes('"win"') && str.includes('"amount"') && (str.includes('"win_amount"') || str.includes('"profit"'))) ||
      (str.includes('"close_quote"') && str.includes('"buy_amount"'))
    ) return true;

    return false;
  }

  // ─── Extract raw trade data from various message structures ──────
  function extractRawTrade(parsed) {
    // Exnova/IQ Option: { name: "position-changed", msg: { raw_event: { binary_options_option_changed1: { ...tradeData } } } }
    if (parsed.msg && typeof parsed.msg === 'object') {
      // Deep nested: msg.raw_event.binary_options_option_changed1 (or similar key)
      if (parsed.msg.raw_event && typeof parsed.msg.raw_event === 'object') {
        const keys = Object.keys(parsed.msg.raw_event);
        for (const key of keys) {
          const candidate = parsed.msg.raw_event[key];
          if (candidate && typeof candidate === 'object' && (candidate.amount !== undefined || candidate.result !== undefined || candidate.win !== undefined)) {
            console.log('🔍 [Anti-Fúria] Dados extraídos de msg.raw_event.' + key);
            return candidate;
          }
        }
      }
      // msg.result (some brokers)
      if (parsed.msg.result && typeof parsed.msg.result === 'object') return parsed.msg.result;
      // msg is the trade directly
      if (parsed.msg.win !== undefined || parsed.msg.win_amount !== undefined || parsed.msg.amount !== undefined) return parsed.msg;
    }
    // Nested data
    if (parsed.data && typeof parsed.data === 'object') return parsed.data;
    // Top-level
    return parsed;
  }

  // ─── 1. WEBSOCKET PROXY INTERCEPTION ─────────────────────────────
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args) {
      const ws = new target(...args);
      console.log('🛡️ [Anti-Fúria WS] Conexão criada:', args[0]);

      ws.addEventListener('message', function(event) {
        try {
          let msgStr = '';
          if (typeof event.data === 'string') {
            msgStr = event.data;
          } else if (event.data instanceof Blob) {
            // Blob: read async
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const text = reader.result;
                if (typeof text === 'string') processWsMessage(text);
              } catch(e) {}
            };
            reader.readAsText(event.data);
            return;
          } else if (event.data instanceof ArrayBuffer) {
            msgStr = new TextDecoder('utf-8').decode(event.data);
          }

          if (msgStr) processWsMessage(msgStr);
        } catch (err) {
          // Silent
        }
      });

      return ws;
    }
  });

  function processWsMessage(msgStr) {
    if (!msgStr || msgStr.length < 5) return;

    let parsed = null;
    try { parsed = JSON.parse(msgStr); } catch(e) { return; }

    if (!parsed || typeof parsed !== 'object') return;

    // Debug: log every meaningful WS message name
    if (DEBUG && parsed.name) {
      console.log('📡 [Anti-Fúria WS msg]', parsed.name, parsed.msg ? '(has msg)' : '');
    }

    if (isTradeCloseEvent(parsed)) {
      console.log('🎯 [Anti-Fúria WS] TRADE CLOSE detectado:', JSON.stringify(parsed).substring(0, 500));

      const raw = extractRawTrade(parsed);
      const trade = buildTrade(raw, 'WebSocket');
      if (trade) {
        broadcastTrade(trade);
      } else {
        console.warn('⚠️ [Anti-Fúria WS] Trade detectado mas não foi possível extrair dados válidos:', raw);
      }
    }
  }

  // ─── 2. XHR INTERCEPTOR (fallback for HTTP-based results) ────────
  const OrigXHROpen = XMLHttpRequest.prototype.open;
  const OrigXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._afUrl = url;
    return OrigXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        const url = (this._afUrl || '').toLowerCase();
        if (
          url.includes('option') || url.includes('trade') || url.includes('deal') ||
          url.includes('history') || url.includes('result') || url.includes('close')
        ) {
          const text = this.responseText;
          if (text && text.length > 10) {
            let data = null;
            try { data = JSON.parse(text); } catch(e) {}
            if (data && isTradeCloseEvent(data)) {
              console.log('🎯 [Anti-Fúria XHR] Trade close via HTTP:', url);
              const raw = extractRawTrade(data);
              const trade = buildTrade(raw, 'XHR');
              if (trade) broadcastTrade(trade);
            }
          }
        }
      } catch(e) {}
    });
    return OrigXHRSend.apply(this, arguments);
  };

  // ─── 3. FETCH INTERCEPTOR ────────────────────────────────────────
  const OrigFetch = window.fetch;
  window.fetch = function() {
    const url = (arguments[0] || '').toString().toLowerCase();
    const promise = OrigFetch.apply(this, arguments);

    if (
      url.includes('option') || url.includes('trade') || url.includes('deal') ||
      url.includes('history') || url.includes('result') || url.includes('close')
    ) {
      promise.then(response => {
        const clone = response.clone();
        clone.text().then(text => {
          try {
            let data = JSON.parse(text);
            if (data && isTradeCloseEvent(data)) {
              console.log('🎯 [Anti-Fúria Fetch] Trade close via fetch:', url);
              const raw = extractRawTrade(data);
              const trade = buildTrade(raw, 'Fetch');
              if (trade) broadcastTrade(trade);
            }
          } catch(e) {}
        }).catch(() => {});
      }).catch(() => {});
    }

    return promise;
  };

  console.log('✅ [Anti-Fúria Auto-Capture v2] WebSocket Proxy + XHR + Fetch interceptors ativos.');
})();
`;

  // 4. CONTENT.JS (Injected in pages to bridge with the Trader Journal app)
  const contentJs = `// Content script bridging Trader Web App with the Extension
(function() {
  console.log('🛡️ [Anti-Fúria ContentScript] Bridge iniciado em:', window.location.hostname);

  function syncFromPage() {
    const bridgeEl = document.getElementById('anti-furia-status-bridge');
    if (bridgeEl) {
      const isStopHit = bridgeEl.getAttribute('data-stophit') === 'true';
      const userActive = bridgeEl.getAttribute('data-user-active') !== 'false';
      const subStatus = bridgeEl.getAttribute('data-sub-status') || 'ACTIVE';
      const userRole = bridgeEl.getAttribute('data-user-role') || 'CLIENT';
      const todayPnl = parseFloat(bridgeEl.getAttribute('data-today-pnl') || '0');
      const dailyLossLimit = parseFloat(bridgeEl.getAttribute('data-loss-limit') || '30');
      const winRate = parseFloat(bridgeEl.getAttribute('data-winrate') || '0');
      const profitFactor = parseFloat(bridgeEl.getAttribute('data-profit-factor') || '0');
      const todayTradesCount = parseInt(bridgeEl.getAttribute('data-trades-count') || '0', 10);
      const currentCapital = parseFloat(bridgeEl.getAttribute('data-capital') || '0');

      const isSubBlocked = (userRole === 'CLIENT' && (!userActive || subStatus === 'OVERDUE' || subStatus === 'INACTIVE'));

      chrome.runtime.sendMessage({
        type: 'UPDATE_STOP_STATUS',
        isStopHit: isStopHit || isSubBlocked,
        isSubBlocked: isSubBlocked,
        userActive: userActive,
        subStatus: subStatus,
        userRole: userRole,
        todayPnl: todayPnl,
        dailyLossLimit: dailyLossLimit,
        winRate: winRate,
        profitFactor: profitFactor,
        todayTradesCount: todayTradesCount,
        currentCapital: currentCapital,
      });
    }
  }

  // Listen to window postMessage from the web app or injected script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ANTI_FURIA_SYNC') {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STOP_STATUS',
        isStopHit: event.data.isStopHit,
        todayPnl: event.data.todayPnl,
        dailyLossLimit: event.data.dailyLossLimit,
        winRate: event.data.winRate,
        profitFactor: event.data.profitFactor,
        todayTradesCount: event.data.todayTradesCount,
        currentCapital: event.data.currentCapital,
      });
    }

    if (event.data && event.data.type === 'AUTO_TRADE_CAPTURED' && event.data.trade) {
      console.log('🎯 [Anti-Fúria ContentScript] Enviando trade capturado para background:', event.data.trade);
      chrome.runtime.sendMessage({
        type: 'AUTO_TRADE_CAPTURED',
        trade: event.data.trade,
      });
    }
  });

  // Ouve mensagens vindas do Service Worker para repassar ao Trader Journal
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'TRADER_JOURNAL_AUTO_TRADE' && msg.trade) {
      console.log('🎉 [Anti-Fúria ContentScript] Transmitindo trade para o Trader Journal:', msg.trade);
      window.postMessage({
        type: 'TRADER_JOURNAL_AUTO_TRADE',
        trade: msg.trade,
      }, '*');
    }
  });

  // Observe DOM for changes in the status bridge
  const observer = new MutationObserver(() => syncFromPage());
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  // Initial check
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    syncFromPage();
  } else {
    document.addEventListener('DOMContentLoaded', syncFromPage);
  }
})();
`;

  // 4. BLOCKED.HTML (The psychological intervention screen with rich trader stats)
  const blockedHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Acesso Bloqueado | Stop Loss Atingido</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: #090d16;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 640px;
      width: 100%;
      background: #0f172a;
      border: 2px solid #ef4444;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25);
      overflow: hidden;
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .header {
      background: #dc2626;
      color: white;
      padding: 26px 24px;
      text-align: center;
    }
    .icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 60px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 50%;
      margin-bottom: 10px;
    }
    .icon-badge svg { width: 34px; height: 34px; fill: none; stroke: currentColor; stroke-width: 2.5; }
    .header h1 { font-size: 21px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { font-size: 13px; opacity: 0.95; margin-top: 4px; font-weight: 500; }
    .content { padding: 24px; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    @media (max-width: 520px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .metric-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 8px;
      text-align: center;
    }
    .metric-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; }
    .metric-val { font-size: 15px; font-weight: 800; font-family: monospace; color: #f1f5f9; margin-top: 3px; }
    .metric-val.green { color: #34d399; }
    .metric-val.cyan { color: #38bdf8; }
    .metric-val.red { color: #f87171; }

    .stats-box {
      background: #1e293b;
      border-radius: 16px;
      padding: 14px 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
      border: 1px solid #334155;
    }
    .stat-item { text-align: center; }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600; }
    .stat-val { font-size: 20px; font-weight: 800; font-family: monospace; margin-top: 4px; color: #f87171; }

    .quote-box {
      background: rgba(220, 38, 38, 0.1);
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .quote-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #fca5a5; margin-bottom: 6px; }

    .countdown-card {
      background: #020617;
      border: 1px dashed #475569;
      border-radius: 16px;
      padding: 14px;
      text-align: center;
      margin-bottom: 20px;
    }
    .countdown-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .countdown-digits { font-size: 28px; font-weight: 900; font-family: monospace; color: #38bdf8; margin-top: 4px; }
    .btn-row { display: flex; gap: 12px; }
    .btn {
      flex: 1;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary { background: #334155; color: white; }
    .btn-primary:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon-badge">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      </div>
      <h1>Acesso Bloqueado pelo Plano de Trade</h1>
      <p>Você atingiu o seu limite de Stop Loss diário na corretora</p>
    </div>

    <div class="content">
      <!-- 4-Card Rich Metrics Grid -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Assertividade</div>
          <div class="metric-val green" id="winRateVal">--%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Fator de Lucro</div>
          <div class="metric-val cyan" id="profitFactorVal">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Trades Hoje</div>
          <div class="metric-val" id="tradesCountVal">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Saldo Atual</div>
          <div class="metric-val" id="capitalVal">R$ --</div>
        </div>
      </div>

      <!-- Stop Loss Details Bar -->
      <div class="stats-box">
        <div class="stat-item">
          <div class="stat-label">Limite de Stop</div>
          <div class="stat-val" id="lossLimit">R$ 30,00</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Resultado Hoje</div>
          <div class="stat-val red" id="todayPnl">-R$ 30,00</div>
        </div>
      </div>

      <!-- Tactical AI Mentor Advice Card -->
      <div class="quote-box">
        <div class="quote-title">🧠 Diagnóstico do Mentor IA</div>
        <div id="aiMentorAdvice">
          Carregando análise do seu histórico operacional...
        </div>
      </div>

      <div class="countdown-card">
        <div class="countdown-title">Acesso liberado novamente à meia-noite (00:00:00)</div>
        <div class="countdown-digits" id="timer">--h --m --s</div>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" id="btnDashboard">Voltar ao Diário de Trade</button>
      </div>
    </div>
  </div>

  <script src="blocked.js"></script>
</body>
</html>
`;

  // 4b. BLOCKED.JS (External script for Manifest V3 CSP compliance)
  const blockedJs = `(function() {
  let targetUnlockDate = null;

  function formatBRL(val) {
    const num = Number(val) || 0;
    const absStr = Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (num < 0 ? '-R$ ' : 'R$ ') + absStr;
  }

  function generateAiAdvice(winRate, profitFactor, tradesCount, todayPnl, lossLimit) {
    const limitFormatted = formatBRL(lossLimit);

    if (winRate > 0 && winRate >= 50) {
      return 'Sua taxa de assertividade geral é de <strong>' + winRate.toFixed(1) + '%</strong> com Fator de Lucro de <strong>' + profitFactor.toFixed(2) + '</strong>. Seu histórico prova que sua técnica funciona! Não destrua semanas de lucro consistente por conta de um Stop Loss diário de <strong>' + limitFormatted + '</strong>. Aceitar a perda de hoje protege o seu capital para continuar vencendo no próximo ciclo.';
    } else if (tradesCount >= 4) {
      return 'Você já realizou <strong>' + tradesCount + ' operações</strong> hoje e atingiu o limite de Stop Loss. Continuar operando sob forte emoção (tilt/fúria) é o principal motivo de quebra de bancas. Feche a corretora agora, estude seu histórico no diário e volte revigorado na sua próxima janela!';
    } else if (winRate > 0) {
      return 'Sua assertividade atual é de <strong>' + winRate.toFixed(1) + '%</strong>. O mercado financeiro é uma maratona de longo prazo. Respeitar o seu limite de perda de <strong>' + limitFormatted + '</strong> é a única regra inegociável que garante a sua sobrevivência e longevidade no trading.';
    } else {
      return 'O maior destruidor de bancas em Opções Binárias e Mercado Financeiro não é a taxa de acerto, é o dia de fúria após tomar o stop. Aceitar a perda de <strong>' + limitFormatted + '</strong> é a decisão que separa um apostador de um trader profissional.';
    }
  }

  function calculateTargetUnlockDate(data) {
    const now = new Date();
    const unlock = new Date();

    if (data && data.antiFuriaCustomWindowEnabled && data.antiFuriaStartTime) {
      const parts = data.antiFuriaStartTime.split(':');
      const startH = parseInt(parts[0], 10) || 0;
      const startM = parseInt(parts[1], 10) || 0;

      unlock.setHours(startH, startM, 0, 0);
      if (now >= unlock) {
        unlock.setDate(unlock.getDate() + 1);
      }
    } else {
      unlock.setHours(24, 0, 0, 0);
    }
    return unlock;
  }

  function goToDashboard() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        const appTab = tabs.find(t => t.url && (t.url.includes('localhost') || t.url.includes('127.0.0.1')));
        if (appTab && appTab.id) {
          chrome.tabs.update(appTab.id, { active: true });
          if (appTab.windowId) {
            chrome.windows.update(appTab.windowId, { focused: true });
          }
        } else {
          chrome.tabs.create({ url: 'http://localhost:3000' });
        }
      });
    } else {
      window.location.href = 'http://localhost:3000';
    }
  }

  function redirectBack() {
    const params = new URLSearchParams(window.location.search);
    const orig = params.get('orig');
    if (orig) {
      window.location.href = decodeURIComponent(orig);
    } else {
      goToDashboard();
    }
  }

  function updateCountdown() {
    const now = new Date();
    const unlock = targetUnlockDate || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const diff = unlock.getTime() - now.getTime();

    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    if (diff <= 0) {
      timerEl.innerText = '00h 00m 00s';
      redirectBack();
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    timerEl.innerText = 
      String(hours).padStart(2, '0') + 'h ' +
      String(mins).padStart(2, '0') + 'm ' +
      String(secs).padStart(2, '0') + 's';
  }

  // Load state from extension storage & listen to live unlock changes
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['dailyLossLimit', 'todayPnl', 'isStopHit', 'isSubBlocked', 'antiFuriaCustomWindowEnabled', 'antiFuriaStartTime', 'winRate', 'profitFactor', 'todayTradesCount', 'currentCapital'], (data) => {
      const params = new URLSearchParams(window.location.search);
      const isSubBlocked = Boolean(data.isSubBlocked) || params.get('type') === 'sub_blocked';

      if (isSubBlocked) {
        const headerTitle = document.querySelector('.header h1');
        const headerSub = document.querySelector('.header p');
        const quoteTitle = document.querySelector('.quote-title');
        const adviceEl = document.getElementById('aiMentorAdvice');
        const countdownCard = document.querySelector('.countdown-card');
        const btnRow = document.querySelector('.btn-row');

        if (headerTitle) headerTitle.innerText = '🔒 ASSINATURA PENDENTE / SUSPENSA';
        if (headerSub) headerSub.innerText = 'Sua conta do TradeLock foi desativada pela administração';
        if (quoteTitle) quoteTitle.innerText = '⚠️ BLOQUEIO DE ASSINATURA SAAS';
        if (adviceEl) {
          adviceEl.innerHTML = 'Seu acesso às corretoras e ao diário de trade foi suspenso por pendência no plano de assinatura.<br/><br/><strong>Para reativar seu acesso:</strong> entre em contato com a administração para realizar o pagamento.';
        }
        if (countdownCard) countdownCard.style.display = 'none';
        if (btnRow) {
          btnRow.innerHTML = '<a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20regularizar%20minha%20assinatura%20do%20TradeLock%20para%20liberar%20meu%20acesso." target="_blank" class="btn btn-primary" style="background:#059669;color:#fff;text-decoration:none;display:block;text-align:center;">💬 Regularizar Assinatura no WhatsApp</a>';
        }
        return;
      }
      const limitEl = document.getElementById('lossLimit');
      const pnlEl = document.getElementById('todayPnl');
      const titleEl = document.querySelector('.countdown-title');
      const winRateEl = document.getElementById('winRateVal');
      const pfEl = document.getElementById('profitFactorVal');
      const tradesEl = document.getElementById('tradesCountVal');
      const capitalEl = document.getElementById('capitalVal');
      const adviceEl = document.getElementById('aiMentorAdvice');

      const limit = Number(data.dailyLossLimit) || ${dailyLossLimit};
      const pnl = Number(data.todayPnl);
      const winRate = Number(data.winRate) || 0;
      const profitFactor = Number(data.profitFactor) || 0;
      const tradesCount = Number(data.todayTradesCount) || 0;
      const capital = Number(data.currentCapital) || 0;

      if (limitEl) limitEl.innerText = formatBRL(limit);
      if (pnlEl) pnlEl.innerText = formatBRL(isNaN(pnl) || pnl === 0 ? -limit : pnl);
      if (winRateEl) winRateEl.innerText = winRate > 0 ? winRate.toFixed(1) + '%' : 'N/A';
      if (pfEl) pfEl.innerText = profitFactor > 0 ? profitFactor.toFixed(2) : 'N/A';
      if (tradesEl) tradesEl.innerText = tradesCount > 0 ? tradesCount + ' trades' : '1 trade';
      if (capitalEl) capitalEl.innerText = capital > 0 ? formatBRL(capital) : 'R$ --';

      if (adviceEl) {
        adviceEl.innerHTML = generateAiAdvice(winRate, profitFactor, tradesCount, pnl < 0 ? pnl : -limit, limit);
      }

      targetUnlockDate = calculateTargetUnlockDate(data);

      if (titleEl) {
        if (data && data.antiFuriaCustomWindowEnabled && data.antiFuriaStartTime) {
          titleEl.innerText = 'Acesso liberado novamente no próximo ciclo às ' + data.antiFuriaStartTime + 'h';
        } else {
          titleEl.innerText = 'Acesso liberado novamente à meia-noite (00:00:00)';
        }
      }

      if (data.isStopHit === false) {
        redirectBack();
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.isStopHit && changes.isStopHit.newValue === false) {
        redirectBack();
      }
    });
  }

  // Start countdown timer immediately
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Attach button event listener
  const initEvents = () => {
    const btn = document.getElementById('btnDashboard');
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        goToDashboard();
      };
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initEvents();
  } else {
    document.addEventListener('DOMContentLoaded', initEvents);
  }
})();
`;

  // 5. POPUP.HTML & POPUP.JS (Interface da Barra de Ferramentas - Design Painel Dark & Somente Leitura)
  const popupHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>TradeLock Anti-Fúria</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 320px;
      background: #000000;
      color: #f8fafc;
      padding: 16px;
      border: 1px solid #1e293b;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .logo {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.3px;
    }
    .status-badge {
      font-size: 10px;
      font-weight: 900;
      font-family: monospace;
      padding: 3px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-active { background: #e11d48; color: #ffffff; box-shadow: 0 0 12px rgba(225,29,72,0.4); }
    .status-inactive { background: #059669; color: #ffffff; }

    .status-card {
      background: #000000;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 12px;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .card-label {
      font-size: 10px;
      font-weight: 800;
      font-family: monospace;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-val {
      font-size: 12px;
      font-weight: 800;
      font-family: monospace;
      margin-top: 4px;
      line-height: 1.4;
    }

    .domains-title {
      font-size: 10px;
      font-weight: 800;
      font-family: monospace;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .domain-list {
      max-height: 140px;
      overflow-y: auto;
      background: #000000;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 4px 8px;
      margin-bottom: 10px;
    }
    .domain-list::-webkit-scrollbar { width: 4px; }
    .domain-list::-webkit-scrollbar-track { background: #000000; }
    .domain-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

    .domain-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 6px;
      border-bottom: 1px solid #0f172a;
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      color: #e2e8f0;
    }
    .domain-item:last-child { border-bottom: none; }

    .admin-lock-note {
      font-size: 10px;
      font-family: monospace;
      color: #64748b;
      text-align: center;
      padding: 8px;
      background: #000000;
      border: 1px solid #1e293b;
      border-radius: 12px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-test {
      width: 100%;
      background: #e11d48;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 10px;
      font-size: 11px;
      font-weight: 900;
      font-family: monospace;
      cursor: pointer;
      margin-bottom: 6px;
      transition: background 0.2s;
      box-shadow: 0 4px 14px rgba(225,29,72,0.3);
    }
    .btn-test:hover { background: #f43f5e; }

    .btn-unlock {
      width: 100%;
      background: #1e293b;
      color: #94a3b8;
      border: none;
      border-radius: 12px;
      padding: 8px;
      font-size: 10px;
      font-weight: 800;
      font-family: monospace;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-unlock:hover { background: #334155; color: #ffffff; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🛡️ TradeLock Anti-Fúria</div>
    <div id="statusBadge" class="status-badge status-inactive">Liberado 🟢</div>
  </div>

  <div class="status-card">
    <div class="card-label">Status da Trava de Risk:</div>
    <div id="statusMsg" class="card-val" style="color: #34d399;">
      Operações liberadas normalmente sob custódia.
    </div>
  </div>

  <div class="domains-title">Corretoras Bloqueadas no Stop:</div>
  <div class="domain-list" id="domainList"></div>

  <div class="admin-lock-note">
    <span>🔒 Lista gerenciada exclusivamente pela Administração</span>
  </div>

  <button id="btnTest" class="btn-test">Simular Stop Loss (Testar)</button>
  <button id="btnUnlock" class="btn-unlock">Desativar Trava (Modo Teste)</button>

  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `function render() {
  chrome.storage.local.get(['isStopHit', 'isSubBlocked', 'blockedDomains'], (data) => {
    const badge = document.getElementById('statusBadge');
    const msg = document.getElementById('statusMsg');
    const list = document.getElementById('domainList');

    if (data.isSubBlocked) {
      badge.className = 'status-badge status-active';
      badge.innerText = 'SUSPENSO 🔒';
      msg.innerText = 'Assinatura suspensa! Acesso a corretoras bloqueado.';
      msg.style.color = '#f87171';
    } else if (data.isStopHit) {
      badge.className = 'status-badge status-active';
      badge.innerText = 'BLOQUEADO 🔒';
      msg.innerText = 'Stop Loss atingido! Acesso a corretoras bloqueado.';
      msg.style.color = '#f87171';
    } else {
      badge.className = 'status-badge status-inactive';
      badge.innerText = 'LIBERADO 🟢';
      msg.innerText = 'Operações liberadas normalmente sob custódia.';
      msg.style.color = '#34d399';
    }

    list.innerHTML = '';
    const doms = data.blockedDomains || [];
    doms.forEach(d => {
      const item = document.createElement('div');
      item.className = 'domain-item';
      item.innerHTML = '<span>🌐 ' + d + '</span><span style="color:#64748b;font-size:10px">PROTEGIDO 🔒</span>';
      list.appendChild(item);
    });
  });
}

document.getElementById('btnTest').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TEST_BLOCK_TRIGGER' }, () => render());
});

document.getElementById('btnUnlock').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TEST_UNLOCK' }, () => render());
});

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(() => render());
}

document.addEventListener('DOMContentLoaded', render);
`;

  // 6. README.TXT (Tutorial fácil para o usuário)
  const readmeTxt = `=====================================================
🛡️ EXTENSÃO ANTI-FÚRIA TRADER: BLOQUEADOR DE CORRETORAS
=====================================================

Esta extensão foi desenvolvida para proteger o seu capital no mercado de Opções Binárias.
Assim que você atinge o seu Stop Loss no Diário de Trade, o acesso a corretoras (Exnova, Quotex, etc.)
é BLOQUEADO IMEDIATAMENTE no seu navegador até o dia seguinte (às 00:00:00).

COMO INSTALAR NO GOOGLE CHROME / BRAVE / EDGE (1 MINUTO):
--------------------------------------------------------
1. Extraia o conteúdo deste arquivo .ZIP em uma pasta no seu computador (ex: na pasta Documentos ou Área de Trabalho).
2. Abra o Google Chrome (ou Brave / Edge) e acesse na barra de endereços:
   chrome://extensions
3. No canto superior direito da página, ATIVE a chave "Modo de Desenvolvedor" (Developer Mode).
4. Clique no botão "Carregar sem compactação" (Load unpacked) que aparecerá no canto superior esquerdo.
5. Selecione a pasta onde você extraiu estes arquivos.
6. Pronto! O ícone de escudo da extensão aparecerá na sua barra de ferramentas.

COMO TESTAR:
------------
1. Abra o seu Diário de Trade no navegador.
2. Registre as operações normais do dia. Ao atingir o Stop Loss diário, a extensão detectará e
   fechará ou redirecionará qualquer tentativa de abrir a Exnova (exnova.com / trade.exnova.com).
3. Você também pode clicar no ícone da extensão a qualquer momento para ver o status ou testar o bloqueio!

Boas operações e mantenha a disciplina inegociável!
`;

  // Add files to zip
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('background.js', backgroundJs);
  zip.file('content.js', contentJs);
  zip.file('injected.js', injectedJs);
  zip.file('blocked.html', blockedHtml);
  zip.file('blocked.js', blockedJs);
  zip.file('popup.html', popupHtml);
  zip.file('popup.js', popupJs);
  zip.file('LEIAME_INSTRUCOES.txt', readmeTxt);

  // Generate icon png base64
  try {
    const icon128Base64 = generateIconDataUrl(128);
    if (icon128Base64) {
      zip.file('icon.png', icon128Base64, { base64: true });
    }
  } catch (e) {
    console.warn('Could not generate canvas icon, continuing...', e);
  }

  return await zip.generateAsync({ type: 'blob' });
}
