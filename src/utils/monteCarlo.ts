/**
 * Monte Carlo Simulation Engine
 * Executa N simulações probabilísticas com base nas estatísticas reais do trader
 * para estimar risco de ruína e projetar curvas de capital futuras.
 */

export interface MonteCarloConfig {
  winRate: number;           // 0-1 (ex: 0.55 = 55%)
  avgWin: number;            // Ganho médio por trade em R$
  avgLoss: number;           // Perda média por trade em R$ (valor positivo)
  initialCapital: number;    // Capital inicial
  tradesPerDay: number;      // Quantidade média de trades por dia
  numSimulations: number;    // Número de simulações (1000 default)
  projectionDays: number;    // Dias para projetar (ex: 90)
  ruinThreshold: number;     // % do capital que define "ruína" (ex: 0.1 = 10% do capital restante = ruína)
}

export interface SimulationPath {
  /** Capital ao final de cada dia projetado */
  dailyEquity: number[];
}

export interface MonteCarloResult {
  /** Probabilidade de ruína (0-1) */
  riskOfRuin: number;
  /** Percentis de capital final */
  finalCapitalPercentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  /** Curvas de percentis por dia (para gráfico de área) */
  dailyPercentiles: Array<{
    day: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }>;
  /** Capital médio ao final */
  avgFinalCapital: number;
  /** Drawdown máximo médio */
  avgMaxDrawdown: number;
  /** Projeções em 30, 60, 90 dias (mediana) */
  projections: {
    days30: number;
    days60: number;
    days90: number;
  };
  /** Expectância matemática por trade */
  expectancy: number;
  /** Total de simulações executadas */
  totalSimulations: number;
  /** Contagem de ruínas */
  ruinCount: number;
}

/**
 * Roda a simulação de Monte Carlo
 */
export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
  const {
    winRate,
    avgWin,
    avgLoss,
    initialCapital,
    tradesPerDay,
    numSimulations,
    projectionDays,
    ruinThreshold,
  } = config;

  const ruinLevel = initialCapital * ruinThreshold;
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  // Matriz: [simulação][dia] = capital
  const allPaths: number[][] = [];
  let ruinCount = 0;
  let totalMaxDrawdown = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialCapital];
    let capital = initialCapital;
    let peak = initialCapital;
    let maxDd = 0;
    let ruined = false;

    for (let day = 1; day <= projectionDays; day++) {
      // Simula N trades no dia
      for (let t = 0; t < tradesPerDay; t++) {
        if (capital <= ruinLevel) {
          ruined = true;
          break;
        }
        const rand = Math.random();
        if (rand < winRate) {
          capital += avgWin;
        } else {
          capital -= avgLoss;
        }
      }

      if (capital > peak) peak = capital;
      const dd = peak > 0 ? ((peak - capital) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;

      path.push(Math.max(0, capital));

      if (ruined) {
        // Preenche o resto com zero
        for (let remaining = day + 1; remaining <= projectionDays; remaining++) {
          path.push(0);
        }
        break;
      }
    }

    allPaths.push(path);
    if (ruined || capital <= ruinLevel) ruinCount++;
    totalMaxDrawdown += maxDd;
  }

  // Calcula percentis para cada dia
  const dailyPercentiles: MonteCarloResult['dailyPercentiles'] = [];
  
  // Sample a cada N dias para manter o gráfico leve
  const sampleInterval = projectionDays <= 30 ? 1 : projectionDays <= 60 ? 2 : 3;

  for (let day = 0; day <= projectionDays; day += sampleInterval) {
    const values = allPaths.map(p => p[Math.min(day, p.length - 1)]).sort((a, b) => a - b);
    dailyPercentiles.push({
      day,
      p10: percentile(values, 10),
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p90: percentile(values, 90),
    });
  }

  // Garante que o último dia está incluído
  if (dailyPercentiles[dailyPercentiles.length - 1]?.day !== projectionDays) {
    const values = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b);
    dailyPercentiles.push({
      day: projectionDays,
      p10: percentile(values, 10),
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p90: percentile(values, 90),
    });
  }

  // Capital final
  const finalCapitals = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b);
  const avgFinal = finalCapitals.reduce((s, v) => s + v, 0) / finalCapitals.length;

  // Projeções em 30, 60, 90 dias
  const getMedianAtDay = (targetDay: number): number => {
    const cappedDay = Math.min(targetDay, projectionDays);
    const vals = allPaths.map(p => p[Math.min(cappedDay, p.length - 1)]).sort((a, b) => a - b);
    return percentile(vals, 50);
  };

  return {
    riskOfRuin: ruinCount / numSimulations,
    finalCapitalPercentiles: {
      p10: percentile(finalCapitals, 10),
      p25: percentile(finalCapitals, 25),
      p50: percentile(finalCapitals, 50),
      p75: percentile(finalCapitals, 75),
      p90: percentile(finalCapitals, 90),
    },
    dailyPercentiles,
    avgFinalCapital: avgFinal,
    avgMaxDrawdown: totalMaxDrawdown / numSimulations,
    projections: {
      days30: getMedianAtDay(30),
      days60: getMedianAtDay(60),
      days90: getMedianAtDay(90),
    },
    expectancy,
    totalSimulations: numSimulations,
    ruinCount,
  };
}

/** Calcula o percentil P de um array já ordenado */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}
