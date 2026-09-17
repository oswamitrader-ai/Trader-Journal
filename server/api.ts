import { Router, Request, Response, RequestHandler } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const apiRouter = Router();

// Lazy get Google GenAI client
let aiClient: GoogleGenAI | null = null;
export function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Allowed candidate models for fallback during high demand or quota limits
const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-3.8-flash",
];

async function generateContentWithFallback(ai: GoogleGenAI, requestOptions: any) {
  let lastError: any = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...requestOptions,
        model,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || "");
      console.warn(`[Gemini API] Tentativa com modelo '${model}' falhou: ${errorMsg.slice(0, 100)}...`);
      // Continue loop to try next model regardless of whether it was 503 or 429 quota limit
    }
  }
  throw lastError;
}

// Heuristic audit generator based on actual trading statistics
function generateStatisticalAudit(summary: any, currentRiskSettings: any, recentTrades: any[]) {
  const winRate = Number(summary?.winRate) || 0;
  const profitFactor = Number(summary?.profitFactor) || 0;
  const maxDrawdownPercent = Number(summary?.maxDrawdownPercent) || 0;
  const payoff = Number(summary?.payoff) || 0;
  const netProfit = Number(summary?.netProfit) || 0;
  const netProfitPercent = Number(summary?.netProfitPercent) || 0;
  const winCount = Number(summary?.winCount) || 0;
  const totalTrades = Number(summary?.totalTrades) || 0;
  const dailyLossLimit = Number(currentRiskSettings?.dailyLossLimit) || 300;
  const dailyProfitTarget = Number(currentRiskSettings?.dailyProfitTarget) || 500;

  // Score calculation (0 - 100)
  let score = 50;
  if (winRate >= 65) score += 20;
  else if (winRate >= 55) score += 15;
  else if (winRate >= 48) score += 8;
  else score -= 10;

  if (profitFactor >= 2.0) score += 20;
  else if (profitFactor >= 1.5) score += 15;
  else if (profitFactor >= 1.2) score += 10;
  else if (profitFactor >= 1.0) score += 5;
  else score -= 15;

  if (maxDrawdownPercent <= 5) score += 15;
  else if (maxDrawdownPercent <= 10) score += 8;
  else if (maxDrawdownPercent <= 15) score -= 5;
  else score -= 15;

  if (payoff >= 1.5) score += 10;
  else if (payoff >= 1.0) score += 5;
  else score -= 5;

  score = Math.min(98, Math.max(15, score));

  let statusTag: "Consistente" | "Em Evolução" | "Alerta de Risco" | "Crítico" = "Em Evolução";
  if (score >= 80) statusTag = "Consistente";
  else if (score >= 60) statusTag = "Em Evolução";
  else if (score >= 40) statusTag = "Alerta de Risco";
  else statusTag = "Crítico";

  const highlights = [
    `Taxa de assertividade em ${winRate.toFixed(1)}% (${winCount} ganhos em ${totalTrades} trades).`,
    `Fator de lucro de ${profitFactor.toFixed(2)} com payoff médio de ${payoff.toFixed(2)}.`,
    `Rebaixamento máximo de ${maxDrawdownPercent.toFixed(1)}% em relação ao topo histórico.`,
    `Resultado líquido acumulado de R$ ${netProfit.toFixed(2)} (${netProfitPercent.toFixed(1)}%).`,
  ];

  let riskDiagnosis = "";
  if (maxDrawdownPercent > 10) {
    riskDiagnosis = `Atenção ao drawdown acumulado de ${maxDrawdownPercent.toFixed(1)}%. Quando o rebaixamento ultrapassa 10%, a recuperação exige disciplina redobrada. Limite rigorosamente suas perdas diárias a R$ ${dailyLossLimit.toFixed(2)}.`;
  } else if (profitFactor >= 1.5 && winRate >= 50) {
    riskDiagnosis = `Excelente equilíbrio de risco! Seu fator de lucro (${profitFactor.toFixed(2)}) e payoff (${payoff.toFixed(2)}) indicam que você ganha mais quando acerta do que perde quando erra. Mantenha o stop diário em R$ ${dailyLossLimit.toFixed(2)} intacto.`;
  } else {
    riskDiagnosis = `Gerenciamento em fase de estruturação. Seu drawdown atual está controlado em ${maxDrawdownPercent.toFixed(1)}%, mas é vital manter uma proporção de ganho médio superior à perda média para assegurar consistência matemática a longo prazo.`;
  }

  let tacticalAdvice = "";
  if (winRate < 50 && payoff < 1.3) {
    tacticalAdvice = "Foque na seleção de setups de maior probabilidade a favor da tendência e evite operações de contra-tendência que degradam o payoff.";
  } else if (maxDrawdownPercent > 8) {
    tacticalAdvice = "Reduza a quantidade de contratos/lotes pela metade temporariamente até recuperar a confiança e estabilizar a curva de capital.";
  } else {
    tacticalAdvice = `Mantenha a meta diária referencial de R$ ${dailyProfitTarget.toFixed(2)} e limite de ${dailyLossLimit.toFixed(2)}. Ao atingir qualquer um dos dois, encerre o dia.`;
  }

  // Find most frequent profitable strategy in recent trades
  const strategyCounts: Record<string, number> = {};
  for (const t of recentTrades) {
    if (t.pnl > 0 && t.strategy) {
      strategyCounts[t.strategy] = (strategyCounts[t.strategy] || 0) + 1;
    }
  }
  const topStrategy = Object.keys(strategyCounts).sort((a, b) => strategyCounts[b] - strategyCounts[a])[0] || "Price Action e Rompimento";

  return {
    score,
    statusTag,
    highlights,
    riskDiagnosis,
    tacticalAdvice,
    bestStrategy: topStrategy,
    psychologyTip: "A consistência reside em aceitar o stop loss como custo operacional inevitável. Nunca tente recuperar um dia negativo aumentando a mão.",
  };
}

