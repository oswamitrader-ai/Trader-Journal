import React, { useState, useEffect } from 'react';
import { mobileSyncService, MobileLockState } from '../../src/services/mobileSyncService';

export const TradeLockMobileApp: React.FC = () => {
  const [lockState, setLockState] = useState<MobileLockState>(mobileSyncService.getState());
  const [activeTab, setActiveTab] = useState<'SHIELD' | 'KPI' | 'DUEL'>('SHIELD');
  const [duelMode, setDuelMode] = useState<'BULL' | 'BEAR'>('BULL');
  const [countdown, setCountdown] = useState<string>('00:00:00');

  useEffect(() => {
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

  const handleActivateVpn = () => {
    alert('⚠️ Solicitando permissão para ativar VpnService local de filtragem de rede no Android...');
    mobileSyncService.updateState({ isStopHit: true });
  };

  const handleDeactivateVpn = () => {
    mobileSyncService.updateState({ isStopHit: false, isMaxTradesHit: false });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(225,29,72,0.5)]">
            🛡️
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">TRADELOCK MOBILE</h1>
            <p className="text-xs text-slate-400 font-mono">Blindagem Android & iOS v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              lockState.isLockActive
                ? 'bg-rose-950/80 text-rose-400 border border-rose-600'
                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-600'
            }`}
          >
            {lockState.isLockActive ? 'BLOQUEADO 🔒' : 'LIBERADO 🟢'}
          </span>
        </div>
      </header>

      {/* Segment Navigation */}
      <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 mb-5">
        <button
          onClick={() => setActiveTab('SHIELD')}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === 'SHIELD' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          🛡️ Escudo VPN
        </button>
        <button
          onClick={() => setActiveTab('KPI')}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === 'KPI' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          📊 Risco Hoje
        </button>
        <button
          onClick={() => setActiveTab('DUEL')}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === 'DUEL' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          🐂 Touro vs Urso
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'SHIELD' && (
        <div className="space-y-4">
          {/* Status Card */}
          <div
            className={`p-4 rounded-xl border-2 ${
              lockState.isLockActive
                ? 'bg-rose-950/30 border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.3)]'
                : 'bg-slate-900/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                Status da Blindagem no Celular
              </span>
              <span className="text-xs font-mono text-cyan-400 font-bold">{countdown}</span>
            </div>
            <h2 className="text-xl font-black text-white mb-1">
              {lockState.isLockActive ? 'BLINDAGEM NATIVA ATIVA' : 'SISTEMA MONITORANDO'}
            </h2>
            <p className="text-xs text-slate-300 mb-4">
              {lockState.reason || 'Todos os acessos a aplicativos e sites de corretoras estão sob monitoramento.'}
            </p>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <button
                onClick={handleActivateVpn}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
              >
                🔒 Testar Bloqueio Mobile Instantâneo
              </button>
              {lockState.isLockActive && (
                <button
                  onClick={handleDeactivateVpn}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs uppercase"
                >
                  🔓 Liberar Acesso (Simulação)
                </button>
              )}
            </div>
          </div>

          {/* Device Setup Cards */}
          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-bold text-white">Configuração Android (VpnService + Acessibilidade)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                O VpnService local bloqueia as requisições de rede para a Exnova e IQ Option, enquanto a Acessibilidade desenha a tela de bloqueio por cima dos apps.
              </p>
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/50">
                <span>VpnService Local: OK</span>
                <span>Acessibilidade: Ativa</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🍏</span>
                <h3 className="text-sm font-bold text-white">Configuração iOS (Screen Time API)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Utiliza as APIs oficiais `FamilyControls` e `ManagedSettings` para oculta/bloquear aplicativos de corretoras e Safari no iPhone.
              </p>
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400 bg-cyan-950/40 p-2 rounded border border-cyan-800/50">
                <span>ManagedSettings: OK</span>
                <span>iOS 15+: Compatível</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'KPI' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase">PnL do Dia (R$)</span>
            <p className="text-lg font-black text-rose-500 font-mono mt-1">- R$ 150,00</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Limite Stop Loss</span>
            <p className="text-lg font-black text-white font-mono mt-1">R$ 150,00</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Operações Hoje</span>
            <p className="text-lg font-black text-white font-mono mt-1">5 / 5</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Assertividade</span>
            <p className="text-lg font-black text-emerald-400 font-mono mt-1">20%</p>
          </div>
        </div>
      )}

      {activeTab === 'DUEL' && (
        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => setDuelMode('BULL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                duelMode === 'BULL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              🐂 Modo Touro (Disciplina)
            </button>
            <button
              onClick={() => setDuelMode('BEAR')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                duelMode === 'BEAR' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              🐻 Modo Urso (Fúria)
            </button>
          </div>

          {duelMode === 'BULL' ? (
            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-left">
              <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Mente Fria & Execução Perfeita</h4>
              <p className="text-xs text-slate-300">
                O Touro representa o trader consciente que aceita as perdas planejadas e preserva o capital para a próxima oportunidade.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg text-left">
              <h4 className="text-xs font-bold text-rose-400 uppercase mb-1">Alerta de Revenge Trading</h4>
              <p className="text-xs text-slate-300">
                O Urso da Fúria tenta recuperar perdas aumentando a mão fora do gerenciamento. O TradeLock interrompe o ciclo de destruição.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeLockMobileApp;
