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
} from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import {
  generateExtensionZip,
  DEFAULT_BLOCKED_DOMAINS,
} from '../utils/extensionGenerator';

interface AntiFuriaExtensionPageProps {
  onBackToDashboard: () => void;
  isStopHit: boolean;
  todayPnl: number;
  dailyLossLimit: number;
  winRate?: number;
  profitFactor?: number;
  todayTradesCount?: number;
  currentCapital?: number;
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

  const triggerTestSimulation = () => {
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
                  Trava Anti-Fúria — Extensão de Proteção Psicológica
                </h1>
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase shadow-md shadow-rose-900/40">
                  SISTEMA DE BLINDAGEM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bloqueia automaticamente o acesso às corretoras (Exnova, Quotex, IQ Option) ao atingir o Stop Loss diário.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow-lg shadow-rose-900/50 shrink-0 self-start sm:self-auto disabled:opacity-60"
        >
          {isDownloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{isDownloading ? 'Gerando Pacote...' : 'Baixar Extensão (.ZIP)'}</span>
        </button>
      </div>

      {/* PAINEL DE STATUS EM TEMPO REAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Status Atual da Trava */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl relative overflow-hidden">
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
                ? 'Corretoras bloqueadas para proteger seu capital'
                : 'Operações autorizadas pela gestão de risco'}
            </p>
          </div>
        </div>

        {/* Limite de Loss Diário */}
        <div className="rounded-2xl border border-slate-800 bg-black p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Limite de Stop Loss (R$)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-rose-400 shadow-md">
              <Lock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {formatCurrency(dailyLossLimit)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Gatilho de acionamento do bloqueio</p>
          </div>
        </div>

        {/* PnL Atual do Dia */}
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
              {todayTradesCount} trade(s) realizado(s) hoje
            </p>
          </div>
        </div>

        {/* Assertividade & Fator de Lucro */}
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
            <p className="text-[11px] text-slate-400 mt-1">Desempenho histórico consolidado</p>
          </div>
        </div>

        {/* Desbloqueio à Meia-Noite */}
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
            <p className="text-[11px] text-slate-400 mt-1">Tempo até o novo ciclo operacional</p>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS DA TELA */}
      <div className="rounded-2xl border border-slate-800 bg-black p-2 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('install')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === 'install'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>Instalação no Navegador &amp; Guia</span>
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

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === 'preview'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>Prévia da Tela de Intervenção</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="rounded-3xl border border-slate-800 bg-black p-6 shadow-2xl space-y-6">
        {/* ABA 1: INSTALAÇÃO E PASSO A PASSO */}
        {activeTab === 'install' && (
          <div className="space-y-6">
            {/* Banner de Download do ZIP */}
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
                {/* Passo 1 */}
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

                {/* Passo 2 */}
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

                {/* Passo 3 */}
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

                {/* Passo 4 */}
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

            {/* Como a trava funciona na prática */}
            <div className="rounded-2xl border border-slate-800 bg-black p-5 space-y-3">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4 text-rose-400" />
                <span>Mecanismos de Bloqueio &amp; Proteção Psicológica</span>
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-black space-y-1">
                  <strong className="text-emerald-400 block text-xs">1. Captura de Trades ao Vivo</strong>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    A extensão monitora os trades em tempo real na Exnova/Quotex e os sincroniza automaticamente no diário sem intervenção manual.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-black space-y-1">
                  <strong className="text-rose-400 block text-xs">2. Redirecionamento Imediato</strong>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Caso o Stop Loss seja atingido, as abas das corretoras são redirecionadas na hora para a tela de intervenção com o mentor IA.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-black space-y-1">
                  <strong className="text-purple-400 block text-xs">3. Reset Automático (Meia-Noite)</strong>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    O bloqueio permanece inviolável até a virada do dia (00:00:00), quando o novo ciclo é aberto com a mente descansada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: GERENCIAMENTO DE CORRETORAS BLOQUEADAS */}
        {activeTab === 'domains' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Globe className="h-4 w-4 text-rose-400" />
                <span>Lista de Corretoras &amp; Sites Bloqueados</span>
              </h4>
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

        {/* ABA 3: PRÉVIA DA TELA DE INTERVENÇÃO */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Eye className="h-4 w-4 text-rose-400" />
                  <span>Prévia Interativa da Tela de Intervenção Psicológica</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Esta é a interface que aparece no navegador do trader quando ele tenta acessar a corretora sob Stop Loss.
                </p>
              </div>

              <button
                onClick={triggerTestSimulation}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900 hover:text-white text-xs font-bold transition shadow-md shrink-0"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Simular Sinal de Stop</span>
              </button>
            </div>

            {/* Tela Simulada do Bloqueio */}
            <div className="rounded-3xl border-2 border-rose-600 bg-black text-white overflow-hidden shadow-2xl">
              <div className="bg-rose-600 text-white p-6 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black/25 mb-3 shadow-inner">
                  <ShieldAlert className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-black tracking-wide uppercase">
                  Acesso Bloqueado pelo Plano de Trade
                </h3>
                <p className="text-xs text-white/90 font-medium mt-1">
                  Você atingiu o seu Stop Loss diário na corretora e a Trava Anti-Fúria foi ativada.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* 4 Cards de Métricas na Intervenção */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-black border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assertividade</div>
                    <div className="text-base font-mono font-black text-emerald-400 mt-1">
                      {winRate > 0 ? `${winRate.toFixed(1)}%` : '--%'}
                    </div>
                  </div>
                  <div className="bg-black border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fator Lucro</div>
                    <div className="text-base font-mono font-black text-teal-300 mt-1">
                      {profitFactor > 0 ? profitFactor.toFixed(2) : '--'}
                    </div>
                  </div>
                  <div className="bg-black border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trades Hoje</div>
                    <div className="text-base font-mono font-black text-slate-200 mt-1">
                      {todayTradesCount > 0 ? `${todayTradesCount} trades` : '1 trade'}
                    </div>
                  </div>
                  <div className="bg-black border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Atual</div>
                    <div className="text-base font-mono font-black text-slate-200 mt-1">
                      {currentCapital > 0 ? formatCurrency(currentCapital) : 'R$ --'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-black border border-slate-800 rounded-2xl p-4 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Limite de Stop
                    </span>
                    <div className="text-xl font-mono font-black text-white mt-1">
                      {formatCurrency(dailyLossLimit)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Resultado Hoje
                    </span>
                    <div className="text-xl font-mono font-black text-rose-400 mt-1">
                      {formatCurrency(todayPnl <= -dailyLossLimit ? todayPnl : -dailyLossLimit)}
                    </div>
                  </div>
                </div>

                {/* Caixa do Mentor IA */}
                <div className="rounded-2xl bg-rose-950/40 border border-rose-500/40 p-4 text-xs leading-relaxed text-slate-200 space-y-1.5">
                  <div className="font-extrabold text-rose-300 uppercase tracking-wide text-xs flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-rose-400" />
                    <span>Diagnóstico do Mentor IA TradeLock</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    {winRate >= 50 ? (
                      <>
                        Sua taxa de acerto é de <strong className="text-emerald-400">{winRate.toFixed(1)}%</strong> com Fator de Lucro de <strong className="text-teal-300">{profitFactor.toFixed(2)}</strong>. Sua estratégia é lucrativa! Não jogue fora semanas de resultado por causa de uma perda de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong>. Aceitar a perda de hoje é o segredo da consistência.
                      </>
                    ) : (
                      <>
                        O maior causador de quebra de bancas no mercado financeiro não é o loss individual, é a tentativa de recuperar o prejuízo no mesmo dia sob o efeito da fúria. Aceitar o stop de <strong className="text-white">{formatCurrency(dailyLossLimit)}</strong> preserva seu capital para vencer no próximo pregão.
                      </>
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-black border border-slate-800 p-4 text-center">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Acesso liberado novamente à meia-noite (00:00:00)
                  </div>
                  <div className="text-3xl font-mono font-black text-purple-300 mt-1">
                    {countdownText || '00h 00m 00s'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