// Fallback tactical responses when Gemini API has temporary 503 outage
function generateFallbackChatReply(messages: any[], traderContext: any): string {
  const lastMsg = (messages?.[messages.length - 1]?.content || "").toLowerCase();
  const currentCapital = traderContext?.currentCapital ?? 10000;
  const winRate = traderContext?.winRate ?? 0;
  const dailyLossLimit = traderContext?.dailyLossLimit ?? 300;
  const dailyProfitTarget = traderContext?.dailyProfitTarget ?? 500;

  if (lastMsg.includes("stop") || lastMsg.includes("perda") || lastMsg.includes("loss") || lastMsg.includes("furia") || lastMsg.includes("recuperar")) {
    return `Olá, Trader! 🛑 O modelo de IA está com alta demanda momentânea no Google, mas aqui está a regra inegociável de gestão de risco:\n\n1. **Stop Loss é Sagrado:** Seu limite configurado é de R$ ${dailyLossLimit}. Se bateu o stop, DESLIGUE a plataforma imediatamente.\n2. **Jamais faça preço médio contra:** Adicionar contratos em posição perdedora é o caminho mais rápido para quebrar a conta.\n3. O mercado estará aberto amanhã. Aceitar a perda de hoje é o que permite você continuar vivo no jogo amanhã.`;
  }

  if (lastMsg.includes("meta") || lastMsg.includes("ganho") || lastMsg.includes("gain") || lastMsg.includes("lucro")) {
    return `Parabéns pelos resultados! 🎯 (Nota: Servidor de IA sob alta demanda momentânea)\n\nSua meta diária é de R$ ${dailyProfitTarget}. Lembre-se: quando você atinge a meta, o mercado passa a ser um risco, não uma oportunidade. A maioria dos traders devolve o lucro da manhã no período da tarde por excesso de confiança (overtrading). Coloque o dinheiro no bolso e proteja seu patrimônio!`;
  }

  if (lastMsg.includes("overtrading") || lastMsg.includes("ansiedade") || lastMsg.includes("psicologico") || lastMsg.includes("disciplina")) {
    return `O aspecto psicológico representa 80% do sucesso no trade! 🧠 (Nota: Servidor de IA sob alta demanda momentânea)\n\n• **Limite de trades:** Não faça mais operações do que o planejado. Fadiga visual e mental destrói a disciplina.\n• **Respiração e pausa:** Sentiu raiva, euforia ou frustração? Levante da cadeira, tome água e fique longe da tela por 15 minutos.\n• **Foco no processo:** Esqueça o dinheiro por um instante e foque apenas em executar o seu plano à risca. O dinheiro é consequência da disciplina.`;
  }

  return `Olá! ⚡ Os servidores de IA do Google estão experimentando alta demanda temporária (503). Enquanto a conexão estabiliza, seu resumo atual é: Saldo de R$ ${currentCapital}, Assertividade de ${winRate}% e Stop Diário em R$ ${dailyLossLimit}.\n\nRecomendação do Mentor: Mantenha o foco absoluto na preservação do seu capital e na execução técnica das suas melhores estratégias. Tente reenviar sua pergunta em alguns instantes para uma resposta detalhada!`;
}

