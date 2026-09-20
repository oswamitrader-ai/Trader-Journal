import React, { useState, useMemo } from 'react';
import { X, Target, Brain, ShieldAlert, Zap, AlertTriangle, TrendingUp, Sliders, BarChart2, Shield, Activity } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import { Trade, OverallMetrics, RiskSettings } from '../types';

interface StakePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCapital?: number;
  trades?: Trade[];
  metrics?: OverallMetrics;
  settings?: RiskSettings;
}

type StrategyType = 'FIXED' | 'SOROS' | 'MARTINGALE';
type PlannerTab = 'simulator' | 'ai';

export const StakePlannerModal: React.FC<StakePlannerModalProps> = ({
  isOpen,
  onClose,
  initialCapital = 1000,
  trades = [],
  metrics,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<PlannerTab>('ai');
  const [strategy, setStrategy] = useState<StrategyType>('SOROS');
  const [initialStake, setInitialStake] = useState<number>(50);
  const [payout, setPayout] = useState<number>(85);
  const [levels, setLevels] = useState<number>(3);

  // AI Tab state
  const [aiStakeInput, setAiStakeInput] = useState<number>(50);

  // Calcular projeção (Simulador)
  const projection = useMemo(() => {
    const pnlRate = payout / 100;
    const steps = [];
    let currentStake = initialStake;
    let accumulatedLoss = 0;

    for (let i = 1; i <= levels; i++) {
      let nextStake = currentStake;
      let expectedReturn = 0;

      if (strategy === 'FIXED') {
        nextStake = initialStake;
        expectedReturn = nextStake * pnlRate;
      } else if (strategy === 'SOROS') {
        if (i === 1) {
          nextStake = initialStake;
        } else {
          nextStake = steps[i - 2].returnAmount;
        }
        expectedReturn = nextStake * pnlRate;
      } else if (strategy === 'MARTINGALE') {
        if (i === 1) {
          nextStake = initialStake;
          accumulatedLoss = 0;
        } else {
          accumulatedLoss += steps[i - 2].stake;
          nextStake = (accumulatedLoss + (initialStake * pnlRate)) / pnlRate;
        }
        expectedReturn = nextStake * pnlRate;
      }

      steps.push({
        level: i,
        stake: nextStake,
        profit: expectedReturn,
        returnAmount: nextStake + expectedReturn,
      });
    }

    return steps;
  }, [strategy, initialStake, payout, levels]);

  // IA Conselho Dinâmico (Simulador)
  const aiFeedback = useMemo(() => {
    if (strategy === 'FIXED') {
      return {
        type: 'success',
        icon: <Target className="h-5 w-5 text-white" />,
        title: 'Gestão Conservadora Excelente',
        message: 'A Mão Fixa é a estratégia mais sustentável a longo prazo. Foca em taxa de acerto. Controle suas emoções e não mude o valor após perdas.',
        borderColor: 'border-emerald-600',
        bgColor: 'bg-emerald-600 text-white',
      };
    } else if (strategy === 'SOROS') {
      const riskLevel = levels > 3 ? 'warning' : 'success';
      return {
        type: riskLevel,
        icon: <Zap className="h-5 w-5 text-white" />,
        title: levels > 3 ? 'Cuidado com a Ganância (Soros Alto)' : 'Alavancagem Inteligente (Soros Curto)',
        message: levels > 3 
          ? `Soros nível ${levels} requer uma taxa de acerto sequencial muito rara. Considere parar no Nível 2 ou 3 para proteger seu capital inicial de ${formatCurrency(initialStake)}.`
          : 'O Soros curto (Nível 2 ou 3) é ideal para alavancar lucros arriscando apenas o lucro da corretora. Ótima escolha!',
        borderColor: riskLevel === 'warning' ? 'border-amber-600' : 'border-emerald-600',
        bgColor: riskLevel === 'warning' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white',
      };
    } else {
      const totalRisk = projection.reduce((acc, s) => acc + s.stake, 0);
      const isBankruptRisk = totalRisk > initialCapital * 0.5;
      
      return {
        type: 'error',
        icon: <ShieldAlert className="h-5 w-5 text-white" />,
        title: 'ALERTA DE ALTO RISCO MATEMÁTICO',
        message: `O uso de Martingale destrói bancas. Para chegar ao nível ${levels}, você precisará arriscar um total de ${formatCurrency(totalRisk)} para tentar recuperar trocados. ${isBankruptRisk ? 'ISSO PODE QUEBRAR SUA BANCA DE IMEDIATO!' : 'A matemática está contra você. Sugiro fortemente não utilizar!'}`,
        borderColor: 'border-rose-600',
        bgColor: 'bg-rose-600 text-white animate-pulse shadow-rose-900/50',
      };
    }
  }, [strategy, levels, initialStake, projection, initialCapital]);

  // ========== AI SUGGESTION LOGIC ==========
  const aiSuggestion = useMemo(() => {
    const capital = metrics?.currentCapital ?? initialCapital;
    const winRate = metrics?.winRate ?? 50;
    const pf = metrics?.profitFactor ?? 1;
    const streak = metrics?.currentStreak ?? { type: 'NONE' as const, count: 0 };
    const drawdownPct = metrics?.currentDrawdownPercent ?? 0;
    const totalTrades = metrics?.totalTrades ?? 0;

    // Exposure check
    const exposurePct = capital > 0 ? (aiStakeInput / capital) * 100 : 100;

    // ===== RISK SCORE (0-100, higher = more dangerous) =====
    let riskScore = 0;

    // Drawdown contribution (0-40 points)
    if (drawdownPct > 20) riskScore += 40;
    else if (drawdownPct > 10) riskScore += 25;
    else if (drawdownPct > 5) riskScore += 15;
    else riskScore += Math.round(drawdownPct * 2);

    // Losing streak contribution (0-30 points)
    if (streak.type === 'LOSS') {
      riskScore += Math.min(30, streak.count * 8);
    }

    // Win rate contribution (0-20 points)
    if (winRate < 40) riskScore += 20;
    else if (winRate < 50) riskScore += 12;
    else if (winRate < 55) riskScore += 5;

    // Exposure contribution (0-10 points)
    if (exposurePct > 10) riskScore += 10;
    else if (exposurePct > 5) riskScore += 5;
    else if (exposurePct > 3) riskScore += 2;

    riskScore = Math.min(100, Math.max(0, riskScore));

    // ===== RISK LEVEL =====
    let riskLevel: 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO' = 'BAIXO';
    let riskColor = 'text-emerald-400';
    let riskBg = 'bg-emerald-600';
    if (riskScore >= 70) { riskLevel = 'CRÍTICO'; riskColor = 'text-rose-400'; riskBg = 'bg-rose-600'; }
    else if (riskScore >= 45) { riskLevel = 'ALTO'; riskColor = 'text-amber-400'; riskBg = 'bg-amber-600'; }
    else if (riskScore >= 25) { riskLevel = 'MÉDIO'; riskColor = 'text-yellow-400'; riskBg = 'bg-yellow-600'; }

    // ===== SUGGESTED STAKE =====
    let suggestedStake = aiStakeInput;
    let suggestedStrategy: 'Mão Fixa' | 'Soros Nível 2' | 'Soros Nível 3' | 'Mão Mínima Defensiva' = 'Mão Fixa';
    let stakeReason = '';

    if (riskScore >= 70) {
      // CRITICAL: Reduce 50% or minimum
      suggestedStake = Math.max(1, aiStakeInput * 0.5);
      suggestedStrategy = 'Mão Mínima Defensiva';
      stakeReason = `Drawdown de ${drawdownPct.toFixed(1)}% e ${streak.type === 'LOSS' ? `${streak.count} losses seguidos` : 'performance instável'}. Reduzir drasticamente para preservar capital.`;
    } else if (riskScore >= 45) {
      // HIGH: Reduce 30%
      suggestedStake = Math.max(1, aiStakeInput * 0.7);
      suggestedStrategy = 'Mão Fixa';
      stakeReason = `Win rate de ${winRate.toFixed(1)}% com risco elevado. Reduza a mão em 30% e foque em setups de alta qualidade.`;
    } else if (riskScore >= 25) {
      // MEDIUM: Maintain
      suggestedStake = aiStakeInput;
      suggestedStrategy = 'Mão Fixa';
      stakeReason = 'Performance estável. Mantenha o valor atual sem expandir até consolidar mais dados.';
    } else {
      // LOW: Can expand
      if (pf >= 2.0 && winRate >= 60 && streak.type === 'WIN' && streak.count >= 2) {
        suggestedStake = aiStakeInput * 1.1;
        suggestedStrategy = 'Soros Nível 2';
        stakeReason = `Excelente! PF de ${pf.toFixed(2)} e ${streak.count} wins seguidos. Condições favoráveis para Soros curto (Nível 2), arriscando apenas o lucro.`;
      } else if (pf >= 1.5 && winRate >= 55) {
        suggestedStake = aiStakeInput;
        suggestedStrategy = 'Mão Fixa';
        stakeReason = `Performance sólida (PF ${pf.toFixed(2)}, WR ${winRate.toFixed(1)}%). Mantenha a mão padrão com disciplina.`;
      } else {
        suggestedStake = aiStakeInput;
        suggestedStrategy = 'Mão Fixa';
        stakeReason = 'Dados insuficientes ou performance neutra. Mantenha a mão fixa e acumule mais operações para análise.';
      }
    }

    // ===== ALERTS =====
    const alerts: Array<{ type: 'warning' | 'danger' | 'info'; message: string }> = [];

    // Martingale alert (always)
    alerts.push({
      type: 'danger',
      message: `Não use Martingale. ${pf > 0 ? `Com PF de ${pf.toFixed(2)}, recuperar via Gale exige ${Math.round(100 / (pf > 0 ? pf : 1))}% de acerto sequencial` : 'Sem dados suficientes para calcular'}, o que é matematicamente insustentável a longo prazo.`,
    });

    if (exposurePct > 5) {
      alerts.push({
        type: 'warning',
        message: `Sobreexposição! Sua entrada de ${formatCurrency(aiStakeInput)} representa ${exposurePct.toFixed(1)}% do capital. O ideal é no máximo 2-3% por operação.`,
      });
    }

    if (streak.type === 'LOSS' && streak.count >= 3) {
      alerts.push({
        type: 'danger',
        message: `Você está em ${streak.count} losses consecutivos. Considere PARAR de operar hoje e revisar sua estratégia antes de retomar.`,
      });
    }

    if (drawdownPct > 10) {
      alerts.push({
        type: 'danger',
        message: `Drawdown atual de ${drawdownPct.toFixed(1)}% está acima do limite saudável de 10%. Prioridade: preservar capital.`,
      });
    }

    if (totalTrades < 10) {
      alerts.push({
        type: 'info',
        message: 'Você possui menos de 10 operações registradas. As sugestões se tornarão mais precisas conforme registrar mais trades.',
      });
    }

    return {
      suggestedStake,
      suggestedStrategy,
      stakeReason,
      riskScore,
      riskLevel,
      riskColor,
      riskBg,
      alerts,
      exposurePct,
      winRate,
      pf,
      drawdownPct,
      streak,
      capital,
    };
  }, [aiStakeInput, metrics, initialCapital]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl flex flex-col max-h-[90vh] bg-black border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Planejador de Entradas</h2>
              <p className="text-xs text-slate-400">Simule estratégias e receba sugestões inteligentes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex bg-black px-4 pt-3 pb-0 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'ai'
                ? 'border-indigo-500 text-indigo-400 bg-black'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            Sugestão IA
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400 bg-black'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Simulador
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* ==================== ABA: SUGESTÃO IA ==================== */}
          {activeTab === 'ai' && (
            <div className="space-y-5">

              {/* Input: Valor da Entrada */}
              <div className="rounded-xl border border-slate-800 bg-black p-4">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Valor da Entrada Atual (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={aiStakeInput}
                  onChange={(e) => setAiStakeInput(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-700 bg-black px-4 py-3 text-lg font-bold text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-2 text-[10px] text-slate-500">
                  Capital atual: <strong className="text-slate-300">{formatCurrency(aiSuggestion.capital)}</strong>
                  {' | '}Exposição: <strong className={aiSuggestion.exposurePct > 5 ? 'text-amber-400' : 'text-slate-300'}>{aiSuggestion.exposurePct.toFixed(1)}%</strong>
                </p>
              </div>

              {/* Card: Próxima Entrada Sugerida */}
              <div className="rounded-xl border border-indigo-600 bg-black p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-lg">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white">Próxima Entrada Sugerida</h4>
                      <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        {aiSuggestion.suggestedStrategy}
                      </span>
                    </div>
                    <div className="text-3xl font-black text-indigo-400 font-mono my-2">
                      {formatCurrency(aiSuggestion.suggestedStake)}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {aiSuggestion.stakeReason}
                    </p>
                    {aiSuggestion.suggestedStake !== aiStakeInput && (
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500">Diferença:</span>
                        <span className={`font-bold font-mono ${aiSuggestion.suggestedStake > aiStakeInput ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {aiSuggestion.suggestedStake > aiStakeInput ? '+' : ''}{formatCurrency(aiSuggestion.suggestedStake - aiStakeInput)}
                          {' '}({aiSuggestion.suggestedStake > aiStakeInput ? '+' : ''}{(((aiSuggestion.suggestedStake - aiStakeInput) / aiStakeInput) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Nível de Risco */}
              <div className="rounded-xl border border-slate-800 bg-black p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Nível de Risco Atual</h4>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${aiSuggestion.riskBg} text-white`}>
                    {aiSuggestion.riskLevel}
                  </span>
                </div>

                {/* Risk Bar */}
                <div className="relative h-3 w-full rounded-full bg-slate-800 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${aiSuggestion.riskBg}`}
                    style={{ width: `${aiSuggestion.riskScore}%` }}
                  />
                </div>

                {/* Mini Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-black border border-slate-800 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Win Rate</p>
                    <p className={`text-sm font-black font-mono ${aiSuggestion.winRate >= 55 ? 'text-emerald-400' : aiSuggestion.winRate >= 45 ? 'text-yellow-400' : 'text-rose-400'}`}>
                      {aiSuggestion.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-black border border-slate-800 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Profit Factor</p>
                    <p className={`text-sm font-black font-mono ${aiSuggestion.pf >= 1.5 ? 'text-emerald-400' : aiSuggestion.pf >= 1.0 ? 'text-yellow-400' : 'text-rose-400'}`}>
                      {aiSuggestion.pf.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-black border border-slate-800 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Drawdown</p>
                    <p className={`text-sm font-black font-mono ${aiSuggestion.drawdownPct <= 5 ? 'text-emerald-400' : aiSuggestion.drawdownPct <= 10 ? 'text-yellow-400' : 'text-rose-400'}`}>
                      {aiSuggestion.drawdownPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-black border border-slate-800 p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase">Sequência</p>
                    <p className={`text-sm font-black font-mono ${aiSuggestion.streak.type === 'WIN' ? 'text-emerald-400' : aiSuggestion.streak.type === 'LOSS' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {aiSuggestion.streak.type === 'WIN' ? '+' : aiSuggestion.streak.type === 'LOSS' ? '-' : ''}{aiSuggestion.streak.count}
                      {' '}{aiSuggestion.streak.type === 'WIN' ? 'Wins' : aiSuggestion.streak.type === 'LOSS' ? 'Losses' : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alertas da IA */}
              {aiSuggestion.alerts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Alertas da IA</h4>
                  </div>
                  {aiSuggestion.alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-3.5 text-xs leading-relaxed font-medium flex items-start gap-3 border bg-black ${
                        alert.type === 'danger'
                          ? 'border-rose-800 text-rose-300'
                          : alert.type === 'warning'
                          ? 'border-amber-800 text-amber-300'
                          : 'border-blue-800 text-blue-300'
                      }`}
                    >
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        alert.type === 'danger' ? 'text-rose-400' : alert.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      }`} />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== ABA: SIMULADOR ==================== */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              {/* TABS (Estratégia) */}
              <div className="flex bg-black p-1 rounded-xl border border-slate-800">
                {(['FIXED', 'SOROS', 'MARTINGALE'] as StrategyType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setStrategy(type);
                      setLevels(type === 'MARTINGALE' ? 3 : type === 'SOROS' ? 3 : 5);
                    }}
                    className={`flex-1 flex items-center justify-center py-2.5 text-xs font-bold rounded-lg transition-all ${
                      strategy === type
                        ? type === 'MARTINGALE' 
                          ? 'bg-rose-600 text-white shadow-md' 
                          : 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {type === 'FIXED' && 'Mão Fixa'}
                    {type === 'SOROS' && 'Soros (Alavancagem)'}
                    {type === 'MARTINGALE' && 'Martingale (Recuperação)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* SETUP INPUTS */}
                <div className="col-span-1 space-y-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-black">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                      Configuração
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Valor da 1ª Entrada (R$)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={initialStake}
                          onChange={(e) => setInitialStake(Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Payout Esperado (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={payout}
                          onChange={(e) => setPayout(Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Níveis / Quantidade de Ordens
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={strategy === 'MARTINGALE' ? 5 : 10}
                          value={levels}
                          onChange={(e) => setLevels(Number(e.target.value) || 1)}
                          className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI FEEDBACK & RESULTS */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  
                  {/* AI CARD */}
                  <div className={`p-4 rounded-xl border ${aiFeedback.borderColor} ${aiFeedback.bgColor} flex items-start gap-3 shadow-lg`}>
                    <div className="mt-0.5 shrink-0 bg-black/20 p-2 rounded-lg border border-white/20">
                      {aiFeedback.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2 text-white">
                        Análise da IA: {aiFeedback.title}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-white/90 font-medium">
                        {aiFeedback.message}
                      </p>
                    </div>
                  </div>

                  {/* Tabela de Projeção */}
                  <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800 bg-black">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Target className="h-4 w-4 text-indigo-400" />
                        Projeção Passo a Passo
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-2 font-medium">Ordem</th>
                            <th className="px-4 py-2 font-medium">Valor da Entrada</th>
                            <th className="px-4 py-2 font-medium">Lucro (Win)</th>
                            <th className="px-4 py-2 font-medium">Retorno Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {projection.map((step, idx) => (
                            <tr key={idx} className="hover:bg-slate-900 transition">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                                  <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center border border-slate-700 text-[10px]">
                                    {step.level}
                                  </span>
                                  {strategy === 'SOROS' && 'Mão de Soros'}
                                  {strategy === 'MARTINGALE' && (idx === 0 ? 'Entrada Principal' : `Gale ${idx}`)}
                                  {strategy === 'FIXED' && 'Entrada'}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-white">
                                {formatCurrency(step.stake)}
                              </td>
                              <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                                +{formatCurrency(step.profit)}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-300">
                                {formatCurrency(step.returnAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {strategy === 'MARTINGALE' && (
                      <div className="p-3 bg-rose-600 border-t border-rose-500 text-[10px] text-white text-center font-bold">
                        <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                        Se você perder todas essas {levels} ordens, o prejuízo acumulado será de <strong>{formatCurrency(projection.reduce((acc, s) => acc + s.stake, 0))}</strong>.
                      </div>
                    )}
                    {strategy === 'SOROS' && (
                      <div className="p-3 bg-emerald-600 border-t border-emerald-500 text-[10px] text-white text-center font-bold">
                        Se você acertar {levels} vitórias seguidas, lucrará <strong>{formatCurrency(projection[projection.length - 1].returnAmount - initialStake)}</strong> arriscando do seu bolso apenas <strong>{formatCurrency(initialStake)}</strong>.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-800 bg-black px-6 py-4 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-500 max-w-md">
            Esta ferramenta é apenas um simulador para ajudar na gestão matemática de risco e não substitui o preenchimento de seus trades no diário.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
