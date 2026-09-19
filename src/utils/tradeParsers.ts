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

// Clean number format (handles "1.250,50", "R$ -150,00", "(50.00)")
function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  let str = val.trim();
  // Remove currency symbols and non-numeric chars except -, +, commas and dots
  str = str.replace(/[R$\s]/g, '');
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.substring(1, str.length - 1);
  }
  // Brazilian format: "1.500,50" -> "1500.50"
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

// Parse Date to YYYY-MM-DD
function parseDateString(dateStr: string | undefined): { date: string; time: string } {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!dateStr) return { date: defaultDate, time: defaultTime };

  const str = dateStr.trim();
  // Extract time if present (e.g., "15/09/2026 14:30:00" or "2026-09-15 14:30")
  const parts = str.split(/\s+/);
  let dPart = parts[0] || '';
  let tPart = parts[1] || defaultTime;

  if (tPart.length >= 5) {
    tPart = tPart.substring(0, 5); // "14:30"
  }

  // Format date part
  let date = defaultDate;
  if (dPart.includes('/')) {
    const dParts = dPart.split('/');
    if (dParts.length === 3) {
      // DD/MM/YYYY or YYYY/MM/DD
      if (dParts[0].length === 4) {
        date = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
      } else {
        date = `${dParts[2].padStart(4, '20')}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      }
    }
  } else if (dPart.includes('.')) {
    const dParts = dPart.split('.');
    if (dParts.length === 3) {
      if (dParts[0].length === 4) {
        date = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
      } else {
        date = `${dParts[2].padStart(4, '20')}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      }
    }
  } else if (dPart.includes('-')) {
    const dParts = dPart.split('-');
    if (dParts.length === 3) {
      if (dParts[0].length === 4) {
        date = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
      } else {
        date = `${dParts[2].padStart(4, '20')}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      }
    }
  }

  return { date, time: tPart };
}

// Split CSV line handling quotes
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

// Auto-detect delimiter
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

  // Determine platform type
  let detected = preset;
  if (preset === 'AUTO') {
    const headerStr = lines[0].toLowerCase();
    if (
      headerStr.includes('ativo') ||
      headerStr.includes('fechamento') ||
      headerStr.includes('lucro/prejuízo') ||
      headerStr.includes('lucro liquido')
    ) {
      detected = 'PROFITCHART';
    } else if (
      headerStr.includes('ticket') ||
      headerStr.includes('open time') ||
      headerStr.includes('item') ||
      headerStr.includes('swap')
    ) {
      detected = 'METATRADER';
    } else if (
      headerStr.includes('option') ||
      headerStr.includes('investment') ||
      headerStr.includes('exnova') ||
      headerStr.includes('payout')
    ) {
      detected = 'EXNOVA';
    } else {
      detected = 'PROFITCHART'; // Default fallback for B3
    }
  }

  const parsedTrades: ParsedTradeItem[] = [];
  const errors: string[] = [];

  // Index mapping
  let assetIdx = -1;
  let dateIdx = -1;
  let timeIdx = -1;
  let typeIdx = -1;
  let pnlIdx = -1;
  let qtyIdx = -1;
  let strategyIdx = -1;

  // Header column identification
  header.forEach((col, idx) => {
    if (col.includes('ativo') || col.includes('symbol') || col.includes('item') || col.includes('instrument')) {
      if (assetIdx === -1) assetIdx = idx;
    }
    if (col.includes('data') || col.includes('date') || col.includes('abertura') || col.includes('open time') || col.includes('time')) {
      if (dateIdx === -1) dateIdx = idx;
    }
    if (col.includes('hora') || col.includes('horario') || col.includes('close time')) {
      if (timeIdx === -1) timeIdx = idx;
    }
    if (col.includes('tipo') || col.includes('type') || col.includes('lado') || col.includes('direção') || col.includes('direcao')) {
      if (typeIdx === -1) typeIdx = idx;
    }
    if (col.includes('resultado') || col.includes('lucro') || col.includes('pnl') || col.includes('profit') || col.includes('p&l')) {
      if (pnlIdx === -1) pnlIdx = idx;
    }
    if (col.includes('qtd') || col.includes('quantidade') || col.includes('contratos') || col.includes('size') || col.includes('volume') || col.includes('investment')) {
      if (qtyIdx === -1) qtyIdx = idx;
    }
    if (col.includes('estrategia') || col.includes('setup') || col.includes('strategy') || col.includes('nota')) {
      if (strategyIdx === -1) strategyIdx = idx;
    }
  });

  // Fallback defaults if header search yielded nothing
  if (assetIdx === -1) assetIdx = 0;
  if (dateIdx === -1) dateIdx = 1;
  if (pnlIdx === -1) pnlIdx = header.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const rowStr = lines[i];
    const cols = splitCsvLine(rowStr, delimiter);

    // Skip short or empty lines
    if (cols.length < 2) continue;

    try {
      const rawAsset = (cols[assetIdx] || 'WIN').toUpperCase().replace(/[^A-Z0-9/]/g, '');
      const asset = rawAsset || 'WIN';

      // Date / Time parsing
      const rawDateStr = cols[dateIdx] || '';
      const { date, time: parsedTime } = parseDateString(rawDateStr);
      const time = timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx].substring(0, 5) : parsedTime;

      // PnL parsing
      const rawPnl = cols[pnlIdx] || '0';
      const pnl = parseNumber(rawPnl);

      // Result logic
      let result: TradeResult = 'BREAKEVEN';
      if (pnl > 0.001) result = 'GAIN';
      else if (pnl < -0.001) result = 'LOSS';

      // Type parsing (BUY / SELL)
      const rawType = (typeIdx !== -1 ? cols[typeIdx] : '').toUpperCase();
      let type: TradeType = 'BUY';
      if (rawType.includes('V') || rawType.includes('SELL') || rawType.includes('PUT') || rawType.includes('SHORT')) {
        type = 'SELL';
      }

      // Quantity / Contracts
      const rawQty = qtyIdx !== -1 ? cols[qtyIdx] : '1';
      const contractsOrQuantity = Math.max(1, parseNumber(rawQty));

      // Strategy
      const strategy = strategyIdx !== -1 && cols[strategyIdx] ? cols[strategyIdx] : 'Importado via CSV';

      const tradeItem: ParsedTradeItem = {
        id: `imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        date,
        time,
        asset,
        type,
        strategy,
        result,
        pnl,
        contractsOrQuantity,
        notes: `Importado de relatório ${detected}`,
        selected: true,
        rawRow: rowStr,
      };

      parsedTrades.push(tradeItem);
    } catch (err: any) {
      errors.push(`Linha ${i + 1}: ${err?.message || 'Erro de leitura dos campos'}`);
    }
  }

  const totalPnl = parsedTrades.reduce((acc, t) => acc + t.pnl, 0);

  const platformNames: Record<string, string> = {
    PROFITCHART: 'ProfitChart (Nelogica)',
    METATRADER: 'MetaTrader 4 / 5',
    EXNOVA: 'Exnova / IQ Option',
    AUTO: 'Formatador Genérico CSV',
  };

  return {
    trades: parsedTrades,
    errors,
    platformDetected: platformNames[detected] || 'Genérico CSV',
    totalPnl,
  };
}
