import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Laptop,
  Lock,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Sparkles,
  Globe,
} from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import {
  generateExtensionZip,
  DEFAULT_BLOCKED_DOMAINS,
} from '../utils/extensionGenerator';

interface AntiFuriaExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStopHit: boolean;
  todayPnl: number;
  dailyLossLimit: number;
  winRate?: number;
  profitFactor?: number;
  todayTradesCount?: number;
  currentCapital?: number;
}

export const AntiFuriaExtensionModal: React.FC<AntiFuriaExtensionModalProps> = ({
  isOpen,
  onClose,
  isStopHit,
  todayPnl,
  dailyLossLimit,
  winRate = 0,
  profitFactor = 0,
  todayTradesCount = 0,
  currentCapital = 0,
}) => {
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
  const [activeTab, setActiveTab] = useState<'install' | 'domains' | 'preview'>('install');
  const [countdownText, setCountdownText] = useState('');

  // Persist customized domains to LocalStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('trader_journal_blocked_domains_v1', JSON.stringify(domains));
    } catch (e) {
      console.error(e);
    }
  }, [domains]);

  React.useEffect(() => {
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

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await generateExtensionZip({
        dailyLossLimit,
        blockedDomains: domains,
        appName: 'Diário de Trade Pro',
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

  const triggerTestSimulation = () => {
    // Sends postMessage to test the bridge in the browser
    window.postMessage(
      {
        type: 'ANTI_FURIA_SYNC',
        isStopHit: true,
        todayPnl: -dailyLossLimit,
        dailyLossLimit: dailyLossLimit,
      },
      '*'
    );
    setActiveTab('preview');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md animate-fade-in pt-safe pb-safe"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden rounded-2xl border border-red-900/60 bg-slate-900 shadow-2xl flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-3.5 sm:px-5 py-3 sm:py-4 bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-900/40 shrink-0">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded-full bg-red-500/20 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-red-300 border border-red-500/30 shrink-0">
                  Proteção Psicológica
                </span>
                <h3 className="text-xs sm:text-base md:text-lg font-black text-white truncate">
                  Extensão Trava Anti-Fúria
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                Bloqueia o acesso a corretoras imediatamente ao atingir o Stop Loss diário
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0 ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Status Bar */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={`flex h-2.5 w-2.5 rounded-full shrink-0 ${
                isStopHit ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
              }`}
            />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate">
              Trava Hoje:{' '}
              {isStopHit ? (
                <strong className="text-red-400 uppercase">STOP ATIVO</strong>
              ) : (
                <strong className="text-emerald-400 uppercase">LIBERADO</strong>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono shrink-0">
            <span className="text-slate-400">
              Hoje: <strong className={todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(todayPnl)}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Stop: <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong>
            </span>
          </div>
        </div>

        {/* Tab Selector (Always 100% visible on mobile with 3-column responsive segmented control) */}
        <div className="border-b border-slate-800 bg-slate-950/95 p-1.5 sm:p-2.5 shrink-0 z-10">
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            <button
              id="tab-btn-install"
              onClick={() => setActiveTab('install')}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeTab === 'install'
                  ? 'bg-red-600/25 border border-red-500/60 text-red-300 shadow-sm shadow-red-950/50'
                  : 'bg-slate-900/60 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span className="truncate hidden sm:inline">Instalação no Chrome</span>
              <span className="truncate sm:hidden">Instalar</span>
            </button>
            <button
              id="tab-btn-domains"
              onClick={() => setActiveTab('domains')}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeTab === 'domains'
                  ? 'bg-red-600/25 border border-red-500/60 text-red-300 shadow-sm shadow-red-950/50'
                  : 'bg-slate-900/60 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span className="truncate hidden sm:inline">Corretoras Bloqueadas ({domains.length})</span>
              <span className="truncate sm:hidden">Corretoras ({domains.length})</span>
            </button>
            <button
              id="tab-btn-preview"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center ${
                activeTab === 'preview'
                  ? 'bg-red-600/25 border border-red-500/60 text-red-300 shadow-sm shadow-red-950/50'
                  : 'bg-slate-900/60 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span className="truncate hidden sm:inline">Prévia do Bloqueio</span>
              <span className="truncate sm:hidden">Prévia</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 text-sm text-slate-300">
          {activeTab === 'install' && (
            <div className="space-y-5">
              {/* Highlight Action: Download ZIP */}
              <div className="rounded-2xl border border-red-600/40 bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-950 p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-white font-extrabold text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-red-400" />
                      Extensão Pronta e Pré-configurada
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Criamos os arquivos da extensão configurados para o seu limite de stop de{' '}
                      <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong> e bloqueio automático da <strong>Exnova</strong> e outras plataformas.
                    </p>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center justify-center gap-2.5 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/60 hover:bg-red-500 transition active:scale-95 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{isDownloading ? 'Gerando...' : 'Baixar Extensão (.ZIP)'}</span>
                  </button>
                </div>

                {downloadSuccess && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-xl animate-fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Download iniciado! Siga o passo a passo abaixo para ativar no Chrome.</span>
                  </div>
                )}
              </div>

              {/* Step by step install guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Passo a Passo de Instalação (Simples e Rápido):
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs">
                      1
                    </div>
                    <div>
                      <strong className="text-white block text-sm">Extraia o arquivo .ZIP</strong>
                      <p className="text-slate-400 mt-1 leading-relaxed">
                        Descompacte o arquivo baixado em uma pasta fixa no seu computador (por exemplo, na pasta Documentos).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs">
                      2
                    </div>
                    <div>
                      <strong className="text-white block text-sm">Abra chrome://extensions</strong>
                      <p className="text-slate-400 mt-1 leading-relaxed">
                        No Google Chrome (ou Brave / Edge), digite <code className="text-red-300 bg-red-950/60 px-1 py-0.5 rounded">chrome://extensions</code> na barra de endereços e aperte Enter.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs">
                      3
                    </div>
                    <div>
                      <strong className="text-white block text-sm">Ative o Modo de Desenvolvedor</strong>
                      <p className="text-slate-400 mt-1 leading-relaxed">
                        No canto superior direito da página de extensões, ligue a chave seletora <strong>&quot;Modo de Desenvolvedor&quot;</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs">
                      4
                    </div>
                    <div>
                      <strong className="text-white block text-sm">Carregar sem Compactação</strong>
                      <p className="text-slate-400 mt-1 leading-relaxed">
                        Clique no botão <strong>&quot;Carregar sem compactação&quot;</strong> no canto esquerdo e selecione a pasta onde extraiu a extensão. Pronto!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-400" />
                  Como a extensão bloqueia a Exnova na prática:
                </h5>
                <ul className="mt-2.5 space-y-2 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Sincronização em Tempo Real:</strong> Quando você registra as operações no seu diário e o P&amp;L bate o limite de perda, a extensão detecta imediatamente.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Fechamento Imediato de Abas Abertas:</strong> Se você já estiver com a aba da Exnova aberta no momento do stop, a extensão redireciona a aba instantaneamente para a tela de intervenção psicológica.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Desbloqueio Automático à Meia-Noite:</strong> O bloqueio é rigoroso durante o restante do dia e se desfaz automaticamente à meia-noite (00:00:00) para o início do novo ciclo operacional.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-bold text-sm">Lista de Corretoras Monitoradas</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Qualquer tentativa de acessar estes domínios após o stop loss será bloqueada:
                </p>
              </div>

              {/* Add custom domain */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  placeholder="ex: exnova.com, quotex.com"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
                <button
                  onClick={handleAddDomain}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 transition"
                >
                  <Plus className="w-4 h-4 text-red-400" />
                  <span>Adicionar</span>
                </button>
              </div>

              {/* Domain List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {domains.map((dom) => (
                  <div
                    key={dom}
                    className="flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-mono text-slate-200 font-medium">{dom}</span>
                    <button
                      onClick={() => handleRemoveDomain(dom)}
                      className="text-slate-500 hover:text-red-400 p-1 transition"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar ZIP Atualizado com estas Corretoras</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold text-sm">Visualização da Tela de Intervenção</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    É esta tela que o trader vê caso tente burlar a gestão e acessar a Exnova após o stop:
                  </p>
                </div>
                <button
                  onClick={triggerTestSimulation}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold px-3 py-1.5 transition flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Simular Sinal</span>
                </button>
              </div>

              {/* Simulated Screen */}
              <div className="rounded-2xl border-2 border-red-500 bg-[#090d16] text-white overflow-hidden shadow-2xl">
                <div className="bg-red-600 text-white p-5 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/25 mb-2">
                    <ShieldAlert className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-base font-black tracking-wide uppercase">
                    Acesso Bloqueado pelo Plano de Trade
                  </h3>
                  <p className="text-xs text-white/90 font-medium mt-0.5">
                    Você bateu o seu Stop Loss diário na corretora Exnova
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* 4-Card Rich Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assertividade</div>
                      <div className="text-sm font-mono font-extrabold text-emerald-400 mt-0.5">
                        {winRate > 0 ? `${winRate.toFixed(1)}%` : '--%'}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fator Lucro</div>
                      <div className="text-sm font-mono font-extrabold text-sky-400 mt-0.5">
                        {profitFactor > 0 ? profitFactor.toFixed(2) : '--'}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trades Hoje</div>
                      <div className="text-sm font-mono font-extrabold text-slate-200 mt-0.5">
                        {todayTradesCount > 0 ? `${todayTradesCount} trades` : '1 trade'}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Atual</div>
                      <div className="text-sm font-mono font-extrabold text-slate-200 mt-0.5">
                        {currentCapital > 0 ? formatCurrency(currentCapital) : 'R$ --'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Limite de Stop
                      </span>
                      <div className="text-lg font-mono font-bold text-white mt-0.5">
                        {formatCurrency(dailyLossLimit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Resultado Hoje
                      </span>
                      <div className="text-lg font-mono font-bold text-red-400 mt-0.5">
                        {formatCurrency(todayPnl <= -dailyLossLimit ? todayPnl : -dailyLossLimit)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-red-950/30 border-l-4 border-red-500 p-3.5 text-xs leading-relaxed text-slate-300 space-y-1">
                    <div className="font-extrabold text-red-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-red-400" />
                      Diagnóstico do Mentor IA
                    </div>
                    <p className="text-slate-300 leading-normal">
                      {winRate >= 50 ? (
                        <>
                          Sua taxa de assertividade geral é de <strong className="text-emerald-400">{winRate.toFixed(1)}%</strong> com Fator de Lucro de <strong className="text-sky-400">{profitFactor.toFixed(2)}</strong>. Seu histórico prova que sua técnica funciona! Não destrua semanas de lucro por causa de um Stop Loss diário de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong>. Aceitar a perda de hoje protege seu patrimônio para continuar vencendo no próximo ciclo.
                        </>
                      ) : todayTradesCount >= 4 ? (
                        <>
                          Você já realizou <strong className="text-amber-400">{todayTradesCount} operações</strong> hoje e atingiu o limite de Stop Loss. Continuar operando sob forte emoção (tilt/fúria) é o principal motivo de quebra de bancas. Feche a corretora agora, estude seu histórico no diário e volte revigorado na sua próxima janela!
                        </>
                      ) : (
                        <>
                          O maior destruidor de bancas em Opções Binárias e Mercado Financeiro não é a taxa de acerto, é o dia de fúria após tomar o stop. Aceitar a perda de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong> é a decisão que separa um apostador de um trader profissional.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">
                      Acesso liberado novamente à meia-noite (00:00:00)
                    </div>
                    <div className="text-2xl font-mono font-black text-sky-400 mt-1">
                      {countdownText || '00h 00m 00s'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-950 px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Chrome, Brave, Opera e Edge</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 transition shrink-0 ml-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