// Health check handler
const handleHealth = (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

// AI Trade Performance Analysis handler
const handleAnalyze = async (req: Request, res: Response) => {
  const { summary, recentTrades = [], currentRiskSettings } = req.body;

  try {
    const ai = getGenAI();
    if (!ai) {
      return res.json(generateStatisticalAudit(summary, currentRiskSettings, recentTrades));
    }

    const prompt = `Você é um experiente Gestor de Risco e Mentor profissional de Opções Binárias (foco em gestão de banca, metas 2x0, Soros, controle de perdas diárias, proteção de payout e psicologia de trade).
Analise os seguintes dados reais do trader e forneça um feedback técnico, psicológico e estatístico direto e acionável em Português do Brasil:

DADOS GERAIS:
- Capital Inicial: R$ ${summary?.initialCapital ?? 0}
- Saldo Atual: R$ ${summary?.currentCapital ?? 0}
- Lucro Líquido Acumulado: R$ ${summary?.netProfit ?? 0} (${summary?.netProfitPercent ?? 0}%)
- Assertividade (Win Rate): ${summary?.winRate ?? 0}%
- Total de Operações: ${summary?.totalTrades ?? 0} (Gains: ${summary?.winCount ?? 0}, Losses: ${summary?.lossCount ?? 0}, Breakevens: ${summary?.breakevenCount ?? 0})
- Fator de Lucro (Profit Factor): ${summary?.profitFactor ?? 0}
- Payoff (Ganho Médio / Perda Média): ${summary?.payoff ?? 0}
- Ganho Médio: R$ ${summary?.avgWin ?? 0}
- Perda Média: R$ ${summary?.avgLoss ?? 0}
- Drawdown Máximo: ${summary?.maxDrawdownPercent ?? 0}% (R$ ${summary?.maxDrawdownAmount ?? 0})
- Drawdown Atual: ${summary?.currentDrawdownPercent ?? 0}%
- Maior Gain: R$ ${summary?.maxWin ?? 0} | Maior Loss: R$ ${summary?.maxLoss ?? 0}
- Configuração de Limite de Perda Diário (Stop Loss): R$ ${currentRiskSettings?.dailyLossLimit ?? 0}
- Meta Diária (Take Profit): R$ ${currentRiskSettings?.dailyProfitTarget ?? 0}

AMOSTRA DE OPERAÇÕES RECENTES:
${JSON.stringify(recentTrades || [], null, 2)}

Por favor, elabore um diagnóstico estruturado em JSON com o seguinte formato exato:
{
  "score": número de 0 a 100 avaliando a consistência e disciplina no mercado de Opções Binárias,
  "statusTag": "Consistente" | "Em Evolução" | "Alerta de Risco" | "Crítico",
  "highlights": ["3 a 4 destaques positivos ou pontos de atenção em bullet points curtos"],
  "riskDiagnosis": "Um parágrafo conciso sobre o gerenciamento de risco, respeito ao stop e payout em Opções Binárias",
  "tacticalAdvice": "Ação prática recomendada para as próximas sessões (ex: limitar a 2 ou 3 entradas no dia, parar no primeiro loss, evitar pares com payout < 80%)",
  "bestStrategy": "Estratégia ou padrão operacional mais eficiente observado",
  "psychologyTip": "Conselho focado em controle emocional, ganância e respeito ao plano de trade em Opções Binárias"
}

Responda APENAS o JSON válido sem texto adicional antes ou depois.`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    const text = (response.text || "{}").trim();
    try {
      const cleanJson = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const parsed = JSON.parse(cleanJson);
      return res.json(parsed);
    } catch {
      return res.json(generateStatisticalAudit(summary, currentRiskSettings, recentTrades));
    }
  } catch (error: any) {
    console.warn("Gemini API indisponível ou em alta demanda. Usando motor analítico estatístico:", error?.message || error);
    return res.json(generateStatisticalAudit(summary, currentRiskSettings, recentTrades));
  }
};

// AI Trader Mentor Chat handler
const handleChat = async (req: Request, res: Response) => {
  const { messages = [], traderContext } = req.body;

  try {
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        reply: generateFallbackChatReply(messages, traderContext),
      });
    }

    const systemInstruction = `Você é o 'Mentor Trader IA', um especialista sênior em gestão de risco, psicologia comportamental e estratégias de alta assertividade para traders de Opções Binárias (Price Action, Fluxo de Vela, Retração de M1, M5, Suporte e Resistência, Linhas de Tendência e Fibonnaci).
Seu objetivo supremo é guiar o trader para a consistência real, protegendo sua banca contra o 'dia de fúria' e mantendo a disciplina matemática do mercado de OB.

Contexto atual do trader:
- Saldo Atual: R$ ${traderContext?.currentCapital ?? "Não informado"}
- Lucro Líquido Acumulado: R$ ${traderContext?.netProfit ?? "Não informado"}
- Assertividade Atual: ${traderContext?.winRate ?? 0}%
- Drawdown Máximo: ${traderContext?.maxDrawdownPercent ?? 0}%
- Stop Loss Diário Definido: R$ ${traderContext?.dailyLossLimit ?? "Não informado"}
- Meta Diária: R$ ${traderContext?.dailyProfitTarget ?? "Não informado"}

Diretrizes inegociáveis:
1. Em Opções Binárias o payout médio é 80%-90% e o loss é 100%. Reforce que poucas operações de alta qualidade (ex: 2x0 ou 3x1) superam operar o dia inteiro.
2. NUNCA recomende Martingale descontrolado (dobrar para recuperar loss). Recomende Mão Fixa ou Soros Nível 1/2 com lucro.
3. Se o trader relatar perda, frustração ou vontade de recuperar o dinheiro no mesmo dia, acolha firmemente e ordene fechar a corretora imediatamente.
4. Responda em Português do Brasil de forma empática, profissional, técnica e objetiva.`;

    const contents: any[] = [];
    if (Array.isArray(messages)) {
      for (const m of messages) {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content || "" }],
        });
      }
    }

    const response = await generateContentWithFallback(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "Desculpe, não consegui formular a resposta no momento.";
    return res.json({ reply });
  } catch (error: any) {
    console.warn("Erro no chat do Gemini (alta demanda ou indisponibilidade):", error?.message || error);
    return res.json({
      reply: generateFallbackChatReply(messages, traderContext),
    });
  }
};

