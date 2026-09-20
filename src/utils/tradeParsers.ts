import { Trade, TradeType, TradeResult } from '../types';

export type PlatformPreset = 'AUTO' | 'PROFITCHART' | 'METATRADER' | 'EXNOVA';

export interface ParsedTradeItem extends Trade {
  selected: boolean;
  rawRow: string;
}

export interface ParseReportResult {
  trades: ParsedTradeItem[];
  errors: string[];
  platformDetected: string;
  totalPnl: number;
}

// ── Utilitários ──────────────────────────────────────────────────

/** Limpa e converte string numérica para number (BR e US formats) */
function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  let str = val.trim();
  str = str.replace(/[R$\s]/g, '');
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.substring(1, str.length - 1);
  }
  // Brazilian: "1.500,50" -> "1500.50"
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/** Split CSV respeitando aspas */
function splitCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/** Auto-detecta delimitador */
function detectDelimiter(content: string): string {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ';';
  const firstLine = lines[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

// ── Parser ISO datetime (Exnova usa "2026-09-16T08:41:27-03:00") ──

function parseIsoDatetime(raw: string): { date: string; time: string } {
  const fallback = {
    date: new Date().toISOString().split('T')[0],
    time: '00:00',
  };
  if (!raw || !raw.trim()) return fallback;

  const str = raw.trim();

  // ISO 8601 completo: "2026-09-16T08:41:27-03:00" ou "2026-09-16T08:41:27Z"
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    return {
      date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      time: `${isoMatch[4]}:${isoMatch[5]}`,
    };
  }

  // YYYY-MM-DD HH:mm
  const spaceMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (spaceMatch) {
    return {
      date: `${spaceMatch[1]}-${spaceMatch[2]}-${spaceMatch[3]}`,
      time: `${spaceMatch[4]}:${spaceMatch[5]}`,
    };
  }

  // DD/MM/YYYY HH:mm
  const brMatch = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\s*(\d{2})?:?(\d{2})?/);
  if (brMatch) {
    let p1 = parseInt(brMatch[1], 10);
    let p2 = parseInt(brMatch[2], 10);
    let p3 = brMatch[3];
    if (p3.length === 2) p3 = '20' + p3;
    let day = p1, month = p2;
    if (p1 > 12) { day = p1; month = p2; }
    else if (p2 > 12) { month = p1; day = p2; }
    const time = brMatch[4] && brMatch[5] ? `${brMatch[4]}:${brMatch[5]}` : '00:00';
    return {
      date: `${p3}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      time,
    };
  }

  // Unix timestamp
  if (/^\d{10}$/.test(str)) {
    const dt = new Date(parseInt(str, 10) * 1000);
    if (!isNaN(dt.getTime())) {
      return {
        date: dt.toISOString().split('T')[0],
        time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
      };
    }
  }
  if (/^\d{13}$/.test(str)) {
    const dt = new Date(parseInt(str, 10));
    if (!isNaN(dt.getTime())) {
      return {
        date: dt.toISOString().split('T')[0],
        time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
      };
    }
  }

  // Fallback: Date.parse nativo
  const nativeDt = new Date(str);
  if (!isNaN(nativeDt.getTime())) {
    return {
      date: nativeDt.toISOString().split('T')[0],
      time: `${String(nativeDt.getHours()).padStart(2, '0')}:${String(nativeDt.getMinutes()).padStart(2, '0')}`,
    };
  }

  return fallback;
}

// ── PARSER DEDICADO EXNOVA ──────────────────────────────────────
// Headers reais: Position ID, Instrument, Opening Date Time, Asset, Direction,
// Quantity, Opening price, Leverage, TP, SL, Closing Date Time, Closing price,
// Investments, Equity, Commission, Overnight fee, Swap, Custodial fee,
// Total PnL, Gross PnL, Net PnL, Buy Option Price, Sell Option Price, Currency Conversion

function parseExnovaDedicated(
  lines: string[],
  delimiter: string,
  header: string[]
): ParseReportResult {
  const errors: string[] = [];
  const trades: ParsedTradeItem[] = [];

  // Mapeamento exato de colunas por nome
  const colMap: Record<string, number> = {};
  header.forEach((h, idx) => {
    colMap[h.trim().toLowerCase()] = idx;
  });

  // Índices exatos das colunas da Exnova
  const dateIdx = colMap['opening date time'] ?? colMap['opening datetime'] ?? colMap['data de abertura'] ?? -1;
  const assetIdx = colMap['asset'] ?? colMap['ativo'] ?? colMap['active'] ?? -1;
  const directionIdx = colMap['direction'] ?? colMap['direção'] ?? colMap['direcao'] ?? -1;
  const investmentIdx = colMap['investments'] ?? colMap['investment'] ?? colMap['investimento'] ?? colMap['aposta'] ?? -1;
  const netPnlIdx = colMap['net pnl'] ?? -1;
  const grossPnlIdx = colMap['gross pnl'] ?? -1;
  const totalPnlIdx = colMap['total pnl'] ?? -1;
  const equityIdx = colMap['equity'] ?? -1;
  const closingDateIdx = colMap['closing date time'] ?? colMap['closing datetime'] ?? -1;
  const instrumentIdx = colMap['instrument'] ?? -1;

  if (dateIdx === -1) {
    errors.push('Coluna "Opening Date Time" não encontrada no CSV. Verifique se o arquivo é da Exnova.');
  }

  for (let i = 1; i < lines.length; i++) {
    const rowStr = lines[i];
    const cols = splitCsvLine(rowStr, delimiter);
    if (cols.length < 3) continue;

    try {
      // ── Data e Hora (extrai da ISO "2026-09-16T08:41:27-03:00") ──
      const rawDate = dateIdx !== -1 ? cols[dateIdx] : '';
      const { date, time } = parseIsoDatetime(rawDate);

      // ── Ativo (Asset) ──
      let asset = (assetIdx !== -1 ? cols[assetIdx] : '').trim().toUpperCase();
      if (!asset || asset.length < 2) {
        // Tenta pegar do instrumento
        asset = (instrumentIdx !== -1 ? cols[instrumentIdx] : 'N/A').trim().toUpperCase();
      }
      asset = asset.replace(/[^A-Z0-9/._-]/g, '') || 'N/A';

      // ── Direção (call = BUY, put = SELL) ──
      const rawDir = (directionIdx !== -1 ? cols[directionIdx] : '').toLowerCase().trim();
      let type: TradeType = 'BUY';
      if (rawDir.includes('put') || rawDir.includes('sell') || rawDir.includes('vend') || rawDir.includes('baixa') || rawDir.includes('down')) {
        type = 'SELL';
      }

      // ── Valor Investido (Investments) ──
      const rawInvestment = investmentIdx !== -1 ? cols[investmentIdx] : '0';
      const investment = parseNumber(rawInvestment);

      // ── Net PnL (usa Net PnL direto do CSV — é o lucro/perda líquido REAL) ──
      let netPnl = 0;

      if (netPnlIdx !== -1 && cols[netPnlIdx] && cols[netPnlIdx].trim() !== '') {
        netPnl = parseNumber(cols[netPnlIdx]);
      } else if (totalPnlIdx !== -1 && cols[totalPnlIdx] && cols[totalPnlIdx].trim() !== '') {
        netPnl = parseNumber(cols[totalPnlIdx]);
      } else if (grossPnlIdx !== -1 && cols[grossPnlIdx] && cols[grossPnlIdx].trim() !== '') {
        netPnl = parseNumber(cols[grossPnlIdx]);
      } else if (equityIdx !== -1) {
        // Equity = retorno total. Se equity > investment = win, se equity = 0 = loss
        const equity = parseNumber(cols[equityIdx]);
        if (equity <= 0.001 && investment > 0) {
          netPnl = -investment;
        } else {
          netPnl = equity - investment;
        }
      }

      // ── Resultado ──
      let result: TradeResult = 'BREAKEVEN';
      if (netPnl > 0.001) result = 'GAIN';
      else if (netPnl < -0.001) result = 'LOSS';

      const tradeItem: ParsedTradeItem = {
        id: `imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        date,
        time,
        asset,
        type,
        strategy: 'Importado via Exnova',
        result,
        pnl: Math.round(netPnl * 100) / 100, // Arredonda para 2 casas
        contractsOrQuantity: Math.round(investment * 100) / 100,
        notes: `Digital Options | Investimento: R$ ${investment.toFixed(2)}`,
        selected: true,
        rawRow: rowStr,
      };

      trades.push(tradeItem);
    } catch (err: any) {
      errors.push(`Linha ${i + 1}: ${err?.message || 'Erro de leitura'}`);
    }
  }

  const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);

  return {
    trades,
    errors,
    platformDetected: 'Exnova / IQ Option (Digital Options)',
    totalPnl,
  };
}

