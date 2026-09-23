import React, { useState, useEffect } from 'react';
import { mobileSyncService, MobileLockState } from '../../src/services/mobileSyncService';

export const TradeLockMobileApp: React.FC = () => {
  const [lockState, setLockState] = useState<MobileLockState>(mobileSyncService.getState());
  const [activeTab, setActiveTab] = useState<'SHIELD' | 'KPI'>('SHIELD');
  const [countdown, setCountdown] = useState<string>('00:00:00');
  const [inputEmail, setInputEmail] = useState<string>(lockState.userEmail || 'oswamitrader@gmail.com');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    mobileSyncService.setUserEmail(inputEmail);
    const unsubscribe = mobileSyncService.subscribe((state) => {
      setLockState(state);
    });

    const timerInterval = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diffMs = endOfDay.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown('00:00:00');
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        setCountdown(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timerInterval);
    };
  }, []);

  const handleSyncSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputEmail.trim()) return;

    setIsSyncing(true);
    setSyncFeedback('Sincronizando...');

    try {
      await mobileSyncService.fetchDataAndSubscribe(inputEmail.trim());
      mobileSyncService.setUserEmail(inputEmail.trim());
      setSyncFeedback('✅ Sincronizado!');
    } catch (err) {
      setSyncFeedback('❌ Erro na Sincronização');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncFeedback(null);
      }, 2000);
    }
  };

  const handleActivateTestLock = () => {
    mobileSyncService.updateState({ isStopHit: true });
  };

  const handleDeactivateTestLock = () => {
    mobileSyncService.updateState({ isStopHit: false, isMaxTradesHit: false });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div
      className="min-h-screen bg-black text-white p-4 select-none relative overflow-x-hidden"
      style={{
        fontFamily: "'Arial Black', 'Arial', sans-serif",
        fontWeight: 900,
      }}
    >
      {/* Background Image Overlay - Touro vs Urso (Imagem 2) */}
      <div
        className="fixed inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center bg-no-repeat filter brightness-75 contrast-125"
        style={{ backgroundImage: "url('/bull-bg.jpg')" }}
      />

      {/* Main Container Content */}
      <div className="relative z-10 max-w-md mx-auto">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 bg-black/80 backdrop-blur-md p-2 rounded-xl border">
          <div className="flex items-center gap-2.5">
            <img
              src="/tradelock-shield.jpg"
              alt="TradeLock Shield"
              className="w-9 h-9 rounded-lg border border-emerald-500/50 object-cover shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            />
            <div>
              <h1 className="text-base font-black tracking-tight text-white uppercase">TRADELOCK MOBILE</h1>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[9px] text-emerald-400 font-mono font-bold uppercase">SUPABASE REALTIME</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                lockState.isLockActive
                  ? 'bg-rose-950/90 text-rose-400 border border-rose-600 animate-pulse'
                  : 'bg-emerald-950/90 text-emerald-400 border border-emerald-600'
              }`}
            >
              {lockState.isLockActive ? 'BLOQUEADO 🔒' : 'LIBERADO 🟢'}
            </span>
          </div>
        </header>

        {/* User Email Sync Box - 100% Clicável e Funcional */}
        <form
          onSubmit={handleSyncSubmit}
          className="mb-4 bg-black/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2 shadow-xl"
        >
          <div className="flex-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
              E-mail do Trader no Painel Web:
            </label>
            <input
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="seu-email@gmail.com"
            />
          </div>
          <button
            type="submit"
            disabled={isSyncing}
            onClick={() => handleSyncSubmit()}
            className={`self-end py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-lg text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-lg ${
              isSyncing ? 'opacity-50 cursor-wait' : ''
            }`}
          >
            {syncFeedback || (isSyncing ? 'Sincronizando...' : 'Sincronizar')}
          </button>
        </form>

        {/* Segment Navigation (2 Colunas) */}
        <div className="grid grid-cols-2 gap-1 bg-black/80 p-1 rounded-xl border border-slate-800 mb-5 shadow-lg">
          <button
            onClick={() => setActiveTab('SHIELD')}
            className={`py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'SHIELD' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🛡️ Escudo Nativo
          </button>
          <button
            onClick={() => setActiveTab('KPI')}
            className={`py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'KPI' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Risco Hoje
          </button>
        </div>

        {/* Main Content Area */}
        {activeTab === 'SHIELD' && (
          <div className="space-y-4">
            {/* Status Card */}
            <div
              className={`p-4 rounded-xl border-2 ${
                lockState.isLockActive
                  ? 'bg-black/90 border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.3)]'
                  : 'bg-black/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                  Status do Celular (Acessibilidade & VPN)
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">{countdown}</span>
              </div>
              <h2 className="text-xl font-black text-white mb-1">
                {lockState.isLockActive ? 'BLINDAGEM NATIVA ATIVA' : 'SISTEMA MONITORANDO'}
              </h2>
              <p className="text-xs text-slate-300 mb-4">
                {lockState.reason || 'Todos os acessos a aplicativos (Exnova, Quotex, IQ Option) e redes estão sob monitoramento em tempo real.'}
              </p>

              <div className="grid grid-cols-1 gap-2 pt-2">
                <button
                  onClick={handleActivateTestLock}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  🔒 Testar Bloqueio Mobile Instantâneo
                </button>
                {lockState.isLockActive && (
                  <button
                    onClick={handleDeactivateTestLock}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs uppercase active:scale-95 transition cursor-pointer"
                  >
                    🔓 Liberar Acesso (Simulação)
                  </button>
                )}
              </div>
            </div>

            {/* Native Device Setup Cards */}
            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 bg-black/90 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-sm font-bold text-white">Android Nativo (VpnService + AccessibilityService)</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  O VpnService filtra os pacotes de rede para a Exnova/Quotex, enquanto o AccessibilityService desenha o bloqueio por cima dos apps das corretoras ao tentar abrir.
                </p>
                <div className="flex items-center justify-between text-xs font-mono text-emerald-400 bg-black p-2 rounded border border-emerald-800/50">
                  <span>VpnService: Conectado</span>
                  <span>Acessibilidade: Ativa</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'KPI' && (
          <div className="space-y-4">
            {/* Barra de progresso do Stop Loss */}
            <div className="p-4 bg-black/90 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Uso do Stop Loss Diário</span>
                <span className={`text-[10px] font-mono font-bold ${lockState.isStopHit ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {lockState.isStopHit ? '⛔ STOP ATINGIDO' : '✅ DENTRO DO LIMITE'}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    lockState.todayPnl >= 0
                      ? 'bg-emerald-500'
                      : Math.abs(lockState.todayPnl) >= lockState.dailyLossLimit
                      ? 'bg-rose-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                  style={{
                    width: `${lockState.dailyLossLimit > 0 ? Math.min(100, (Math.abs(Math.min(0, lockState.todayPnl)) / lockState.dailyLossLimit) * 100) : 0}%`
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-500 font-mono">
                  Perda: {formatCurrency(Math.abs(Math.min(0, lockState.todayPnl)))}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  Limite: {formatCurrency(lockState.dailyLossLimit)}
                </span>
              </div>
            </div>

            {/* Grid de KPIs - AllBlack sem tom azul */}
            <div className="grid grid-cols-2 gap-3">
              {/* PnL Real do Dia (só Conta Real) */}
              <div className={`p-3 rounded-xl border ${
                lockState.todayPnl > 0
                  ? 'bg-black/90 border-emerald-800/60'
                  : lockState.todayPnl < 0
                  ? 'bg-black/90 border-rose-800/60'
                  : 'bg-black/90 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 font-mono uppercase">PnL Real do Dia</span>
                <p className={`text-lg font-black font-mono mt-1 ${
                  lockState.todayPnl > 0 ? 'text-emerald-400' : lockState.todayPnl < 0 ? 'text-rose-500' : 'text-slate-500'
                }`}>
                  {formatCurrency(lockState.todayPnl)}
                </p>
                <span className="text-[9px] text-slate-500 font-mono">
                  {lockState.todayRealTradesCount > 0
                    ? `${lockState.todayRealTradesCount} trade${lockState.todayRealTradesCount > 1 ? 's' : ''} real`
                    : 'Sem trades reais hoje'}
                </span>
              </div>

              {/* Limite Stop Loss */}
              <div className="p-3 bg-black/90 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Limite Stop Loss</span>
                <p className="text-lg font-black text-rose-400 font-mono mt-1">
                  {formatCurrency(lockState.dailyLossLimit)}
                </p>
                <span className="text-[9px] text-slate-500 font-mono">
                  Meta: {formatCurrency(lockState.dailyProfitTarget)}
                </span>
              </div>

              {/* Operações Hoje */}
              <div className={`p-3 rounded-xl border ${
                lockState.isMaxTradesHit
                  ? 'bg-black/90 border-rose-800/60'
                  : 'bg-black/90 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 font-mono uppercase">Operações Hoje</span>
                <p className="text-lg font-black text-white font-mono mt-1">
                  {lockState.todayTradesCount} / {lockState.maxTradesPerDay}
                </p>
                <span className="text-[9px] text-slate-500 font-mono">
                  {lockState.isMaxTradesHit ? '⛔ Limite atingido' : `${lockState.maxTradesPerDay - lockState.todayTradesCount} restante${lockState.maxTradesPerDay - lockState.todayTradesCount !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Assertividade (Win Rate) */}
              <div className="p-3 bg-black/90 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Assertividade</span>
                <p className={`text-lg font-black font-mono mt-1 ${
                  lockState.winRate >= 60 ? 'text-emerald-400' : lockState.winRate >= 40 ? 'text-amber-400' : lockState.winRate > 0 ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {lockState.winRate}%
                </p>
                <span className="text-[9px] text-slate-500 font-mono">
                  {lockState.gainCount}W / {lockState.lossCount}L
                </span>
              </div>

              {/* Profit Factor */}
              <div className="p-3 bg-black/90 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Profit Factor</span>
                <p className={`text-lg font-black font-mono mt-1 ${
                  lockState.profitFactor >= 1.5 ? 'text-emerald-400' : lockState.profitFactor >= 1 ? 'text-amber-400' : lockState.profitFactor > 0 ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {lockState.profitFactor > 0 ? lockState.profitFactor.toFixed(2) : '—'}
                </p>
                <span className="text-[9px] text-slate-500 font-mono">
                  {lockState.profitFactor >= 1.5 ? 'Excelente' : lockState.profitFactor >= 1 ? 'Positivo' : lockState.profitFactor > 0 ? 'Negativo' : 'Sem dados'}
                </span>
              </div>

              {/* Contagem Regressiva */}
              <div className="p-3 bg-black/90 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Reset em</span>
                <p className="text-lg font-black text-emerald-400 font-mono mt-1">{countdown}</p>
                <span className="text-[9px] text-slate-500 font-mono">Meia-noite</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeLockMobileApp;
