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
        resources: ['blocked.html', 'blocked.js', 'icon.png', 'injected.js', 'bull-vs-bear.jpg', 'tradelock-shield.jpg'],
        matches: ['<all_urls>'],
      },
    ],
  };

  // Carregar imagens do duelo para o pacote ZIP da extensão
  try {
    const bullRes = await fetch('/bull-vs-bear.jpg');
    if (bullRes.ok) {
      const bullBlob = await bullRes.blob();
      zip.file('bull-vs-bear.jpg', bullBlob);
    }
  } catch (e) {
    console.warn('Não foi possível carregar bull-vs-bear.jpg para a extensão:', e);
  }

  try {
    const shieldRes = await fetch('/tradelock-shield.jpg');
    if (shieldRes.ok) {
      const shieldBlob = await shieldRes.blob();
      zip.file('tradelock-shield.jpg', shieldBlob);
    }
  } catch (e) {
    console.warn('Não foi possível carregar tradelock-shield.jpg para a extensão:', e);
  }

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
  chrome.storage.local.get(['isStopHit', 'isMaxTradesHit', 'isSubBlocked', 'blockedDomains'], (data) => {
    if ((data.isStopHit || data.isMaxTradesHit || data.isSubBlocked) && Array.isArray(data.blockedDomains)) {
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

    // 2. Atualiza PnL e verifica se acionou o Stop Loss ou o limite de Overtrading
    chrome.storage.local.get(['todayPnl', 'dailyLossLimit', 'blockedDomains', 'todayTradesCount', 'maxTradesPerDay'], (res) => {
      const currentPnl = Number(res.todayPnl) || 0;
      const tradePnl = Number(msg.trade.pnl) || 0;
      const newPnl = currentPnl + tradePnl;
      const limit = Number(res.dailyLossLimit) || ${dailyLossLimit};
      const isHit = newPnl <= -limit;

      const newTradesCount = (Number(res.todayTradesCount) || 0) + 1;
      const maxTrades = Number(res.maxTradesPerDay) || 5;
      const isMaxTradesHit = maxTrades > 0 && newTradesCount >= maxTrades;

      const isLockActive = isHit || isMaxTradesHit;

      chrome.storage.local.set({
        todayPnl: newPnl,
        isStopHit: isHit,
        isMaxTradesHit: isMaxTradesHit,
        todayTradesCount: newTradesCount,
        lastTradeCaptured: msg.trade,
      }, () => {
        if (isLockActive) {
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
        sendResponse({ success: true, isStopHit: isHit, isMaxTradesHit: isMaxTradesHit, newPnl: newPnl });
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
      const isMaxTradesHit = Boolean(msg.isMaxTradesHit);
      const maxTradesPerDay = Number(msg.maxTradesPerDay) || 5;
      const pnl = Number(msg.todayPnl) || 0;
      const limit = Number(msg.dailyLossLimit) || ${dailyLossLimit};
      const today = new Date().toISOString().split('T')[0];

      chrome.storage.local.set({
        isStopHit: isHit,
        isMaxTradesHit: isMaxTradesHit,
        maxTradesPerDay: maxTradesPerDay,
        isSubBlocked: isSubBlocked,
        todayPnl: pnl,
        dailyLossLimit: limit,
        lastDate: today,
        winRate: Number(msg.winRate) || 0,
        profitFactor: Number(msg.profitFactor) || 0,
        todayTradesCount: Number(msg.todayTradesCount) || 0,
        currentCapital: Number(msg.currentCapital) || 0,
      }, () => {
        const isLockActive = isHit || isMaxTradesHit || isSubBlocked;
        if (isLockActive) {
          // Stop loss hit or Overtrading hit or Subscription blocked -> Redirect broker tabs to blocked.html
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
          // Only unblock tabs if NO lock condition is active!
          unblockAllTabs();
        }
        sendResponse({ success: true, isStopHit: isHit, isMaxTradesHit: isMaxTradesHit, isSubBlocked: isSubBlocked });
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

    // --- CRITICAL: Process CLOSED trades with a definitive result ---
    const resultField = String(raw.result || '').toLowerCase();
    const winField = String(raw.win || '').toLowerCase();
    const statusField = String(raw.status || raw.state || raw.close_reason || '').toLowerCase();
    
    const closedResults = ['win', 'loose', 'loss', 'equal', 'draw'];
    const isClosed =
      closedResults.includes(resultField) ||
      closedResults.includes(winField) ||
      winField === 'true' ||
      winField === 'false' ||
      raw.win === true ||
      raw.win === false ||
      statusField === 'closed' ||
      statusField === 'finished' ||
      raw.closed === true ||
      raw.close_time != null ||
      raw.close_reason != null ||
      raw.close_quote != null ||
      raw.win_amount != null;

    if (!isClosed) {
      console.log('⏩ [Anti-Fúria] Ignorando evento de abertura de ordem (status=' + statusField + ', win=' + winField + ')');
      return null;
    }

    // --- Dedup by option_id / deal_id ---
    const optionId = raw.option_id || raw.id || raw.deal_id || raw.position_id || '';
    if (optionId && processedIds.has('oid-' + optionId)) {
      console.log('⏩ [Anti-Fúria] Ignorando trade duplicado, id:', optionId);
      return null;
    }
    if (optionId) processedIds.add('oid-' + optionId);

    // --- Amount invested (Stake / Entrada) ---
    const amount = Math.abs(Number(raw.amount || raw.enrolled_amount || raw.investment || raw.stake || raw.buy_amount) || 0);

    // --- Win/Loss detection ---
    const rawProfitField = Number(raw.net_profit || raw.net_pnl || raw.profit_net || raw.profit_amount || raw.win_amount || raw.win_enrolled_amount || raw.profit || raw.pnl) || 0;

    const isWin =
      resultField === 'win' ||
      winField === 'win' ||
      winField === 'true' ||
      raw.win === true ||
      (rawProfitField > amount && amount > 0) ||
      (raw.net_profit > 0 || raw.net_pnl > 0);

    const isEqual =
      resultField === 'equal' ||
      resultField === 'draw' ||
      winField === 'equal' ||
      (rawProfitField === amount && amount > 0);

    const isLoss =
      !isWin &&
      !isEqual &&
      (resultField === 'loose' ||
        resultField === 'loss' ||
        winField === 'loose' ||
        winField === 'loss' ||
        winField === 'false' ||
        raw.win === false ||
        (rawProfitField === 0 && isClosed));

    // --- Strict PnL Extraction (Lucro Líquido Real) ---
    let pnl = 0;

    if (raw.net_pnl != null) {
      pnl = Number(raw.net_pnl);
    } else if (raw.net_profit != null) {
      pnl = Number(raw.net_profit);
    } else if (raw.profit_net != null) {
      pnl = Number(raw.profit_net);
    } else if (isWin) {
      if (rawProfitField > amount && amount > 0) {
        // Exnova Payout Total (Retorno Total = Investimento + Lucro Líquido)
        // Exemplo: Retorno R$ 18,50 - Investimento R$ 10,00 = Lucro Líquido R$ 8,50
        pnl = rawProfitField - amount;
      } else if (rawProfitField > 0) {
        pnl = rawProfitField;
      } else if (amount > 0) {
        const profitPct = Number(raw.profit_percent) || 185;
        pnl = profitPct > 100 ? amount * ((profitPct - 100) / 100) : amount * (profitPct / 100);
      }
    } else if (isLoss) {
      pnl = -Math.abs(amount > 0 ? amount : rawProfitField);
    } else if (isEqual) {
      pnl = 0;
    }

    // Asset mapping (Exnova uses active_id for pairs)
    const activeMap = { 1: 'EUR/USD', 2: 'EUR/GBP', 4: 'GBP/USD', 5: 'USD/JPY', 76: 'AUD/CAD', 81: 'EUR/JPY' };
    const activeId = raw.active_id || raw.act || '';
    const rawAsset = String(raw.active || raw.asset || raw.instrument || raw.active_name || '').toUpperCase();
    const asset = rawAsset || (activeMap[activeId] || (activeId ? 'ID_' + activeId : 'DIGITAL'));

    // Direction
    const dir = String(raw.dir || raw.direction || raw.type || '').toLowerCase();
    const type = (dir === 'put' || dir.includes('sell') || dir.includes('baixa')) ? 'SELL' : 'BUY';

    // Account Type Detection (DEMO vs REAL)
    const userBalanceType = Number(raw.user_balance_type || raw.balance_type_id || raw.balance_type || raw.account_type_id) || 0;
    const isDemoFlag = raw.is_demo === true || raw.demo === true || raw.isDemo === true || raw.is_demo === 1 || raw.demo === 1;
    const accountTypeStr = String(raw.account_type || raw.accountType || raw.type_name || raw.account || raw.balance_name || '').toLowerCase();
    
    const isDemo = 
      userBalanceType === 4 ||
      isDemoFlag ||
      accountTypeStr.includes('demo') ||
      accountTypeStr.includes('practic') ||
      accountTypeStr.includes('simulat') ||
      accountTypeStr.includes('prática') ||
      accountTypeStr.includes('pratica');

    const accountType = isDemo ? 'DEMO' : 'REAL';
    const isReal = !isDemo;

    const now = new Date();
    const roundedPnl = Math.round(pnl * 100) / 100;
    const result = isWin ? 'GAIN' : (isLoss ? 'LOSS' : 'BREAKEVEN');
    const tradeId = optionId || Date.now();

    console.log('✅ [Anti-Fúria] Trade FECHADO (' + (isDemo ? 'DEMO 🧪' : 'REAL 💵') + '):', result, 'PnL:', roundedPnl, 'Amount:', amount, 'Asset:', asset, 'Dir:', type);

    return {
      id: 'auto-' + tradeId + '-' + Math.random().toString(36).substring(2, 6),
      date: now.toISOString().split('T')[0],
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      asset: asset.replace(/[^A-Z0-9/._-]/g, '') || 'DIGITAL',
      type: type,
      strategy: 'Captura Automática (' + source + (isDemo ? ' - Conta DEMO 🧪' : ' - Conta REAL 💵') + ')',
      result: result,
      pnl: roundedPnl,
      contractsOrQuantity: amount > 0 ? Math.round(amount * 100) / 100 : Math.abs(roundedPnl),
      accountType: accountType,
      isReal: isReal,
      notes: (isDemo ? '[CONTA DEMO 🧪] ' : '[CONTA REAL 💵] ') + 'Capturado automaticamente em ' + HOST,
      tags: isDemo ? ['DEMO', 'Auto-Capturado'] : ['REAL', 'Auto-Capturado'],
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
      name === 'result' ||
      name === 'order-changed' ||
      name === 'position-state-changed'
    ) return true;

    // Quotex / generic format: look for keywords in stringified JSON
    const str = JSON.stringify(parsed).toLowerCase();
    if (
      (str.includes('"option-closed"') || str.includes('"deal-closed"') || str.includes('"digital-option-closed"')) ||
      (str.includes('"win"') && str.includes('"amount"') && (str.includes('"win_amount"') || str.includes('"profit"'))) ||
      (str.includes('"close_quote"') && str.includes('"buy_amount"'))
    ) return true;

    return false;
  }

  // ─── Extract raw trade data from various message structures ──────
  function extractRawTrade(parsed) {
    if (parsed.msg && typeof parsed.msg === 'object') {
      if (parsed.msg.raw_event && typeof parsed.msg.raw_event === 'object') {
        const keys = Object.keys(parsed.msg.raw_event);
        for (const key of keys) {
          const candidate = parsed.msg.raw_event[key];
          if (candidate && typeof candidate === 'object' && (candidate.amount !== undefined || candidate.result !== undefined || candidate.win !== undefined || candidate.status !== undefined)) {
            return candidate;
          }
        }
      }
      if (parsed.msg.result && typeof parsed.msg.result === 'object') return parsed.msg.result;
      if (parsed.msg.win !== undefined || parsed.msg.win_amount !== undefined || parsed.msg.amount !== undefined || parsed.msg.status !== undefined) return parsed.msg;
    }
    if (parsed.data && typeof parsed.data === 'object') return parsed.data;
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
    if (!parsed) return;

    // Support Array of WS items or single object
    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const IGNORED_NAMES = ['quote-generated', 'candle-generated', 'heartbeat', 'timesync', 'instrument-quotes-generated', 'front-ping', 'live-deal-binary-option-placed-quote'];
      const msgName = (item.name || '').toLowerCase();

      if (DEBUG && msgName && !IGNORED_NAMES.includes(msgName)) {
        console.log('📡 [Anti-Fúria WS msg]', item.name, item.msg ? '(has msg)' : '');
        window.__antiFuriaLastRawMessages = window.__antiFuriaLastRawMessages || [];
        window.__antiFuriaLastRawMessages.unshift(item);
        if (window.__antiFuriaLastRawMessages.length > 20) window.__antiFuriaLastRawMessages.pop();
      }

      if (isTradeCloseEvent(item)) {
        console.log('🎯 [Anti-Fúria WS] TRADE CLOSE detectado:', JSON.stringify(item).substring(0, 500));

        const raw = extractRawTrade(item);
        const trade = buildTrade(raw, 'WebSocket');
        if (trade) {
          broadcastTrade(trade);
        } else {
          console.warn('⚠️ [Anti-Fúria WS] Trade detectado mas não foi possível extrair dados válidos:', raw);
        }
      }
    }
  }

  // ─── WebSocket Prototype Message Listener (Catches pre-existing & worker WebSockets) ───
  try {
    const origAddEv = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function(type, listener, options) {
      if (type === 'message' && typeof listener === 'function') {
        const wrapped = function(event) {
          try {
            if (typeof event.data === 'string') processWsMessage(event.data);
          } catch(e) {}
          return listener.apply(this, arguments);
        };
        return origAddEv.call(this, type, wrapped, options);
      }
      return origAddEv.apply(this, arguments);
    };
  } catch(e) {}

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

  // ─── 4. TRAVA DO BEM: INTERCEPTADOR DE ORDENS E BOTÕES DE COMPRA/VENDA ─────
  let lockState = { isStopHit: false, isMaxTradesHit: false, maxTradesPerDay: 5, todayTradesCount: 0 };

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'ANTI_FURIA_LOCK_STATE') {
      lockState = {
        isStopHit: Boolean(event.data.isStopHit),
        isMaxTradesHit: Boolean(event.data.isMaxTradesHit),
        maxTradesPerDay: Number(event.data.maxTradesPerDay) || 5,
        todayTradesCount: Number(event.data.todayTradesCount) || 0
      };
      updateBrokerBanner();
    }
  });

  function isOrderBlocked() {
    return lockState.isStopHit || lockState.isMaxTradesHit;
  }

  let lastAlertTime = 0;
  function showTravaDoBemAlert() {
    const now = Date.now();
    if (now - lastAlertTime < 2000) return; // Debounce alerts
    lastAlertTime = now;

    const msg = lockState.isStopHit 
      ? '🔒 STOP LOSS ATINGIDO: Novas ordens foram bloqueadas!' 
      : '🛡️ TRAVA DO BEM ATIVA: Você atingiu seu limite de ' + lockState.maxTradesPerDay + ' operações para hoje (' + lockState.todayTradesCount + '/' + lockState.maxTradesPerDay + ').\\n\\nNovas ordens foram bloqueadas para proteger seu capital, mas telas de saque e navegação permanecem LIBERADAS! 🟢';
    
    alert(msg);
  }

  // Intercept Call / Put / Buy / Sell button clicks on broker UI
  document.addEventListener('click', function(e) {
    if (!isOrderBlocked()) return;

    const target = e.target;
    if (!target) return;

    const btn = target.closest('button, div[role="button"], a[role="button"], .btn-call, .btn-put, .deal-button, [data-test*="call"], [data-test*="put"], [data-test*="deal"], [class*="call"], [class*="put"], [class*="buy"], [class*="sell"]');
    
    if (btn) {
      const txt = (btn.innerText || btn.textContent || '').toLowerCase();
      const cls = (btn.className || '').toString().toLowerCase();
      const testAttr = (btn.getAttribute('data-test') || '').toLowerCase();

      const isTradeBtn = 
        cls.includes('call') || cls.includes('put') || cls.includes('buy') || cls.includes('sell') || cls.includes('deal') ||
        testAttr.includes('call') || testAttr.includes('put') || testAttr.includes('deal') ||
        txt.includes('call') || txt.includes('put') || txt.includes('comprar') || txt.includes('vender') || txt.includes('investir') || txt.includes('acima') || txt.includes('abaixo') || txt.includes('higher') || txt.includes('lower');

      const isNavBtn = txt.includes('saque') || txt.includes('withdraw') || txt.includes('depósito') || txt.includes('deposit') || txt.includes('perfil') || txt.includes('suporte') || txt.includes('histórico');

      if (isTradeBtn && !isNavBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showTravaDoBemAlert();
        return false;
      }
    }
  }, true);

  // Intercept WebSocket send for order placements
  const origWSSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    if (isOrderBlocked() && typeof data === 'string') {
      const dataLower = data.toLowerCase();
      if (
        dataLower.includes('buyv3') ||
        dataLower.includes('place-order') ||
        dataLower.includes('open-position') ||
        dataLower.includes('create-option') ||
        dataLower.includes('do-deal') ||
        dataLower.includes('option-buy')
      ) {
        console.warn('🛡️ [Anti-Fúria Trava do Bem] Requisição de ordem interceptada e cancelada:', dataLower.substring(0, 100));
        showTravaDoBemAlert();
        return; // Block sending
      }
    }
    return origWSSend.apply(this, arguments);
  };

  function updateBrokerBanner() {
    let banner = document.getElementById('anti-furia-trava-do-bem-banner');
    if (!lockState.isMaxTradesHit || lockState.isStopHit) {
      if (banner) banner.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'anti-furia-trava-do-bem-banner';
      banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 999999; background: #09090b; border-bottom: 2px solid #10b981; color: #ffffff; padding: 10px 16px; font-family: monospace; font-size: 13px; font-weight: bold; text-align: center; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);';
      document.body.appendChild(banner);
    }

    banner.innerHTML = '<span>🛡️ <strong style="color:#10b981;">TRAVA DO BEM TRADELOCK:</strong> Limite diário de operações atingido (' + lockState.todayTradesCount + '/' + lockState.maxTradesPerDay + '). Novas entradas bloqueadas | Saques e histórico liberados 🟢</span>';
  }

  console.log('✅ [Anti-Fúria Auto-Capture v2] WebSocket Proxy + Trava do Bem interceptores ativos.');
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
      const isMaxTradesHit = bridgeEl.getAttribute('data-max-trades-hit') === 'true';
      const maxTradesPerDay = parseInt(bridgeEl.getAttribute('data-max-trades') || '5', 10);
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

      // Forward status to injected script on broker pages
      window.postMessage({
        type: 'ANTI_FURIA_LOCK_STATE',
        isStopHit: isStopHit || isSubBlocked,
        isMaxTradesHit: isMaxTradesHit,
        maxTradesPerDay: maxTradesPerDay,
        todayTradesCount: todayTradesCount,
      }, '*');

      chrome.runtime.sendMessage({
        type: 'UPDATE_STOP_STATUS',
        isStopHit: isStopHit || isSubBlocked,
        isMaxTradesHit: isMaxTradesHit,
        maxTradesPerDay: maxTradesPerDay,
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

  // 4. BLOCKED.HTML (Tela de Bloqueio da Extensão - Design Oficial Touro vs Urso & Painel Dark)
  const blockedHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Acesso Bloqueado | TradeLock Anti-Fúria</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: #000000;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      max-width: 900px;
      width: 100%;
      background: #000000;
      border: 2px solid #e11d48;
      border-radius: 24px;
      box-shadow: 0 0 50px rgba(225, 29, 72, 0.35);
      overflow: hidden;
    }
    .header {
      background: #e11d48;
      color: #ffffff;
      padding: 24px 20px;
      text-align: center;
      border-bottom: 1px solid #be123c;
    }
    .header-title-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .header-icon {
      width: 36px;
      height: 36px;
      background: rgba(0,0,0,0.25);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 900;
      font-family: monospace;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header p {
      font-size: 13px;
      font-weight: 700;
      opacity: 0.95;
      max-width: 620px;
      margin: 0 auto;
      line-height: 1.4;
    }

    .content {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: #000000;
    }

    /* Duel Card */
    .duel-card {
      border: 1px solid #1e293b;
      background: #000000;
      border-radius: 16px;
      padding: 16px;
    }
    .duel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .duel-tag {
      font-size: 10px;
      font-weight: 900;
      font-family: monospace;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .duel-title {
      font-size: 14px;
      font-weight: 900;
      font-family: monospace;
      color: #ffffff;
    }
    .duel-btn-row {
      display: flex;
      gap: 6px;
      background: #000000;
      border: 1px solid #1e293b;
      padding: 4px;
      border-radius: 12px;
    }
    .duel-btn {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      background: transparent;
      color: #94a3b8;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .duel-btn.active-bull { background: #059669; color: #ffffff; }
    .duel-btn.active-bear { background: #e11d48; color: #ffffff; }
    .duel-btn.active-full { background: #7c3aed; color: #ffffff; }

    .duel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 640px) {
      .duel-grid { grid-template-columns: 1fr; }
    }
    .duel-view-box {
      position: relative;
      border: 1px solid #1e293b;
      border-radius: 16px;
      background: #000000;
      overflow: hidden;
      height: 200px;
    }
    .duel-box-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.85;
      display: block;
    }
    .duel-box-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, #000000 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
    }
    .duel-box-text {
      position: absolute;
      bottom: 12px;
      left: 12px;
      right: 12px;
      text-align: left;
    }

    /* 4-KPI Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    @media (max-width: 520px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .metric-card {
      background: #000000;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 12px 10px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .metric-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; }
    .metric-val { font-size: 18px; font-weight: 900; font-family: monospace; color: #f8fafc; margin-top: 4px; }
    .metric-val.green { color: #34d399; }
    .metric-val.cyan { color: #38bdf8; }

    /* AI Mentor Quote Box */
    .quote-box {
      background: #000000;
      border: 1px solid rgba(225, 29, 72, 0.4);
      padding: 16px;
      border-radius: 16px;
      font-size: 12px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .quote-title { font-size: 11px; font-weight: 900; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; color: #fb7185; margin-bottom: 6px; }

    /* Timer Card */
    .countdown-card {
      background: #000000;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 14px;
      text-align: center;
    }
    .countdown-title { font-size: 11px; font-weight: 800; font-family: monospace; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .countdown-digits { font-size: 28px; font-weight: 900; font-family: monospace; color: #38bdf8; margin-top: 4px; }

    .btn-row { display: flex; gap: 12px; }
    .btn {
      flex: 1;
      padding: 14px 20px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 800;
      font-family: monospace;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary { background: #1e293b; color: white; border: 1px solid #334155; }
    .btn-primary:hover { background: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header" id="headerBox">
      <div class="header-title-row">
        <div class="header-icon">🛡️</div>
        <h1 id="headerTitle">ACESSO BLOQUEADO PELO PLANO DE TRADE</h1>
      </div>
      <p id="headerSub">Você atingiu o seu Stop Loss diário de R$ 60,00. O TradeLock assumiu o controle e bloqueou fisicamente as corretoras para conter o Urso da Fúria.</p>
    </div>

    <div class="content">
      <!-- Duelo Box -->
      <div class="duel-card" id="duelSection">
        <div class="duel-header">
          <div>
            <div class="duel-tag">CONFRONTO VISUAL PSICOLÓGICO</div>
            <div class="duel-title">O Duelo: Touro da Disciplina vs. Urso do Dia de Fúria</div>
          </div>
          <div class="duel-btn-row">
            <span class="duel-btn active-full" style="cursor:default;">🛡️ Ver Confronto Completo</span>
          </div>
        </div>

        <div id="duelContent">
          <div class="duel-grid">
            <div class="duel-view-box">
              <img src="bull-vs-bear.jpg" alt="Duelo Touro vs Urso" class="duel-box-img" />
              <div class="duel-box-overlay"></div>
              <div class="duel-box-text">
                <div style="font-size: 10px; font-weight: 900; font-family: monospace; color: #fbbf24; text-transform: uppercase;">CONFRONTO DE TENDÊNCIA</div>
                <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #ffffff; margin-top: 2px;">Touro vs. Urso em Execução</div>
                <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">O confronto entre a disciplina tática do Touro e o impulso irracional do Urso de recuperar o loss.</div>
              </div>
            </div>
            <div class="duel-view-box">
              <img src="tradelock-shield.jpg" alt="Escudo TradeLock" class="duel-box-img" />
              <div class="duel-box-overlay"></div>
              <div class="duel-box-text">
                <div style="font-size: 10px; font-weight: 900; font-family: monospace; color: #34d399; text-transform: uppercase;">BARREIRA FÍSICA INTRANSPONÍVEL</div>
                <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #ffffff; margin-top: 2px;">Escudo TradeLock Interceptando</div>
                <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">O bloqueio rígido que ergue o escudo no navegador antes que o Urso devore seu saldo restante.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4-Card Rich Metrics Grid -->
      <div class="metrics-grid" id="metricsSection">
        <div class="metric-card">
          <div class="metric-label">ASSERTIVIDADE</div>
          <div class="metric-val green" id="winRateVal">--%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">FATOR LUCRO</div>
          <div class="metric-val cyan" id="profitFactorVal">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">TRADES HOJE</div>
          <div class="metric-val" id="tradesCountVal">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">SALDO ATUAL</div>
          <div class="metric-val" id="capitalVal">R$ --</div>
        </div>
      </div>

      <!-- Tactical AI Mentor Advice Card -->
      <div class="quote-box" id="quoteSection">
        <div class="quote-title">✨ DIAGNÓSTICO DO MENTOR IA TRADELOCK</div>
        <div id="aiMentorAdvice">
          Carregando análise do seu histórico operacional...
        </div>
      </div>

      <div class="countdown-card" id="timerSection">
        <div class="countdown-title">ACESSO LIBERADO AUTOMATICAMENTE A MEIA-NOITE (00:00:00)</div>
        <div class="countdown-digits" id="timer">--h --m --s</div>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" id="btnDashboard">← Voltar ao Diário de Trade</button>
      </div>
    </div>
  </div>

  <script src="blocked.js"></script>
</body>
</html>
`;

  // 4b. BLOCKED.JS (Script com suporte dinâmico ao Duelo Touro vs Urso e Diagnóstico IA)
  const blockedJs = `(function() {
  let targetUnlockDate = null;
  let currentDuelMode = 'FULL';

  function formatBRL(val) {
    const num = Number(val) || 0;
    const absStr = Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (num < 0 ? '-R$ ' : 'R$ ') + absStr;
  }

  function updateDuelView() {
    const content = document.getElementById('duelContent');
    if (!content) return;

    content.innerHTML = \`
      <div class="duel-grid">
        <div class="duel-view-box">
          <img src="bull-vs-bear.jpg" alt="Duelo Touro vs Urso" class="duel-box-img" />
          <div class="duel-box-overlay"></div>
          <div class="duel-box-text">
            <div style="font-size: 10px; font-weight: 900; font-family: monospace; color: #fbbf24; text-transform: uppercase;">CONFRONTO DE TENDÊNCIA</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #ffffff; margin-top: 2px;">Touro vs. Urso em Execução</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">O confronto entre a disciplina tática do Touro e o impulso irracional do Urso de recuperar o loss.</div>
          </div>
        </div>
        <div class="duel-view-box">
          <img src="tradelock-shield.jpg" alt="Escudo TradeLock" class="duel-box-img" />
          <div class="duel-box-overlay"></div>
          <div class="duel-box-text">
            <div style="font-size: 10px; font-weight: 900; font-family: monospace; color: #34d399; text-transform: uppercase;">BARREIRA FÍSICA INTRANSPONÍVEL</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #ffffff; margin-top: 2px;">Escudo TradeLock Interceptando</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">O bloqueio rígido que ergue o escudo no navegador antes que o Urso devore seu saldo restante.</div>
          </div>
        </div>
      </div>
    \`;
  }

  function generateAiAdvice(winRate, profitFactor, tradesCount, todayPnl, lossLimit) {
    const limitFormatted = formatBRL(lossLimit);

    if (winRate > 0 && winRate >= 50) {
      return 'Sua taxa de assertividade acumulada é de <strong style="color:#34d399">' + winRate.toFixed(1) + '%</strong> com Fator de Lucro de <strong style="color:#38bdf8">' + profitFactor.toFixed(2) + '</strong>. Sua estratégia técnica funciona! Não jogue fora semanas de resultado por causa de um Stop Loss pontual de <strong style="color:#ffffff">' + limitFormatted + '</strong>. Aceitar a perda de hoje é o que separa um apostador de um profissional.';
    } else {
      return 'O maior causador de quebra de bancas no mercado financeiro não é a perda individual, é a tentativa descontrolada de recuperar o prejuízo no mesmo dia. Aceitar o stop de <strong style="color:#ffffff">' + limitFormatted + '</strong> preserva seu saldo para vencer no próximo pregão.';
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
        const headerTitle = document.getElementById('headerTitle');
        const headerSub = document.getElementById('headerSub');
        const duelSection = document.getElementById('duelSection');
        const quoteSection = document.getElementById('quoteSection');
        const timerSection = document.getElementById('timerSection');
        const adviceEl = document.getElementById('aiMentorAdvice');
        const btnRow = document.querySelector('.btn-row');

        if (headerTitle) headerTitle.innerText = '🔒 ACESSO BLOQUEADO — ASSINATURA PENDENTE / SUSPENSA';
        if (headerSub) headerSub.innerText = 'Sua conta do TradeLock foi desativada pela administração por falta de pagamento ou vencimento do plano.';
        if (duelSection) duelSection.style.display = 'none';
        if (timerSection) timerSection.style.display = 'none';
        if (quoteSection) quoteSection.style.borderColor = 'rgba(225, 29, 72, 0.8)';
        if (adviceEl) {
          adviceEl.innerHTML = 'Seu acesso às corretoras e ao diário de trade foi suspenso pela administração.<br/><br/><strong>Para reativar seu acesso instantaneamente:</strong> entre em contato com o suporte do TradeLock.';
        }
        if (btnRow) {
          btnRow.innerHTML = '<a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20regularizar%20minha%20assinatura%20do%20TradeLock%20para%20liberar%20meu%20acesso." target="_blank" class="btn btn-primary" style="background:#059669;color:#fff;text-decoration:none;display:block;text-align:center;">💬 Regularizar Assinatura no WhatsApp</a>';
        }
        return;
      }

      const limit = Number(data.dailyLossLimit) || ${dailyLossLimit};
      const pnl = Number(data.todayPnl) || 0;
      const winRate = Number(data.winRate) || 0;
      const profitFactor = Number(data.profitFactor) || 0;
      const tradesCount = Number(data.todayTradesCount) || 0;
      const capital = Number(data.currentCapital) || 0;

      const isMaxTradesHit = Boolean(data.isMaxTradesHit);
      const isStopHit = Boolean(data.isStopHit);
      const isLockActive = isStopHit || isMaxTradesHit || isSubBlocked;

      const headerTitle = document.getElementById('headerTitle');
      const headerSub = document.getElementById('headerSub');
      const winRateEl = document.getElementById('winRateVal');
      const pfEl = document.getElementById('profitFactorVal');
      const tradesEl = document.getElementById('tradesCountVal');
      const capitalEl = document.getElementById('capitalVal');
      const adviceEl = document.getElementById('aiMentorAdvice');

      if (headerTitle) {
        headerTitle.innerText = isMaxTradesHit && !isStopHit
          ? '🛑 ACESSO BLOQUEADO POR OVERTRADING'
          : '🛡️ ACESSO BLOQUEADO PELO PLANO DE TRADE';
      }

      if (headerSub) {
        if (isMaxTradesHit && !isStopHit) {
          headerSub.innerText = 'Você atingiu o seu Limite Máximo de Operações Diárias (' + tradesCount + ' trades realizados). O TradeLock assumiu o controle e bloqueou fisicamente as corretoras para conter o overtrading e proteger seu capital.';
        } else {
          headerSub.innerText = 'Você atingiu o seu Stop Loss diário de ' + formatBRL(limit) + '. O TradeLock assumiu o controle e bloqueou fisicamente as corretoras para conter o Urso da Fúria.';
        }
      }
      if (winRateEl) winRateEl.innerText = winRate > 0 ? winRate.toFixed(1) + '%' : '--%';
      if (pfEl) pfEl.innerText = profitFactor > 0 ? profitFactor.toFixed(2) : '--';
      if (tradesEl) tradesEl.innerText = tradesCount > 0 ? tradesCount + ' trade' + (tradesCount > 1 ? 's' : '') : '1 trade';
      if (capitalEl) capitalEl.innerText = capital > 0 ? formatBRL(capital) : 'R$ --';

      if (adviceEl) {
        adviceEl.innerHTML = generateAiAdvice(winRate, profitFactor, tradesCount, pnl < 0 ? pnl : -limit, limit);
      }

      targetUnlockDate = calculateTargetUnlockDate(data);

      if (!isLockActive) {
        redirectBack();
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        const isStopHit = changes.isStopHit ? changes.isStopHit.newValue : undefined;
        const isMaxTradesHit = changes.isMaxTradesHit ? changes.isMaxTradesHit.newValue : undefined;
        if (isStopHit === false && isMaxTradesHit === false) {
          redirectBack();
        }
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
