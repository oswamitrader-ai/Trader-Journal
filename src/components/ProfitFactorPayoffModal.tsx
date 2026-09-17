import React, { useState } from 'react';
import {
  X,
  Scale,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Zap,
  HelpCircle,
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import { OverallMetrics } from '../types';
import { formatCurrency } from '../utils/calculations';

interface ProfitFactorPayoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: OverallMetrics;
}

export const ProfitFactorPayoffModal: React.FC<ProfitFactorPayoffModalProps> = ({
  isOpen,
  onClose,
  metrics,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profitFactor' | 'payoff' | 'breakeven'>('overview');

  if (!isOpen) return null;

  // Status diagnostics
  const pf = metrics?.profitFactor ?? 0;
  const payoff = metrics?.payoff ?? 0;
  const winRate = metrics?.winRate ?? 0;
  const avgWin = metrics?.avgWin ?? 0;
  const avgLoss = metrics?.avgLoss ?? 0;

  let pfStatus = {
    label: 'Prejuízo',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    desc: 'O total de perdas supera o total de ganhos. Reveja disciplina e stop.',
  };
  if (pf >= 1.6) {
    pfStatus = {
      label: 'Excelente / Alta Performance',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      desc: 'Operacional altamente rentável com ganhos expressivos sobre as perdas.',
    };
  } else if (pf >= 1.25) {
    pfStatus = {
      label: 'Bom e Consistente',
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/30',
      desc: 'Zona saudável de consistência no longo prazo.',
    };
  } else if (pf >= 1.0) {
    pfStatus = {
      label: 'Breakeven / Empate Tênue',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
      desc: 'Equilíbrio no limite. Pouca margem de segurança contra sequências de loss.',
    };
  }

  let payoffStatus = {
    label: 'Abaixo da Média de OB',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
  };
  if (payoff >= 1.15) {
    payoffStatus = {
      label: 'Excelente (Típico com Soros)',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/30',
    };
  } else if (payoff >= 0.82) {
    payoffStatus = {
      label: 'Padrão Saudável de Opções Binárias',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    };
  } else if (payoff >= 0.75) {
    payoffStatus = {
      label: 'Atenção aos Payouts da Corretora',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
    };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md animate-fade-in pt-safe pb-safe"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2">
                Fator de Lucro &amp; Payoff em OB
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1">
                Guia matemático, referências ideais e diagnóstico da sua conta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Metrics Diagnosis Banner (Compact and Responsive) */}
        <div className="bg-slate-950/70 border-b border-slate-800/80 px-3 sm:px-5 py-2 sm:py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
            {/* Profit Factor */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Fator de Lucro
              </span>
              <div className="mt-0.5 sm:mt-1 flex items-center justify-center gap-1.5">
                <span className="text-base sm:text-xl font-black font-mono text-purple-300">
                  {pf.toFixed(2)}
                </span>
              </div>
              <span className={`inline-block mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full border truncate max-w-full ${pfStatus.bg} ${pfStatus.color}`}>
                {pfStatus.label}
              </span>
            </div>

            {/* Payoff */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Payoff Médio
              </span>
              <div className="mt-0.5 sm:mt-1 flex items-center justify-center gap-1.5">
                <span className="text-base sm:text-xl font-black font-mono text-white">
                  1 : {payoff.toFixed(2)}
                </span>
              </div>
              <span className={`inline-block mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full border truncate max-w-full ${payoffStatus.bg} ${payoffStatus.color}`}>
                {payoff >= 1.0 ? 'Payoff Positivo' : 'Payoff OB (~0.85)'}
              </span>
            </div>

            {/* Win Rate */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Assertividade
              </span>
              <div className="mt-0.5 sm:mt-1 flex items-center justify-center gap-1.5">
                <span className={`text-base sm:text-xl font-black font-mono ${winRate >= 55 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {winRate.toFixed(1)}%
                </span>
              </div>
              <span className="inline-block mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-slate-400 truncate max-w-full">
                {winRate >= 55 ? 'Acima do Breakeven' : 'Meta: > 54%'}
              </span>
            </div>

            {/* Gain vs Loss Average */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Méd. Gain / Loss
              </span>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-mono text-slate-200 truncate">
                <span className="text-emerald-400 font-bold">{formatCurrency(avgWin)}</span>
                <span className="text-slate-500 mx-0.5 sm:mx-1">/</span>
                <span className="text-rose-400 font-bold">{formatCurrency(avgLoss)}</span>
              </div>
              <span className="inline-block mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-slate-400 truncate max-w-full">
                {avgLoss > 0 ? `Payout: ${((avgWin / avgLoss) * 100).toFixed(0)}%` : 'Sem losses'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Explicit shrink-0, sticky and fully visible on mobile */}
        <div className="border-b border-slate-800 bg-slate-950 px-3 sm:px-5 py-2 shrink-0 z-20">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 ${
                activeTab === 'overview'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 bg-slate-900/60 border border-slate-800/80'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              <span>Visão Geral OB</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profitFactor')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 ${
                activeTab === 'profitFactor'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 bg-slate-900/60 border border-slate-800/80'
              }`}
            >
              <Scale className="w-3.5 h-3.5 shrink-0" />
              <span>Fator de Lucro</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payoff')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 ${
                activeTab === 'payoff'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 bg-slate-900/60 border border-slate-800/80'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Payoff em OB</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('breakeven')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 ${
                activeTab === 'breakeven'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 bg-slate-900/60 border border-slate-800/80'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span>Matemática &amp; Dicas</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm text-slate-300">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-purple-950/20 border border-purple-800/40 p-4">
                <h4 className="text-purple-300 font-bold text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-400" />
                  Por que estas métricas são vitais para o Trader de Opções Binárias?
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Em Opções Binárias, o mercado possui uma regra fixa: você arrisca <strong>100% da mão</strong> para ganhar uma porcentagem de <strong>payout</strong> (geralmente entre 80% e 90%). 
                  Isso significa que a vantagem estatística da corretora está embutida em cada clique.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Para ser lucrativo e consistente no longo prazo, o trader de OB depende de duas forças combinadas:
                  um <strong>Fator de Lucro acima de 1.25</strong> (disciplina no stop) e o alinhamento da sua <strong>Assertividade</strong> com o <strong>Payoff</strong> do gerenciamento adotado (Mão Fixa ou Soros).
                </p>
              </div>

              {/* Two Column summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Summary Profit Factor */}
                <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-purple-400" />
                      Fator de Lucro
                    </span>
                    <span className="text-xs text-purple-300 font-mono font-bold">Ideal: &gt; 1.40</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Mostra quantos reais você coloca no bolso para cada R$ 1,00 que perde no somatório total de todas as operações.
                  </p>
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                    <span className="text-slate-400">Fórmula:</span> Total Ganho ÷ Total Perdido
                  </div>
                  <div className="mt-2.5 text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Seu resultado atual: <strong>{pf.toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Summary Payoff */}
                <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-teal-400" />
                      Payoff (Risco/Retorno)
                    </span>
                    <span className="text-xs text-teal-300 font-mono font-bold">Padrão OB: 0.80 a 0.90</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Relação entre o ganho médio nas operações vitoriosas e a perda média nas derrotas. Em OB de mão fixa, reflete o payout médio.
                  </p>
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                    <span className="text-slate-400">Fórmula:</span> Ganho Médio ÷ Perda Média
                  </div>
                  <div className="mt-2.5 text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Seu resultado atual: <strong>1 : {payoff.toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profitFactor' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-bold text-sm">Escala de Referência para Fator de Lucro (Profit Factor)</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Use esta tabela para classificar a solidez do seu operacional em Opções Binárias:
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs min-w-[340px]">
                  <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Faixa de Valor</th>
                      <th className="px-3.5 py-2.5">Classificação</th>
                      <th className="px-3.5 py-2.5">O que significa na prática para OB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-sans">
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-rose-400">&lt; 1,00</td>
                      <td className="px-3.5 py-2.5 font-medium text-rose-400">Prejuízo</td>
                      <td className="px-3.5 py-2.5 text-slate-300">
                        O total que você perdeu supera o total ganho. Comum em quem tenta recuperar no mesmo dia (dia de fúria) ou não respeita o stop loss.
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-amber-400">1,00 a 1,20</td>
                      <td className="px-3.5 py-2.5 font-medium text-amber-400">Breakeven Frágil</td>
                      <td className="px-3.5 py-2.5 text-slate-300">
                        Você está empatando ou lucrando centavos. Qualquer dia com 2 derrotas consecutivas pode apagar semanas de resultado.
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-teal-400">1,25 a 1,60</td>
                      <td className="px-3.5 py-2.5 font-medium text-teal-400">Bom &amp; Consistente</td>
                      <td className="px-3.5 py-2.5 text-slate-300">
                        Padrão saudável de traders disciplinados de OB. Mostra que quando bate a meta, você encerra a sessão sem devolver.
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 bg-purple-950/20">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-purple-300">&gt; 1,60</td>
                      <td className="px-3.5 py-2.5 font-medium text-purple-300">Excelente / Alta Performance</td>
                      <td className="px-3.5 py-2.5 text-slate-200">
                        Nível de trader profissional. Combina alta taxa de acerto com gerenciamento rigoroso (ex: 2x0 ou Soros) e baixo rebaixamento.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex items-start gap-3">
                <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Dica de ouro em OB:</strong> O Fator de Lucro é destruído principalmente pela quebra de gerenciamento no Stop Loss. Se você perde R$ 30 por dia quando toma stop (ex: 0x1 ou 0x2), mas ganha R$ 50 nos dias de meta (2x0), seu Fator de Lucro se mantém naturalmente acima de 1,60!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'payoff' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-bold text-sm">O Payoff no Mercado de Opções Binárias</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Por que o Payoff em OB é diferente de outros mercados financeiros (B3/Forex):
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Day Trade Tradicional (B3 / Forex)
                  </span>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Você define onde fica o Stop Loss e onde fica o Take Profit. É comum buscar Payoffs de <strong>1 : 2,00 ou 1 : 3,00</strong> (arriscar 100 pontos para buscar 200 ou 300 pontos).
                  </p>
                  <div className="mt-2 text-[11px] text-emerald-400 font-medium">
                    → Permite ser lucrativo mesmo acertando apenas 40% das operações.
                  </div>
                </div>

                <div className="rounded-xl bg-purple-950/30 border border-purple-800/40 p-3.5">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                    Opções Binárias (Payout Fixo)
                  </span>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    O tempo de expiração é fixo e o risco é assimétrico. No Loss, perde <strong>100%</strong> da mão. No Win, a corretora paga de <strong>80% a 90%</strong> de payout.
                  </p>
                  <div className="mt-2 text-[11px] text-purple-300 font-medium">
                    → Com mão fixa, o Payoff médio fica naturalmente entre <strong>1 : 0,80 e 1 : 0,90</strong>.
                  </div>
                </div>
              </div>

              {/* Payoff reference table for binary options */}
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="bg-slate-950 px-3.5 py-2 font-semibold text-xs text-slate-400 uppercase">
                  Referências de Payoff em Opções Binárias
                </div>
                <div className="divide-y divide-slate-800 bg-slate-900/60 text-xs">
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-rose-400 shrink-0 w-24">&lt; 1 : 0,75</span>
                    <div>
                      <strong className="text-rose-400">Crítico / Inaceitável</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Operar ativos com payouts abaixo de 75% ou fazer martingale descontrolado onde você arrisca valores desproporcionais para lucros pequenos.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 flex items-start gap-3">
                    <span className="font-mono font-bold text-slate-300 shrink-0 w-24">1 : 0,80 a 0,90</span>
                    <div>
                      <strong className="text-slate-200">Padrão Natural de Mão Fixa</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        É a média esperada ao operar com valor de entrada constante em corretoras com payout de 80% a 90%. Exige assertividade acima de 54%.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 flex items-start gap-3 bg-purple-950/20">
                    <span className="font-mono font-bold text-purple-300 shrink-0 w-24">&gt; 1 : 1,10</span>
                    <div>
                      <strong className="text-purple-300">Excelente / Alavancagem com Soros</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Acontece quando o trader utiliza mão de Soros (ex: Soros 2 mãos). O ganho na segunda mão eleva a média de lucro da vitória muito acima do risco inicial da primeira entrada!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'breakeven' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  Ponto de Equilíbrio (Breakeven) em Opções Binárias
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Como o Payoff em OB é inferior a 1, a matemática define com exatidão qual é a taxa de acerto mínima que você precisa ter dependendo do Payout da corretora:
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 sm:p-2.5">
                    <span className="text-slate-400 block text-[11px]">Payout 80%</span>
                    <span className="text-amber-400 font-mono font-bold text-base mt-0.5 block">55,6%</span>
                    <span className="text-[10px] text-slate-500">Mínimo p/ não perder</span>
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 sm:p-2.5">
                    <span className="text-slate-400 block text-[11px]">Payout 85%</span>
                    <span className="text-teal-400 font-mono font-bold text-base mt-0.5 block">54,1%</span>
                    <span className="text-[10px] text-slate-500">Mínimo p/ não perder</span>
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 sm:p-2.5">
                    <span className="text-slate-400 block text-[11px]">Payout 90%</span>
                    <span className="text-emerald-400 font-mono font-bold text-base mt-0.5 block">52,6%</span>
                    <span className="text-[10px] text-slate-500">Mínimo p/ não perder</span>
                  </div>
                </div>
              </div>

              {/* Rules of thumb */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  3 Mandamentos para Vencer a Matemática de OB
                </h5>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">1.</span>
                    <span>
                      <strong>Filtre o Payout:</strong> Nunca opere pares com payout abaixo de 80%. Operar a 70% ou 75% destrói seu Payoff e exige quase 60% de assertividade só para ficar no zero a zero.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">2.</span>
                    <span>
                      <strong>Metas Curtas (ex: 2x0 ou Stop de 1 Loss):</strong> O excesso de operações em OB acumula a desvantagem matemática do payout. Menos cliques com entradas de alta convicção protegem seu Fator de Lucro.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">3.</span>
                    <span>
                      <strong>Cuidado com Martingale:</strong> O Martingale (dobrar a mão após o loss) distorce o Payoff negativamente: arriscar R$ 120 para salvar R$ 15 resulta em um Payoff de 1 : 0,12. Se tomar o loss final, o Fator de Lucro despenca para baixo de 1,00.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-900/90 px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Baseado no seu histórico de {metrics.totalTrades} operações
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
