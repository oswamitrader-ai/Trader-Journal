export type TradeResult = 'GAIN' | 'LOSS' | 'BREAKEVEN';
export type TradeType = 'BUY' | 'SELL';

export type UserRole = 'ADMIN' | 'CLIENT';

export type SubscriptionStatus = 'ACTIVE' | 'OVERDUE' | 'INACTIVE' | 'TRIAL';
export type SubscriptionPlan = 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | 'TRIAL';

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  password?: string;
  // Assinatura & Cobrança SaaS
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionExpiresAt?: string; // YYYY-MM-DD
  monthlyPrice?: number; // R$
  whatsapp?: string; // Somente números com DDD
}

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  asset: string; // e.g., 'WIN' (Mini Índice), 'WDO' (Mini Dólar), 'PETR4', 'BTC/USD'
  type: TradeType;
  strategy: string; // e.g., 'Price Action', 'Rompimento', 'Pullback', 'Médias Móveis', 'VWAP / Reversão'
  result: TradeResult;
  pnl: number; // Net profit or loss in BRL (R$)
  contractsOrQuantity: number;
  entryPrice?: number;
  exitPrice?: number;
  notes?: string;
  tags?: string[];
  emotionalState?: string; // e.g., 'Calmo', 'Ansioso', 'Eufórico'
  accountType?: 'REAL' | 'DEMO';
  isReal?: boolean;
  isAutoCaptured?: boolean;
}

export type CapitalTransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface CapitalTransaction {
  id: string;
  type: CapitalTransactionType;
  amount: number;
  fee?: number; // Taxa cobrada pela corretora (R$)
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  broker?: string; // Ex: 'Exnova', 'XP', 'Clear'
  notes?: string;
}

export interface RiskSettings {
  initialCapital: number;
  dailyProfitTarget: number; // Meta de Ganho diária em R$
  dailyLossLimit: number; // Limite de Perda diário (valor positivo em R$, ex: 300)
  monthlyProfitTarget: number; // Meta de Ganho mensal em R$
  monthlyLossLimit: number; // Limite de Perda mensal em R$
  maxTradesPerDay: number;
  alertSoundEnabled: boolean;
  antiFuriaCustomWindowEnabled?: boolean;
  antiFuriaStartTime?: string; // e.g., '07:00'
  antiFuriaEndTime?: string; // e.g., '11:30'
}

export interface DayPerformance {
  date: string;
  pnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  equityAtEndOfDay: number;
  prevDayPnl?: number;
  dayOverDayGrowthPercent?: number; // % change compared to previous operating day
  capitalGrowthPercent?: number; // % gain on total capital that day
}

export interface WeeklyPerformance {
  id: string;
  weekNumber: number;
  year: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalPnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  positiveDays: number;
  negativeDays: number;
  bestDayPnl: number;
  worstDayPnl: number;
  targetAchieved: boolean;
}

export interface MonthlyPerformance {
  monthKey: string; // YYYY-MM
  monthName: string;
  totalPnl: number;
  winRate: number;
  tradesCount: number;
  positiveDays: number;
  negativeDays: number;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
}

export interface OverallMetrics {
  initialCapital: number;
  currentCapital: number;
  netProfit: number;
  netProfitPercent: number;
  winRate: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  profitFactor: number;
  payoff: number; // Avg Win / Avg Loss
  avgWin: number;
  avgLoss: number;
  maxWin: number;
  maxLoss: number;
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  currentDrawdownPercent: number;
  currentStreak: {
    type: 'WIN' | 'LOSS' | 'NONE';
    count: number;
  };
  lastDayPnl: number;
  prevDayPnl: number;
  dayOverDayGrowthPercent: number; // Comparação do último dia com o dia anterior
}

export interface NotificationAlert {
  id: string;
  type: 'TARGET_REACHED' | 'LOSS_LIMIT_REACHED' | 'WARNING_NEAR_STOP' | 'DRAWDOWN_ALERT' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  date: string;
  severity: 'success' | 'warning' | 'error' | 'info';
}

export interface AiAnalysisResult {
  score: number;
  statusTag: 'Consistente' | 'Em Evolução' | 'Alerta de Risco' | 'Crítico';
  highlights: string[];
  riskDiagnosis: string;
  tacticalAdvice: string;
  bestStrategy: string;
  psychologyTip: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
