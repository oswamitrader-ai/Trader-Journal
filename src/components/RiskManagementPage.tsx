import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Calculator,
  Percent,
  Layers,
  Sparkles,
  Zap,
  Info,
  Save,
  RotateCcw,
  GitCommit,
} from 'lucide-react';
import { RiskSettings, Trade } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';

interface RiskManagementPageProps {
  settings: RiskSettings;
  currentCapital: number;
  todayPnl: number;
  todayTradesCount: number;
  isStopHit: boolean;
  isMaxTradesHit: boolean;
  onSaveSettings: (newSettings: RiskSettings) => void;
  onBackToJournal: () => void;
}

/**
 * Simula uma sequência exata de trades com interrupção realista por quebra de saldo ou Stop Loss
 */
function simulateSequence(
  seq: ('W' | 'L')[],
  model: string,
  baseStake: number,
  payoutPct: number,
  winRatePct: number,
  baseCapital: number,
  dailyLossLimit: number,
  dailyProfitTarget: number
): {
  pnl: number;
  executedSeq: ('W' | 'L')[];
  seqStr: string;
  winCount: number;
  lossCount: number;
  details: string[];
  terminatedEarly: boolean;
  terminationReason?: string;
} {
  const payoutDec = payoutPct / 100;
  let pnl = 0;
  const executedSeq: ('W' | 'L')[] = [];
  const details: string[] = [];

  let winCount = 0;
  let lossCount = 0;
  let sorosStep = 0;
  let isGaleStep = false;
  let currentStake = baseStake;
  let terminatedEarly = false;
  let terminationReason = '';

  for (let idx = 0; idx < seq.length; idx++) {
    const res = seq[idx];
    const currentBalance = baseCapital + pnl;

    // Check 1: Meta de Lucro Diária Atingida (Take Profit)
    if (dailyProfitTarget > 0 && pnl >= dailyProfitTarget) {
      terminatedEarly = true;
      terminationReason = 'Meta Batida 🎯';
      break;
    }

    // Check 2: Conta Zerada (Saldo <= 0)
    if (currentBalance <= 0) {
      terminatedEarly = true;
      terminationReason = 'Zerou a Conta 🛑';
      break;
    }

    // Check 3: Stop Loss Diário Atingido
    if (dailyLossLimit > 0 && pnl <= -dailyLossLimit) {
      terminatedEarly = true;
      terminationReason = 'Stop Loss Atingido 🔒';
      break;
    }

    // Stake dinâmica necessária para a entrada
    let requiredStake = baseStake;
    if (model === 'SOROS_1' || model === 'SOROS_2' || model === 'SOROS_3') {
      requiredStake = currentStake;
    } else if (model === 'MARTINGALE') {
      requiredStake = isGaleStep ? baseStake * 2 : baseStake;
    } else if (model === 'SOROSGALE') {
      requiredStake = isGaleStep ? Math.round(baseStake * 1.5 * 100) / 100 : baseStake;
    } else if (model === 'KELLY') {
      const b = payoutPct / 100;
      const p = winRatePct / 100;
      const q = 1 - p;
      const kellyPctRaw = b > 0 ? ((b * p - q) / b) * 100 : 0;
      const kellyPct = Math.max(0.5, Math.min(10, Math.round(kellyPctRaw * 10) / 10));
      requiredStake = Math.max(1, (currentBalance * kellyPct) / 100);
    }

    // Check 4: Saldo Insuficiente para a entrada
    if (currentBalance < requiredStake) {
      terminatedEarly = true;
      terminationReason = 'Saldo Insuficiente ⚠️';
      break;
    }

    executedSeq.push(res);

    if (model === 'MAO_FIXA') {
      if (res === 'W') {
        winCount++;
        const profit = baseStake * payoutDec;
        pnl += profit;
        details.push(`T${idx + 1}: W (+${formatCurrency(profit)})`);
      } else {
        lossCount++;
        pnl -= baseStake;
        details.push(`T${idx + 1}: L (-${formatCurrency(baseStake)})`);
      }
    } else if (model === 'SOROS_1') {
      const stakeThisTrade = currentStake;
      if (res === 'W') {
        winCount++;
        const profit = stakeThisTrade * payoutDec;
        pnl += profit;
        if (sorosStep === 0) {
          sorosStep = 1;
          currentStake = baseStake + profit;
          details.push(`T${idx + 1}: W 1ª (+${formatCurrency(profit)})`);
        } else {
          sorosStep = 0;
          currentStake = baseStake;
          details.push(`T${idx + 1}: W Soros 1! 🎉 (+${formatCurrency(profit)})`);
        }
      } else {
        lossCount++;
        pnl -= stakeThisTrade;
        details.push(`T${idx + 1}: L Soros (-${formatCurrency(stakeThisTrade)})`);
        sorosStep = 0;
        currentStake = baseStake;
      }
    } else if (model === 'SOROS_2') {
      const stakeThisTrade = currentStake;
      if (res === 'W') {
        winCount++;
        const profit = stakeThisTrade * payoutDec;
        pnl += profit;
        if (sorosStep < 2) {
          sorosStep++;
          currentStake = currentStake + profit;
          details.push(`T${idx + 1}: W Mão ${sorosStep} (+${formatCurrency(profit)})`);
        } else {
          sorosStep = 0;
          currentStake = baseStake;
          details.push(`T${idx + 1}: W Soros 2! 🎉 (+${formatCurrency(profit)})`);
        }
      } else {
        lossCount++;
        pnl -= stakeThisTrade;
        details.push(`T${idx + 1}: L Soros (-${formatCurrency(stakeThisTrade)})`);
        sorosStep = 0;
        currentStake = baseStake;
      }
    } else if (model === 'SOROS_3') {
      const stakeThisTrade = currentStake;
      if (res === 'W') {
        winCount++;
        const profit = stakeThisTrade * payoutDec;
        pnl += profit;
        if (sorosStep < 3) {
          sorosStep++;
          currentStake = currentStake + profit;
          details.push(`T${idx + 1}: W Mão ${sorosStep} (+${formatCurrency(profit)})`);
        } else {
          sorosStep = 0;
          currentStake = baseStake;
          details.push(`T${idx + 1}: W Soros 3! 🚀 (+${formatCurrency(profit)})`);
        }
      } else {
        lossCount++;
        pnl -= stakeThisTrade;
        details.push(`T${idx + 1}: L Soros (-${formatCurrency(stakeThisTrade)})`);
        sorosStep = 0;
        currentStake = baseStake;
      }
    } else if (model === 'SOROSGALE') {
      if (res === 'W') {
        winCount++;
        const profit = requiredStake * payoutDec;
        pnl += profit;
        details.push(`T${idx + 1}: W ${isGaleStep ? '(Gale)' : ''} (+${formatCurrency(profit)})`);
        isGaleStep = false;
      } else {
        lossCount++;
        pnl -= requiredStake;
        details.push(`T${idx + 1}: L (-${formatCurrency(requiredStake)})`);
        isGaleStep = !isGaleStep;
      }
    } else if (model === 'MARTINGALE') {
      if (res === 'W') {
        winCount++;
        const profit = requiredStake * payoutDec;
        pnl += profit;
        details.push(`T${idx + 1}: W ${isGaleStep ? '(Martingale)' : ''} (+${formatCurrency(profit)})`);
        isGaleStep = false;
      } else {
        lossCount++;
        pnl -= requiredStake;
        details.push(`T${idx + 1}: L (-${formatCurrency(requiredStake)})`);
        isGaleStep = !isGaleStep;
      }
    } else if (model === 'KELLY') {
      if (res === 'W') {
        winCount++;
        const profit = requiredStake * payoutDec;
        pnl += profit;
        details.push(`T${idx + 1}: W (+${formatCurrency(profit)})`);
      } else {
        lossCount++;
        pnl -= requiredStake;
        details.push(`T${idx + 1}: L (-${formatCurrency(requiredStake)})`);
      }
    }

    // Check pós-operação: se bateu a meta com o último lucro, encerra a sessão
    if (dailyProfitTarget > 0 && pnl >= dailyProfitTarget) {
      terminatedEarly = true;
      terminationReason = 'Meta Batida 🎯';
      break;
    }
  }

  const roundedPnl = Math.round(pnl * 100) / 100;
  const seqStr = executedSeq.join('-');

  return {
    pnl: roundedPnl,
    executedSeq,
    seqStr,
    winCount,
    lossCount,
    details,
    terminatedEarly,
    terminationReason,
  };
}

