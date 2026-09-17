import { Trade, DayPerformance, WeeklyPerformance, MonthlyPerformance, OverallMetrics, RiskSettings } from '../types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, includeSign = false): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2).replace('.', ',')}%`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

export function formatShortDate(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  return `${parts[2]}/${parts[1]}`;
}

// Calculate week number (ISO week)
export function getWeekNumber(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

export function calculateMetrics(trades: Trade[], settings?: RiskSettings): OverallMetrics {
  const initialCapital = settings?.initialCapital || 10000;
  if (!trades || trades.length === 0) {
    return {
      initialCapital,
      currentCapital: initialCapital,
      netProfit: 0,
      netProfitPercent: 0,
      winRate: 0,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      profitFactor: 0,
      payoff: 0,
      avgWin: 0,
      avgLoss: 0,
      maxWin: 0,
      maxLoss: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      currentDrawdownPercent: 0,
      currentStreak: { type: 'NONE', count: 0 },
      lastDayPnl: 0,
      prevDayPnl: 0,
      dayOverDayGrowthPercent: 0,
    };
  }

  // Chronological sort
  const sortedTrades = [...trades].sort((a, b) => {
    const dtA = `${a.date}T${a.time || '00:00'}`;
    const dtB = `${b.date}T${b.time || '00:00'}`;
    return dtA.localeCompare(dtB);
  });

  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let totalGains = 0;
  let totalLosses = 0;
  let maxWin = 0;
  let maxLoss = 0;

  // Running equity & drawdown
  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  // Streak tracking
  let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let currentStreakCount = 0;

  for (const trade of sortedTrades) {
    const pnl = Number(trade.pnl) || 0;
    currentEquity += pnl;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }

    const drawdownAmt = Math.max(0, peakEquity - currentEquity);
    const drawdownPct = peakEquity > 0 ? (drawdownAmt / peakEquity) * 100 : 0;

    if (drawdownAmt > maxDrawdownAmount) {
      maxDrawdownAmount = drawdownAmt;
    }
    if (drawdownPct > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPct;
    }

    if (pnl > 0.001) {
      winCount++;
      totalGains += pnl;
      if (pnl > maxWin) maxWin = pnl;

      if (currentStreakType === 'WIN') {
        currentStreakCount++;
      } else {
        currentStreakType = 'WIN';
        currentStreakCount = 1;
      }
    } else if (pnl < -0.001) {
      lossCount++;
      totalLosses += Math.abs(pnl);
      if (Math.abs(pnl) > maxLoss) maxLoss = Math.abs(pnl);

      if (currentStreakType === 'LOSS') {
        currentStreakCount++;
      } else {
        currentStreakType = 'LOSS';
        currentStreakCount = 1;
      }
    } else {
      breakevenCount++;
      currentStreakType = 'NONE';
      currentStreakCount = 0;
    }
  }

  const totalTrades = sortedTrades.length;
  const netProfit = totalGains - totalLosses;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;
  const currentCapital = initialCapital + netProfit;

  // Assertividade (Taxa de acerto)
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  // Fator de Lucro (Profit Factor)
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.9 : 0;

  // Médias e Payoff
  const avgWin = winCount > 0 ? totalGains / winCount : 0;
  const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99.9 : 0;

  // Current Drawdown
  const currentDrawdownAmt = Math.max(0, peakEquity - currentEquity);
  const currentDrawdownPercent = peakEquity > 0 ? (currentDrawdownAmt / peakEquity) * 100 : 0;

  // Calculate day-over-day variation for the last active trading days
  const dailyMap = getDailyPerformances(sortedTrades, initialCapital);
  let lastDayPnl = 0;
  let prevDayPnl = 0;
  let dayOverDayGrowthPercent = 0;

  if (dailyMap.length >= 2) {
    lastDayPnl = dailyMap[dailyMap.length - 1].pnl;
    prevDayPnl = dailyMap[dailyMap.length - 2].pnl;
    if (prevDayPnl !== 0) {
      dayOverDayGrowthPercent = ((lastDayPnl - prevDayPnl) / Math.abs(prevDayPnl)) * 100;
    } else {
      dayOverDayGrowthPercent = lastDayPnl > 0 ? 100 : lastDayPnl < 0 ? -100 : 0;
    }
  } else if (dailyMap.length === 1) {
    lastDayPnl = dailyMap[0].pnl;
    dayOverDayGrowthPercent = 100;
  }

  return {
    initialCapital,
    currentCapital,
    netProfit,
    netProfitPercent,
    winRate,
    totalTrades,
    winCount,
    lossCount,
    breakevenCount,
    profitFactor,
    payoff,
    avgWin,
    avgLoss,
    maxWin,
    maxLoss,
    maxDrawdownAmount,
    maxDrawdownPercent,
    currentDrawdownPercent,
    currentStreak: { type: currentStreakType, count: currentStreakCount },
    lastDayPnl,
    prevDayPnl,
    dayOverDayGrowthPercent,
  };
}

