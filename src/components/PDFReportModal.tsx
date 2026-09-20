import React, { useState, useMemo } from 'react';
import { X, FileText, Download, RefreshCw } from 'lucide-react';
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import { Trade, OverallMetrics, RiskSettings, DayPerformance, MonthlyPerformance } from '../types';
import { formatCurrency } from '../utils/calculations';

// ========== PDF STYLES ==========
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b' },
  // Cover
  coverPage: { padding: 40, fontFamily: 'Helvetica', justifyContent: 'center', alignItems: 'center', height: '100%' },
  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 8 },
  coverSubtitle: { fontSize: 14, color: '#475569', marginBottom: 40 },
  coverMeta: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  coverCapital: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#10b981', marginTop: 30 },
  coverCapitalLabel: { fontSize: 10, color: '#64748b', marginTop: 4 },
  // Section
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 10, paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0' },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', paddingVertical: 6, paddingHorizontal: 4 },
  tableHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#ffffff', flex: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  tableCell: { fontSize: 8, flex: 1, textAlign: 'center', color: '#334155' },
  tableCellBold: { fontSize: 8, flex: 1, textAlign: 'center', color: '#0f172a', fontFamily: 'Helvetica-Bold' },
  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpiCard: { width: '48%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10, backgroundColor: '#f8fafc' },
  kpiLabel: { fontSize: 8, color: '#64748b', marginBottom: 2 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  kpiValueGreen: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#10b981' },
  kpiValueRed: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#f43f5e' },
  // Analysis
  analysisBlock: { marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, backgroundColor: '#f8fafc' },
  analysisTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  analysisText: { fontSize: 9, color: '#475569', lineHeight: 1.5 },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#94a3b8' },
  // Badge
  badge: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  badgeGreen: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeRed: { backgroundColor: '#ffe4e6', color: '#9f1239' },
  badgeYellow: { backgroundColor: '#fef9c3', color: '#854d0e' },
});

