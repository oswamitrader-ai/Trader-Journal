# Contexto do Projeto: Trader Journal

## Visão Geral
Aplicação de Diário de Trade (Trader Journal) desenvolvida em React, TypeScript, Vite e Tailwind CSS / Vanilla CSS. Integração com Supabase para dados/sincronização e suporte a importação de operações de diversas corretoras (ProfitChart, MetaTrader, Exnova).

## Recursos Implementados
1. **Seleção e Exclusão em Massa (Batch Delete)**:
   - Caixas de seleção (checkboxes) adicionadas na tela "Diário de Operações" e no modal de detalhes do dia do Calendário Mensal.
   - Botão "Excluir Selecionados" com confirmação dinâmica.

2. **Parser 100% Fiel de Importação (Exnova / IQ Option / Profit / MT)**:
   - Suporte a arquivos CSV e PDF no mesmo botão de importação.
   - Extração precisa de datas (`Opening Date Time` em formato ISO / BR), ativos (`Asset`), direção (`call` -> BUY, `put` -> SELL), valor investido (`Investments`) e resultado líquido real (`Net PnL`).
   - Leitura de PDF via `pdfjs-dist` extraindo texto estruturado por linhas.

3. **Remoção e Correção de Valor Mínimo do Capital Inicial**:
   - Removida a trava de R$ 100 mínimos na tela de Configurações de Gestão de Risco & Metas (`RiskSettingsModal.tsx`).
   - Corrigido o padrão de `DEFAULT_RISK_SETTINGS` e o parsing de fallback (`|| 10000` alterado para `?? 0`), para evitar que o saldo inicial fosse forçado em R$ 10.000,00 quando o usuário configurava R$ 0.

4. **Persistência da Trava Anti-Fúria & Janela de Operações**:
   - Garantida a gravação do estado do toggle (`antiFuriaCustomWindowEnabled`) e dos horários (`antiFuriaStartTime` e `antiFuriaEndTime`) no `localStorage`, `Supabase` e no estado do modal (`RiskSettingsModal.tsx`).

5. **Suporte a Taxas de Saque & Corretora nas Movimentações de Capital**:
   - Adicionado botão no modal de movimentações (`CapitalHistoryModal.tsx`) para registrar a taxa cobrada pela corretora (`fee?: number`), descontando automaticamente do saldo total.

6. **Motor de Captura Automática de Ordens em Tempo Real na Extensão (`injected.js`)**:
   - Injetado motor de interceptação de WebSocket no pacote ZIP gerado da extensão (`extensionGenerator.ts`).
   - Resolvido bloqueio de CSP (Content Security Policy) da Exnova utilizando o recurso nativo `world: 'MAIN'` do Manifest V3, garantindo execução com privilégios do Chrome sem injeção inline de DOM.
   - Captura automaticamente ordens encerradas (Demo e Real) na Exnova, IQ Option e Quotex, registrando o trade no diário e disparando o bloqueio da Trava Anti-Fúria instantaneamente no Stop Loss.

7. **Overlays e Notificações**:
   - Mantidos intocados conforme regras globais.

8. **Gráfico de Candles por Operação, Curva de Capital & Painel Completo de Drawdown**:
   - Implementado gráfico de Candlesticks por operação na aba "P&L Diário" do `PerformanceCharts.tsx`.
   - Cada trade gera um candle individual onde a Abertura é o saldo acumulado antes da ordem e o Fechamento é o saldo acumulado pós-ordem.
   - Corrigida a aba **"Curva de Capital"** e **"Drawdown"**: pontos partem do **Capital Inicial** (`Ponto 0: Capital Inicial`) com suporte a **Trade a Trade** (por operação).
   - **Aba de Drawdown Reformulada**: Adicionados 4 cards de KPIs de risco (`Drawdown Máximo %`, `Drawdown Máximo R$`, `Drawdown Atual %` e `Recuperação de Capital`), inspeção detalhada via tooltip no gráfico submerso e guia educativo explicativo.