// ── PARSER GENÉRICO (ProfitChart, MetaTrader, fallback) ──────────

function parseGeneric(
  lines: string[],
  delimiter: string,
  header: string[],
  detected: string
): ParseReportResult {
  const errors: string[] = [];
  const trades: ParsedTradeItem[] = [];

  // Index mapping por keywords
  let assetIdx = -1;
  let dateIdx = -1;
  let timeIdx = -1;
  let typeIdx = -1;
  let pnlIdx = -1;
  let qtyIdx = -1;
  let statusIdx = -1;
  let strategyIdx = -1;

  header.forEach((col, idx) => {
    const c = col.trim().toLowerCase();

    if (c === 'status' || c === 'result' || c === 'outcome' || c === 'win/loss' ||
        c.includes('resultado da')) {
      statusIdx = idx;
    }

    if (c.includes('ativo') || c.includes('symbol') || c.includes('item') ||
        c.includes('instrument') || c.includes('par') || c.includes('pair') || c.includes('moeda')) {
      if (assetIdx === -1) assetIdx = idx;
    }

    if (c === 'data' || c === 'date' || c.includes('data de') || c.includes('open date') ||
        c.includes('created') || c.includes('data/hora') || c.includes('abertura') ||
        c.includes('open time')) {
      if (dateIdx === -1) dateIdx = idx;
    }

    if (c === 'hora' || c === 'time' || c.includes('horario') || c.includes('horário') ||
        c.includes('close time') || c.includes('fechamento')) {
      if (timeIdx === -1 && idx !== dateIdx) timeIdx = idx;
    }

    if (c.includes('tipo') || c.includes('type') || c.includes('lado') ||
        c.includes('direção') || c.includes('direcao') || c.includes('direction') ||
        c.includes('action') || c.includes('option')) {
      if (typeIdx === -1) typeIdx = idx;
    }

    if (c.includes('investment') || c.includes('investimento') || c.includes('aposta') ||
        c.includes('amount') || c.includes('qtd') || c.includes('quantidade') ||
        c.includes('contratos') || c.includes('size') || c.includes('volume') ||
        (c.includes('valor') && !c.includes('lucro') && !c.includes('resultado'))) {
      if (qtyIdx === -1) qtyIdx = idx;
    }

    if (c.includes('income') || c.includes('profit') || c.includes('retorno') ||
        c.includes('rendimento') || c.includes('pnl') || c.includes('p&l') ||
        c.includes('lucro') || c.includes('payout') ||
        (c.includes('resultado') && !c.includes('ativo') && statusIdx !== idx)) {
      if (pnlIdx === -1) pnlIdx = idx;
    }

    if (c.includes('estrategia') || c.includes('setup') || c.includes('strategy') || c.includes('nota')) {
      if (strategyIdx === -1) strategyIdx = idx;
    }
  });

  // Fallbacks
  if (assetIdx === -1) assetIdx = 0;
  if (dateIdx === -1) dateIdx = 1;
  if (pnlIdx === -1) pnlIdx = header.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const rowStr = lines[i];
    const cols = splitCsvLine(rowStr, delimiter);
    if (cols.length < 2) continue;

    try {
      const rawAsset = (cols[assetIdx] || 'WIN').trim().toUpperCase();
      let asset = rawAsset.replace(/[^A-Z0-9/._-]/g, '') || 'WIN';

      // Data e hora
      const rawDateStr = dateIdx !== -1 ? cols[dateIdx] : '';
      const { date, time: parsedTime } = parseIsoDatetime(rawDateStr);
      const time = timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx].trim().substring(0, 5) : parsedTime;

      // Quantidade
      const rawQty = qtyIdx !== -1 ? cols[qtyIdx] : '1';
      const contractsOrQuantity = Math.max(1, parseNumber(rawQty));

      // PnL
      const pnlNum = parseNumber(pnlIdx !== -1 ? cols[pnlIdx] : '0');
      const statusStr = (statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx] : '').toLowerCase().trim();

      let netPnl = pnlNum;
      // Se tem status explícito
      if (statusStr.includes('win') || statusStr.includes('won') || statusStr.includes('gain') || statusStr.includes('ganh')) {
        netPnl = pnlNum > 0 ? pnlNum : contractsOrQuantity * 0.85;
      } else if (statusStr.includes('loss') || statusStr.includes('lost') || statusStr.includes('perd') || statusStr.includes('derr')) {
        netPnl = pnlNum < 0 ? pnlNum : -contractsOrQuantity;
      } else if (statusStr.includes('equal') || statusStr.includes('empat') || statusStr.includes('break')) {
        netPnl = 0;
      }

      let result: TradeResult = 'BREAKEVEN';
      if (netPnl > 0.001) result = 'GAIN';
      else if (netPnl < -0.001) result = 'LOSS';

      // Tipo
      const rawType = (typeIdx !== -1 ? cols[typeIdx] : '').toUpperCase();
      let type: TradeType = 'BUY';
      if (rawType.includes('V') || rawType.includes('SELL') || rawType.includes('PUT') ||
          rawType.includes('SHORT') || rawType.includes('BAIXA') || rawType.includes('LOW') || rawType.includes('DOWN')) {
        type = 'SELL';
      }

      const strategy = strategyIdx !== -1 && cols[strategyIdx]
        ? cols[strategyIdx].trim()
        : `Importado via ${detected}`;

      trades.push({
        id: `imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        date, time, asset, type, strategy, result,
        pnl: Math.round(netPnl * 100) / 100,
        contractsOrQuantity,
        notes: `Importado de relatório ${detected}`,
        selected: true,
        rawRow: rowStr,
      });
    } catch (err: any) {
      errors.push(`Linha ${i + 1}: ${err?.message || 'Erro de leitura'}`);
    }
  }

  const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
  const platformNames: Record<string, string> = {
    PROFITCHART: 'ProfitChart (Nelogica)',
    METATRADER: 'MetaTrader 4 / 5',
    EXNOVA: 'Exnova / IQ Option',
    AUTO: 'Formatador Genérico CSV',
  };

  return {
    trades,
    errors,
    platformDetected: platformNames[detected] || 'Genérico CSV',
    totalPnl,
  };
}

// ── DETECT PLATFORM ──────────────────────────────────────────────

function detectPlatform(headerLine: string): PlatformPreset {
  const h = headerLine.toLowerCase();

  // Exnova: headers exatos
  if (
    h.includes('opening date time') ||
    h.includes('net pnl') ||
    h.includes('digital options') ||
    (h.includes('investments') && h.includes('direction') && h.includes('asset'))
  ) {
    return 'EXNOVA';
  }

  // ProfitChart
  if (h.includes('ativo') || h.includes('fechamento') || h.includes('lucro/prejuízo') || h.includes('lucro liquido')) {
    return 'PROFITCHART';
  }

  // MetaTrader
  if (h.includes('ticket') || h.includes('open time') || h.includes('swap')) {
    return 'METATRADER';
  }

  // Exnova alternativo (português)
  if (h.includes('aposta') || h.includes('direcao') || h.includes('direção') || h.includes('payout')) {
    return 'EXNOVA';
  }

  return 'PROFITCHART'; // fallback genérico
}

// ── ENTRY POINT: parseTradeFile ──────────────────────────────────

export function parseTradeFile(
  content: string,
  preset: PlatformPreset = 'AUTO'
): ParseReportResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      trades: [],
      errors: ['O arquivo parece estar vazio ou sem linhas suficientes.'],
      platformDetected: 'Nenhuma',
      totalPnl: 0,
    };
  }

  const delimiter = detectDelimiter(content);
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());

  // Detecta plataforma
  let detected = preset;
  if (preset === 'AUTO') {
    detected = detectPlatform(lines[0]);
  }

  // ── Exnova: parser dedicado com mapeamento exato de colunas ──
  if (detected === 'EXNOVA') {
    return parseExnovaDedicated(lines, delimiter, header);
  }

  // ── Genérico: ProfitChart, MetaTrader etc ──
  return parseGeneric(lines, delimiter, header, detected);
}

// ── PDF PARSER ───────────────────────────────────────────────────

/**
 * Extrai texto de PDF e tenta parsear como tabela de operações.
 * Usa pdf.js (pdfjs-dist) carregado via CDN worker.
 */
export async function parsePdfFile(
  arrayBuffer: ArrayBuffer,
  preset: PlatformPreset = 'AUTO'
): Promise<ParseReportResult> {
  try {
    // Import dinâmico do pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configura worker via CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textLines: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Agrupa itens de texto por posição Y (mesma linha)
      const lineMap = new Map<number, { x: number; text: string }[]>();
      
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          // Arredonda Y para agrupar itens da mesma linha
          const y = Math.round((item as any).transform[5]);
          const x = (item as any).transform[4];
          if (!lineMap.has(y)) lineMap.set(y, []);
          lineMap.get(y)!.push({ x, text: item.str.trim() });
        }
      }

      // Ordena linhas por Y (desc, pois PDF Y é de baixo pra cima) e itens por X
      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
      for (const y of sortedYs) {
        const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
        // Junta com ";" como delimitador para simular CSV
        const lineText = items.map((item) => item.text).join(';');
        if (lineText.trim().length > 3) {
          textLines.push(lineText);
        }
      }
    }

    if (textLines.length < 2) {
      return {
        trades: [],
        errors: ['O PDF não contém dados tabulares suficientes para importação.'],
        platformDetected: 'PDF (sem dados)',
        totalPnl: 0,
      };
    }

    // Tenta parsear o texto extraído como CSV
    const csvContent = textLines.join('\n');
    const result = parseTradeFile(csvContent, preset);
    
    // Ajusta nome da plataforma
    result.platformDetected = `${result.platformDetected} (via PDF)`;
    
    if (result.trades.length === 0 && result.errors.length === 0) {
      result.errors.push(
        'O PDF foi lido com sucesso, mas não foi possível identificar operações na estrutura. ' +
        'Tente exportar como CSV diretamente da plataforma para melhor precisão.'
      );
    }

    return result;
  } catch (err: any) {
    return {
      trades: [],
      errors: [
        `Erro ao processar PDF: ${err?.message || 'Erro desconhecido'}. ` +
        'Tente exportar como CSV diretamente da sua corretora para resultado mais preciso.',
      ],
      platformDetected: 'PDF (erro)',
      totalPnl: 0,
    };
  }
}
