/**
 * Calculadora do Critério de Kelly para Dimensionamento de Lote e Gestão de Risco
 */

export interface KellyParams {
  capital: number;           // Capital total da banca (R$)
  winRatePercent: number;    // Taxa de acerto em % (ex: 55 para 55%)
  avgWin: number;            // Lucro médio por trade vencedor (R$)
  avgLoss: number;           // Perda média por trade perdedor (R$)
  stopLossAmount: number;    // Valor de risco por lote/contrato no trade atual (R$)
  fractionMultiplier: number; // Fração de Kelly (0.25 = 25% Conservador, 0.5 = 50%, etc)
}

export interface KellyResult {
  fullKellyPercent: number;       // Kelly 100% em porcentagem (ex: 25.0 para 25%)
  fractionalKellyPercent: number; // Kelly aplicado com a fração (ex: 6.25%)
  recommendedRiskAmount: number;  // Valor recomendado a arriscar em R$
  recommendedLots: number;        // Lotes / mini-contratos sugeridos (arredondado)
  exactLots: number;              // Lotes exatos fracionados
  payoffRatio: number;            // Payoff (AvgWin / AvgLoss)
  expectedValue: number;          // Expectativa matemática por R$ 1 arriscado
  hasPositiveExpectancy: boolean; // Se o sistema é lucrativo no longo prazo
  warningLevel: 'safe' | 'warning' | 'danger' | 'negative'; // Nível de alerta
  warningMessage: string;         // Mensagem orientativa em PT-BR
}

/**
 * Calcula o tamanho de posição ideal com base no Critério de Kelly Fracionário
 */
export function calculateKelly(params: KellyParams): KellyResult {
  const { capital, winRatePercent, avgWin, avgLoss, stopLossAmount, fractionMultiplier } = params;

  const W = Math.min(Math.max(winRatePercent / 100, 0.001), 0.999);
  const win = Math.max(avgWin, 0.01);
  const loss = Math.max(avgLoss, 0.01);
  const R = win / loss; // Payoff ratio

  // Fórmula de Kelly: K% = W - [(1 - W) / R]
  const fullKelly = W - ((1 - W) / R);
  const fullKellyPct = fullKelly * 100;

  // Expected Value por R$ 1 arriscado: EV = (W * R) - (1 - W)
  const ev = (W * R) - (1 - W);
  const hasPositiveExpectancy = fullKelly > 0 && ev > 0;

  // Kelly fracionário aplicado
  const fractionPct = Math.max(0, fullKellyPct * fractionMultiplier);

  // Capital em risco recomendado (R$)
  const safeCapital = Math.max(capital, 100);
  const recommendedRisk = (safeCapital * fractionPct) / 100;

  // Lotes recomendados
  const safeStop = Math.max(stopLossAmount, 1);
  const exactLots = recommendedRisk / safeStop;
  const recommendedLots = Math.max(0, Math.floor(exactLots));

  // Determinar mensagem de alerta e segurança
  let warningLevel: 'safe' | 'warning' | 'danger' | 'negative' = 'safe';
  let warningMessage = 'Dimensionamento seguro dentro das boas práticas de gerenciamento.';

  if (!hasPositiveExpectancy) {
    warningLevel = 'negative';
    warningMessage = 'Atenção: Seu operacional apresenta Expectativa Matemática Negativa. O Critério de Kelly não recomenda realizar trades neste cenário.';
  } else if (fractionPct > 10) {
    warningLevel = 'danger';
    warningMessage = 'Risco Muito Alto: Arriscar mais de 10% do capital por trade expõe a banca a alto risco de drawdown e ruína. Sugerimos limitar a no máximo 2% - 5%.';
  } else if (fractionPct > 5) {
    warningLevel = 'warning';
    warningMessage = 'Risco Moderado-Alto: Risco recomendado acima de 5%. Considere utilizar Kelly 25% (Conservador) para proteger sua curva de patrimônio.';
  } else {
    warningLevel = 'safe';
    warningMessage = `Excelente: Risco recomendado de ${fractionPct.toFixed(2)}% do capital por operação com expectativa positiva de +${(ev * 100).toFixed(1)}% por R$ 1 arriscado.`;
  }

  return {
    fullKellyPercent: Number(fullKellyPct.toFixed(2)),
    fractionalKellyPercent: Number(fractionPct.toFixed(2)),
    recommendedRiskAmount: Number(recommendedRisk.toFixed(2)),
    recommendedLots,
    exactLots: Number(exactLots.toFixed(2)),
    payoffRatio: Number(R.toFixed(2)),
    expectedValue: Number(ev.toFixed(2)),
    hasPositiveExpectancy,
    warningLevel,
    warningMessage,
  };
}
