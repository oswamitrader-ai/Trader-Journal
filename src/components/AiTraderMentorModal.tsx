import React, { useState } from 'react';
import {
  X,
  Brain,
  MessageSquare,
  Sparkles,
  Send,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  OverallMetrics,
  RiskSettings,
  Trade,
  AiAnalysisResult,
  ChatMessage,
} from '../types';

interface AiTraderMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: OverallMetrics;
  settings: RiskSettings;
  trades: Trade[];
}

export const AiTraderMentorModal: React.FC<AiTraderMentorModalProps> = ({
  isOpen,
  onClose,
  metrics,
  settings,
  trades,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'chat'>('audit');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        trades.length > 0
          ? `Olá, Trader! Eu sou o seu Mentor de Gestão de Risco e Psicologia Operacional. Analisei suas estatísticas reais: você tem ${trades.length} operações registradas, assertividade de ${metrics.winRate.toFixed(1)}% e capital de R$ ${metrics.currentCapital.toFixed(2)}. Como posso te ajudar hoje? Quer revisar uma estratégia, discutir disciplina de stop ou planejar metas?`
          : `Olá, Trader! Eu sou o seu Mentor de Gestão de Risco e Psicologia Operacional. Seu diário está pronto para registrar dados 100% reais. Conforme você adicionar suas operações, fornecerei auditorias de risco, cálculo de payoff e dicas psicológicas personalizadas. Como posso te apoiar no seu plano de trade hoje?`,
      timestamp: 'Agora',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  if (!isOpen) return null;

  const sanitizeErrorMessage = (msg: string): string => {
    if (!msg) return 'Erro de comunicação temporário.';
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('demanda')) {
      return 'O modelo de IA está enfrentando alta demanda temporária nos servidores do Google. Por favor, tente novamente em alguns segundos.';
    }
    return msg;
  };

  // Trigger Gemini AI Audit
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const recentTradesSample = trades.slice(0, 15).map((t) => ({
        date: t.date,
        asset: t.asset,
        type: t.type,
        strategy: t.strategy,
        result: t.result,
        pnl: t.pnl,
        notes: t.notes,
      }));

      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: metrics,
          currentRiskSettings: settings,
          recentTrades: recentTradesSample,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao conectar com o serviço de análise.');
      }

      const data: AiAnalysisResult = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      console.warn('Erro na análise:', err);
      setAnalysisError(sanitizeErrorMessage(err.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send message to Gemini Trader Chatbot
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSendingMessage) return;

    const userText = inputMessage.trim();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          traderContext: {
            currentCapital: metrics.currentCapital,
            netProfit: metrics.netProfit,
            winRate: metrics.winRate,
            maxDrawdownPercent: metrics.maxDrawdownPercent,
            dailyLossLimit: settings.dailyLossLimit,
            dailyProfitTarget: settings.dailyProfitTarget,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha na resposta do mentor.');
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...newMessages, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${sanitizeErrorMessage(err.message)}`,
        timestamp: 'Agora',
      };
      setMessages([...newMessages, errMsg]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Dicas de Manejo (Gestão Conservadora baseada no Profit Factor)
  const pf = metrics.profitFactor;
  let lotAdvice = {
    title: 'Mão Padrão Recomendada (100% da Mão Base)',
    badge: 'Consistente',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    borderColor: 'border-emerald-500/30 bg-emerald-950/20',
    iconColor: 'text-emerald-400',
    description:
      'Seu Fator de Lucro está em nível saudável. Mantenha o tamanho de lote padrão estipulado em seu plano de trade, sem aumentar a mão desnecessariamente.',
    action: 'Mantenha 100% da mão padrão sem alavancagem extra.',
  };

  if (pf >= 2.0) {
    lotAdvice = {
      title: 'Desempenho de Alta Vantagem (Fator de Lucro >= 2.0)',
      badge: 'Excelente',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      borderColor: 'border-emerald-500/30 bg-emerald-950/20',
      iconColor: 'text-emerald-400',
      description:
        'Sua estratégia apresenta excelente expectativa matemática positiva. Você tem margem estatística para operar com sua mão cheia padrão ou realizar expansões graduais de lote (ex: +10%), contanto que respeite o stop loss financeiro.',
      action: 'Mão Cheia Padrão (100% a 110% do lote habitual).',
    };
  } else if (pf >= 1.3) {
    lotAdvice = {
      title: 'Desempenho Estável (Fator de Lucro entre 1.3 e 1.99)',
      badge: 'Estável',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      borderColor: 'border-teal-500/30 bg-teal-950/20',
      iconColor: 'text-teal-400',
      description:
        'Seus ganhos superam com folga as perdas. Mantenha exatamente o lote base do seu gerenciamento (100%), focando em selecionar apenas os setups com melhor simetria risco-retorno.',
      action: 'Mantenha 100% da mão base.',
    };
  } else if (pf >= 1.0) {
    lotAdvice = {
      title: 'Gestão Defensiva: Redução de Mão (Fator de Lucro entre 1.0 e 1.29)',
      badge: 'Atenção / Margem Apertada',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      borderColor: 'border-amber-500/30 bg-amber-950/20',
      iconColor: 'text-amber-400',
      description:
        'Sua vantagem matemática está apertada. Aplicando a gestão conservadora, é recomendado reduzir o tamanho da sua mão em 25% a 30% até que a média de ganhos aumente e a assertividade se consolide.',
      action: 'Reduzir mão para 70% a 75% do lote padrão.',
    };
  } else {
    lotAdvice = {
      title: 'Alerta de Risco: Mão Mínima Defensiva (Fator de Lucro < 1.0)',
      badge: 'Redução Drástica Necessária',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      borderColor: 'border-rose-500/30 bg-rose-950/20',
      iconColor: 'text-rose-400',
      description:
        'Sua curva está no prejuízo acumulado. Recomendação de gestão conservadora estrita: reduza a mão em 50% ou opere com o lote mínimo de 1 contrato/lote base até acumular 5 a 10 trades positivos consecutivos.',
      action: 'Operar no lote mínimo ou 50% da mão para proteção patrimonial.',
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm pt-safe pb-safe">
      <div className="flex h-[92vh] sm:h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-black shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 bg-black/70">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Mentor Trader IA</h3>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Auditoria de risco, psicologia comportamental e conselhos técnicos personalizados
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="sm:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Switcher & Close */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <div className="flex rounded-xl bg-black p-1 border border-slate-800 w-full sm:w-auto justify-center">
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition flex-1 sm:flex-initial ${
                  activeTab === 'audit'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Diagnóstico
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition flex-1 sm:flex-initial ${
                  activeTab === 'chat'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat Mentor
              </button>
            </div>

            <button
              onClick={onClose}
              className="hidden sm:block rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
          {/* TAB 1: DIAGNÓSTICO DE PERFORMANCE */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              {/* CARD DICAS DE MANEJO (Gestão de Tamanho de Mão / Lote baseada no Profit Factor) */}
              <div className={`rounded-2xl border ${lotAdvice.borderColor} p-4 space-y-2.5 backdrop-blur-sm`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-black ${lotAdvice.iconColor} border border-slate-800`}>
                      <Sliders className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Dicas de Manejo (Tamanho da Mão / Lote)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Ajustes automáticos de gestão conservadora baseados no Fator de Lucro atual ({pf.toFixed(2)})
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border self-start sm:self-center ${lotAdvice.badgeColor}`}>
                    {lotAdvice.badge}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <h5 className="font-bold text-white text-xs">
                    {lotAdvice.title}
                  </h5>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {lotAdvice.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-black/80 border border-slate-800 text-[11px]">
                    <strong className="text-slate-400">Orientação Tática:</strong>
                    <span className="font-bold text-teal-300 font-mono">{lotAdvice.action}</span>
                  </div>
                </div>
              </div>
              {/* Trigger Card */}
              {!analysisResult && !isAnalyzing && (
                <div className="rounded-2xl border border-slate-800 bg-black/60 p-6 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Solicitar Auditoria de Performance & Risco
                  </h4>
                  <p className="max-w-md mx-auto text-slate-400 leading-relaxed">
                    A IA analisará seu histórico de trades, assertividade ({metrics.winRate.toFixed(1)}%),
                    fator de lucro ({metrics.profitFactor.toFixed(2)}), rebaixamento de capital (drawdown de{' '}
                    {metrics.maxDrawdownPercent.toFixed(1)}%) e fornecerá recomendações acionáveis para melhorar sua consistência.
                  </p>
                  <button
                    onClick={handleRunAnalysis}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-900/30 hover:bg-teal-500 transition active:scale-95"
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar Diagnóstico com IA
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isAnalyzing && (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="mx-auto h-8 w-8 text-teal-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">
                    O Mentor IA está analisando seus trades e métricas de risco...
                  </p>
                  <p className="text-slate-400">
                    Calculando índice de consistência, relação risco:retorno e hábitos operacionais.
                  </p>
                </div>
              )}

              {/* Error state */}
              {analysisError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-rose-300 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400" />
                  <div>
                    <strong className="block font-bold">Aviso</strong>
                    <span>{analysisError}</span>
                    <button
                      onClick={handleRunAnalysis}
                      className="mt-2 block rounded bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-200"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              )}

              {/* Analysis Result Display */}
              {analysisResult && (
                <div className="space-y-4">
                  {/* Top Score Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-950 via-teal-950/20 to-slate-950 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 font-mono font-black text-xl border border-teal-500/30">
                        {analysisResult.score}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            Índice de Disciplina & Consistência
                          </span>
                          <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/30">
                            {analysisResult.statusTag}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Baseado em {trades.length} operações e aderência aos parâmetros de risco
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleRunAnalysis}
                      className="flex items-center gap-1.5 self-end sm:self-center rounded-xl border border-slate-800 bg-black px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Atualizar Análise
                    </button>
                  </div>

                  {/* Highlights Bullets */}
                  <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                    <h5 className="font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Pontos Observados pelo Mentor
                    </h5>
                    <ul className="space-y-1.5">
                      {analysisResult.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Diagnosis */}
                  <div className="rounded-xl border border-slate-800 bg-black/40 p-4">
                    <h5 className="font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-blue-400" />
                      Diagnóstico de Risco & Drawdown
                    </h5>
                    <p className="text-slate-300 leading-relaxed">
                      {analysisResult.riskDiagnosis}
                    </p>
                  </div>

                  {/* Tactical Advice & Psychology */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-teal-500/20 bg-teal-950/10 p-3.5">
                      <h5 className="font-bold text-teal-300 mb-1 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" /> Ação Tática Recomendada
                      </h5>
                      <p className="text-slate-300 leading-relaxed">
                        {analysisResult.tacticalAdvice}
                      </p>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-3.5">
                      <h5 className="font-bold text-purple-300 mb-1 flex items-center gap-1.5">
                        <Lightbulb className="h-4 w-4" /> Psicologia & Disciplina
                      </h5>
                      <p className="text-slate-300 leading-relaxed">
                        {analysisResult.psychologyTip}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHAT COM MENTOR TRADER */}
          {activeTab === 'chat' && (
            <div className="flex h-full flex-col justify-between">
              {/* Message Thread */}
              <div className="space-y-3 pr-2 overflow-y-auto max-h-[50vh]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/40'
                          : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="mt-1 text-[10px] text-slate-500 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {isSendingMessage && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-400" />
                    <span>Mentor Trader está digitando...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Pergunte sobre gestão, disciplina, estratégias ou desabafe sobre um trade..."
                    className="flex-1 rounded-xl border border-slate-800 bg-black px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isSendingMessage}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-900/30 hover:bg-teal-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