export function getDailyPerformances(trades: Trade[], initialCapital: number): DayPerformance[] {
  if (!trades || trades.length === 0) return [];

  const mapByDate = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = mapByDate.get(t.date) || [];
    list.push(t);
    mapByDate.set(t.date, list);
  }

  const sortedDates = Array.from(mapByDate.keys()).sort();
  const result: DayPerformance[] = [];
  let runningEquity = initialCapital;

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const dayTrades = mapByDate.get(date) || [];

    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let breakevens = 0;

    for (const t of dayTrades) {
      pnl += Number(t.pnl) || 0;
      if (t.pnl > 0.001) wins++;
      else if (t.pnl < -0.001) losses++;
      else breakevens++;
    }

    const startOfDayEquity = runningEquity;
    runningEquity += pnl;

    const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;

    let prevDayPnl: number | undefined = undefined;
    let dayOverDayGrowthPercent: number | undefined = undefined;

    if (i > 0) {
      prevDayPnl = result[i - 1].pnl;
      if (prevDayPnl !== 0) {
        dayOverDayGrowthPercent = ((pnl - prevDayPnl) / Math.abs(prevDayPnl)) * 100;
      } else {
        dayOverDayGrowthPercent = pnl > 0 ? 100 : pnl < 0 ? -100 : 0;
      }
    }

    const capitalGrowthPercent = startOfDayEquity > 0 ? (pnl / startOfDayEquity) * 100 : 0;

    result.push({
      date,
      pnl,
      tradesCount: dayTrades.length,
      wins,
      losses,
      breakevens,
      winRate,
      equityAtEndOfDay: runningEquity,
      prevDayPnl,
      dayOverDayGrowthPercent,
      capitalGrowthPercent,
    });
  }

  return result;
}

export function getWeeklyPerformances(trades: Trade[], settings?: RiskSettings): WeeklyPerformance[] {
  if (!trades || trades.length === 0) return [];

  const dailyProfitTarget = settings?.dailyProfitTarget ?? 500;
  const weeklyMap = new Map<string, Trade[]>();

  for (const t of trades) {
    const [y, m, d] = t.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const { year, week } = getWeekNumber(dateObj);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;

    const list = weeklyMap.get(key) || [];
    list.push(t);
    weeklyMap.set(key, list);
  }

  const sortedKeys = Array.from(weeklyMap.keys()).sort().reverse(); // Most recent first
  const results: WeeklyPerformance[] = [];

  for (const key of sortedKeys) {
    const weekTrades = weeklyMap.get(key) || [];
    const [yearStr, weekStr] = key.split('-W');
    const weekNumber = Number(weekStr);
    const year = Number(yearStr);

    let totalPnl = 0;
    let wins = 0;
    let losses = 0;

    const dayPnlMap = new Map<string, number>();

    let minDate = weekTrades[0].date;
    let maxDate = weekTrades[0].date;

    for (const t of weekTrades) {
      const pnl = Number(t.pnl) || 0;
      totalPnl += pnl;
      if (pnl > 0.001) wins++;
      else if (pnl < -0.001) losses++;

      dayPnlMap.set(t.date, (dayPnlMap.get(t.date) || 0) + pnl);

      if (t.date < minDate) minDate = t.date;
      if (t.date > maxDate) maxDate = t.date;
    }

    let positiveDays = 0;
    let negativeDays = 0;
    let bestDayPnl = -Infinity;
    let worstDayPnl = Infinity;

    dayPnlMap.forEach((pnl) => {
      if (pnl > 0.001) positiveDays++;
      else if (pnl < -0.001) negativeDays++;

      if (pnl > bestDayPnl) bestDayPnl = pnl;
      if (pnl < worstDayPnl) worstDayPnl = pnl;
    });

    if (bestDayPnl === -Infinity) bestDayPnl = 0;
    if (worstDayPnl === Infinity) worstDayPnl = 0;

    const winRate = weekTrades.length > 0 ? (wins / weekTrades.length) * 100 : 0;
    const targetAchieved = totalPnl >= (dailyProfitTarget * 3); // Meta semanal referencial

    results.push({
      id: key,
      weekNumber,
      year,
      weekLabel: `Semana ${weekNumber} (${formatShortDate(minDate)} a ${formatShortDate(maxDate)})`,
      startDate: minDate,
      endDate: maxDate,
      totalPnl,
      tradesCount: weekTrades.length,
      wins,
      losses,
      winRate,
      positiveDays,
      negativeDays,
      bestDayPnl,
      worstDayPnl,
      targetAchieved,
    });
  }

  return results;
}