/**
 * Gera todas as 2^N permutações de sequências de Wins ('W') e Losses ('L')
 */
function generateAllSequences(n: number): ('W' | 'L')[][] {
  const total = Math.pow(2, n);
  const result: ('W' | 'L')[][] = [];

  for (let i = 0; i < total; i++) {
    const seq: ('W' | 'L')[] = [];
    for (let bit = n - 1; bit >= 0; bit--) {
      const isWin = ((i >> bit) & 1) === 0;
      seq.push(isWin ? 'W' : 'L');
    }
    result.push(seq);
  }

  return result;
}

export const RiskManagementPage: React.FC<RiskManagementPageProps> = ({
  settings,
  currentCapital,
  todayPnl,
  todayTradesCount,
  isStopHit,
  isMaxTradesHit,
  onSaveSettings,
  onBackToJournal,
}) => {
  // Form State
  const [initialCapital, setInitialCapital] = useState<number>(settings.initialCapital ?? 10000);
  const [dailyProfitTarget, setDailyProfitTarget] = useState<number>(settings.dailyProfitTarget ?? 500);
  const [dailyLossLimit, setDailyLossLimit] = useState<number>(settings.dailyLossLimit ?? 300);
  const [monthlyProfitTarget, setMonthlyProfitTarget] = useState<number>(settings.monthlyProfitTarget ?? 5000);
  const [monthlyLossLimit, setMonthlyLossLimit] = useState<number>(settings.monthlyLossLimit ?? 2000);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(settings.maxTradesPerDay ?? 5);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState<boolean>(settings.alertSoundEnabled ?? true);
  const [antiFuriaCustomWindowEnabled, setAntiFuriaCustomWindowEnabled] = useState<boolean>(settings.antiFuriaCustomWindowEnabled ?? false);
  const [antiFuriaStartTime, setAntiFuriaStartTime] = useState<string>(settings.antiFuriaStartTime ?? '07:00');
  const [antiFuriaEndTime, setAntiFuriaEndTime] = useState<string>(settings.antiFuriaEndTime ?? '11:30');

  // Commitment Lock Period State
  const [lockDurationDays, setLockDurationDays] = useState<number>(settings.riskLockDurationDays ?? 7);
  const [riskLockUntil, setRiskLockUntil] = useState<string | undefined>(settings.riskLockUntil);

  // Management Calculator State
  const [managementStyle, setManagementStyle] = useState<'MAO_FIXA' | 'SOROS_1' | 'SOROS_2' | 'SOROS_3' | 'SOROSGALE' | 'MARTINGALE' | 'KELLY'>(
    settings.managementStyle ?? 'MAO_FIXA'
  );
  const [payout, setPayout] = useState<number>(settings.estimatedPayout ?? 87);
  const [winRate, setWinRate] = useState<number>(settings.estimatedWinRate ?? 65);

  // Stake input mode: PERCENT (%) vs FIXED (R$)
  const [stakeMode, setStakeMode] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [stakeValue, setStakeValue] = useState<number>(settings.stakePercent ?? 2);

  // Time remaining calculation for active lock
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('');
  const [isCurrentlyLocked, setIsCurrentlyLocked] = useState<boolean>(false);

  useEffect(() => {
    const updateLockStatus = () => {
      if (!settings.riskLockUntil) {
        setIsCurrentlyLocked(false);
        setTimeRemainingStr('');
        return;
      }

      const lockTime = new Date(settings.riskLockUntil).getTime();
      const now = Date.now();
      const diff = lockTime - now;

      if (diff <= 0) {
        setIsCurrentlyLocked(false);
        setTimeRemainingStr('Compromisso Concluído');
      } else {
        setIsCurrentlyLocked(true);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeRemainingStr(`${days}d ${hours}h ${minutes}m`);
        } else {
          setTimeRemainingStr(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    };

    updateLockStatus();
    const interval = setInterval(updateLockStatus, 1000);
    return () => clearInterval(interval);
  }, [settings.riskLockUntil]);

  // Calculations for Stake
  const baseCapital = currentCapital > 0 ? currentCapital : initialCapital;

  let stakeAmount = 0;
  let stakePercentCalc = 0;

  if (stakeMode === 'PERCENT') {
    stakePercentCalc = Math.max(0.1, Math.min(100, stakeValue));
    stakeAmount = Math.max(1, (baseCapital * (stakePercentCalc / 100)));
  } else {
    stakeAmount = Math.max(1, stakeValue);
    stakePercentCalc = baseCapital > 0 ? (stakeAmount / baseCapital) * 100 : 0;
  }

  const singleWinProfit = stakeAmount * (payout / 100);

  // Soros sequence returns
  const soros1Profit = singleWinProfit + ((stakeAmount + singleWinProfit) * (payout / 100));
  const soros2Return = (stakeAmount + singleWinProfit) + (stakeAmount + singleWinProfit) * (payout / 100);
  const soros2Profit = soros2Return * (payout / 100) + (soros2Return - stakeAmount);
  const soros3Profit = (stakeAmount * Math.pow(1 + payout / 100, 4)) - stakeAmount;

  // Kelly Criterion Optimal Stake %
  const b = payout / 100;
  const p = winRate / 100;
  const q = 1 - p;
  const kellyPctRaw = b > 0 ? ((b * p - q) / b) * 100 : 0;
  const kellyPct = Math.max(0, Math.min(10, Math.round(kellyPctRaw * 10) / 10));
  const kellyStake = (baseCapital * kellyPct) / 100;

  // ── EXACT MATHEMATICAL REALISTIC SEQUENCE SIMULATOR ──
  const totalTrades = Math.max(1, Math.min(6, maxTradesPerDay));
  const rawSequences = generateAllSequences(totalTrades);

  // Run realistic simulation for each permutation considering early account breakdown / stop loss
  const evaluatedMap = new Map<string, any>();

  rawSequences.forEach((seq) => {
    const res = simulateSequence(seq, managementStyle, stakeAmount, payout, winRate, baseCapital, dailyLossLimit, dailyProfitTarget);
    
    // Deduplicate sequences that collapsed into the same early-terminated execution path
    if (!evaluatedMap.has(res.seqStr)) {
      const totalExec = res.executedSeq.length;
      evaluatedMap.set(res.seqStr, {
        ...res,
        totalExec,
        capitalPct: baseCapital > 0 ? Math.round((res.pnl / baseCapital) * 1000) / 10 : 0,
        winRatePct: totalExec > 0 ? Math.round((res.winCount / totalExec) * 100) : 0,
      });
    }
  });

  const evaluatedSequences = Array.from(evaluatedMap.values());
  // Sort sequences by PnL descending (Best scenario to worst scenario)
  evaluatedSequences.sort((a, b) => b.pnl - a.pnl);

  // Projections over lockDurationDays
  const daysInPeriod = lockDurationDays;
  const expDailyWins = totalTrades * p;
  const expDailyLosses = totalTrades * q;
  const expDailyPnl = (expDailyWins * singleWinProfit) - (expDailyLosses * stakeAmount);
  const expPeriodPnl = expDailyPnl * daysInPeriod;

  const handleSave = () => {
    let newLockUntil = riskLockUntil;

    if (!isCurrentlyLocked) {
      const lockDate = new Date();
      lockDate.setDate(lockDate.getDate() + lockDurationDays);
      newLockUntil = lockDate.toISOString();
    }

    const updated: RiskSettings = {
      initialCapital,
      dailyProfitTarget,
      dailyLossLimit,
      monthlyProfitTarget,
      monthlyLossLimit,
      maxTradesPerDay,
      alertSoundEnabled,
      antiFuriaCustomWindowEnabled,
      antiFuriaStartTime,
      antiFuriaEndTime,
      riskLockUntil: newLockUntil,
      riskLockDurationDays: lockDurationDays,
      managementStyle,
      estimatedPayout: payout,
      estimatedWinRate: winRate,
      stakePercent: Math.round(stakePercentCalc * 10) / 10,
    };

    onSaveSettings(updated);
    alert(`🔒 Plano de Gestão de Risco salvo e Trancado por ${lockDurationDays} dias! Suas regras estão blindadas até ${new Date(newLockUntil!).toLocaleString('pt-BR')}.`);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToJournal}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao Diário</span>
            </button>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-900/30">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Gestão de Risco &amp; Metas Invioláveis
                  </h1>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-400 border border-emerald-500/30">
                    TradeLock Shield
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Defina o período de compromisso e a matriz matemática que protegerá seu capital.
                </p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-3">
            {isCurrentlyLocked ? (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-600/50 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-300 shadow-lg shadow-rose-950/50">
                <Lock className="h-4 w-4 text-rose-400 animate-pulse" />
                <span>TRANCADO 🔒 ({timeRemainingStr})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-3.5 py-2 text-xs font-bold text-emerald-300">
                <Unlock className="h-4 w-4 text-emerald-400" />
                <span>GESTAO EDITÁVEL 🔓</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Banner Alert for Active Lock */}
        {isCurrentlyLocked && (
          <div className="rounded-3xl border-2 border-rose-600/80 bg-rose-950/40 p-6 shadow-2xl shadow-rose-900/30 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-900/50">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    🔒 Compromisso de Gestão em Andamento
                  </h3>
                  <p className="text-xs text-rose-200 mt-1">
                    Você trancou seu plano de risco até{' '}
                    <strong className="text-white">
                      {new Date(settings.riskLockUntil!).toLocaleString('pt-BR')}
                    </strong>
                    . As regras não podem ser afrouxadas nem desativadas em momento de fúria!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-black/60 px-4 py-2.5 rounded-2xl border border-rose-600/40 self-end sm:self-auto font-mono">
                <Clock className="h-4 w-4 text-rose-400" />
                <span className="text-xs font-bold text-white">
                  Tempo Restante: <span className="text-rose-400 font-extrabold">{timeRemainingStr}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 1: Commitment Duration Selection */}
        <section className="rounded-3xl border border-slate-800 bg-black/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-400" />
                1. Selecione o Tempo de Compromisso (Trava de Gestão)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Determine por quanto tempo este plano de risco ficará trancado. Durante este período, o sistema impede qualquer alteração que afrouxe seu stop.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { days: 1, label: '1 Dia', desc: 'Sessão Atual' },
              { days: 3, label: '3 Dias', desc: 'Curto Prazo' },
              { days: 7, label: '7 Dias (1 Sem)', desc: 'Recomendado ⭐' },
              { days: 14, label: '14 Dias (2 Sem)', desc: 'Consistência' },
              { days: 30, label: '30 Dias (1 Mês)', desc: 'Profissional 🏆' },
            ].map((option) => (
              <button
                key={option.days}
                type="button"
                disabled={isCurrentlyLocked}
                onClick={() => setLockDurationDays(option.days)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                  lockDurationDays === option.days
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/50 font-bold'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } ${isCurrentlyLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Clock className={`h-5 w-5 mb-2 ${lockDurationDays === option.days ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="text-sm font-bold">{option.label}</span>
                <span className="text-[10px] opacity-75 mt-1">{option.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 2: Risk Settings Form */}
        <section className="rounded-3xl border border-slate-800 bg-black/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                2. Parâmetros de Risco &amp; Limites Invioláveis
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure os limites exatos de perda e metas de lucro para o seu diário e extensão Anti-Fúria.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Capital Inicial (Removida a expressão "banca base") */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Capital Inicial (R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked}
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">Valor real disponível do trader para cálculo de risco e travas.</p>
            </div>

            {/* Limite de Perda Diário (Stop Loss) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
                <span>Limite de Perda Diário (Stop Loss R$)</span>
                {(isCurrentlyLocked || isStopHit) && <Lock className="h-3.5 w-3.5 text-rose-400" />}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-rose-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked || isStopHit}
                  value={dailyLossLimit}
                  onChange={(e) => setDailyLossLimit(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-rose-900/60 bg-rose-950/20 pl-10 pr-4 py-2.5 text-sm font-bold text-rose-300 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
              <p className="text-[11px] text-rose-400/80">
                {isStopHit ? '🔒 Bloqueado: Stop Loss atingido no dia de hoje!' : 'Valor máximo aceitável de perda por dia.'}
              </p>
            </div>

            {/* Meta de Lucro Diária (Take Profit) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                Meta de Lucro Diária (Take Profit R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-emerald-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked}
                  value={dailyProfitTarget}
                  onChange={(e) => setDailyProfitTarget(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-emerald-900/60 bg-emerald-950/20 pl-10 pr-4 py-2.5 text-sm font-bold text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
              <p className="text-[11px] text-emerald-400/80">Meta financeira desejada ao encerrar o dia de trading.</p>
            </div>

            {/* Meta Mensal */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Meta de Lucro Mensal (R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked}
                  value={monthlyProfitTarget}
                  onChange={(e) => setMonthlyProfitTarget(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {/* Limite de Perda Mensal */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Limite de Perda Mensal (R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked}
                  value={monthlyLossLimit}
                  onChange={(e) => setMonthlyLossLimit(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {/* Limite Máximo de Operações Diárias */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                <span>Máximo de Operações no Dia</span>
                {(isCurrentlyLocked || isMaxTradesHit) && <Lock className="h-3.5 w-3.5 text-amber-400" />}
              </label>
              <div className="relative">
                <Layers className="absolute left-3.5 top-3 h-4 w-4 text-amber-500" />
                <input
                  type="number"
                  disabled={isCurrentlyLocked || isMaxTradesHit}
                  value={maxTradesPerDay}
                  onChange={(e) => setMaxTradesPerDay(Math.max(1, Math.min(10, Number(e.target.value))))}
                  className="w-full rounded-2xl border border-amber-900/60 bg-amber-950/20 pl-10 pr-4 py-2.5 text-sm font-bold text-amber-300 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
              </div>
              <p className="text-[11px] text-amber-400/80">Parametriza o simulador realista da sessão diária abaixo.</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: Advanced Management Calculator & Realistic Simulator */}
        <section className="rounded-3xl border border-slate-800 bg-black/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-400" />
                3. Calculadora de Gestão de Entradas &amp; Projeção Profissional
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Calcule a stake ideal e simule os cenários reais da sua sessão considerando interrupção por quebra de saldo ou Stop Loss.
              </p>
            </div>

            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Calculadora Inteligente
            </span>
          </div>

          {/* Style Selector Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Modelo de Gestão Operacional
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { key: 'MAO_FIXA', label: 'Mão Fixa', desc: 'Conservador' },
                { key: 'SOROS_1', label: 'Soros Nível 1', desc: '1 Mão Lucro' },
                { key: 'SOROS_2', label: 'Soros Nível 2', desc: '2 Mãos Lucro' },
                { key: 'SOROS_3', label: 'Soros Nível 3', desc: 'Alavancagem' },
                { key: 'SOROSGALE', label: 'SorosGale', desc: 'Protegido' },
                { key: 'MARTINGALE', label: 'Martingale', desc: '1 Nível Max' },
                { key: 'KELLY', label: 'Critério Kelly', desc: 'Matemático' },
              ].map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setManagementStyle(style.key as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                    managementStyle === style.key
                      ? 'border-blue-500 bg-blue-950/40 text-blue-300 ring-2 ring-blue-500/30 shadow-lg font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold">{style.label}</span>
                  <span className="text-[10px] opacity-75 mt-0.5">{style.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs for Calculator: Payout, WinRate, Mode Toggle + Stake Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Payout Médio da Corretora (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  value={payout}
                  onChange={(e) => setPayout(Math.max(1, Math.min(100, Number(e.target.value))))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Assertividade Estimada / Win Rate (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  value={winRate}
                  onChange={(e) => setWinRate(Math.max(1, Math.min(99, Number(e.target.value))))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Investimento por Entrada (% vs R$) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Investimento por Entrada
                </label>

                {/* Mode Selector Toggle: % vs R$ */}
                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setStakeMode('PERCENT');
                      setStakeValue(Math.round(stakePercentCalc * 10) / 10 || 2);
                    }}
                    className={`px-2 py-0.5 rounded ${
                      stakeMode === 'PERCENT'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    % Percentual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStakeMode('FIXED');
                      setStakeValue(Math.round(stakeAmount) || 50);
                    }}
                    className={`px-2 py-0.5 rounded ${
                      stakeMode === 'FIXED'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    R$ Valor Fixo
                  </button>
                </div>
              </div>

              <div className="relative">
                {stakeMode === 'PERCENT' ? (
                  <Percent className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                ) : (
                  <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                )}
                <input
                  type="number"
                  value={stakeValue}
                  onChange={(e) => setStakeValue(Math.max(0.1, Number(e.target.value)))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {stakeMode === 'PERCENT'
                  ? `Equivale a ${formatCurrency(stakeAmount)} por trade.`
                  : `Equivale a ${stakePercentCalc.toFixed(1)}% do seu capital.`}
              </p>
            </div>
          </div>

          {/* Calculator Output Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Stake Recomendada (1ª Entrada)</span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {formatCurrency(stakeAmount)}
              </span>
              <span className="text-[11px] text-slate-500 block">({stakePercentCalc.toFixed(1)}% de {formatCurrency(baseCapital)})</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Lucro por Vitória Simples</span>
              <span className="text-xl font-black font-mono text-blue-400">
                +{formatCurrency(singleWinProfit)}
              </span>
              <span className="text-[11px] text-slate-500 block">(Payout {payout}%)</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {managementStyle.startsWith('SOROS') ? 'Lucro da Sequência Soros' : 'Kelly Optimal Stake'}
              </span>
              <span className="text-xl font-black font-mono text-teal-300">
                {managementStyle === 'SOROS_1' && `+${formatCurrency(soros1Profit)}`}
                {managementStyle === 'SOROS_2' && `+${formatCurrency(soros2Profit)}`}
                {managementStyle === 'SOROS_3' && `+${formatCurrency(soros3Profit)}`}
                {managementStyle === 'KELLY' && formatCurrency(kellyStake)}
                {!managementStyle.startsWith('SOROS') && managementStyle !== 'KELLY' && `+${formatCurrency(singleWinProfit)}`}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {managementStyle === 'KELLY' ? `Fração matemática: ${kellyPct}%` : 'Mão de alavancagem'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Projeção ({lockDurationDays} Dias Estimados)</span>
              <span className={`text-xl font-black font-mono ${expPeriodPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {expPeriodPnl >= 0 ? '+' : ''}{formatCurrency(expPeriodPnl)}
              </span>
              <span className="text-[11px] text-slate-500 block">(Baseado na assertividade {winRate}%)</span>
            </div>
          </div>

          {/* DYNAMIC REALISTIC SESSION SIMULATION BASED ON ACTUAL CAPITAL & STOP LOSS */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-emerald-400" />
                  Simulador de Cenários Reais da Sessão ({evaluatedSequences.length} Sequências Possíveis)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulação profissional trade a trade considerando interrupção por quebra de capital ({formatCurrency(baseCapital)}) ou Stop Loss ({formatCurrency(dailyLossLimit)}) no modelo{' '}
                  <strong className="text-emerald-400">
                    {managementStyle === 'MAO_FIXA' && 'Mão Fixa'}
                    {managementStyle === 'SOROS_1' && 'Soros Nível 1'}
                    {managementStyle === 'SOROS_2' && 'Soros Nível 2'}
                    {managementStyle === 'SOROS_3' && 'Soros Nível 3'}
                    {managementStyle === 'SOROSGALE' && 'SorosGale'}
                    {managementStyle === 'MARTINGALE' && 'Martingale'}
                    {managementStyle === 'KELLY' && 'Critério de Kelly'}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-300 shrink-0">
                <span className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1">
                  Capital: <strong className="text-emerald-400">{formatCurrency(baseCapital)}</strong>
                </span>
              </div>
            </div>

            {/* Interactive Table of Realistic Permutations */}
            <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-800 bg-black/60 scrollbar-thin scrollbar-thumb-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 z-10">
                  <tr>
                    <th className="p-3">Sequência Executada (Trades Reais)</th>
                    <th className="p-3 text-center">Placar da Sessão</th>
                    <th className="p-3 text-center">Status da Sessão</th>
                    <th className="p-3 text-right">Resultado PnL (R$)</th>
                    <th className="p-3 text-right">Impacto no Capital (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {evaluatedSequences.map((sc, idx) => {
                    const isPositive = sc.pnl > 0.001;
                    const isNegative = sc.pnl < -0.001;

                    const seqBadges = sc.executedSeq.map((res: string, i: number) => (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center h-5 w-5 rounded font-black text-[10px] ${
                          res === 'W'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                        title={`Trade ${i + 1}: ${res === 'W' ? 'Vitória' : 'Derrota'}`}
                      >
                        {res}
                      </span>
                    ));

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          sc.terminatedEarly
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : isPositive
                            ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        {/* Sequência Executada em badges coloridos */}
                        <td className="p-3 whitespace-nowrap font-sans font-bold text-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              {seqBadges}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({sc.totalExec} {sc.totalExec === 1 ? 'trade' : 'trades'})
                            </span>
                          </div>
                        </td>

                        {/* Placar */}
                        <td className="p-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-bold text-xs">
                            <span className="text-emerald-400">{sc.winCount}W</span>
                            <span className="text-slate-600">x</span>
                            <span className="text-rose-400">{sc.lossCount}L</span>
                          </span>
                        </td>

                        {/* Status da Sessão (Ex: 🏆 Meta Batida, 🛑 Zerou a Conta, 🔒 Stop Atingido) */}
                        <td className="p-3 whitespace-nowrap text-center">
                          {sc.terminatedEarly ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-300 border border-rose-500/30">
                              {sc.terminationReason}
                            </span>
                          ) : isPositive ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 border border-emerald-500/30">
                              Meta/Sessão Concluída 🟢
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                              Sessão Encerrada ⚪
                            </span>
                          )}
                        </td>

                        {/* PnL da Sequência Real */}
                        <td className="p-3 whitespace-nowrap text-right font-black">
                          <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}>
                            {sc.pnl > 0 ? '+' : ''}{formatCurrency(sc.pnl)}
                          </span>
                        </td>

                        {/* Impacto no capital */}
                        <td className="p-3 whitespace-nowrap text-right font-bold">
                          <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}>
                            {sc.capitalPct > 0 ? '+' : ''}{sc.capitalPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onBackToJournal}
            className="px-5 py-3 rounded-2xl border border-slate-800 bg-slate-900 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isCurrentlyLocked}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3 text-sm font-extrabold text-white shadow-xl shadow-emerald-950/60 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="h-4 w-4" />
            <span>Salvar &amp; Trancar Plano de Gestão ({lockDurationDays} Dias)</span>
          </button>
        </div>
      </main>
    </div>
  );
};
