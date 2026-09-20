import { Trade, RiskSettings } from '../types';

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  initialCapital: 0, // R$ 0,00 capital inicial padrão
  dailyProfitTarget: 500, // Meta diária de R$ 500
  dailyLossLimit: 300, // Limite de perda diário de R$ 300 (Stop Loss)
  monthlyProfitTarget: 5000, // Meta mensal
  monthlyLossLimit: 2000, // Limite de perda mensal
  maxTradesPerDay: 5,
  alertSoundEnabled: true,
  antiFuriaCustomWindowEnabled: false,
  antiFuriaStartTime: '07:00',
  antiFuriaEndTime: '11:30',
};

// 100% Real data - Sem dados mockados ou pré-carregados
export const INITIAL_TRADES: Trade[] = [];