// In-memory Anti-Fúria stop loss status cache
let antiFuriaStatus = {
  isStopHit: false,
  todayPnl: 0,
  dailyLossLimit: 30,
  updatedAt: new Date().toISOString(),
};

const handleExtensionStatus: RequestHandler = (req, res) => {
  return res.json(antiFuriaStatus);
};

const handleExtensionSync: RequestHandler = (req, res) => {
  const { isStopHit, todayPnl, dailyLossLimit } = req.body || {};
  antiFuriaStatus = {
    isStopHit: Boolean(isStopHit),
    todayPnl: Number(todayPnl) || 0,
    dailyLossLimit: Number(dailyLossLimit) || 30,
    updatedAt: new Date().toISOString(),
  };
  return res.json({ success: true, status: antiFuriaStatus });
};

// Mount routes for both "/health" and "/api/health", etc.
apiRouter.get("/health", handleHealth);
apiRouter.get("/api/health", handleHealth);

apiRouter.post("/gemini/analyze", handleAnalyze);
apiRouter.post("/api/gemini/analyze", handleAnalyze);

apiRouter.post("/gemini/chat", handleChat);
apiRouter.post("/api/gemini/chat", handleChat);

apiRouter.get("/extension/status", handleExtensionStatus);
apiRouter.get("/api/extension/status", handleExtensionStatus);

apiRouter.post("/extension/sync", handleExtensionSync);
apiRouter.post("/api/extension/sync", handleExtensionSync);