9. **Calculadora do Critério de Kelly Adaptada para Opções Binárias**:
   - Atualizado o `KellyCalculatorModal.tsx` para focar em valores financeiros (Stakes / Entrada) em vez de contratos/lotes. Exibe diretamente a **Stake Sugerida** em valor financeiro exato (ex: `R$ 50,00` ou `$ 10,00`).

10. **Seletor Global de Moeda do Painel (Multi-Moedas)**:
    - Adicionado botão e dropdown no `Navbar.tsx` com suporte a **Real (BRL - R$)**, **Dólar (USD - $)**, **Euro (EUR - €)**, **Tether (USDT - ₮)** e **Bitcoin (BTC - ₿)**.
    - Atualizada a função `formatCurrency` em `calculations.ts` para formatar instantaneamente todos os valores do diário, cards, gráficos e modais na moeda selecionada pelo trader.

11. **Refatoração Visual Completa do Painel (Dark Theme Puro)**:
    - **Fundo Preto Puro**: Todas as instâncias de `bg-slate-950` e `bg-slate-900` foram substituídas por `bg-black` em todos os componentes (App, Navbar, KpiCards, PerformanceCharts, MonthlyCalendar, TradeList, WeeklyPerformancePanel, e todos os modais).
    - **Fonte Arial Black**: Tipografia global alterada de "Plus Jakarta Sans" para **"Arial Black"** com peso negrito (700+) via `index.css`. JetBrains Mono mantida para elementos `font-mono`.
    - **Espaçamento Otimizado**: Gap entre botões da Navbar aumentado, padding das abas de navegação melhorado, evitando textos comprimidos.
    - **index.html**: Fonte Google removida (Plus Jakarta Sans), body com `bg-black`.
    - **index.css**: Tipografia global com Arial Black em todos os elementos.

12. **Proteção Anti-Burlar e Imutabilidade de Operações de Conta Real (Anti-Fúria)**:
    - Implementada a função utilitária `isTradeProtected(trade)` em `calculations.ts`.
    - Operações de **Conta Real** são **estritamente protegidas e imutáveis contra exclusão e alteração financeira**.
    - Impede que o trader exclua trades de perda ou altere os valores de entrada e P&L (resultado líquido R$) para burlar a Trava Anti-Fúria.
    - No modal de edição (`TradeFormModal.tsx`), os campos de **Valor de Entrada (R$)**, **Resultado Líquido (P&L R$)**, **Direção (Compra/Venda)** e **Tipo de Conta** ficam **desabilitados (disabled)** com banner de aviso 🔒 para operações protegidas, permitindo ajustar apenas anotações, setup e estado emocional.
    - Bloqueios ativos na exclusão individual (`TradeList.tsx` e `DayDetailModal.tsx`), exclusão em massa (`handleDeleteMultipleTrades`), e na limpeza de dados (`handleResetData` em `App.tsx`).
    - Interface gráfica exibe o selo **"Protegido 🔒"** com ícone de escudo em todos os trades de conta real.

13. **Bloqueio de Adição de Operações ao Atingir Stop Loss Diário (Anti-Fúria v2)**:
    - Corrigida falha de segurança onde o trader podia **burlar a trava anti-fúria adicionando novas operações manualmente** mesmo após atingir o Stop Loss diário.
    - `handleOpenNewTrade` e `handleOpenNewTradeForDate` em `App.tsx` agora verificam `isStopHit` e bloqueiam a abertura do modal com alerta.
    - `handleSaveTrade` em `App.tsx` bloqueia o salvamento de **novas** operações de Conta Real quando `isStopHit === true` (edições de trades existentes continuam permitidas).
    - `handleImportTrades` em `App.tsx` bloqueia importação de trades quando `isStopHit === true`.
    - Botão **"Nova Operação"** e **"Importar"** na `Navbar.tsx` ficam **visualmente desabilitados** (vermelho, opacidade reduzida, ícone de escudo) quando o Stop Loss diário é atingido.
    - Trades capturados automaticamente pela extensão Chrome passam pelo `bypassStopCheck` para permitir registro de trades já executados na corretora.

