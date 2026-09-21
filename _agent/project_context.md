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

17. **Ícone de Favicon SVG (`/favicon.svg`)**:
    - **Correção de Erro 404**: Criado o arquivo [favicon.svg](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/public/favicon.svg) na pasta `public/` com o escudo oficial verde/preto do sistema e adicionada a tag `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` em [index.html](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/index.html).

18. **Parser Dedicado e Correção de Importação de Operações Quotex**:
    - **Motivo do Problema Identificado**: O arquivo da Quotex não era reconhecido pela auto-detecção de formato e caía no fallback `PROFITCHART`. Como a Quotex exporta pares OTC e Payout % (ex: `93%` ou `93`), o parser antigo lia `93` como lucro em R$. Como `93 > 0`, todos os trades (ganhos e perdas) eram classificados erroneamente como **WIN** (GAIN).
    - **Solução Implementada**:
      - Criada a plataforma `'QUOTEX'` em `PlatformPreset` e a função dedicada `parseQuotexDedicated` em [tradeParsers.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/tradeParsers.ts#L276-L440).
      - Adicionada detecção automática de relatórios da Quotex em `detectPlatform`.
      - Identificação precisa de **Loss**: quando a coluna de retorno é `0` ou `$0.00`, quando o status é "Perda/Sem retorno/Prejuízo/Loss", ou quando o preço de fechamento é desfavorável. Para perdas, o PnL é calculado como `-investimento` (LOSS).
      - Identificação de **Win**: converte a taxa de payout (ex: 93%) sobre o valor investido para calcular o lucro líquido real em R$.
      - Adicionado botão seletor da **Quotex** no modal de importação ([ImportTradesModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/ImportTradesModal.tsx#L198)).

19. **Liberação da Exclusão em Massa de Trades Importados**:
    - **Motivo do Problema**: A trava Anti-Fúria de `isTradeProtected(trade)` considerava *todas* as operações da Conta Real (`isReal === true`) imutáveis, bloqueando a exclusão dos trades importados via relatório CSV/PDF no Diário de Operações.
    - **Solução**: Atualizada a função `isTradeProtected` em [calculations.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/calculations.ts#L39-L55) para verificar se a operação foi importada (`id.startsWith('imp-')` ou estratégia/notas contendo "Importado"). Operações importadas são liberadas para exclusão individual e em massa. Operações capturadas ao vivo pela extensão continuam 100% protegidas 🔒.

20. **Leitura Universal de Nomes de Ativos e Datas de Relatórios**:
    - **Motivos Identificados**: 
      1. **Nomes de Ativos**: A regex antiga removia parênteses e espaços, transformando `USD/MXN (OTC)` em `USD/MXNOTC`.
      2. **Datas com Data Atual**: Se o nome da coluna no cabeçalho estivesse em outro formato (ex: `Open time` ou `Timestamp`), o sistema não encontrava o índice e utilizava o fallback com a data de hoje.
    - **Solução Implementada**:
      - Criada a função `cleanAssetName` em [tradeParsers.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/tradeParsers.ts#L41-L65) que limpa o nome sem corromper o par de moedas e mantendo a tag `(OTC)` formatada (ex: `USD/MXN (OTC)`).
      - Atualizada a função `parseIsoDatetime` para aceitar qualquer padrão ISO, BR (`DD/MM/YYYY`), US (`MM/DD/YYYY`), pontos (`21.06.2026`) ou Timestamps Unix.
      - Implementada a varredura automática de linha (row scanning fallback): caso a coluna não seja achada pelo nome no cabeçalho, o sistema analisa os valores da 1ª linha do arquivo para identificar automaticamente qual coluna contém os nomes dos ativos e qual contém a data real da operação.

21. **Correção na Identificação de Direção (PUT / VENDA) & Regra de Win/Loss Invertida**:
    - **Causa Raiz do Bug**: Quando a coluna de direção no relatório da Quotex possuía um nome não-padrão (ex: `Call/Put`, `Trade Type` ou `Action`), o índice `typeIdx` não era encontrado e todas as operações eram forçadas como `BUY` (CALL/COMPRA). Em uma operação de **PUT/VENDA que foi LOSS** (preço subiu, `closePrice > openPrice`), como o sistema achava que a ordem era de `BUY`, a regra `closePrice > openPrice` classificava o trade erroneamente como **WIN**.
    - **Solução**:
      - Ampliada a busca do cabeçalho de tipo/direção em `parseQuotexDedicated` e `parseGeneric` ([tradeParsers.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/tradeParsers.ts#L400-L450)).
      - Adicionada a varredura de linha (row scanning): caso a coluna não seja achada pelo nome do cabeçalho, o sistema inspeciona a 1ª linha procurando por palavras como `call`, `put`, `buy`, `sell`, `compra`, `venda`, `alta`, `baixa`, `higher`, `lower`.
      - Garantido o mapeamento correto de `SELL` (PUT/VENDA) para todas as ordens de venda, corrigindo a regra de preços de abertura vs fechamento (`closePrice < openPrice` = WIN para PUT, `closePrice > openPrice` = LOSS para PUT).

22. **Varredura Omni-Coluna por Linha para Direção e Resultado de Risco (Loss)**:
    - **Causa Raiz Identificada no Fallback de PnL**: Se a coluna de retorno contivesse a taxa de Payout (ex: `93%` ou `93`), a verificação secundária `profitNum > 0.001` transformava a linha em **GAIN** mesmo quando o status continha palavras de perda ou quando a ordem era de Venda/PUT.
    - **Solução Definitiva Implementada em `parseQuotexDedicated`**:
      - **Varredura Omni-Coluna por Linha**: Para CADA linha de trade individual, o sistema varre **todas as células da linha** procurando termos explícitos de direção (`put`, `sell`, `venda`, `baixa`, `down`, `lower`, `abaixo`, `↓`, `▼`) para garantir que ordens de venda **nunca fiquem como BUY**.
      - **Bloqueio Absoluto de Payout como Win para Loss**: Varre todas as células da linha procurando termos de perda (`loss`, `lost`, `perda`, `perdeu`, `prejuízo`, `sem retorno`, `zerado`, `negativ`, `falha`). Se identificado como Loss, o PnL é travado em **`-investimento`** e o resultado em **`LOSS`**, impedindo que a taxa de payout (93) force o resultado como GAIN.

## Regras Importantes
- Ambiente: Windows.
- Explicações curtas e diretas ao código.
- Português do Brasil (PT-BR).