export function getMonthlyPerformances(trades: Trade[]): MonthlyPerformance[] {
  if (!trades || trades.length === 0) return [];

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const monthMap = new Map<string, Trade[]>();
  for (const t of trades) {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    const list = monthMap.get(monthKey) || [];
    list.push(t);
    monthMap.set(monthKey, list);
  }

  const sortedMonthKeys = Array.from(monthMap.keys()).sort().reverse();
  const results: MonthlyPerformance[] = [];

  for (const monthKey of sortedMonthKeys) {
    const monthTrades = monthMap.get(monthKey) || [];
    const [year, month] = monthKey.split('-').map(Number);
    const monthName = `${monthNames[month - 1]} de ${year}`;

    let totalPnl = 0;
    let wins = 0;
    const dayMap = new Map<string, number>();

    for (const t of monthTrades) {
      const pnl = Number(t.pnl) || 0;
      totalPnl += pnl;
      if (pnl > 0.001) wins++;
      dayMap.set(t.date, (dayMap.get(t.date) || 0) + pnl);
    }

    let positiveDays = 0;
    let negativeDays = 0;
    let bestDay: { date: string; pnl: number } | null = null;
    let worstDay: { date: string; pnl: number } | null = null;

    dayMap.forEach((pnl, date) => {
      if (pnl > 0.001) positiveDays++;
      else if (pnl < -0.001) negativeDays++;

      if (!bestDay || pnl > bestDay.pnl) {
        bestDay = { date, pnl };
      }
      if (!worstDay || pnl < worstDay.pnl) {
        worstDay = { date, pnl };
      }
    });

    results.push({
      monthKey,
      monthName,
      totalPnl,
      winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
      tradesCount: monthTrades.length,
      positiveDays,
      negativeDays,
      bestDay,
      worstDay,
    });
  }

  return results;
}

export function getStatsByAsset(trades: Trade[]): Array<{ asset: string; tradesCount: number; pnl: number; winRate: number }> {
  const map = new Map<string, { count: number; wins: number; pnl: number }>();

  for (const t of trades) {
    const asset = t.asset || 'Outros';
    const curr = map.get(asset) || { count: 0, wins: 0, pnl: 0 };
    curr.count++;
    curr.pnl += Number(t.pnl) || 0;
    if (t.pnl > 0.001) curr.wins++;
    map.set(asset, curr);
  }

  return Array.from(map.entries()).map(([asset, data]) => ({
    asset,
    tradesCount: data.count,
    pnl: data.pnl,
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
  })).sort((a, b) => b.pnl - a.pnl);
}

export function getStatsByStrategy(trades: Trade[]): Array<{ strategy: string; tradesCount: number; pnl: number; winRate: number }> {
  const map = new Map<string, { count: number; wins: number; pnl: number }>();

  for (const t of trades) {
    const strat = t.strategy || 'Geral';
    const curr = map.get(strat) || { count: 0, wins: 0, pnl: 0 };
    curr.count++;
    curr.pnl += Number(t.pnl) || 0;
    if (t.pnl > 0.001) curr.wins++;
    map.set(strat, curr);
  }

  return Array.from(map.entries()).map(([strategy, data]) => ({
    strategy,
    tradesCount: data.count,
    pnl: data.pnl,
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
  })).sort((a, b) => b.pnl - a.pnl);
}