14. **Correção do Bug de Fuso Horário (UTC vs Local) & Isolamento de PnL Conta Real na Trava Anti-Fúria**:
    - **Causa Raiz Identificada**: Uso de `new Date().toISOString().split('T')[0]` gerava a data em UTC. No Brasil (UTC-3), após as 21h00, o UTC avançava para o dia seguinte, fazendo o sistema buscar os trades do dia errado (`todayPerformance = undefined`) e desativando a Trava Anti-Fúria à noite mesmo com o Stop Loss atingido (-R$ 60,00).
    - Criada a função utilitária `getLocalDateStr()` em `calculations.ts` para formatar a data exata no fuso horário local (`YYYY-MM-DD`).
    - Atualizados todos os componentes (`App.tsx`, `TradeFormModal.tsx`, `TradeList.tsx`, `PerformanceCharts.tsx`, `CapitalHistoryModal.tsx`) para usar `getLocalDateStr()`.
    - `todayRealPnl` implementado em `App.tsx` para calcular o resultado líquido exclusivo da **Conta Real**, garantindo que trades da conta DEMO não mascarem a perda do stop loss da Conta Real.

15. **Proteção Anti-Burlar por Alteração de Parâmetros de Risco (`RiskSettingsModal.tsx`)**:
    - **Falha Crítica Identificada**: Quando o Stop Loss era atingido, o trader em estado de fúria podia abrir o modal de Configurações de Risco (`RiskSettingsModal.tsx`) e **aumentar o Limite de Perda Diário** (ex: de R$ 60 para R$ 1.000 ou R$ 0). Ao salvar, `isStopHit` recalculava para `false`, **desativando e destravando a Trava Anti-Fúria instantaneamente**.
    - **Solução Implementada**:
      - Passada a prop `isStopHit` para o `RiskSettingsModal.tsx`.
      - O campo **"Limite de Perda Diário (R$)"** fica **bloqueado/desabilitado (`disabled`)** com um aviso em vermelho 🔒 enquanto o Stop Loss estiver atingido no dia.
      - Na função `handleSubmit` do modal e em `handleSaveSettings` no `App.tsx`, o sistema bloqueia qualquer tentativa de aumentar/modificar o valor do stop loss diário enquanto a trava estiver ativa.
      - Corrigida também a verificação de data em `handleOpenNewTradeForDate` no `App.tsx` para utilizar o fuso horário local (`getLocalDateStr()`).

16. **Trava Anti-Overtrading por Número Máximo de Operações Diárias & Bloqueio de Edição**:
    - **Funcionalidade Implementada**: Ativada a trava de bloqueio Anti-Fúria quando o trader atinge o **Limite Máximo de Operações no Dia** (`isMaxTradesHit = todayTradesCount >= maxTradesPerDay`).
    - **Bloqueio Unificado (`isAntiFuriaActive`)**:
      - `isAntiFuriaActive = isStopHit || isMaxTradesHit`.
      - Quando o limite de operações ou o stop loss é atingido: novas operações de Conta Real, abertura de modais e importação de relatórios são **completamente bloqueados**.
      - Os botões na `Navbar.tsx` ("Nova Operação" e "Importar") ficam visualmente desabilitados 🔒.
    - **Bloqueio de Edição de Parâmetros**: No `RiskSettingsModal.tsx`, **tanto o Limite de Perda Diário (R$) quanto o Limite Máximo de Operações por Dia** ficam `disabled` com aviso visual 🔒 enquanto a trava estiver ativa, impedindo que o trader altere ou aumente as metas para burlar o bloqueio.

## Regras Importantes
- Ambiente: Windows.
- Explicações curtas e diretas ao código.
- Português do Brasil (PT-BR).