// ========== HELPER ==========
const fmtCurrency = (v: number) => {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const getMonthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// ========== PDF DOCUMENT ==========
interface ReportData {
  metrics: OverallMetrics;
  settings: RiskSettings;
  monthLabel: string;
  monthKey: string;
  monthTrades: Trade[];
  monthDays: DayPerformance[];
  monthPerf: MonthlyPerformance | null;
  generatedAt: string;
}

const TraderReportDocument: React.FC<{ data: ReportData }> = ({ data }) => {
  const { metrics, settings, monthLabel, monthTrades, monthDays, monthPerf, generatedAt } = data;

  // Behavioral analysis
  const avgTradesPerDay = monthDays.length > 0 ? monthTrades.length / monthDays.length : 0;
  const positiveDays = monthDays.filter(d => d.pnl > 0).length;
  const negativeDays = monthDays.filter(d => d.pnl < 0).length;
  const breakEvenDays = monthDays.filter(d => d.pnl === 0).length;
  
  // Streaks within the month
  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  const sortedTrades = [...monthTrades].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  sortedTrades.forEach(t => {
    if (t.result === 'GAIN') { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
    else if (t.result === 'LOSS') { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
    else { curWin = 0; curLoss = 0; }
  });

  const monthWins = monthTrades.filter(t => t.result === 'GAIN').length;
  const monthLosses = monthTrades.filter(t => t.result === 'LOSS').length;
  const monthWinRate = monthTrades.length > 0 ? (monthWins / monthTrades.length) * 100 : 0;
  const monthPnl = monthTrades.reduce((acc, t) => acc + t.pnl, 0);
  const monthGrossProfit = monthTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const monthGrossLoss = Math.abs(monthTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const monthPF = monthGrossLoss > 0 ? monthGrossProfit / monthGrossLoss : monthGrossProfit > 0 ? Infinity : 0;

  // Risk score (same logic as StakePlannerModal)
  let riskScore = 0;
  if (metrics.currentDrawdownPercent > 20) riskScore += 40;
  else if (metrics.currentDrawdownPercent > 10) riskScore += 25;
  else if (metrics.currentDrawdownPercent > 5) riskScore += 15;
  else riskScore += Math.round(metrics.currentDrawdownPercent * 2);
  if (metrics.currentStreak.type === 'LOSS') riskScore += Math.min(30, metrics.currentStreak.count * 8);
  if (metrics.winRate < 40) riskScore += 20;
  else if (metrics.winRate < 50) riskScore += 12;
  else if (metrics.winRate < 55) riskScore += 5;
  riskScore = Math.min(100, riskScore);
  const riskLevel = riskScore >= 70 ? 'CRÍTICO' : riskScore >= 45 ? 'ALTO' : riskScore >= 25 ? 'MÉDIO' : 'BAIXO';

  // AI Verdict
  const generateAiVerdict = (): string[] => {
    const lines: string[] = [];
    
    // Consistency
    if (monthPF >= 2.0 && monthWinRate >= 55) {
      lines.push(`CONSISTÊNCIA: Excelente. O Profit Factor de ${monthPF === Infinity ? '∞' : monthPF.toFixed(2)} e Win Rate de ${monthWinRate.toFixed(1)}% indicam uma estratégia com forte vantagem matemática. Manter a disciplina atual é essencial.`);
    } else if (monthPF >= 1.3) {
      lines.push(`CONSISTÊNCIA: Estável. Profit Factor de ${monthPF.toFixed(2)} mostra que os ganhos superam as perdas. Foco em manter setups de alta qualidade e evitar overtrading.`);
    } else if (monthPF >= 1.0) {
      lines.push(`CONSISTÊNCIA: Margem apertada. Profit Factor de ${monthPF.toFixed(2)} indica que o trader está no break-even ou perto dele. Recomenda-se reduzir tamanho de mão em 25-30% até consolidar melhor assertividade.`);
    } else {
      lines.push(`CONSISTÊNCIA: Alerta. Profit Factor de ${monthPF.toFixed(2)} mostra que as perdas superam os ganhos. Revisão completa de estratégia é necessária antes de continuar operando com capital real.`);
    }

    // Behavioral
    if (avgTradesPerDay > 10) {
      lines.push(`COMPORTAMENTO: Overtrading detectado (média de ${avgTradesPerDay.toFixed(1)} trades/dia). Excesso de operações geralmente reduz a qualidade das entradas. Sugestão: limitar a ${Math.min(8, settings.maxTradesPerDay)} operações por dia.`);
    } else if (avgTradesPerDay >= 3) {
      lines.push(`COMPORTAMENTO: Volume de operações saudável (${avgTradesPerDay.toFixed(1)} trades/dia). Frequência adequada para manter a assertividade sem fadiga emocional.`);
    } else {
      lines.push(`COMPORTAMENTO: Baixo volume operacional (${avgTradesPerDay.toFixed(1)} trades/dia). Isso pode significar boa seletividade ou oportunidades perdidas. Analise se está filtrando bem os setups.`);
    }

    // Risk
    if (metrics.maxDrawdownPercent > 15) {
      lines.push(`RISCO: Drawdown máximo de ${metrics.maxDrawdownPercent.toFixed(1)}% está acima do limite saudável de 10-15%. Prioridade absoluta em preservar capital com redução de mão.`);
    } else if (metrics.maxDrawdownPercent > 8) {
      lines.push(`RISCO: Drawdown máximo de ${metrics.maxDrawdownPercent.toFixed(1)}% está dentro de parâmetros aceitáveis, mas requer atenção. Stop loss diário deve ser respeitado rigorosamente.`);
    } else {
      lines.push(`RISCO: Drawdown máximo controlado em ${metrics.maxDrawdownPercent.toFixed(1)}%. Excelente gestão de risco. Manter a disciplina atual.`);
    }

    // Recommendation
    if (monthPnl > 0 && monthWinRate >= 55 && riskScore < 45) {
      lines.push(`RECOMENDAÇÃO: Condições favoráveis para manter tamanho de mão atual ou considerar expansão gradual (+10%) no próximo mês, respeitando sempre o stop loss financeiro diário de ${fmtCurrency(settings.dailyLossLimit)}.`);
    } else if (monthPnl > 0) {
      lines.push(`RECOMENDAÇÃO: Manter tamanho de mão atual (Mão Fixa). Apesar do resultado positivo, alguns indicadores sugerem cautela. Foque em consistência antes de expandir.`);
    } else {
      lines.push(`RECOMENDAÇÃO: Reduzir tamanho de mão em 30-50% e operar com lote mínimo até acumular 5-10 trades positivos consecutivos. Prioridade: recuperação com disciplina, não com agressividade.`);
    }

    return lines;
  };

  const aiVerdict = generateAiVerdict();

  return (
    <Document>
      {/* PAGE 1: COVER */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverTitle}>Relatório Executivo</Text>
        <Text style={s.coverSubtitle}>Trader Journal — Balanço Mensal</Text>
        <View style={{ width: 60, height: 2, backgroundColor: '#10b981', marginBottom: 30 }} />
        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#334155', marginBottom: 4 }}>{monthLabel}</Text>
        <Text style={s.coverMeta}>Gerado em: {generatedAt}</Text>
        <Text style={s.coverMeta}>Total de Operações: {monthTrades.length}</Text>
        <Text style={s.coverMeta}>Dias Operados: {monthDays.length}</Text>
        <Text style={s.coverCapital}>{fmtCurrency(metrics.currentCapital)}</Text>
        <Text style={s.coverCapitalLabel}>Capital Atual</Text>
        <View style={s.footer}>
          <Text>Gerado por Trader Journal — Confidencial</Text>
          <Text>Página 1 de 5</Text>
        </View>
      </Page>

      {/* PAGE 2: KPIs */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Balanço Mensal — {monthLabel}</Text>
        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Capital Inicial</Text>
            <Text style={s.kpiValue}>{fmtCurrency(settings.initialCapital)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Capital Final</Text>
            <Text style={s.kpiValue}>{fmtCurrency(metrics.currentCapital)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Lucro/Prejuízo do Mês</Text>
            <Text style={monthPnl >= 0 ? s.kpiValueGreen : s.kpiValueRed}>{fmtCurrency(monthPnl)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Win Rate</Text>
            <Text style={monthWinRate >= 50 ? s.kpiValueGreen : s.kpiValueRed}>{fmtPct(monthWinRate)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Profit Factor</Text>
            <Text style={monthPF >= 1 ? s.kpiValueGreen : s.kpiValueRed}>{monthPF === Infinity ? '∞' : monthPF.toFixed(2)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Payoff (Avg Win / Avg Loss)</Text>
            <Text style={s.kpiValue}>{metrics.payoff.toFixed(2)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Total de Operações</Text>
            <Text style={s.kpiValue}>{monthTrades.length}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Drawdown Máximo</Text>
            <Text style={s.kpiValueRed}>{fmtPct(metrics.maxDrawdownPercent)}</Text>
          </View>
        </View>

        <Text style={[s.sectionTitle, { marginTop: 10 }]}>Resumo de Resultados</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={[s.kpiCard, { width: '31%' }]}>
            <Text style={s.kpiLabel}>Wins</Text>
            <Text style={s.kpiValueGreen}>{monthWins}</Text>
          </View>
          <View style={[s.kpiCard, { width: '31%' }]}>
            <Text style={s.kpiLabel}>Losses</Text>
            <Text style={s.kpiValueRed}>{monthLosses}</Text>
          </View>
          <View style={[s.kpiCard, { width: '31%' }]}>
            <Text style={s.kpiLabel}>Breakeven</Text>
            <Text style={s.kpiValue}>{monthTrades.length - monthWins - monthLosses}</Text>
          </View>
        </View>
        <View style={s.footer}>
          <Text>Gerado por Trader Journal — Confidencial</Text>
          <Text>Página 2 de 5</Text>
        </View>
      </Page>

      {/* PAGE 3: DAILY BREAKDOWN */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Resumo Diário — {monthLabel}</Text>
        {monthDays.length === 0 ? (
          <Text style={s.analysisText}>Nenhum dia operado neste mês.</Text>
        ) : (
          <View>
            <View style={s.tableHeader}>
              <Text style={s.tableHeaderCell}>Data</Text>
              <Text style={s.tableHeaderCell}>Trades</Text>
              <Text style={s.tableHeaderCell}>Wins</Text>
              <Text style={s.tableHeaderCell}>Losses</Text>
              <Text style={s.tableHeaderCell}>Win Rate</Text>
              <Text style={s.tableHeaderCell}>P&L do Dia</Text>
            </View>
            {monthDays.map((day, idx) => (
              <View key={day.date} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={s.tableCellBold}>{fmtDate(day.date)}</Text>
                <Text style={s.tableCell}>{day.tradesCount}</Text>
                <Text style={s.tableCell}>{day.wins}</Text>
                <Text style={s.tableCell}>{day.losses}</Text>
                <Text style={s.tableCell}>{fmtPct(day.winRate)}</Text>
                <Text style={[s.tableCellBold, { color: day.pnl >= 0 ? '#10b981' : '#f43f5e' }]}>
                  {fmtCurrency(day.pnl)}
                </Text>
              </View>
            ))}
            {/* Total Row */}
            <View style={[s.tableHeader, { backgroundColor: '#334155' }]}>
              <Text style={s.tableHeaderCell}>TOTAL</Text>
              <Text style={s.tableHeaderCell}>{monthTrades.length}</Text>
              <Text style={s.tableHeaderCell}>{monthWins}</Text>
              <Text style={s.tableHeaderCell}>{monthLosses}</Text>
              <Text style={s.tableHeaderCell}>{fmtPct(monthWinRate)}</Text>
              <Text style={[s.tableHeaderCell, { color: monthPnl >= 0 ? '#a7f3d0' : '#fda4af' }]}>
                {fmtCurrency(monthPnl)}
              </Text>
            </View>
          </View>
        )}
        <View style={s.footer}>
          <Text>Gerado por Trader Journal — Confidencial</Text>
          <Text>Página 3 de 5</Text>
        </View>
      </Page>

      {/* PAGE 4: BEHAVIORAL ANALYSIS */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Análise Comportamental — {monthLabel}</Text>
        
        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Dias Positivos</Text>
            <Text style={s.kpiValueGreen}>{positiveDays}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Dias Negativos</Text>
            <Text style={s.kpiValueRed}>{negativeDays}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Dias Breakeven</Text>
            <Text style={s.kpiValue}>{breakEvenDays}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Média de Trades/Dia</Text>
            <Text style={s.kpiValue}>{avgTradesPerDay.toFixed(1)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Sequência Máx. de Wins</Text>
            <Text style={s.kpiValueGreen}>{maxWinStreak}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Sequência Máx. de Losses</Text>
            <Text style={s.kpiValueRed}>{maxLossStreak}</Text>
          </View>
        </View>

        <View style={s.analysisBlock}>
          <Text style={s.analysisTitle}>Nível de Risco Atual</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={[s.badge, riskScore >= 70 ? s.badgeRed : riskScore >= 25 ? s.badgeYellow : s.badgeGreen]}>
              <Text>{riskLevel} ({riskScore}/100)</Text>
            </View>
          </View>
          <Text style={s.analysisText}>
            O score de risco é calculado com base no drawdown atual ({fmtPct(metrics.currentDrawdownPercent)}), 
            sequência de resultados ({metrics.currentStreak.type === 'WIN' ? `+${metrics.currentStreak.count} wins` : metrics.currentStreak.type === 'LOSS' ? `-${metrics.currentStreak.count} losses` : 'neutro'}), 
            win rate geral ({fmtPct(metrics.winRate)}) e exposição de capital.
          </Text>
        </View>

        <View style={s.analysisBlock}>
          <Text style={s.analysisTitle}>Meta vs Realizado</Text>
          <Text style={s.analysisText}>
            Meta Diária: {fmtCurrency(settings.dailyProfitTarget)} | Stop Diário: {fmtCurrency(settings.dailyLossLimit)}
          </Text>
          <Text style={[s.analysisText, { marginTop: 4 }]}>
            Meta Mensal: {fmtCurrency(settings.monthlyProfitTarget)} | Stop Mensal: {fmtCurrency(settings.monthlyLossLimit)}
          </Text>
          <Text style={[s.analysisText, { marginTop: 4, fontFamily: 'Helvetica-Bold', color: monthPnl >= settings.monthlyProfitTarget ? '#10b981' : monthPnl <= -settings.monthlyLossLimit ? '#f43f5e' : '#334155' }]}>
            Resultado: {fmtCurrency(monthPnl)} ({monthPnl >= settings.monthlyProfitTarget ? 'META BATIDA ✓' : monthPnl <= -settings.monthlyLossLimit ? 'STOP ATINGIDO ✗' : 'Em Andamento'})
          </Text>
        </View>

        <View style={s.footer}>
          <Text>Gerado por Trader Journal — Confidencial</Text>
          <Text>Página 4 de 5</Text>
        </View>
      </Page>

      {/* PAGE 5: AI VERDICT */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Parecer do Mentor IA — {monthLabel}</Text>
        <Text style={{ fontSize: 8, color: '#94a3b8', marginBottom: 12 }}>
          Diagnóstico automatizado baseado nos dados reais registrados no período. Este parecer utiliza regras de gestão conservadora e não substitui consultoria profissional.
        </Text>

        {aiVerdict.map((paragraph, idx) => (
          <View key={idx} style={[s.analysisBlock, { marginBottom: 10 }]}>
            <Text style={s.analysisText}>{paragraph}</Text>
          </View>
        ))}

        <View style={[s.analysisBlock, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[s.analysisTitle, { color: '#166534' }]}>Resumo Final</Text>
          <Text style={[s.analysisText, { color: '#15803d' }]}>
            {monthPnl >= 0
              ? `Mês encerrado com resultado positivo de ${fmtCurrency(monthPnl)}. ${monthWinRate >= 55 ? 'Assertividade acima da média.' : 'Win rate pode ser melhorado.'} ${monthPF >= 1.5 ? 'Profit Factor saudável.' : 'Profit Factor requer atenção.'} Mantenha a disciplina e o controle emocional para sustentar os resultados no próximo período.`
              : `Mês encerrado com prejuízo de ${fmtCurrency(Math.abs(monthPnl))}. É fundamental revisar a estratégia, respeitar os stops e considerar redução de mão antes de retomar operações agressivas. Foque em consistência, não em recuperação rápida.`
            }
          </Text>
        </View>

        <View style={s.footer}>
          <Text>Gerado por Trader Journal — Confidencial</Text>
          <Text>Página 5 de 5</Text>
        </View>
      </Page>
    </Document>
  );
};

// ========== MODAL COMPONENT ==========
interface PDFReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: Trade[];
  metrics: OverallMetrics;
  settings: RiskSettings;
  dailyPerformance: DayPerformance[];
  monthlyPerformance: MonthlyPerformance[];
}

export const PDFReportModal: React.FC<PDFReportModalProps> = ({
  isOpen,
  onClose,
  trades,
  metrics,
  settings,
  dailyPerformance,
  monthlyPerformance,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Available months from trades
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    trades.forEach(t => {
      if (t.date) months.add(t.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [trades]);

  // Auto-select latest month
  const effectiveMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[0] : '');

  const handleGenerate = async () => {
    if (!effectiveMonth) return;
    setIsGenerating(true);

    try {
      const monthTrades = trades.filter(t => t.date.startsWith(effectiveMonth));
      const monthDays = dailyPerformance.filter(d => d.date.startsWith(effectiveMonth));
      const monthPerf = monthlyPerformance.find(m => m.monthKey === effectiveMonth) || null;

      const data: ReportData = {
        metrics,
        settings,
        monthLabel: getMonthLabel(effectiveMonth),
        monthKey: effectiveMonth,
        monthTrades,
        monthDays,
        monthPerf,
        generatedAt: new Date().toLocaleString('pt-BR'),
      };

      const blob = await pdf(<TraderReportDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_${effectiveMonth}_TraderJournal.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md flex flex-col bg-black border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-black">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Relatório Executivo</h2>
              <p className="text-xs text-slate-400">Exportar balanço mensal em PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Month selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Mês de Referência
            </label>
            {availableMonths.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum trade registrado. Importe ou cadastre operações para gerar relatórios.</p>
            ) : (
              <select
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-black px-4 py-3 text-sm font-bold text-white focus:border-violet-500 focus:outline-none"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{getMonthLabel(m)}</option>
                ))}
              </select>
            )}
          </div>

          {/* Preview summary */}
          {effectiveMonth && (
            <div className="rounded-xl border border-slate-800 bg-black p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Prévia</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Trades no mês: </span>
                  <strong className="text-white">{trades.filter(t => t.date.startsWith(effectiveMonth)).length}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Dias operados: </span>
                  <strong className="text-white">{dailyPerformance.filter(d => d.date.startsWith(effectiveMonth)).length}</strong>
                </div>
                <div>
                  <span className="text-slate-500">P&L do mês: </span>
                  <strong className={`${trades.filter(t => t.date.startsWith(effectiveMonth)).reduce((a, t) => a + t.pnl, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(trades.filter(t => t.date.startsWith(effectiveMonth)).reduce((a, t) => a + t.pnl, 0))}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Páginas: </span>
                  <strong className="text-white">5</strong>
                </div>
              </div>
            </div>
          )}

          {/* Content description */}
          <div className="text-[10px] text-slate-500 space-y-1">
            <p>O relatório contém:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Capa com capital atual</li>
              <li>Balanço mensal com KPIs completos</li>
              <li>Resumo diário (P&L por dia)</li>
              <li>Análise comportamental e nível de risco</li>
              <li>Parecer do Mentor IA com recomendações</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-black px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm font-bold transition">
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !effectiveMonth}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
