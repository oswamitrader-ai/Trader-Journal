import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Sparkles,
  Globe,
  Clock,
  Laptop,
  TrendingUp,
  TrendingDown,
  Maximize2,
  X,
  Flame,
} from 'lucide-react';
import { SystemUser } from '../types';
import { formatCurrency } from '../utils/calculations';
import {
  generateExtensionZip,
  DEFAULT_BLOCKED_DOMAINS,
} from '../utils/extensionGenerator';
import { downloadWindowsLockerBat } from '../utils/windowsLockerGenerator';

interface AntiFuriaExtensionPageProps {
  onBackToDashboard: () => void;
  isStopHit: boolean;
  todayPnl: number;
  dailyLossLimit: number;
  winRate?: number;
  profitFactor?: number;
  todayTradesCount?: number;
  currentCapital?: number;
  currentUser?: SystemUser | null;
}

export const AntiFuriaExtensionPage: React.FC<AntiFuriaExtensionPageProps> = ({
  onBackToDashboard,
  isStopHit,
  todayPnl,
  dailyLossLimit,
  winRate = 0,
  profitFactor = 0,
  todayTradesCount = 0,
  currentCapital = 0,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';
  const [domains, setDomains] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('trader_journal_blocked_domains_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Falha ao carregar domínios salvos do storage:', e);
    }
    return DEFAULT_BLOCKED_DOMAINS;
  });

  const [newDomain, setNewDomain] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'lockscreen' | 'install' | 'domains'>(() =>
    currentUser?.role === 'ADMIN' ? 'lockscreen' : 'install'
  );
  const [duelMode, setDuelMode] = useState<'FULL' | 'BULL' | 'BEAR'>('FULL');
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);
  const [countdownText, setCountdownText] = useState('');

  // Persistir domínios customizados no LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('trader_journal_blocked_domains_v1', JSON.stringify(domains));
    } catch (e) {
      console.error(e);
    }
  }, [domains]);

  // Contagem regressiva até a meia-noite (00:00:00)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdownText('00h 00m 00s');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(
        `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fechar tela cheia com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPreviewOpen) {
        setIsFullscreenPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPreviewOpen]);

  // Download do pacote ZIP da extensão
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await generateExtensionZip({
        dailyLossLimit,
        blockedDomains: domains,
        appName: 'TradeLock - Gestão & Capital',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anti-furia-trader-extensao.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Falha ao gerar ZIP da extensão:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddDomain = () => {
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (clean && !domains.includes(clean)) {
      setDomains([...domains, clean]);
      setNewDomain('');
    }
  };

  const handleRemoveDomain = (dom: string) => {
    setDomains(domains.filter((d) => d !== dom));
  };

  // Renderizador Interno da Tela de Bloqueio com o Duelo Touro vs Urso Integrado
  const renderLockScreenComponent = (isFullscreen = false) => {
    const isMaxTradesHit = todayTradesCount >= (dailyLossLimit > 0 ? 4 : 0); // Prop check fallback
    const lockTitle = isStopHit
      ? `Você atingiu o seu Stop Loss diário de ${formatCurrency(dailyLossLimit)}.`
      : `Você atingiu o seu Limite Máximo de Operações Diárias (${todayTradesCount} trades realizados).`;
    const lockReasonText = isStopHit
      ? `O TradeLock assumiu o controle e bloqueou fisicamente as corretoras para conter o Urso da Fúria e proteger seu capital.`
      : `O TradeLock ativou a Trava Anti-Overtrading para impedir a fadiga mental e conter operações impulsivas em excesso.`;

    return (
    <div
      className={`rounded-3xl border-2 border-rose-600 bg-black text-white overflow-hidden shadow-[0_0_50px_rgba(225,29,72,0.35)] space-y-0 ${
        isFullscreen ? 'max-w-5xl mx-auto w-full my-auto' : ''
      }`}
    >
      {/* 1. Header do Bloqueio */}
      <div className="bg-rose-600 text-white p-6 sm:p-7 text-center relative border-b border-rose-700">
        <div className="flex items-center justify-center gap-2.5 mb-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/25 text-white shadow-inner">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-base sm:text-xl font-black font-mono tracking-wider uppercase">
            {isStopHit ? 'ACESSO BLOQUEADO POR STOP LOSS' : 'ACESSO BLOQUEADO POR OVERTRADING'}
          </h2>
        </div>
        <p className="text-xs sm:text-sm font-bold text-white/95 max-w-xl mx-auto leading-relaxed">
          {lockTitle} {lockReasonText}
        </p>
      </div>

      <div className="p-5 sm:p-7 space-y-5 bg-black">
        {/* 2. SEÇÃO DE ABAS DE MODO INTERATIVO INCORPORADA NA TELA DE BLOQUEIO */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-black p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono">
                CONFRONTO VISUAL PSICOLÓGICO
              </span>
              <h3 className="text-sm sm:text-base font-black text-white font-mono">
                O Duelo: Touro da Disciplina vs. Urso do Dia de Fúria
              </h3>
            </div>

            {/* BADGE DE CONFRONTO COMPLETO */}
            <div className="flex items-center gap-1.5 bg-black border border-slate-800 p-1.5 rounded-xl shrink-0">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white shadow-md shadow-violet-950/40 font-mono uppercase">
                <ShieldAlert className="h-3.5 w-3.5 text-violet-300" />
                Ver Confronto Completo
              </span>
            </div>
          </div>

          {/* CONTEÚDO DINÂMICO CONFORME O MODO SELECIONADO NA TELA DE BLOQUEIO */}
          {duelMode === 'FULL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative rounded-2xl border border-slate-800 bg-black overflow-hidden h-48 sm:h-56 shadow-xl">
                <img
                  src="/bull-vs-bear.jpg"
                  alt="Duelo Touro vs Urso"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <span className="text-[10px] font-black uppercase text-amber-400 font-mono">
                    CONFRONTO DE TENDÊNCIA
                  </span>
                  <h4 className="text-sm font-bold text-white font-mono">Touro vs. Urso em Execução</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    O confronto entre a disciplina tática e o impulso irracional de recuperar o loss.
                  </p>
                </div>
              </div>

              <div className="relative rounded-2xl border border-slate-800 bg-black overflow-hidden h-48 sm:h-56 shadow-xl">
                <img
                  src="/tradelock-shield.jpg"
                  alt="Escudo TradeLock"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <span className="text-[10px] font-black uppercase text-emerald-400 font-mono">
                    BARREIRA FÍSICA INTRANSPONÍVEL
                  </span>
                  <h4 className="text-sm font-bold text-white font-mono">Escudo TradeLock Interceptando</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    O bloqueio rígido que ergue o escudo antes que o Urso devore seu saldo restante.
                  </p>
                </div>
              </div>
            </div>
          )}

          {duelMode === 'BULL' && (
            <div className="rounded-2xl border border-emerald-600/60 bg-black p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 font-mono">
                    LUZ ESMERALDA — TENDÊNCIA DE ALTA
                  </span>
                  <h4 className="text-base font-black text-white font-mono">
                    Visão do Touro: Lucro Preservado &amp; Frieza Operacional
                  </h4>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Traders consistentes respeitam a parada diária. Ao aceitar o stop de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong>, você protege semanas de ganhos e permite que o Touro da Disciplina mantenha sua curva de capital saudável no longo prazo.
              </p>
            </div>
          )}

          {duelMode === 'BEAR' && (
            <div className="rounded-2xl border border-rose-600/60 bg-black p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-rose-400 font-mono">
                    LUZ CARMESIM — QUEDA LIVRE DE CAPITAL
                  </span>
                  <h4 className="text-base font-black text-white font-mono">
                    Visão do Urso: Armadilhas do Revenge Trading
                  </h4>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sob o impacto emocional da fúria, o cérebro tenta recuperar o loss abrindo ordens impulsivas com lotes maiores. Sem a trava TradeLock, 94% dos traders zeram a banca inteira em menos de 40 minutos de revenge trading.
              </p>
            </div>
          )}
        </div>

        {/* 3. 4 Cards de KPIs de Risco */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-black border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ASSERTIVIDADE</div>
            <div className="text-lg font-mono font-black text-emerald-400 mt-1">
              {winRate > 0 ? `${winRate.toFixed(1)}%` : '--%'}
            </div>
          </div>

          <div className="bg-black border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">FATOR LUCRO</div>
            <div className="text-lg font-mono font-black text-teal-300 mt-1">
              {profitFactor > 0 ? profitFactor.toFixed(2) : '--'}
            </div>
          </div>

          <div className="bg-black border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">TRADES HOJE</div>
            <div className="text-lg font-mono font-black text-slate-100 mt-1">
              {todayTradesCount > 0 ? `${todayTradesCount} trade${todayTradesCount > 1 ? 's' : ''}` : '1 trade'}
            </div>
          </div>

          <div className="bg-black border border-slate-800 rounded-2xl p-3.5 shadow-md">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">SALDO ATUAL</div>
            <div className="text-lg font-mono font-black text-slate-100 mt-1">
              {currentCapital > 0 ? formatCurrency(currentCapital) : 'R$ --'}
            </div>
          </div>
        </div>

        {/* 4. Caixa de Diagnóstico do Mentor IA */}
        <div className="rounded-2xl border border-rose-900/60 bg-black p-4 sm:p-5 space-y-2">
          <div className="font-extrabold text-rose-400 uppercase tracking-wider text-xs flex items-center gap-2 font-mono">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <span>DIAGNÓSTICO DO MENTOR IA TRADELOCK</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed font-sans">
            {winRate >= 50 ? (
              <>
                Sua taxa de assertividade acumulada é de <strong className="text-emerald-400">{winRate.toFixed(1)}%</strong> com Fator de Lucro de <strong className="text-teal-300">{profitFactor.toFixed(2)}</strong>. Sua estratégia técnica funciona! Não jogue fora semanas de resultado por causa de um Stop Loss pontual de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong>. Aceitar a perda de hoje é o que separa um apostador de um profissional.
              </>
            ) : (
              <>
                O maior causador de quebra de bancas no mercado financeiro não é a perda individual, é a tentativa descontrolada de recuperar o prejuízo no mesmo dia. Aceitar o stop de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong> preserva seu saldo para vencer no próximo pregão.
              </>
            )}
          </p>
        </div>

        {/* 5. Timer de Desbloqueio à Meia-Noite */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 text-center shadow-md">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            ACESSO LIBERADO AUTOMATICAMENTE A MEIA-NOITE (00:00:00)
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-400 mt-1">
            {countdownText || '00h 00m 00s'}
          </div>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition shadow-md shrink-0"
            title="Voltar para a tela principal de operações"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-400" />
            <span>Voltar ao Diário de Trade</span>
          </button>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-950/60 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  Trava Anti-Fúria — Duelo Touro vs. Urso &amp; Blindagem
                </h1>
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase shadow-md shadow-rose-900/40">
                  BARREIRA INVIOLÁVEL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                O escudo físico que impede o Urso da Fúria de zerar sua banca ao atingir o Stop Loss diário.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsFullscreenPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900 text-rose-200 font-bold text-xs transition shadow-md shrink-0"
              title="Exclusivo para Administração"
            >
              <Maximize2 className="h-4 w-4 text-rose-400" />
              <span>Ver Bloqueio em Tela Cheia</span>
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow-lg shadow-rose-900/50 shrink-0 self-start sm:self-auto disabled:opacity-60"
          >
            {isDownloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isDownloading ? 'Gerando Pacote...' : 'Baixar Extensão (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* PAINEL DE STATUS EM TEMPO REAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Status da Trava Hoje */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Status da Trava Hoje
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md ${
                isStopHit ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600'
              }`}
            >
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-black font-mono tracking-tight uppercase ${
                isStopHit ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {isStopHit ? 'STOP ATIVO 🔒' : 'LIBERADO 🟢'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {isStopHit
                ? 'Corretoras bloqueadas para conter o Urso da Fúria'
                : 'Acesso liberado sob custódia da gestão de risco'}
            </p>
          </div>
        </div>

        {/* Limite de Stop Loss */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Limite de Stop (R$)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-rose-400 shadow-md">
              <Lock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {formatCurrency(dailyLossLimit)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Barreira inviolável do plano de trade</p>
          </div>
        </div>

        {/* PnL Atual */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Resultado PnL Hoje
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-md">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {todayPnl > 0 ? '+' : ''}
              {formatCurrency(todayPnl)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {todayTradesCount} trade(s) computado(s) hoje
            </p>
          </div>
        </div>

        {/* Assertividade & PF */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assertividade / PF
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-teal-300">
                {winRate.toFixed(1)}%
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                (PF: {profitFactor.toFixed(2)})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Força técnica acumulada</p>
          </div>
        </div>

        {/* Desbloqueio 00:00 */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Desbloqueio (00:00)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-purple-300 tracking-tight">
              {countdownText || '00h 00m 00s'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Tempo até a abertura da nova janela</p>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS PRINCIPAIS (APENAS PARA ADMIN - CLIENTES VÊEM DIRETO A ABA DE INSTALAÇÃO) */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-800 bg-black p-2 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('lockscreen')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition ${
              activeTab === 'lockscreen'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-rose-300" />
            <span>Tela de Bloqueio &amp; Duelo Touro vs. Urso</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition ${
              activeTab === 'install'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Instalação no Chrome &amp; Passo a Passo</span>
          </button>

          <button
            onClick={() => setActiveTab('domains')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition ${
              activeTab === 'domains'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Corretoras Bloqueadas ({domains.length})</span>
          </button>
        </div>
      )}

      {/* ABA 1: TELA DE BLOQUEIO INTEGRADA COM O DUELO TOURO VS URSO INCORPORADO (EXCLUSIVA ADMIN) */}
      {isAdmin && activeTab === 'lockscreen' && renderLockScreenComponent(false)}

      {/* ABA 2: INSTALAÇÃO NO NAVEGADOR & PASSO A PASSO */}
      {activeTab === 'install' && (
        <div className="rounded-3xl border border-slate-800 bg-black p-6 shadow-2xl space-y-6">
          <div className="rounded-2xl border border-rose-600/40 bg-gradient-to-r from-rose-950/50 via-black to-slate-950 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-rose-400" />
                <span>Pacote ZIP Pré-Configurado</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                A extensão foi gerada sob medida para a sua conta, configurada para bloquear o acesso às corretoras imediatamente quando o prejuízo atingir <strong>{formatCurrency(dailyLossLimit)}</strong>.
              </p>
            </div>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-lg shadow-rose-950/80 shrink-0 disabled:opacity-60"
            >
              {isDownloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isDownloading ? 'Gerando Pacote...' : 'Baixar Extensão (.ZIP)'}</span>
            </button>
          </div>

          {downloadSuccess && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Download iniciado com sucesso! Siga o passo a passo abaixo para instalar no seu navegador.</span>
            </div>
          )}

          {/* Passo a passo visual de instalação */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Laptop className="h-4 w-4 text-rose-400" />
              <span>Passo a Passo de Instalação (Chrome, Edge, Brave, Opera):</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-2xl border border-slate-800 bg-black p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 font-mono font-bold text-white text-xs">
                    1
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PASSO 1</span>
                </div>
                <h5 className="font-bold text-white text-sm">Extrair o arquivo .ZIP</h5>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Descompacte o arquivo baixado (<code className="text-rose-300 font-mono">anti-furia-trader-extensao.zip</code>) em uma pasta fixa no seu computador.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 font-mono font-bold text-white text-xs">
                    2
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PASSO 2</span>
                </div>
                <h5 className="font-bold text-white text-sm">Abrir Extensões</h5>
                <p className="text-slate-400 text-xs leading-relaxed">
                  No seu navegador, acesse o endereço <code className="text-rose-300 font-mono">chrome://extensions</code> na barra de navegação.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 font-mono font-bold text-white text-xs">
                    3
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PASSO 3</span>
                </div>
                <h5 className="font-bold text-white text-sm">Modo Desenvolvedor</h5>
                <p className="text-slate-400 text-xs leading-relaxed">
                  No canto superior direito da tela de extensões, ative a chave seletora <strong>&quot;Modo de Desenvolvedor&quot;</strong>.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 font-mono font-bold text-white text-xs">
                    4
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PASSO 4</span>
                </div>
                <h5 className="font-bold text-white text-sm">Carregar sem compactação</h5>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Clique em <strong>&quot;Carregar sem compactação&quot;</strong> no topo e escolha a pasta extraída. A extensão será ativada instantaneamente!
                </p>
              </div>
            </div>
          </div>

          {/* Seção Adicional: Blindagem para Aplicativo Desktop Windows (.MSI / .EXE) */}
          <div className="rounded-2xl border border-slate-800 bg-black p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Blindagem para Aplicativos Desktop Windows (.MSI / .EXE)
                  </h4>
                  <span className="rounded-full bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-0.5 text-[9px] font-extrabold text-emerald-300 uppercase font-mono">
                    BLINDAGEM NATIVA
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-xl">
                  Opera utilizando o software instalado no Windows (ex: Exnova.msi, IQ Option.exe)? Baixe o script de blindagem do Windows para bloquear o acesso nos aplicativos desktop.
                </p>
              </div>

              <button
                onClick={() => downloadWindowsLockerBat(domains)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition shadow-lg shadow-emerald-950/50 shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Blindagem Windows (.BAT)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-black p-3 space-y-1">
                <span className="font-mono text-emerald-400 font-bold">1. Bloqueio no Arquivo Hosts</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">Redireciona a resolução DNS dos servidores no Windows para 127.0.0.1, impedindo conexões do app desktop.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black p-3 space-y-1">
                <span className="font-mono text-emerald-400 font-bold">2. Encerramento de Processos</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">Encerra automaticamente os executáveis (.exe) ativos da Exnova, IQ Option e Quotex no Windows.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black p-3 space-y-1">
                <span className="font-mono text-emerald-400 font-bold">3. Execução em 1-Clique</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">Basta clicar com o botão direito no arquivo baixado e escolher &quot;Executar como Administrador&quot;.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: GERENCIAMENTO DE CORRETORAS BLOQUEADAS (EXCLUSIVO ADMIN) */}
      {isAdmin && activeTab === 'domains' && (
        <div className="rounded-3xl border border-slate-800 bg-black p-6 shadow-2xl space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe className="h-4 w-4 text-rose-400" />
                  <span>Lista de Corretoras &amp; Sites Bloqueados</span>
                </h4>
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-extrabold text-white uppercase">
                  PAINEL ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ao atingir o Stop Loss, o acesso a estes domínios será interrompido pela extensão do navegador.
              </p>
            </div>

            {/* Adicionar Domínio */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                placeholder="Ex: exnova.com, quotex.com, iqoption.com"
                className="flex-1 rounded-xl border border-slate-800 bg-black px-4 py-2.5 text-xs text-white focus:border-rose-500 focus:outline-none font-mono"
              />
              <button
                onClick={handleAddDomain}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition shadow-md shrink-0"
              >
                <Plus className="h-4 w-4 text-rose-400" />
                <span>Adicionar Corretora</span>
              </button>
            </div>

            {/* Lista de Domínios Cadastrados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {domains.map((dom) => (
                <div
                  key={dom}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-black px-4 py-3 text-xs"
                >
                  <span className="font-mono font-bold text-slate-200">{dom}</span>
                  <button
                    onClick={() => handleRemoveDomain(dom)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                    title="Remover da lista de bloqueio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-950/50"
              >
                <Download className="h-4 w-4" />
                <span>Baixar ZIP Atualizado com estas Corretoras</span>
              </button>
            </div>
          </div>
      )}

      {/* OVERLAY DE SIMULAÇÃO EM TELA CHEIA (100% VIEWPORT - DESIGN 100% FIEL AO PRINT OFICIAL) */}
      {isFullscreenPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center overflow-y-auto p-4 sm:p-8">
          {/* Botão Flutuante de Fechar no Canto Superior Direito */}
          <button
            onClick={() => setIsFullscreenPreviewOpen(false)}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs border border-slate-700 shadow-2xl transition"
            title="Fechar simulação em tela cheia (ou pressione ESC)"
          >
            <X className="h-4 w-4 text-rose-400" />
            <span>Sair da Simulação (ESC)</span>
          </button>

          {/* Renderização do Componente de Bloqueio em Tela Cheia */}
          {renderLockScreenComponent(true)}
        </div>
      )}
    </div>
  );
};
