import type { RiskSettings, Trade } from '../types';

export function getStakeProgression(trades: Trade[], settings: RiskSettings, date: string) {
  const levels = ({ SOROS_1: 1, SOROS_2: 2, SOROS_3: 3 } as Record<string, number>)[settings.managementStyle || ''];
  const ordered = trades.filter(t => t.date === date).slice().sort((a, b) =>
    (a.time || '').localeCompare(b.time || '') ||
    String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')) || a.id.localeCompare(b.id));
  let consecutiveWins = 0, consecutiveLosses = 0;
  for (const trade of ordered) {
    if (levels) {
      // A captured final Soros stake also closes the cycle when an earlier
      // operation is missing from the journal. Fixed and Soros stakes must differ.
      const finalStake = Number((settings as any)[`sorosLevel${levels}Stake`]);
      const isFinalStake = finalStake > Number(settings.fixedStakeAmount || 0) &&
        Math.abs(Number(trade.contractsOrQuantity) - finalStake) < 0.005;
      if (consecutiveWins >= levels || isFinalStake || trade.result !== 'GAIN') consecutiveWins = 0;
      else consecutiveWins++;
    } else {
      consecutiveWins = trade.result === 'GAIN' ? consecutiveWins + 1 : 0;
    }
    consecutiveLosses = trade.result === 'LOSS' ? consecutiveLosses + 1 : 0;
  }
  return { consecutiveWins, consecutiveLosses };
}
