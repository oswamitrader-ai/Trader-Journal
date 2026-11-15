const crypto = require('crypto');
const {createWindowFrameReader} = require('./exnovaWindowFrame.cjs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const POLL_INTERVAL_MS = 250;
const CAPTURE_WIDTH = 1600;
const CAPTURE_HEIGHT = 1000;
const MIN_LINE_CONFIDENCE = 72;

function withTimeout(promise, milliseconds, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(value) {
  let raw = String(value || '').replace(/[^\d,.-]/g, '');
  if (!raw) return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma > dot) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(/,/g, '');
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function getOcrLines(ocrData) {
  const detectedLines = Array.isArray(ocrData?.lines)
    ? ocrData.lines
    : (Array.isArray(ocrData?.blocks) ? ocrData.blocks.flatMap((block) =>
      (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || [])
    ) : []);
  if (detectedLines.length) {
    return detectedLines
      .map((line) => ({
        text: String(line.text || '').trim(),
        confidence: Number(line.confidence) || 0,
        top: Number(line.bbox?.y0) || 0,
        left: Number(line.bbox?.x0) || 0,
        bottom: Number(line.bbox?.y1) || 0,
      }))
      .filter((line) => line.text);
  }

  if (!Array.isArray(ocrData?.words)) return [];
  const groups = new Map();
  for (const word of ocrData.words) {
    if (!word.text || word.confidence < 0) continue;
    const key = `${word.block_num}:${word.par_num}:${word.line_num}`;
    const group = groups.get(key) || { words: [], confidence: [], top: Number(word.bbox?.y0) || 0, left: Number(word.bbox?.x0) || 0 };
    group.words.push(word.text);
    group.confidence.push(Number(word.confidence) || 0);
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((group) => ({
      text: group.words.join(' ').trim(),
      confidence: group.confidence.reduce((sum, value) => sum + value, 0) / Math.max(1, group.confidence.length),
      top: group.top,
      left: group.left,
    }))
    .filter((line) => line.text)
    .sort((left, right) => left.top - right.top);
}

function readCalendarDate(text, now = new Date()) {
  const normalized = normalizeText(text);
  const today = normalized.match(/\b(?:TODAY|HOJE)\b/);
  if (today) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const daysAgoMatch = normalized.match(/\b(\d+)\s+(?:DAYS?\s+AGO|DIAS?\s+ATRAS)\b/);
  const isYesterday = /\b(?:YESTERDAY|ONTEM)\b/.test(normalized);
  if (daysAgoMatch || isYesterday) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - (daysAgoMatch ? Number(daysAgoMatch[1]) : 1));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const iso = normalized.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const br = normalized.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\b/);
  const shortBr = normalized.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  const monthNames = {
    JAN: 1, JANEIRO: 1, JANUARY: 1,
    FEV: 2, FEVEREIRO: 2, FEB: 2, FEBRUARY: 2,
    MAR: 3, MARCO: 3, MARCH: 3,
    ABR: 4, ABRIL: 4, APR: 4, APRIL: 4,
    MAI: 5, MAIO: 5, MAY: 5,
    JUN: 6, JUNHO: 6, JUNE: 6,
    JUL: 7, JULHO: 7, JULY: 7,
    AGO: 8, AGOSTO: 8, AUG: 8, AUGUST: 8,
    SET: 9, SETEMBRO: 9, SEP: 9, SEPTEMBER: 9,
    OUT: 10, OUTUBRO: 10, OCT: 10, OCTOBER: 10,
    NOV: 11, NOVEMBRO: 11, NOVEMBER: 11,
    DEZ: 12, DEZEMBRO: 12, DEC: 12, DECEMBER: 12,
  };
  const fuzzyPortugueseMonth = normalized.match(/\b(\d{1,2})\s*([0O][UUT]T?|[0O]CT)\b/);
  const dayMonth = normalized.match(/\b(\d{1,2})\s+(JAN(?:EIRO|UARY)?|FEV(?:EREIRO|RUARY)?|FEB(?:RUARY)?|MAR(?:CO|CH)?|ABR(?:IL|IL)?|APR(?:IL)?|MAI(?:O)?|MAY|JUN(?:HO|E)?|JUL(?:HO|Y)?|AGO(?:STO|UST)?|SET(?:EMBRO)?|SEP(?:TEMBER)?|OUT(?:UBRO)?|OCT(?:OBER)?|NOV(?:EMBRO|EMBER)?|DEZ(?:EMBRO)?|DEC(?:EMBER)?)(?:\s+(20\d{2}))?\b/);
  const monthDay = normalized.match(/\b(JAN(?:EIRO|UARY)?|FEV(?:EREIRO|RUARY)?|FEB(?:RUARY)?|MAR(?:CO|CH)?|ABR(?:IL|IL)?|APR(?:IL)?|MAI(?:O)?|MAY|JUN(?:HO|E)?|JUL(?:HO|Y)?|AGO(?:STO|UST)?|SET(?:EMBRO)?|SEP(?:TEMBER)?|OUT(?:UBRO)?|OCT(?:OBER)?|NOV(?:EMBRO|EMBER)?|DEZ(?:EMBRO)?|DEC(?:EMBER)?)\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/);
  let year;
  let month;
  let day;
  if (fuzzyPortugueseMonth) {
    [, day] = fuzzyPortugueseMonth;
    month = '10';
    year = String(now.getFullYear());
  } else if (iso) [, year, month, day] = iso;
  else if (br) [, day, month, year] = br;
  else if (shortBr) {
    [, day, month] = shortBr;
    year = String(now.getFullYear());
  } else if (dayMonth) {
    [, day] = dayMonth;
    month = String(monthNames[dayMonth[2]]);
    year = dayMonth[3] || String(now.getFullYear());
  } else if (monthDay) {
    [, month, day] = monthDay;
    month = String(monthNames[monthDay[1]]);
    year = monthDay[3] || String(now.getFullYear());
  }
  else return null;

  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  if (candidate.getFullYear() !== Number(year) || candidate.getMonth() !== Number(month) - 1 || candidate.getDate() !== Number(day)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function readTodayDate(text, now = new Date()) {
  const date = readCalendarDate(text, now);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return date === today ? date : null;
}

function extractMoneyValues(text) {
  const pattern = /(?:R[\$S]|US\$|\$|€|£)\s*[+-]?\s*(?:\d{1,3}(?:[., ]\d{3})+|\d+)(?:[.,]\d{1,2})?/gi;
  return Array.from(String(text || '').matchAll(pattern))
    .map((match) => parseMoney(match[0]))
    .filter((amount) => amount !== null);
}

function readAccountType(lines) {
  const ordered = [...lines].sort((a, b) => a.top - b.top);
  const lineTypes = ordered.map((line) => {
    const text = normalizeText(line.text);
    // Exnova Desktop exibe "Prática" → normaliza para "PRATICA" (sem acento, sem "CONTA")
    // Também suporta: Virtual, Treino, Demo, Practice
    const demo = /\b(DEMO|PRACTICE|PRATICA|PRACTICA|VIRTUAL|TREINO|CONTA DE TREINO|CONTA PRATICA|CONTA DE PRATICA)\b/.test(text);
    const real = /\b(REAL|LIVE|CONTA REAL)\b/.test(text);
    return { demo, real };
  });
  const hasDemo = lineTypes.some((type) => type.demo);
  const hasReal = lineTypes.some((type) => type.real);
  const headerBalanceLine = ordered.find((line) => line.top <= 90 && extractMoneyValues(line.text).length > 0);
  const headerBalance = headerBalanceLine ? extractMoneyValues(headerBalanceLine.text)[0] : null;

  // In this Exnova desktop layout OCR may misread "CONTA REAL" in the selector,
  // but the active real row shows "Disponível" and a matching "Depositar" balance.
  const realSummaryMatches = headerBalance !== null && headerBalance !== undefined && ordered.some((line) =>
    line.top > (headerBalanceLine?.top ?? 0) + 10 &&
    /\bDEPOSITAR\b/.test(normalizeText(line.text)) &&
    /\bDISPONIVEL\b/.test(normalizeText(line.text)) &&
    extractMoneyValues(line.text).some((amount) => Math.abs(amount - headerBalance) < 0.01)
  );
  if (hasDemo && !hasReal && realSummaryMatches) return 'REAL';

  if (hasDemo && hasReal) {
    // The Exnova balance selector shows both account types. Match the active header
    // balance to the amount displayed in each labeled account row.
    if (headerBalance === null || headerBalance === undefined) return null;

    const markers = ordered.flatMap((line, index) => {
      const type = lineTypes[index];
      return type.real || type.demo ? [{ index, top: line.top, type: type.real ? 'REAL' : 'DEMO' }] : [];
    });
    const matchedTypes = new Set();
    for (const marker of markers) {
      const nextMarker = markers.find((candidate) => candidate.top > marker.top);
      const endTop = nextMarker?.top ?? Number.POSITIVE_INFINITY;
      const accountAmounts = ordered
        .filter((line) => line.top >= marker.top - 4 && line.top < endTop)
        .flatMap((line) => extractMoneyValues(line.text));
      if (accountAmounts.some((amount) => Math.abs(amount - headerBalance) < 0.01)) {
        matchedTypes.add(marker.type);
      }
    }
    return matchedTypes.size === 1 ? Array.from(matchedTypes)[0] : null;
  }

  if (hasDemo === hasReal) return null;
  // Se PRATICA/DEMO detectado isolado, retorna DEMO; se REAL isolado, retorna REAL
  return hasDemo ? 'DEMO' : 'REAL';
}

function hasTradeAsset(text) {
  const normalized = normalizeText(text).replace(/\b(?:DIGITAL|DOITAL|BINARY|BINARIA|BRANA)\b/g, ' ');
  return /\b[A-Z]{3}\s*\/\s*[A-Z]{3}(?:\s*\(OTC\))?\b|\b[A-Z]{6}(?:\s*\(OTC\))?\b/.test(normalized);
}

function makeTradeRows(lines, now = new Date()) {
  const ordered = [...lines].sort((left, right) => left.top - right.top);
  const groups = [];
  let current = null;
  let activeDate = null;

  for (const line of ordered) {
    const lineDate = readCalendarDate(line.text, now);
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(line.text);
    if (lineDate && !hasTradeAsset(line.text) && !hasTime) {
      if (current) {
        const currentText = current.lines.map((item) => item.text).join(' ');
        const verticalGap = Math.abs(line.top - current.lines[current.lines.length - 1].top);
        const dateBelongsToPreviousTrade = hasTradeAsset(currentText) && /\b\d{1,2}:\d{2}\b/.test(currentText) && verticalGap <= 64;
        if (dateBelongsToPreviousTrade) {
          current.lines.push({ ...line, date: lineDate });
          current.date = lineDate;
          activeDate = lineDate;
          continue;
        }
        groups.push(current);
        current = null;
      }
      activeDate = lineDate;
      continue;
    }
    const contextualLine = { ...line, date: lineDate || activeDate };
    if (!current) {
      current = { lines: [contextualLine], top: line.top, date: contextualLine.date };
      continue;
    }

    const currentText = current.lines.map((item) => item.text).join(' ');
    const startsNextAsset = hasTradeAsset(line.text) && hasTradeAsset(currentText);
    const startsNextTime = /\b\d{1,2}:\d{2}\b/.test(line.text) && /\b\d{1,2}:\d{2}\b/.test(currentText);
    const verticalGap = Math.abs(line.top - current.lines[current.lines.length - 1].top);
    const lineLimitReached = current.lines.length >= 5;

    if (verticalGap > 46 || startsNextAsset || startsNextTime || lineLimitReached) {
      groups.push(current);
      current = { lines: [contextualLine], top: line.top, date: contextualLine.date };
    } else {
      current.lines.push(contextualLine);
      current.date = current.date || contextualLine.date;
    }
  }
  if (current) groups.push(current);

  return groups.map((group) => ({
    // Keep OCR lines separated so a date like "29 Out" cannot merge with
    // the preceding stake and look like a thousands separator.
    text: group.lines.map((line) => line.text).join(' | '),
    confidence: group.lines.reduce((sum, line) => sum + line.confidence, 0) / group.lines.length,
    top: group.top,
    date: group.date,
    direction: group.lines.find((line) => line.direction)?.direction,
  }));
}

function detectHistoryArrow(bitmap, width, height, x, y) {
  if (!bitmap || bitmap.length < width * height * 4) return null;
  let red = 0;
  let green = 0;
  for (let py = Math.max(0, Math.round(y) - 8); py < Math.min(height, Math.round(y) + 9); py += 1) {
    for (let px = Math.max(0, Math.round(x) - 22); px < Math.min(width, Math.round(x) + 23); px += 1) {
      const offset = (py * width + px) * 4;
      // NativeImage.toBitmap() is BGRA on Windows. The arrow is isolated
      // between the asset name and stake in each history row.
      const blue = bitmap[offset];
      const greenChannel = bitmap[offset + 1];
      const redChannel = bitmap[offset + 2];
      if (redChannel > 165 && greenChannel < 135 && blue < 120) red += 1;
      if (greenChannel > 130 && redChannel < 135 && blue < 135) green += 1;
    }
  }
  if (red >= 3 && red > green * 1.5) return 'ABAIXO';
  if (green >= 3 && green > red * 1.5) return 'ACIMA';
  return null;
}

async function readDesktopHistoryLines(worker, thumbnail) {
  const { width, height } = thumbnail.getSize();
  const crop = {
    x: Math.round(width * 0.04),
    y: Math.round(height * 0.11),
    width: Math.round(width * 0.16),
    height: Math.round(height * 0.86),
  };
  crop.width = Math.min(crop.width, width - crop.x);
  crop.height = Math.min(crop.height, height - crop.y);
  if (crop.width < 100 || crop.height < 200) return getOcrLines(fullData);

  const scale = 3;
  const cropImage = thumbnail.crop(crop).resize({ width: crop.width * scale, height: crop.height * scale });
  const { data: historyData } = await worker.recognize(cropImage.toPNG(), {}, { blocks: true });
  const bitmap = thumbnail.toBitmap();
  const historyLines = getOcrLines(historyData).map((line) => {
    const top = crop.y + line.top / scale;
    const left = crop.x + line.left / scale;
    const hasTradeRow = /\b\d{1,2}:\d{2}\b/.test(line.text) && hasTradeAsset(line.text);
    return {
      ...line,
      top,
      left,
      direction: hasTradeRow
        ? detectHistoryArrow(bitmap, width, height, crop.x + crop.width * 0.70, top + 5)
        : undefined,
    };
  });
  // Do not mix chart labels or candles from the rest of the app window into
  // this list: their OCR lines can split an operation from its date/result.
  return historyLines;
}

function readTradeLine(line, date, accountType, occurrence, sourceLabel) {
  if (line.confidence < 50) return null;
  const normalized = normalizeText(line.text);
  const assetMatch = normalized.match(/\b([A-Z]{3}\s*\/\s*[A-Z]{3}(?:\s*\(OTC\))?|[A-Z]{6}(?:\s*\(OTC\))?)\b/);
  const timeMatch = normalized.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
  const directionMatch = normalized.match(/\b(BUY|SELL|CALL|PUT|HIGHER|LOWER|UP|DOWN|COMPRA|VENDA|ACIMA|ABAIXO|CIMA|BAIXO)\b/);
  const direction = directionMatch?.[1] || line.direction;
  if (!assetMatch || !timeMatch || !direction) return null;

  const explicitPnl = normalized.match(/(?:(?:R[\$S]|US\$|\$|€|£)\s*)?([+-])\s*(?:(?:R[\$S]|US\$|\$|€|£)\s*)?((?:\d{1,3}(?:[., ]\d{3})+|\d+)(?:[.,]\d{1,2})?)/);
  const isBreakeven = /(?:R[\$S]|US\$|\$|€|£)?\s*[0O](?:[.,][0O]+)?\s*\(\s*[0O](?:[.,][0O]+)?\s*%/.test(normalized);
  if (!explicitPnl && !isBreakeven) return null;

  const normalizedMoney = (value) => {
    const parsed = parseMoney(value);
    const digits = String(value || '').replace(/\D/g, '');
    return parsed !== null && !/[.,]/.test(String(value)) && digits.length >= 4 ? parsed / 100 : parsed;
  };
  const pnlMagnitude = explicitPnl ? normalizedMoney(explicitPnl[2]) : 0;
  if (pnlMagnitude === null) return null;
  let pnl = Math.round((explicitPnl?.[1] === '-' ? -pnlMagnitude : pnlMagnitude) * 100) / 100;

  const moneyPattern = /(?:R[\$S]|US\$|\$|€|£)\s*[+-]?\s*(?:\d{1,3}(?:[., ]\d{3})+|\d+)(?:[.,]\d{1,2})?|[+-]\s*(?:R[\$S]|US\$|\$|€|£)\s*(?:\d{1,3}(?:[., ]\d{3})+|\d+)(?:[.,]\d{1,2})?/g;
  const assetEnd = assetMatch.index + assetMatch[0].length;
  const moneyMatches = Array.from(normalized.matchAll(moneyPattern)).filter((match) => match.index >= assetEnd);
  const moneyValues = moneyMatches
    .map((match) => match[0])
    .map(normalizedMoney)
    .filter((amount) => amount !== null && amount >= 0);
  const stake = moneyValues[0] || (pnl < 0 && moneyValues.length === 1 ? Math.abs(pnl) : undefined);
  if (stake === undefined || stake <= 0) return null;
  const payoutPercentMatch = normalized.match(/\(\s*([+-]?\d+(?:[.,]\d+)?)\s*%\s*\)/);
  if (payoutPercentMatch) {
    const payoutPercent = parseMoney(payoutPercentMatch[1]);
    if (payoutPercent !== null) pnl = Math.round(stake * payoutPercent) / 100;
  }

  const type = ['SELL', 'PUT', 'LOWER', 'DOWN', 'VENDA', 'ABAIXO', 'BAIXO'].includes(direction) ? 'SELL' : 'BUY';
  const asset = assetMatch[1].replace(/\s*\/\s*/g, '/').replace(/\s*\(OTC\)/, ' (OTC)');
  const time = timeMatch[0].slice(0, 5);
  const result = pnl > 0 ? 'GAIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
  const signature = [date, time, asset, type, stake.toFixed(2), pnl.toFixed(2), occurrence].join('|');
  const id = `exnova-ocr-${crypto.createHash('sha256').update(signature).digest('hex').slice(0, 20)}`;

  return {
    id,
    date,
    time,
    asset,
    type,
    strategy: `Captura local Exnova ${sourceLabel}`,
    result,
    pnl,
    contractsOrQuantity: Math.round(stake * 100) / 100,
    accountType,
    isReal: accountType === 'REAL',
    isAutoCaptured: true,
    notes: `Operação fechada lida localmente da janela Exnova (${sourceLabel}). Confirme o histórico da corretora.`,
    tags: [accountType, 'Exnova', sourceLabel, 'OCR local'],
  };
}

// The result box moves with the expiration marker in the chart. Its solid
// green/red background has a wider horizontal edge than a candlestick.
function locateReturnPanel(thumbnail, width, height) {
  const pixels = thumbnail.toBitmap(), unit = width / 1366;
  if (pixels.length !== width * height * 4) return null;
  const start = Math.floor(width * .07), end = Math.floor(width * .90);
  const candidates = [];
  for (let y = Math.floor(height * .15); y < height * .85; y += Math.max(2, Math.round(3 * unit))) {
    let left = start;
    for (let x = start + 1; x <= end; x++) {
      const i = (y * width + left) * 4, j = (y * width + x) * 4;
      if (x !== end && pixels[i] === pixels[j] && pixels[i+1] === pixels[j+1] && pixels[i+2] === pixels[j+2]) continue;
      const span = x - left, b = pixels[i], g = pixels[i+1], r = pixels[i+2];
      if (span >= 85*unit && span <= 155*unit && (g > r+22 && g > b+18 || r > g+30 && r > b+25)) {
        const box = candidates.find(c => Math.abs(c.left-left)<5*unit && y-c.last<55*unit);
        if (box) { box.last=y; box.rows++; } else candidates.push({left,top:y,last:y,rows:1});
      }
      left=x;
    }
  }
  const box=candidates.filter(c=>c.rows>=3 && c.last-c.top>=18*unit && c.last-c.top<=62*unit).sort((a,b)=>b.rows-a.rows)[0];
  if(!box)return null;
  const x=Math.max(0,Math.floor(box.left-12*unit)), y=Math.max(0,Math.floor(box.top-18*unit));
  return {x,y,width:Math.min(width-x,Math.ceil(175*unit)),height:Math.min(height-y,Math.ceil(85*unit))};
}

async function readVisibleResultNotification(worker, thumbnail, nativeImage, toastMemory, detectedPanel) {
  const { width, height } = thumbnail.getSize();
  const candidate = detectedPanel === undefined ? locateReturnPanel(thumbnail,width,height) : detectedPanel;
  if(candidate){
    const result = await readResultCrop(worker,thumbnail,nativeImage,toastMemory,candidate);
    if(Number.isFinite(result?.amount))return result;
    const fallback = await readResultCrop(worker,thumbnail,nativeImage,toastMemory,defaultReturnCrop(width,height));
    return fallback || result;
  }
  return readResultCrop(worker,thumbnail,nativeImage,toastMemory,defaultReturnCrop(width,height));
}

function defaultReturnCrop(width,height){
  return {x:Math.round(width*.50), y:Math.round(height*.34), width:Math.round(width*.32), height:Math.round(height*.30)};
}

// Grid lines and price markers sometimes share an OCR line with the toast.
// Anchor on the actual RETORNO word, then keep only words in its value column.
function toastLines(data, scale) {
  const raw = data.lines || (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
  const labels = raw.flatMap(line => line.words || []).filter(w => /^RET[O0]RN[O0]$/i.test(w.text.trim()));
  if (labels.length !== 1 || !labels[0].bbox) return getOcrLines(data);
  const label = labels[0], box = label.bbox;
  const result = [{text:label.text, confidence:label.confidence, left:box.x0, top:box.y0, bottom:box.y1}];
  for (const line of raw) {
    const words=(line.words || []).filter(w=>w.bbox && w.bbox.y0 >= box.y1 - scale && w.bbox.y0 <= box.y0+32*scale &&
      w.bbox.x0 >= box.x0-4*scale && w.bbox.x0 < box.x0+105*scale);
    if (!words.length) continue;
    result.push({text:words.map(w=>w.text).join(' '), confidence:Math.min(...words.map(w=>w.confidence)),
      left:words[0].bbox.x0, top:words[0].bbox.y0, bottom:Math.max(...words.map(w=>w.bbox.y1))});
  }
  return result;
}

async function readResultCrop(worker,thumbnail,nativeImage,toastMemory,crop){
  const {width,height}=thumbnail.getSize();
  crop.width = Math.min(crop.width, width - crop.x);
  crop.height = Math.min(crop.height, height - crop.y);
  if (crop.width < 100 || crop.height < 80) return null;

  const scale = 3;
  const image = thumbnail.crop(crop).resize({ width: crop.width * scale, height: crop.height * scale });
  const imageSize = image.getSize();
  const pixels = Buffer.from(image.toBitmap());
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    // Electron returns BGRA pixels on Windows.
    const luminance = 0.114 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.299 * pixels[offset + 2];
    const value = luminance > 160 ? 0 : 255;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  const highContrastImage = nativeImage.createFromBitmap(pixels, imageSize);
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  let data;
  try {
    ({ data } = await worker.recognize(highContrastImage.toPNG(), {}, { blocks: true }));
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
  }
  const lines = toastLines(data, scale);
  let notice = parseReturnLines(lines, scale);
  const label = lines.find(line => /\bRET[O0]RN[O0]\b/.test(normalizeText(line.text)));
  if (label && label.confidence >= 55 && label.bottom > label.top) {
    const x = Math.max(0, label.left - 3 * scale), y = Math.max(0, label.bottom - scale);
    const amountRect = {x, y, width: Math.min(105 * scale, imageSize.width - x), height: Math.min(21 * scale, imageSize.height - y)};
    if (amountRect.width > 0 && amountRect.height > 0) {
      try {
        await worker.setParameters({tessedit_pageseg_mode:'7', tessedit_char_whitelist:'0123456789.,+-$R€£'});
        const {data: amountData} = await worker.recognize(highContrastImage.crop(amountRect).toPNG(), {}, {blocks:true});
        const amounts = getOcrLines(amountData).map(line => ({...line, top:line.top+y, left:line.left+x}));
        const focused = parseReturnLines([label, ...amounts], scale);
        if (Number.isFinite(focused?.amount)) {
          const first = Number.isFinite(notice?.amount) ? notice : null;
          notice = focused;
          // A second pass uses the original greyscale pixels (no threshold).
          // Both passes share a frozen frame, even if the toast has disappeared.
          let alternate = first;
          if (!alternate) {
            const {data: raw} = await worker.recognize(image.crop(amountRect).toPNG(), {}, {blocks:true});
            alternate = parseReturnLines([label, ...getOcrLines(raw).map(l=>({...l,top:l.top+y,left:l.left+x}))],scale,50);
          }
          notice.confirmedInFrame = alternate?.amount === focused.amount && alternate?.currency === focused.currency;
          if (Number.isFinite(alternate?.amount) && !notice.confirmedInFrame) notice = {amount:null};
        }
      } finally { await worker.setParameters({tessedit_pageseg_mode:'3', tessedit_char_whitelist:''}); }
    }
  }
  if (label) {
    const x = crop.x + Math.floor(label.left / scale), y = crop.y + Math.floor(label.top / scale);
    const rect = {x, y, width: Math.min(44, width - x), height: Math.min(12, height - y)};
    if (rect.width > 0 && rect.height > 0) {
      toastMemory.rect = rect;
      toastMemory.pixels = thumbnail.crop(rect).toBitmap();
    }
  } else if (toastMemory.rect && toastMemory.rect.x + toastMemory.rect.width <= width && toastMemory.rect.y + toastMemory.rect.height <= height) {
    // OCR may drop the word while the same painted notification is still there.
    const pixels = thumbnail.crop(toastMemory.rect).toBitmap(), previous = toastMemory.pixels;
    if (sameReturnLabel(previous,pixels)) return {amount:null};
  }
  return notice;
}

// Compare the bright lettering, not the predominantly black background.
function sameReturnLabel(previous, pixels) {
  if (pixels.length !== previous.length) return false;
  let lettering = 0, matching = 0;
  for(let i=0;i<previous.length;i+=4){
    if(Math.min(previous[i],previous[i+1],previous[i+2]) < 160)continue;
    lettering++;
    if(Math.max(...[0,1,2].map(c=>Math.abs(pixels[i+c]-previous[i+c]))) < 40)matching++;
  }
  return lettering >= 8 && matching / lettering >= .8;
}

// Keep the label and its amount together. Chart prices and other currency amounts
// in the same screenshot do not belong to the result notification.
function parseReturnLines(lines, scale = 3, minAmountConfidence = 55) {
  const labelPattern = /\bRET[O0]RN[O0]\b/;
  const labels = lines.filter(line => labelPattern.test(normalizeText(line.text)));
  if (!labels.length) return null;
  const unreadable = { amount: null };
  if (labels.length !== 1 || labels[0].confidence < 55) return unreadable;
  const label = labels[0];
  const inline = normalizeText(label.text).split(labelPattern)[1].trim().replace(/^[X×]$/, '');
  const nearby = lines.filter(line => line.top > label.top && line.top - label.top <= 32 * scale &&
    Math.abs(line.left - label.left) <= 18 * scale);
  const candidates = inline ? [inline] : nearby.filter(line => line.confidence >= minAmountConfidence).map(line => normalizeText(line.text));
  const money = /^([+-]?)\s*(R\s*[$S]|US\$|\$|€|£)\s*(\d+(?:[.,]\d{2})?)$/;
  const matches = candidates.map(text => text.match(money)).filter(Boolean);
  if (matches.length !== 1) return unreadable;
  const [, sign, currency, raw] = matches[0];
  const amount = parseMoney(raw) * (sign === '-' ? -1 : 1);
  return {amount, currency, display: `RETORNO ${sign}${currency}${raw}`};
}

function createToastGate() {
  let emitted = false, misses = 0, previous = null;
  return {
    observe(notice) {
      if (!notice) {
        previous = null;
        if (++misses >= 3) emitted = false;
        return false;
      }
      misses = 0;
      const key = Number.isFinite(notice.amount) ? `${notice.currency}:${notice.amount}` : null;
      const stable = key !== null && key === previous;
      previous = key;
      return (stable || (key !== null && notice.confirmedInFrame === true)) && !emitted;
    },
    isRecorded() { return emitted; },
    markRecorded() { emitted = true; },
  };
}

function parseVisibleResultTrade(ocrData, notification, now = new Date(), lockedStake = 0) {
  if (!Number.isFinite(notification?.amount)) return null;
  const lines = getOcrLines(ocrData);
  const fullText = normalizeText(lines.map((line) => line.text).join(' '));
  const assetLines = lines
    .filter((line) => line.top >= 70 && line.top <= 260 && line.left <= 520 && hasTradeAsset(line.text))
    .sort((a, b) => a.top - b.top);
  const assetText = assetLines[0]?.text || lines.find((line) => hasTradeAsset(line.text))?.text || '';
  const assetMatch = normalizeText(assetText).match(/\b([A-Z]{3}\s*\/\s*[A-Z]{3}(?:\s*\(OTC\))?|[A-Z]{6}(?:\s*\(OTC\))?)\b/);
  const asset = assetMatch ? assetMatch[1].replace(/\s*\/\s*/g, '/').replace(/\s*\(OTC\)/, ' (OTC)') : 'Exnova (ativo não lido)';
  // Tenta ler o tipo de conta do OCR; se falhar, usa DEMO como fallback seguro
  // (conta de prática no Exnova Desktop exibe "Prática" → PRATICA após normalização)
  const accountType = readAccountType(lines) || 'DEMO';
  const investmentMatch = fullText.match(/\b(?:INVEST|INVESTMENT|INVESTIMENTO)\s*(?:R\s*\$|US\$|\$|€|£)?\s*((?:\d{1,3}(?:[., ]\d{3})+|\d+)(?:[.,]\d{1,2})?)/);
  const stake = (investmentMatch && parseMoney(investmentMatch[1])) || lockedStake;
  // Binary option RETORNO is the total paid back (principal included).
  if (!(stake > 0) || notification.amount > stake * 2 + 0.005 || notification.amount < -stake - 0.005) return null;
  const pnl = Math.round((notification.amount < 0 ? notification.amount : notification.amount - stake) * 100) / 100;
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const result = pnl > 0 ? 'GAIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
  const identity = [date, time, asset, notification.amount.toFixed(2), stake.toFixed(2), accountType || 'UNKNOWN'].join('|');
  const id = `exnova-toast-${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 20)}`;
  const missing = [
    !assetMatch && 'ativo',
    !(stake > 0) && 'valor investido',
  ].filter(Boolean);
  return {
    id,
    date,
    time,
    asset,
    type: 'UNKNOWN',
    strategy: 'Captura local Exnova (aviso de retorno)',
    result,
    pnl,
    contractsOrQuantity: stake,
    accountType,
    isReal: accountType === 'REAL',
    isAutoCaptured: true,
    notes: `Resultado registrado diretamente do aviso visível: ${notification.display}. Moeda lida na tela (${notification.currency}), sem conversão.${missing.length ? ` OCR não identificou: ${missing.join(', ')}.` : ''} Direção não exibida no aviso.`,
    tags: ['Exnova', 'OCR local', 'Aviso de retorno', accountType],
  };
}

function parseClosedTrades(ocrData, now = new Date(), sourceLabel = 'Desktop', requireExnovaBrand = false, preparedLines) {
  const lines = preparedLines || getOcrLines(ocrData);
  const text = lines.map((line) => line.text).join('\n');
  const normalized = normalizeText(text);
  if (requireExnovaBrand && !/\bEXNOVA(?:\.COM)?\b/.test(normalized)) {
    return { state: 'attention', reason: 'Janela de histórico encontrada, mas a tela não foi confirmada como Exnova.' };
  }
  const hasHistory = /\b(HISTORY|HISTORICO|INVESTMENTS|INVESTIMENTOS|CLOSED|ENCERRAD[AO]S?|OPERACOES)\b/.test(normalized);
  if (!hasHistory) return { state: 'attention', reason: 'Abra o histórico/Investimentos do Exnova para iniciar a leitura.' };

  const pageToday = readTodayDate(text, now);
  const pageDateFallback = requireExnovaBrand || /\b(?:TODAY|HOJE)\b/.test(normalized) ? pageToday : null;
  if (requireExnovaBrand && !pageToday) {
    return { state: 'attention', reason: 'Na versão web, selecione o filtro de hoje no histórico da Exnova.' };
  }
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Account balance and selector are near the top/right of the full window;
  // keep using the full-frame OCR for this check while trade rows come from
  // the enlarged history panel.
  const accountType = readAccountType(getOcrLines(ocrData));
  // Se o OCR não detecta DEMO nem REAL, retorna atenção pedindo que
  // o seletor de conta fique visível. No Desktop a conta é visível na barra superior.
  if (!accountType) return { state: 'attention', reason: 'Não consegui confirmar se a conta ativa é Real ou Demo. Deixe o seletor de contas aberto com o saldo ativo visível.' };

  const candidates = makeTradeRows(lines, now).filter((line) => line.confidence >= 50 && /\b\d{1,2}:\d{2}\b/.test(line.text));
  const occurrences = new Map();
  const trades = [];
  let missingOperationDate = false;
  let todayRows = 0;
  let olderRows = 0;
  for (const line of candidates) {
    const operationDate = line.date || pageDateFallback;
    if (!operationDate) {
      missingOperationDate = true;
      continue;
    }
    if (operationDate !== today) {
      olderRows += 1;
      continue;
    }
    todayRows += 1;
    const normalizedLine = normalizeText(line.text);
    const asset = hasTradeAsset(normalizedLine);
    if (!asset) continue;
    const signature = `${normalizedLine}|${accountType}|${operationDate}`;
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    const trade = readTradeLine(line, operationDate, accountType, occurrence, sourceLabel);
    if (trade) trades.push(trade);
  }

  if (trades.length) return { state: 'reading', reason: null, trades };
  if (missingOperationDate && todayRows === 0) {
    return { state: 'attention', reason: 'Não consegui confirmar a data das operações nessa lista. Mantenha visível a data de cada operação; só as de hoje serão registradas.' };
  }
  if (olderRows > 0 && todayRows === 0) {
    return { state: 'attention', reason: 'O histórico está legível, mas não encontrei operações com data de hoje.' };
  }
  return { state: 'attention', reason: 'Histórico encontrado, mas os campos de alguma operação não puderam ser validados. Nenhum trade foi registrado.' };
}

function findExnovaSources(sources) {
  return sources.flatMap((source) => {
    const id = String(source.id || '');
    const title = normalizeText(source.name || '');
    if (!/^window:\d+:/i.test(id)) return [];
    if (/\bEXNOVA\b/.test(title)) {
      return [{ source, sourceLabel: 'Desktop', requireExnovaBrand: false }];
    }
    if (/\b(?:HISTORICO DE TRADING|TRADING HISTORY|INVESTMENTS HISTORY)\b/.test(title)) {
      return [{ source, sourceLabel: 'Web', requireExnovaBrand: true }];
    }
    return [];
  });
}

// Keep frames in chronological order. Reserve room for transitions without
// accumulating seconds of identical background frames while OCR is busy.
function bufferCaptureFrame(queue, frame) {
  const last = queue[queue.length - 1];
  const previous = queue[queue.length - 2];
  if (last && previous && last.kind === frame.kind && previous.kind === frame.kind) {
    queue[queue.length - 1] = frame;
    return;
  }
  if (queue.length >= 8) {
    const redundant = queue.findIndex((item, i) => i > 0 && item.kind === queue[i-1].kind);
    queue.splice(redundant >= 0 ? redundant : 0, 1);
  }
  queue.push(frame);
}

function createExnovaCaptureService({ desktopCapturer, nativeImage, app, onStatus, onTrade, getLockedStake = () => 0 }) {
  let timer = null;
  let workerPromise = null;
  let processing = false, sampling = false, generation = 0;
  const frames = [];
  let lastBroadScan = 0;
  const nativeReader = createWindowFrameReader(nativeImage);
  let lastProvider = '';
  let stopped = true;
  let lastStatus = null;
  let capturedCount = 0;
  let lastReadAt = null;
  const seenTrades = new Set();
  const toastGate = createToastGate();
  const toastMemory = {};
  let resultSequence = 0;

  function publish(state, message) {
    const status = { state, message, capturedCount, lastReadAt, enabled: !stopped };
    const fingerprint = JSON.stringify(status);
    if (fingerprint === lastStatus) return;
    if (!app.isPackaged && (!lastStatus || JSON.parse(lastStatus).message !== message)) console.log('[Exnova captura]',new Date().toISOString(),state,message);
    lastStatus = fingerprint;
    onStatus?.(status);
  }

  async function getWorker() {
    if (!workerPromise) {
      const modelDirectory = app.isPackaged
        ? path.join(process.resourcesPath, 'tessdata')
        : path.join(__dirname, 'tessdata');
      const workerPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js')
        : path.join(__dirname, '..', 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
      workerPromise = createWorker('eng+por', 1, {
        langPath: modelDirectory,
        workerPath,
        gzip: true,
        cacheMethod: 'none',
        logger: () => {},
      });
    }
    return workerPromise;
  }

  async function sample() {
    if (stopped || sampling) return;
    sampling = true;
    const token = generation;
    const start = Date.now();
    try {
      const thumbnail=await nativeReader.read();
      if(stopped || token!==generation)return;
      const windows = thumbnail ? [{source:{thumbnail},sourceLabel:'Desktop',requireExnovaBrand:false}] : findExnovaSources(await withTimeout(desktopCapturer.getSources({types:['window'],thumbnailSize:{width:CAPTURE_WIDTH,height:CAPTURE_HEIGHT},fetchWindowIcons:false}),12000,'O Windows não retornou as janelas.'));
      if(stopped || token!==generation)return;
      const provider = thumbnail ? 'janela nativa' : 'Electron';
      if(!app.isPackaged && provider!==lastProvider)console.log('[Exnova fonte]',provider,'captura ms',Date.now()-start);
      lastProvider=provider;
      const desktop = windows.find(info=>info.sourceLabel==='Desktop' && !info.source.thumbnail.isEmpty());
      if (!windows.length) {
        if (!processing && !frames.length) publish('searching','Aguardando imagem da janela Exnova.');
        return;
      }
      let panel = null;
      if (desktop) {
        const image=desktop.source.thumbnail, size=image.getSize();
        panel=locateReturnPanel(image,size.width,size.height);
      }
      bufferCaptureFrame(frames,{windows:desktop?[desktop]:windows, kind:panel?'panel':'background', panel, at:Date.now(), captureMs:Date.now()-start, stake:getLockedStake()});
      void poll();
    } catch(error) { if(!stopped)publish('error',String(error.message)); }
    finally { sampling=false; }
  }

  async function poll() {
    if (stopped || processing || !frames.length) return;
    const frame=frames.shift(), exnovaWindows=frame.windows;
    const started=Date.now();
    processing = true;
    try {
      const currentState = lastStatus ? JSON.parse(lastStatus).state : null;
      if (!['connected', 'reading', 'attention'].includes(currentState)) {
        publish('connected', 'Janela Exnova encontrada. Preparando leitura local da janela.');
      }
      const worker = await withTimeout(getWorker(), 30000, 'O OCR local não inicializou no tempo esperado.');
      let recognizedWindow = false;
      let desktopWindowAvailable = false;
      let validHistoryScreen = false;
      let lastReason = 'Janela Exnova encontrada, mas a imagem não está disponível. Deixe o app aberto e desbloqueado.';
      let resultNotificationMessage = null;
      let newTradesThisCycle = 0;
      const desktop = exnovaWindows.find(info => info.sourceLabel === 'Desktop');
      for (const processInfo of desktop ? [desktop] : exnovaWindows) {
        const target = processInfo.source;
        if (!target || !target.thumbnail || target.thumbnail.isEmpty()) continue;


        // The desktop app records closed trades from the visible RETORNO toast.
        // Do this focused OCR first; do not require the history panel to be open.
        if (processInfo.sourceLabel === 'Desktop') {
          desktopWindowAvailable = true;
          // Look outside the colour detector periodically; ordinary chart frames
          // should not keep a later popup waiting behind repeated broad OCR scans.
          if (!frame.panel && frame.at-lastBroadScan < 1000) return;
          if (!frame.panel) lastBroadScan=frame.at;
          const notification = await withTimeout(readVisibleResultNotification(worker, target.thumbnail, nativeImage, toastMemory, frame.panel), 15000, 'A leitura do retorno excedeu 15 segundos; reiniciando o OCR.');
          recognizedWindow = true;
          lastReadAt = new Date().toISOString();
          if (!toastGate.observe(notification)) {
            if (notification) resultNotificationMessage = Number.isFinite(notification.amount) ? (toastGate.isRecorded() ? 'Aviso já registrado. Aguardando seu desaparecimento para aceitar a próxima operação.' : 'Retorno lido; aguardando confirmação da leitura.') : 'Aviso localizado; valor do retorno ilegível.';
            continue;
          }

          const size=target.thumbnail.getSize();
          const header=target.thumbnail.crop({x:0,y:0,width:size.width,height:Math.min(size.height,Math.max(230,Math.round(size.height*.34)))});
          const { data } = await withTimeout(
            worker.recognize(header.toPNG(), {}, { blocks: true }),
            20000,
            'A leitura OCR excedeu o tempo esperado.'
          );
          if (stopped) return;
          const parsedResult = parseVisibleResultTrade(data, notification, new Date(frame.at), frame.stake);
          if (!parsedResult) {
            lastReason = `O aviso “RETORNO” apareceu (${notification.display}), mas os campos complementares não puderam ser lidos. O resultado não foi registrado.`;
            resultNotificationMessage = lastReason;
            continue;
          }
          toastGate.markRecorded();
          parsedResult.id += `-${++resultSequence}`;
          seenTrades.add(parsedResult.id);
          capturedCount++;
          newTradesThisCycle++;
          onTrade?.(parsedResult);
          resultNotificationMessage = `Operação registrada. ${notification.display}.`;
          lastReason = resultNotificationMessage;
          continue;
        }

        const { data } = await withTimeout(
          worker.recognize(target.thumbnail.toPNG(), {}, { blocks: true }),
          20000,
          'A leitura OCR excedeu o tempo esperado.'
        );
        if (stopped) return;
        recognizedWindow = true;
        lastReadAt = new Date().toISOString();
        const parsed = parseClosedTrades(data, new Date(), processInfo.sourceLabel, processInfo.requireExnovaBrand);
        if (parsed.state === 'attention') {
          if (!resultNotificationMessage) lastReason = parsed.reason;
          continue;
        }
        validHistoryScreen = true;

        for (const trade of parsed.trades) {
          if (seenTrades.has(trade.id)) continue;
          seenTrades.add(trade.id);
          capturedCount += 1;
          newTradesThisCycle += 1;
          onTrade?.(trade);
        }
      }

      if (!recognizedWindow) {
        publish('attention', lastReason);
        return;
      }

      if (!validHistoryScreen && !newTradesThisCycle && !resultNotificationMessage) {
        if (desktopWindowAvailable) {
          publish('reading', 'Exnova Desktop detectada; monitorando o aviso “RETORNO”. Nenhuma operação fechada detectada nesta leitura.');
          return;
        }
        publish('attention', lastReason);
        return;
      }
      if (resultNotificationMessage) {
        publish('reading', resultNotificationMessage);
        return;
      }
      publish('reading', capturedCount
        ? `${capturedCount} operação(ões) validadas nesta sessão. Captura local ativa.`
        : 'Histórico legível. Aguardando novas operações fechadas.');
    } catch (error) {
      if (!stopped) {
        const failedWorker = workerPromise;
        workerPromise = null;
        failedWorker?.then((worker) => worker.terminate()).catch(() => {});
        publish('error', `Falha na captura local: ${String(error?.message || 'erro desconhecido').slice(0, 140)}`);
      }
    } finally {
      if(!app.isPackaged && frame.panel) console.log('[Exnova duração ms]',JSON.stringify({captura:frame.captureMs,fila:started-frame.at,leitura:Date.now()-started}));
      processing = false;
      if(!stopped && frames.length)setImmediate(poll);
    }
  }

  return {
    getStatus() {
      if (process.platform !== 'win32') {
        return { state: 'unavailable', message: 'Captura Exnova disponível apenas no Windows.', capturedCount, lastReadAt, enabled: false };
      }
      return lastStatus ? JSON.parse(lastStatus) : { state: 'idle', message: 'Captura desativada.', capturedCount, lastReadAt, enabled: false };
    },
    async start() {
      if (process.platform !== 'win32') return this.getStatus();
      if (!stopped) return this.getStatus();
      stopped = false;
      publish('searching', 'Procurando o aplicativo Exnova no Windows.');
      await sample();
      if(stopped)return this.getStatus();
      timer = setInterval(sample, POLL_INTERVAL_MS);
      timer.unref?.();
      return this.getStatus();
    },
    async stop() {
      stopped = true;
      generation++;frames.length=0;nativeReader.stop();
      if (timer) clearInterval(timer);
      timer = null;
      if (workerPromise) {
        try { (await workerPromise).terminate(); } catch {}
        workerPromise = null;
      }
      publish('idle', 'Captura desativada.');
      return this.getStatus();
    },
  };
}

module.exports = {
  createExnovaCaptureService, bufferCaptureFrame,
  parseClosedTrades, sameReturnLabel, toastLines, readVisibleResultNotification, parseReturnLines, parseVisibleResultTrade, createToastGate,
};
