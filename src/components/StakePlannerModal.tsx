import React, { useState, useMemo } from 'react';
import { X, Target, Brain, ShieldAlert, Zap, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

interface StakePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCapital?: number;
}

type StrategyType = 'FIXED' | 'SOROS' | 'MARTINGALE';

export const StakePlannerModal: React.FC<StakePlannerModalProps> = ({
  isOpen,
  onClose,
  initialCapital = 1000,
}) => {
  const [strategy, setStrategy] = useState<StrategyType>('SOROS');
  const [initialStake, setInitialStake] = useState<number>(50);
  const [payout, setPayout] = useState<number>(85);
  const [levels, setLevels] = useState<number>(3); // Max levels to project

  // Calcular projeção
  const projection = useMemo(() => {
    const pnlRate = payout / 100;
    const steps = [];
    let currentStake = initialStake;
    let accumulatedLoss = 0;
    let accumulatedProfit = 0;

    for (let i = 1; i <= levels; i++) {
      let nextStake = currentStake;
      let potentialProfit = 0;
      let expectedReturn = 0;

      if (strategy === 'FIXED') {
        nextStake = initialStake;
        expectedReturn = nextStake * pnlRate;
        accumulatedProfit += expectedReturn;
      } else if (strategy === 'SOROS') {
        // Soros: Stake anterior + Lucro anterior. Ou seja, se ganhar, aposta tudo de novo.
        if (i === 1) {
          nextStake = initialStake;
        } else {
          // A aposta atual é o que apostou no passo anterior + o lucro daquele passo
          nextStake = steps[i - 2].returnAmount;
        }
        expectedReturn = nextStake * pnlRate;
        // Na prática, em Soros, o lucro acumulado líquido da operação final é a diferença entre o prêmio final e a aposta inicial
      } else if (strategy === 'MARTINGALE') {
        // Martingale: Dobrar ou multiplicar para recuperar. Vamos usar fator 2.2 para cobrir loss + pequeno lucro
        if (i === 1) {
          nextStake = initialStake;
          accumulatedLoss = 0;
        } else {
          accumulatedLoss += steps[i - 2].stake;
          // Próxima entrada precisa cobrir o acumulado perdido + dar o lucro da aposta inicial
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

  // IA Conselho Dinâmico
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
      // MARTINGALE
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
              <p className="text-xs text-slate-400">Simule Mão Fixa, Soros e Martingale com análise da IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
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

        {/* FOOTER */}
        <div className="border-t border-slate-800 bg-black px-6 py-4 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-500 max-w-md">
            Esta ferramenta é apenas um simulador para ajudar na gestão matemática de risco e não substitui o preenchimento de seus trades no diário.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
          >
            Fechar Simulação
          </button>
        </div>
      </div>
    </div>
  );
};
