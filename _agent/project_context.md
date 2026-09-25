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
   - Captura automaticamente ordens encerradas na Exnova, IQ Option e Quotex, classificando com precisão **Conta DEMO (Prática)** (`user_balance_type = 4`) vs **Conta REAL** (`user_balance_type = 1`).
   - **Liberação de Exclusão para DEMO**: Operações de Conta DEMO são marcadas com `accountType: 'DEMO'`, `isReal: false` e `tags: ['DEMO']`, ficando **completamente liberadas para exclusão no diário**, sem afetar o Stop Loss nem ser bloqueadas pela regra Anti-Burlar da Conta Real.
   - **Manual Técnico Completo**: Consulte [_agent/auto_capture_manual.md](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/_agent/auto_capture_manual.md) para o guia detalhado de arquitetura, fluxo de dados e troubleshooting.

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
23. **Página Própria de Gestão de Clientes & Assinaturas SaaS (`AdminUserManagementPage.tsx`)**:
    - **Substituição do Modal Flutuante**: O antigo modal compacto e flutuante foi removido e substituído por uma tela inteira e dedicada de Gestão de Clientes e Assinaturas SaaS (`AdminUserManagementPage.tsx`).
    - **Recursos da Nova Tela**:
      - **4 Cards de KPIs SaaS & Receita**: Total de Clientes, Assinaturas Ativas (Adimplentes), Inadimplentes/Suspensos e MRR Recorrente Estimado (R$).
      - **Formulário Completo de Cadastro de Cliente**: Suporte a Nome, E-mail, WhatsApp (com DDD), Senha Inicial, Perfil (Cliente/Admin), Plano (`MENSAL`, `TRIMESTRAL`, `ANUAL`, `TRIAL`), Valor da Mensalidade (R$) e Data de Vencimento.
      - **Controle de Adimplência (1-Click)**: Botão de toggle rápido "Bloquear Inadimplente" / "Ativar Acesso" para suspender ou reativar clientes sem pagamento.
      - **Renovação Rápida & Cobrança WhatsApp**: Botão `+30 dias` para renovação expressa e link direto `Cobrar` que gera mensagem formatada no WhatsApp Web/App com data de vencimento.
      - **Modal Interno de Edição de Assinatura & Reset de Senha**: Permite alterar o plano, mensalidade, data de vencimento e redefinir senhas.
24. **Correção do Gatilho de Meta Batida e Stop Loss com Saldo Zerado (R$ 0,00)**:
    - **Causa Raiz Identificada**: A condição de Meta Batida (`isTargetHit`) e de Stop Loss (`isStopHit`) verificava apenas `todayPnl >= dailyProfitTarget` e `todayPnl <= -dailyLossLimit`. Caso a meta ou stop limite estivessem com valor 0, ou se o usuário fosse novo (saldo R$ 0,00 e 0 trades), `0 >= 0` e `0 <= 0` eram avaliados como `true`, exibindo indevidamente o card/selo de "Meta Batida" e "Stop Atingido".
    - **Solução Implementada**:
      - **Meta Batida**: Exige obrigatoriamente que a meta seja maior que 0 (`dailyProfitTarget > 0`) **E que o trader tenha obtido lucro real no dia (`todayPnl > 0`)**.
      - **Stop Loss**: Exige obrigatoriamente que o limite seja maior que 0 (`dailyLossLimit > 0`) **E que o resultado do dia seja efetivamente negativo (`todayPnl < 0`)**.
25. **Restrição de Acesso ao Botão "Exportar Relatório Executivo PDF" (Exclusivo Admin)**:
    - O botão de exportação em PDF na `Navbar` foi atualizado com a verificação de permissão `currentUser?.role === 'ADMIN'`.
27. **Página Própria de Configuração da Trava Anti-Fúria (`AntiFuriaExtensionPage.tsx`)**:
    - **Substituição do Modal Flutuante**: O antigo modal flutuante de extensão foi removido e transformado em uma tela inteira e dedicada (`AntiFuriaExtensionPage.tsx`).
    - **Recursos da Tela**:
      - **Navegação & Top Bar**: Botão "← Voltar ao Diário de Trade" e indicadores em tempo real (Status da Trava Hoje, Limite de Stop Loss, PnL Hoje, Assertividade/PF e Contagem Regressiva até 00:00).
      - **3 Abas Principais**:
        1. **Instalação no Navegador & Guia**: Botão de Download do pacote ZIP pré-configurado e passo a passo visual em 4 passos.
        2. **Corretoras Bloqueadas**: Lista interativa para adicionar e remover domínios personalizados (Exnova, Quotex, IQ Option, etc.).
28. **Reformulação Visual Completa da Tela de Bloqueio & Duelo Touro vs. Urso (`AntiFuriaExtensionPage.tsx`)**:
    - **Remoção de Glassmorphism & Alinhamento com o Painel**: Adotada a mesma estética visual do painel (`bg-black`, bordas sólidas `border-slate-800`, tipografia negrita Arial Black/Mono).
    - **Incorporação das Imagens Oficiais**:
      - `/bull-vs-bear.jpg`: Ilustração do duelo épico entre o Touro da Disciplina e o Urso da Fúria.
      - `/tradelock-shield.jpg`: Escudo com cadeado de ouro/esmeralda atuando como a barreira física inviolável.
    - **Controles Interativos do Duelo Psicológico**:
      - **Modo Lucro & Disciplina (Touro)**: Luz esmeralda, foco em curva ascendente, execução fria e proteção de lucro.
      - **Modo Fúria & Quebra (Urso)**: Luz carmesim, alertas de revenge trading e demonstração do risco de destruição de banca.
      - **Ver Confronto Completo**: Exibição visual das imagens épicas do Touro vs Urso e do Escudo TradeLock interceptando as corretoras.
29. **Alinhamento 100% Fiel do Modo de Bloqueio em Tela Cheia ao Design Oficial (`AntiFuriaExtensionPage.tsx`)**:
    - **Ajuste do Layout e Borda Neon Carmesim**: Card principal com borda dupla carmesim `border-2 border-rose-600` e brilho neon `shadow-[0_0_50px_rgba(225,29,72,0.35)]`, com cabeçalho vermelho de aviso `ACESSO BLOQUEADO PELO PLANO DE TRADE`.
30. **Bloqueio por Inadimplência/Assinatura & Ocultação de Recursos para Clientes (`App.tsx`, `extensionGenerator.ts`)**:
    - **Remoção do Botão "Ver Bloqueio em Tela Cheia" para Clientes**: O botão fica visível exclusivamente para a role `ADMIN` em `AntiFuriaExtensionPage.tsx`.
    - **Bloqueio Unificado da Plataforma & Extensão Chrome por Inadimplência**: Quando um cliente está com status inativo, suspenso ou inadimplente (`active === false` ou `subscriptionStatus === 'OVERDUE' | 'INACTIVE'`), o sistema intercepta o acesso tanto no painel web quanto na extensão Chrome.
31. **Exclusividade das Abas "Tela de Bloqueio" e "Corretoras Bloqueadas" para Administrador (`AntiFuriaExtensionPage.tsx`)**:
    - **Visualização Exclusiva de Clientes**: As abas **"Tela de Bloqueio & Duelo Touro vs. Urso"** e **"Corretoras Bloqueadas"** foram completamente removidas da visualização de clientes (`role === 'CLIENT'`).
32. **Reformulação do Modal da Extensão (`popup.html`, `popup.js`) & Imutabilidade de Corretoras**:
    - **Alinhamento Estético com a Plataforma**: O popup da barra de ferramentas da extensão foi refatorado com o tema escuro do painel (`bg-black`, bordas `border-slate-800`, tipografia `font-mono` Arial Black, badges `LIBERADO 🟢` e `BLOQUEADO 🔒`).
33. **Alinhamento Completo da Tela de Intervenção nas Corretoras (`blocked.html`, `blocked.js`)**:
    - **Integração do Design Oficial Touro vs. Urso**: Quando a extensão bloqueia o acesso em qualquer corretora (Exnova, Quotex, IQ Option, etc.), a página gerada `blocked.html` agora exibe exatamente o mesmo design oficial do painel (`bg-black`, borda dupla carmesim `border-2 border-rose-600` com brilho neon, o container de Duelo Psicológico com alternância interativa de modos `Touro vs Urso`, os 4 cards de KPIs de risco, a caixa de Diagnóstico do Mentor IA e a contagem regressiva em azul ciano até 00:00:00).
34. **Solução 1: Blindagem de Aplicativos Windows Desktop (.msi / .exe) (`windowsLockerGenerator.ts`)**:
    - **Inviolabilidade da Trava em Apps Desktop**: Criado gerador de script nativo Windows `tradelock-blindagem-windows.bat` em `src/utils/windowsLockerGenerator.ts`.
    - **Modificação do Arquivo Hosts do Windows**: Mapeia todos os domínios de corretoras e subdomínios de WebSocket/API para `127.0.0.1` em `C:\Windows\System32\drivers\etc\hosts`, executa `ipconfig /flushdns` e mata imediatamente os processos executáveis das corretoras (`exnova.exe`, `iqoption.exe`, `quotex.exe`, etc.) com `taskkill`.
    - **Disponibilização de Download no Painel**: Card interativo com 1-click download integrado na guia de instalação da `AntiFuriaExtensionPage.tsx` para os traders blindarem seus computadores contra uso de softwares instalados fora do navegador Chrome.
35. **Aplicativo Nativo Mobile TradeLock (Android & iOS)**:
    - **Módulo Android (`TradeLockVpnService.kt` + `TradeLockAccessibilityService.kt`)**:
      - `VpnService`: Filtra requisições de rede direcionadas a domínios de corretoras (`exnova.com`, `iqoption.com`, etc.) em tempo real a nível de SO sem servidores externos.
      - `AccessibilityService`: Monitora a abertura dos pacotes nativos de corretoras e injeta a tela de bloqueio em tela cheia (`OverlayBlockActivity.kt`) com o Duelo Touro vs Urso por cima do aplicativo da corretora.
    - **Módulo iOS (`TradeLockScreenTimeModule.swift` + `ShieldConfigurationExtension.swift`)**:
      - Utiliza `FamilyControls` e `ManagedSettings` (Screen Time API) do iOS 15+ para ocultar/bloquear aplicativos de corretoras e domínios web no Safari quando a trava estiver ativa.
    - **Sincronização em Tempo Real (`mobileSyncService.ts` + `mobile/src/App.tsx`)**:
      - Conecta com a base Supabase em tempo real acionando e desligando as blindagens nativas móveis instantaneamente.
    - **Versão Web Independente (`mobile.html` + `src/mobileMain.tsx`)**:
      - Entrada Web independente compilada via Vite (`dist/mobile.html`) para execução direta do app móvel em qualquer navegador desktop ou celular (`http://localhost:5173/mobile.html`).
    - **Configuração Capacitor APK (`capacitor.config.json` + `mobile/android/AndroidManifest.xml`)**:
      - Projeto estruturado para compilação nativa de APK Android (`com.tradelock.shield`) com suporte completo a VpnService e AccessibilityService.
36. **Página Dedicada de Gestão de Risco & Metas Invioláveis (`RiskManagementPage.tsx`)**:
    - **Substituição do Modal Flutuante**: O antigo modal compacto foi substituído por uma **página inteira e independente** (`RiskManagementPage.tsx`), acessível diretamente pelo botão "Gestão & Risco" da `Navbar`.
    - **Trava de Compromisso Inviolável (`riskLockUntil`)**:
      - Seletores rápidos de tempo de compromisso: **1 Dia**, **3 Dias**, **7 Dias (1 Semana)**, **14 Dias (2 Semanas)** e **30 Dias (1 Mês)**.
      - Quando o trader salva com um período de compromisso ativo (`Date.now() < riskLockUntil`), as regras de **Stop Loss**, **Meta de Lucro** e **Overtrading (Max Trades)** ficam **trancadas com chave inviolável**. O sistema exibe contagem regressiva em tempo real `DDd HHh MMm SSs` e impede qualquer tentativa de afrouxar os limites em momento de fúria.
    - **Calculadora & Simulador Avançado de Gestão**:
      - Modelos operacionais integrados: `Mão Fixa`, `Soros Nível 1, 2, 3`, `SorosGale`, `Martingale Moderado` e `Critério de Kelly`.
      - Campo renomeado para **"Investimento por Entrada"** com seletor duplo de modo: **Percentual (% da Banca)** vs **Valor Fixo (R$)**.
      - **Simulador Realista com Interrupção Inteligente por Meta, Saldo & Stop Loss**:
        - Removida a expressão "banca base" do formulário de capital inicial.
        - O simulador avalia trade a trade se o trader atingiu a **Meta de Lucro Diária (Take Profit)**, se possui saldo suficiente (`currentBalance >= stake`) ou se atingiu o **Stop Loss Diário**.
        - Se a meta for batida (ex: 2 wins de Soros Nível 1 atingem R$ 74,91 > Meta R$ 70,00), a sessão é **encerrada imediatamente no 2º trade** com a tag `Meta Batida 🎯`. Da mesma forma, se o capital zerar ou o stop for atingido, a sessão encerra no 2º trade com `Zerou a Conta 🛑` ou `Stop Loss Atingido 🔒`. Cenários redundantes ou irrealistas são eliminados da visualização.

37. **Correção do Acionamento Automático do Bloqueio Nativo Mobile (Android Bridge)**:
    - **Causa Raiz do Problema**: Em `MainActivity.kt`, a ponte nativa Android utilizava a condição `isLockActive && isStopHit`. Quando o trader atingia o **Limite Máximo de Operações Diárias** (`isMaxTradesHit`), a trava estava ativa no app mobile (`isLockActive === true`), porém como `isStopHit` era `false`, a ponte nativa desativava o `TradeLockAccessibilityService` e desconectava a VPN local.
    - **Solução Implementada**:
      - Atualizado [MainActivity.kt](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/android/app/src/main/java/com/tradelock/shield/MainActivity.kt) para acionar a acessibilidade e a VPN com base no estado `isLockActive`. Assim, o bloqueio nativo ativa automaticamente no Stop Loss, Limite de Operações Diárias ou Inadimplência.
      - Removidos os botões de teste manual (`Testar Bloqueio Mobile Instantâneo` e `Liberar Acesso`) do aplicativo mobile ([App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/mobile/src/App.tsx)), garantindo que a trava seja 100% automática e inviolável.

38. **Bloqueio Nativo de Navegadores Web Móveis no Celular (Chrome, Firefox, Samsung Internet, Edge, Opera, Brave)**:
    - **Implementação em 2 Camadas (UI + Rede)**:
      - **Camada de UI (`TradeLockAccessibilityService.kt`)**: Adicionada detecção dos principais navegadores nativos para Android (`com.android.chrome`, `org.mozilla.firefox`, `com.sec.android.app.sbrowser`, `com.microsoft.emmx`, `com.opera.browser`, `com.brave.browser`, etc.). A varredura inspeciona em tempo real a barra de endereços URL e a tela do navegador por palavras-chave de corretoras (`exnova`, `iqoption`, `quotex`, `qxbroker`, `pocketoption`, `binomo`, `olymptrade`). Ao detectar a tentativa de acesso com qualquer stop atingido, dispara o bloqueio em tela cheia (`OverlayBlockActivity`).
      - **Camada de Rede (`TradeLockVpnService.kt`)**: Implementada a filtragem de consultas DNS (UDP Porta 53) na VPN local. Quando a trava estiver ativa, as requisições de rede para domínios de corretoras são descartadas no nível do sistema operacional, impedindo que os navegadores carreguem os sites das corretoras.

39. **Alinhamento Estético & Correção de Exibição de Métricas na Tela de Bloqueio da Extensão (`blocked.js` / `extensionGenerator.ts` / `AntiFuriaExtensionPage.tsx`)**:
    - **Correção da Causa Raiz**: Em `blocked.js`, as variáveis `tradesCount` e `limit` eram referenciadas no cabeçalho antes de serem atribuídas, o que gerava um `ReferenceError` e interrompia o preenchimento dinâmico dos 4 cards de KPIs de risco (Assertividade, Fator de Lucro, Trades Hoje e Saldo Atual).
    - **Ajuste Realizado**: Variáveis reordenadas no topo do script para garantir preenchimento 100% fiel de todos os KPIs operacionais no bloqueio.
    - **Limpeza Visual**: Removidos os botões "Modo Lucro & Disciplina" e "Modo Fúria & Quebra" tanto na extensão (`blocked.html` / `blocked.js`) quanto na página do painel ([AntiFuriaExtensionPage.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/AntiFuriaExtensionPage.tsx)), fixando a visualização na aba unificada "Ver Confronto Completo".

40. **Inclusão das Imagens Oficiais do Duelo no Bloqueio da Extensão (`bull-vs-bear.jpg` e `tradelock-shield.jpg`)**:
    - **Correção da Causa Raiz Visual**: As imagens oficiais do duelo (`bull-vs-bear.jpg` e `tradelock-shield.jpg`) eram exibidas na amostra do painel, porém não eram empacotadas no arquivo `.zip` da extensão e o arquivo `blocked.html` possuía apenas caixas de texto genéricas sem as ilustrações.
    - **Solução Implementada**:
      - Atualizado [extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts) para empacotar automaticamente as imagens `bull-vs-bear.jpg` e `tradelock-shield.jpg` no arquivo ZIP e liberá-las no `manifest.json`.
      - Atualizado o HTML/CSS de `blocked.html` e `blocked.js` com a mesma estrutura visual com gradiente e imagens de fundo do painel. A tela exibida ao tentar acessar a corretora bloqueada agora fica 100% idêntica à do painel.

41. **Correção do Loop Infinito de Redirecionamento (Piscamento) & Descrição do Motivo de Overtrading (`background.js` / `blocked.js`)**:
    - **Causa Raiz do Piscamento Incessante**: A função `isUrlBlocked` encontrava o domínio da corretora dentro do parâmetro `?orig=https%3A%2F%2Ftrade.exnova.com` da própria URL `blocked.html`. Isso fazia o `background.js` redirecionar a página `blocked.html` para si mesma centenas de vezes por segundo em loop infinito.
    - **Causa Raiz da Descrição Incorreta**: O manipulador de mensagens do `background.js` combinava `isSubBlocked` com `isStopHit`, forçando o valor como `true` mesmo quando o stop era apenas por limite de operações (Overtrading).
    - **Soluções Aplicadas**:
      - `isUrlBlocked`, `enforceTabBlock` e `onBeforeNavigate` passam a ignorar imediatamente qualquer URL contendo `blocked.html` ou iniciada com `chrome-extension://`, eliminando completamente o loop de redirecionamento.
      - Isoladas as variáveis `isStopHit` e `isMaxTradesHit` em `background.js` e `blocked.js`, garantindo a exibição exata do cabeçalho **🛑 ACESSO BLOQUEADO POR OVERTRADING** quando o trader atinge o limite de trades do dia.

42. **Correção Precisa das Mensagens de Motivo do Bloqueio & Exclusão da Mensagem Padrão Genérica (-R$ 60,00)**:
    - **Causa Raiz Identificada**: Em `App.tsx`, o manipulador de mensagens `ANTI_FURIA_SYNC` enviava `isStopHit: isAntiFuriaActive`. Quando a trava de limite de operações (Overtrading) ativava sem Stop Loss, `App.tsx` repassava `isStopHit: true` para a extensão Chrome. A extensão concluía incorretamente que o Stop Loss de R$ 60 fora atingido. Além disso, o template inicial `blocked.html` continha o texto estático "Você atingiu o seu Stop Loss diário de R$ 60,00".
    - **Solução Implementada**:
      - Atualizado `App.tsx` para transmitir as flags `isStopHit`, `isMaxTradesHit` e `maxTradesPerDay` separadamente via `window.postMessage`, `localStorage` e API.
      - Adicionadas as chaves `'isMaxTradesHit', 'maxTradesPerDay'` no `chrome.storage.local.get` da extensão.
      - Atualizada a formatação dos títulos e descrições em `blocked.js` e `AntiFuriaExtensionPage.tsx` para apresentar detalhadamente o PnL atual real (ex: `resultado do dia de -R$ 45,00 (Limite: R$ 60,00)`), o motivo exato (Stop Loss, Overtrading ou Ambos), e a quantidade de trades executados de forma dinâmica e precisa.

43. **Remoção dos Botões de Teste Manual ("Simular Stop Loss" e "Desativar Trava") do Popup da Extensão**:
    - Removidos os botões de teste manual (`btnTest` e `btnUnlock`) do arquivo [extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts) (`popup.html` e `popup.js`).
    - O popup da extensão Chrome agora opera de forma 100% automática e inviolável, exibindo apenas os indicadores de status do risco, lista de corretoras protegidas e avisos administrativos.

44. **Correção do Cálculo Matemático do Simulador de Gestão Soros (`RiskManagementPage.tsx`)**:
    - **Causa Raiz Identificada**: Na função `simulateSequence` de [RiskManagementPage.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/RiskManagementPage.tsx), a variável `pnl` não era incrementada na 1ª mão de vitorias do Soros (`sorosStep === 0`). Isso fazia com que sequências como `W - L - W` mantivessem a 1ª vitória invisível no PnL, resultando em `-R$ 30,00` em vez do valor real de `-R$ 3,90`. Além disso, a perda no Soros subtraía `baseStake` em vez do valor da stake reinvestida (`stakeThisTrade`), gerando encerramentos precoces falsos por "Saldo Insuficiente".
    - **Solução Implementada**: Atualizado o simulador para computar o PnL trade a trade (`pnl += profit` nas vitórias e `pnl -= stakeThisTrade` nas perdas). As sequências como `W - L - W` e `L - W` agora exibem os valores exatos (ex: `-R$ 3,90` em vez de `-R$ 30,00`), liberando a simulação continuada dos trades seguintes de forma matematicamente precisa.

45. **Blindagem Anti-Burlar por Logout & Análise de Arquitetura App Desktop vs Web/Mobile (`App.tsx`)**:
    - **Causa Raiz Identificada**: Ao clicar em "Sair da Conta" (Logout), o estado `currentUser` era desarmado para `null`, unmontando a ponte DOM `#anti-furia-status-bridge` e permitindo que o trader em fúria burlasse o bloqueio das corretoras fazendo logout.
    - **Soluções Implementedas**:
      - Bloqueado o botão de **Logout ("Sair da Conta")** no [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx) enquanto `isAntiFuriaActive === true`, exibindo um alerta inviolável de bloqueio.
      - Adicionado fallback em `if (!currentUser)` no `App.tsx` que lê o `localStorage` e mantém o elemento bridge `#anti-furia-status-bridge` montado mesmo na tela de login caso a trava estivesse ativa hoje.
      - **Análise Técnica da Arquitetura Desktop (Electron/Tauri)**: Um App Desktop rodando como serviço de segundo plano no Windows (OS-Level Daemon) acrescenta a camada de alteração inviolável do arquivo `hosts` do Windows e encerramento forçado de processos (`taskkill`), atuando a nível de Sistema Operacional independentemente de abas ou logins do navegador.

46. **CHECKPOINT OFICIAL: CONCLUSÃO DA FASE 1 (Web + Extensão Chrome + Mobile Native Android/iOS)**:
    - **Fase 1 100% Concluída**:
      - Sistema completo de Diário de Trade com Dark Theme Puro (Arial Black/Mono) e multi-moedas.
      - Captura automática em tempo real na Exnova/Quotex/IQ Option via Extensão Chrome V3.
      - Trava Anti-Fúria inviolável (Stop Loss Diário, Overtrading e Inadimplência SaaS).
      - Aplicativo Nativo Mobile (`com.tradelock.shield`) com `AccessibilityService` e `VpnService` para bloquear apps nativos e navegadores móveis no Android/iOS.
      - Calculadoras, simuladores realistas de gestão (Soros 1, 2, 3, Gale, Martingale, Kelly) e Gestão de Risco com Trava de Compromisso.
      - Painel de Gestão de Clientes SaaS para Administração.

---

## 🚀 FASE 2: EVOLUÇÃO PARA APP DESKTOP NATIVO (ELECTRON / TAURI + WINDOWS DAEMON)

### Objetivos da Fase 2:
1. **App Desktop Nativo (.exe / .msi)**:
   - Encapsular a plataforma TradeLock em um executável nativo Windows utilizando **Electron / Tauri**.
2. **Windows Service / Daemon em Segundo Plano**:
   - Serviço nativo Windows que roda com privilégios de Administrador, independente de navegador ou login.
   - Aplicação e manutenção persistente da blindagem do arquivo `hosts` (`C:\Windows\System32\drivers\etc\hosts`) para bloquear domínios de corretoras a nível de SO.
   - Monitoramento de processos executáveis (`taskkill`) para encerrar apps desktop de corretoras (ex: `exnova.exe`, `iqoption.exe`, `quotex.exe`).
   - Proteção de processo contra encerramento pelo Gerenciador de Tarefas.

47. **Inicialização da Fase 2: Estruturação do App Desktop Windows Nativo (`TradeLock Desktop`)**:
    - **Pacotes Instalados**: Instalados `electron`, `electron-builder`, `wait-on`, `concurrently` e `cross-env` no projeto.
    - **Arquitetura IPC & Daemon Implementada**:
      - `electron/main.cjs`: Inicializa a janela nativa do Electron (`TradeLock Desktop`), configura a inicialização automática com o Windows (`openAtLogin: true`) e gerencia a escuta de eventos IPC.
      - `electron/preload.cjs`: Expõe a API segura `window.electronAPI` para comunicação bidirecional entre a interface React e o processo nativo.
      - `electron/windowsDaemon.cjs`: Módulo nativo Windows de nível de Sistema Operacional que aplica a trava no arquivo `C:\Windows\System32\drivers\etc\hosts` e executa o `startProcessWatchdog` (`taskkill /F /IM <brokerexe>.exe` a cada 2.5s) para bloquear navegadores e executáveis desktop de corretoras quando a trava estiver ativa.
      - `package.json`: Adicionados os comandos `"npm run electron:dev"` para desenvolvimento desktop e `"npm run electron:build"` para gerar o instalador `.exe` (NSIS/Portable).
      - `App.tsx`: Sincronização em tempo real via IPC enviando `syncLockState` diretamente ao Windows Daemon quando a trava ativa no React.

48. **Sincronização Multidispositivo em Tempo Real Tripla Camada (Broadcast + Postgres Changes + Polling Heartbeat)**:
    - **Causa Raiz Identificada**: A sincronia em tempo real dependia exclusivamente de eventos `postgres_changes`. Em instâncias do Supabase onde a publicação de réplica das tabelas não estava ativada explicitamente no Postgres, os eventos WebSocket do PostgreSQL não eram distribuídos.
    - **Solução de Sincronização Tripla Implementada**:
      - **1. Canal de Broadcast Instantâneo (`tradelock_realtime_broadcast`)**: Criado em [supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts). A cada operação inserida, editada ou excluída no diário ou nas configurações de risco, um evento `SYNC_MUTATION` é disparado em sub-50ms para todas as telas e dispositivos conectados (Web, Desktop Electron e App Mobile).
      - **2. Supabase Postgres Realtime (`postgres_changes`)**: Escuta nativa mantida em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx) e [mobileSyncService.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/services/mobileSyncService.ts) para capturar edições no banco de dados.
      - **3. Polling Heartbeat Silencioso (3s)**: Adicionado temporizador de 3 segundos em background no React e no App Mobile como garantia absoluta. Caso a conexão WebSocket seja interrompida ou enfrente instabilidade, o aplicativo desktop e o app mobile buscam os dados atualizados em no máximo 3 segundos, sem necessidade de recarregar a página (sem F5).

49. **Liberação de Exclusão e Edição para Operações Inseridas Manualmente ("Novo Trade")**:
    - **Ajuste de Regra**: Atualizada a função `isTradeProtected(trade)` em [calculations.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/calculations.ts#L40-L68).
    - Operações criadas manualmente pelo botão "Novo Trade" (`isAutoCaptured !== true`) e operações importadas via CSV/PDF ficam **completamente liberadas para exclusão e edição pelo trader**.
    - A trava de proteção imutável Anti-Fúria permanece aplicada **estritamente** para operações de Conta Real capturadas ao vivo pela extensão Chrome em tempo real (`isAutoCaptured === true` ou `id.startsWith('live-')`).

50. **Persistência Completa da Tela de Gestão de Risco & Regras de Gerenciamento (`RiskManagementPage.tsx`)**:
    - **Causa Raiz Identificada**: Os campos avançados da tela de Gestão de Risco (`riskLockUntil`, `riskLockDurationDays`, `managementStyle`, `estimatedPayout`, `estimatedWinRate`, `stakePercent`) eram omitidos ao salvar no Supabase em [supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts) e não eram sincronizados via `localStorage.setItem(SETTINGS_STORAGE_KEY)`. Ao recarregar a página, as opções selecionadas voltavam para os valores padrão.
    - **Solução Implementada**:
      - Atualizadas as funções `saveRiskSettingsToSupabase` e `fetchRiskSettingsFromSupabase` em [supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts#L324-L415) com serialização/desserialização JSON via coluna `notes` para compatibilidade total com o Supabase Postgres.
      - Adicionada persistência imediata em `localStorage` e re-hidratação via `useEffect` em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx#L680) e [RiskManagementPage.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/RiskManagementPage.tsx#L324).

51. **Ocultação do Botão Excluir e Blindagem de Edição em Operações da Conta Real Capturadas via WebSocket**:
    - **Remoção do Botão de Excluir**: Para todas as operações da Conta Real capturadas ao vivo pela extensão (`isTradeProtected === true`), o botão "Excluir" **nem aparece na interface** em [TradeList.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeList.tsx#L491) e [DayDetailModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/DayDetailModal.tsx#L293). Exibe apenas o selo estático de proteção `<ShieldCheck className="text-amber-400" /> Protegido 🔒`.
    - **Imutabilidade Financeira**: No modal [TradeFormModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeFormModal.tsx#L725), todos os campos financeiros (**Valor de Entrada**, **Resultado Líquido P&L R$**, **Tipo de Conta Real vs Demo** e **Direção Compra vs Venda**) permanecem **desabilitados (disabled)** para operações capturadas ao vivo da Conta Real, permitindo ajustar apenas o setup, anotações e estado emocional.

52. **Proteção Total Contra Exclusão de Operações de Hoje no Anti-Fúria (Anti-Rage Deletion)**:
    - **Causa Raiz Resolvida**: Quando um trader atinge o Stop Loss no dia, a exclusão manual de operações de hoje reduzia a perda acumulada no diário e burlava a trava Anti-Fúria.
    - **Solução Implementada**:
      - Atualizada a função `isTradeProtected(trade, isAntiFuriaActiveToday)` em [calculations.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/calculations.ts). Se `isAntiFuriaActiveToday === true`, qualquer operação realizada hoje (`trade.date === todayStr`) torna-se automaticamente protegida contra exclusão (`isTradeProtected === true`).
      - Passado `isAntiFuriaActive` para `<TradeList>` e `<DayDetailModal>`. O botão "Excluir" e a checkbox de seleção em lote são completamente removidos e substituídos por um badge/ícone estático `Protegido 🔒`.
      - Atualizados os manipuladores `handleDeleteTrade` e `handleDeleteMultipleTrades` em `App.tsx` para bloquear a exclusão via API ou teclas de atalho.

53. **Preservação de Seleção do Período de Compromisso (30 Dias) (`RiskManagementPage.tsx`)**:
    - **Causa Raiz Resolvida**: Ao selecionar 30 Dias na Tela de Gestão de Risco, o polling em background em `App.tsx` enviava props `settings` desatualizadas e sobrescrevia a escolha do usuário para 7 dias antes do salvamento.
    - **Solução Implementada**: Adicionada trava de inicialização única com `useRef(hasInitialized)` em [RiskManagementPage.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/RiskManagementPage.tsx) para preservar as opções escolhidas pelo trader no formulário até o clique no botão Salvar.

55. **Otimização Extrema de Usabilidade, Performance & Expansão do Layout em Tela Cheia**:
    - **Causa Raiz da Lentidão e Piscamento Resolvida**:
      - A inicialização do estado de trades ocorria de forma assíncrona (`useState([])`), exibindo o painel com valores zerados no 1º frame e piscando ao carregar dados do `localStorage` e Supabase.
      - A verificação de seleção por checkbox em `TradeList.tsx` realizava buscas em array O(N) (`selectedIds.includes`), travando a interface ao clicar nas caixas de seleção.
      - Os contêineres principais utilizavam a trava rígida `max-w-7xl` (1280px), deixando grandes espaços vazios nas laterais e afunilando os cards no centro da tela.
    - **Soluções Aplicadas**:
      - **Carregamento Sincrono sem Piscamento**: Em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx), os estados `trades`, `settings` e `capitalTransactions` são pré-carregados sincronicamente do `localStorage` na função de inicialização do `useState`. O painel renderiza no 1º frame já populado, sem nenhum congelamento ou tela zerada ao mudar de aba.
      - **Respostas Instantâneas em Checkboxes (0ms)**: Em [TradeList.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeList.tsx), a verificação de seleção passou a utilizar `selectedSet` (Estrutura `Set` de tempo constante **O(1)**). A marcação/desmarcação de operações por checkbox agora responde instantaneamente sem atraso.
      - **Expansão de Layout em Tela Cheia (`max-w-[1920px] w-full`)**: Atualizados os contêineres em `App.tsx`, `Navbar.tsx` e `RiskManagementPage.tsx` para `max-w-[1920px] w-full`, ocupando 100% da largura útil do monitor e eliminando as bordas laterais vazias.

56. **Correção da Causa Raiz do Bug de Fuso Horário nas Operações Noturnas (Extensão Chrome & App)**:
    - **Causa Raiz Identificada**: No arquivo [extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts) e nos modais do painel, a data do trade era gerada via `new Date().toISOString().split('T')[0]`. No Brasil (Fuso UTC-3), qualquer operação realizada após as 21:00 (21:00 em UTC-3 = 00:00 UTC do dia seguinte) era gravada com a data UTC de **amanhã (25/09/2026)**.
    - **Solução Implementada**:
      - Substituído `toISOString().split('T')[0]` por formatação explicita de fuso horário local (`year-month-day` via `.getFullYear()`, `.getMonth() + 1`, `.getDate()`) em [extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts), [TradeFormModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeFormModal.tsx) e [browserNotifications.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/browserNotifications.ts).
      - Adicionada sanitização automática no carregamento e recepção de trades em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx) (`if (capturedTrade.date > todayStr) capturedTrade.date = todayStr`), corrigindo instantaneamente as operações noturnas registradas com a data do dia seguinte.

57. **Migração & Correção Retroativa de Datas Noturnas e Sincronização do PnL de Hoje**:
    - **Causa Raiz da Oscilação no Início (-R$ 105,47 -> R$ 26,10)**: Como as operações realizadas após as 21:00 foram salvas anteriormente no banco de dados e no `localStorage` com a data `25/09/2026`, o painel calculava o resultado de hoje (`24/09/2026`) inicialmente sem os trades noturnos, resultando em **-R$ 105,47**. Segundos depois, a sincronização da nuvem ou correção de data unificava os trades e o PnL saltava para **+R$ 26,10**.
    - **Solução Aplicada**:
      - Implementada migração retroativa em [supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts) (`fetchTradesFromSupabase`) e em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx) no carregamento síncrono.
      - Todas as operações registradas anteriormente com data futura `25/09/2026` são convertidas automaticamente para a data local real de hoje (`24/09/2026`) no `localStorage` e atualizadas via `upsertTradeToSupabase` no PostgreSQL.
      - O valor de hoje é exibido como **R$ 26,10 desde o primeiro milissegundo de carregamento**, sem oscilação ou divergência de valores.

58. **Ordenação Estrita por Hora, Captura de Ativo WebSocket, Tags Verde/Vermelho & Feedback Visual OTC**:
    - **Ordenação por Data/Hora Decrescente**: Em [TradeList.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeList.tsx) e [DayDetailModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/DayDetailModal.tsx), `filteredTrades` e `dayTrades` foram atualizados para ordenar estritamente por `date` decrescente e `time` decrescente (`(b.time || '00:00').localeCompare(a.time || '00:00')`). Operações no mesmo dia (ex: 21:48 importada e 21:45 websocket) aparecem rigorosamente na ordem cronológica correta (21:48 acima de 21:45).
    - **Captura do Nome do Ativo via WebSocket**: Expandido o dicionário `activeMap` e adicionado fallback de varredura `getDomActiveName()` em [extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts). O sistema extrai nomes reais do ativo de `raw.active_name`, `raw.asset_name`, `raw.symbol`, `raw.pair`, `document.title` ou seletores DOM em vez de salvar IDs genéricos (`ID_12345`).
    - **Cores das Tags de Compra (Verde) e Venda (Vermelho) & Tipos de Conta**:
      - Compra (`BUY`): Tag verde esmeralda (`bg-emerald-500/20 text-emerald-300 border-emerald-500/40`).
      - Venda (`SELL`): Tag vermelha rosa (`bg-rose-500/20 text-rose-300 border-rose-500/40`).
      - Tipo de Conta: Exibição explícita do badge `REAL 💵` (verde/esmeralda) vs `DEMO 🧪` (âmbar).
    - **Feedback Visual para Mercado OTC**:
      - Adicionada a função utilitária `isOtcTrade(trade)` em [calculations.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/calculations.ts).
      - Criado badge visual com brilho neon roxo `<Zap className="h-3 w-3 text-purple-400 fill-purple-400" /> OTC` em [TradeList.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/TradeList.tsx) e [DayDetailModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/DayDetailModal.tsx) para identificar instantaneamente operações realizadas em mercado OTC.

59. **Normalização Definitiva de Datas Noturnas e Ordenação Global na Recarga (F5 Refresh)**:
    - **Causa Raiz Resolvida**: Ao passar da meia-noite no fuso local (`00:00`), a data de hoje mudava (ex: de `24/09` para `25/09`). As operações realizadas na noite anterior (ex: 21:45 / 21:48) que haviam sido salvas originalmente com data UTC de `25/09` deixavam de ser sanitizadas e saltavam para "amanhã" (`25/09`), fazendo com que o recarregamento com F5 alterasse a ordem e o dia da operação.
    - **Solução Implementada**:
      - Criadas as funções `getYesterdayLocalDateStr()` e `sortAndSanitizeTrades(trades)` em [calculations.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/calculations.ts).
      - `sortAndSanitizeTrades` identifica inteligentemente operações noturnas registradas com fuso UTC e converte a data para o dia operacional correto do trader (ex: 21:45/21:48 em `24/09`), além de aplicar a ordenação estrita por `date` decrescente e `time` decrescente (`timeB.localeCompare(timeA)`).
      - Integrado `sortAndSanitizeTrades` no carregamento inicial (`useState`), no `useEffect` de reidratação do usuário, na consulta do Supabase ([supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts)), na captura ao vivo pela extensão e no salvamento/importação de trades em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx).
      - A ordem (21:48 acima de 21:45 no dia 24/09) e as datas permanecem **100% imutáveis e idênticas mesmo após apertar F5**.

60. **Blindagem Inviolável Contra Troca de E-mail no App Mobile TradeLock**:
    - **Causa Raiz de Burlar Resolvida**: Quando a Trava Anti-Fúria ativava no celular (`isLockActive = true`), o trader em estado de fúria podia alterar o campo de e-mail no aplicativo móvel para um e-mail diferente/fictício. Ao sincronizar, os dados desse novo e-mail (sem stop hit) eram retornados, desativando a trava nativa do celular (`AccessibilityService` e `VpnService`) e destravando as corretoras.
    - **Solução Implementada**:
      - **Ancoragem Persistente do E-mail Travado**: Em [mobileSyncService.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/services/mobileSyncService.ts), quando `isLockActive` torna-se `true`, o e-mail travado e a data de hoje são gravados de forma inviolável no `localStorage` do celular (`tradelock_locked_user_email` e `tradelock_locked_date`).
      - **Rejeição Automática de Alterações de E-mail**: Se o usuário tentar alterar o e-mail via formulário ou código enquanto a trava estiver ativa, `setUserEmail` e `fetchDataAndSubscribe` em `mobileSyncService.ts` **bloqueiam e rejeitam a troca**, mantendo a consulta ancorada no e-mail travado com `isLockActive = true`.
      - **Interface Visual Bloqueada no Mobile App**: Em [mobile/src/App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/mobile/src/App.tsx), o campo de entrada de e-mail e o botão "Sincronizar" ficam desabilitados (`disabled={lockState.isLockActive}`) com aviso em vermelho `🔒 BLOQUEADO`, impedindo qualquer tentativa de desativar o bloqueio no celular.

56. **Reformulação em Tela Completa & Importação Avançada em Gestão de Capital (`CapitalHistoryModal.tsx` & `tradeParsers.ts`)**:
    - **Design em Tela Cheia (100% W/H)**: Removido o card flutuante. A tela de Gestão de Capital & Movimentações agora ocupa 100% da largura e altura da tela (`fixed inset-0 w-screen h-screen bg-black`), utilizando todo o comprimento do monitor com topbar nativa ("← Voltar ao Diário de Trade").
    - **Persistência Blindada Dual (LocalStorage + Supabase Lote)**: Resolvido o problema onde recarregar a tela zerava as movimentações importadas. O sistema realiza merge por ID entre `localStorage` e Supabase, grava localmente de forma síncrona na importação e realiza upsert em lote (`syncAllCapitalTransactionsToSupabase`) com suporte total ao campo `status`.
    - **Filtros e Busca em Tempo Real**: Barra de pesquisa para filtrar lançamentos por corretora, valor, data ou observação, além de seletores rápidos por Tipo (Depósito/Saque) e Status.
    - Criada a função `parseCapitalTransactionsCsv` com detecção dinâmica de delimitadores (`,`, `;`, `\t`), colunas de valor, data, taxas/comissões (`withdrawal_comission`, `fee`) e status (`withdrawal_status`, `status`).
    - **Identificação Precisa de Saques via Cabeçalho**: Inspeção das colunas do cabeçalho (`withdrawal_amount`, `withdrawal_date`, `withdrawal_status`) para classificar arquivos e registros como **Saque** mesmo na ausência de uma coluna explícita de tipo.
    - **Isolamento de Transações Canceladas**: Saques e depósitos com status de cancelado (`canceled`, `rejected`, `failed`) são identificados e desconsiderados automaticamente do saldo total da banca.
    - **Badges de Status Visuais**: Renderização de selos dinâmicos (`Concluído 🟢`, `Cancelado 🛑 (Fora do Saldo)` e `Pendente 🟡`) na pré-visualização e no histórico.
57. **Proteção Nativa Android 24/7 em Segundo Plano (`TradeLockNativeSync.kt` & `TradeLockForegroundService.kt`)**:
    - **Causa Raiz Resolvida**: No Android, o sistema operacional colocava o aplicativo em Standby/Doze Mode após horas sem acesso, suspendendo loops de JavaScript da WebView.
    - **Foreground Service Inviolável 24/7**: Criado `TradeLockForegroundService.kt` com notificação persistente (`startForeground`) imune ao encerramento pelo sistema operacional Android.
    - **Sincronização Nativa em Kotlin (`TradeLockNativeSync.kt`)**: Thread nativa em Kotlin rodando a cada 15 segundos em segundo plano, consultando o REST API do Supabase diretamente em segundo plano sem depender da WebView React. Se o trader for stopado no computador desktop, o celular ativa a trava nativa (`isLockActive = true`) e a VPN local instantaneamente mesmo com o app fechado há dias.
    - **Isenção de Otimização de Bateria & Auto-Boot**: Implementado prompt automático de isenção de otimização de bateria (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) e `BootReceiver.kt` para auto-inicialização no boot do celular.

58. **Correção de Ocultação do Botão Sair & Compactação Global do Layout (~80% Zoom)**:
    - **Correção da Ocultação do Botão "Sair"**: Ajustada a estrutura flex da [Navbar.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/Navbar.tsx). O grupo de perfil do usuário e o botão de Logout ("Sair") receberam a classe `shrink-0` e alinhamento dedicado na extrema direita. Os botões utilitários tiveram seus espaçamentos compactados (`gap-1 sm:gap-1.5`) e o container recebeu `overflow-x-hidden`. O botão "Sair" agora permanece 100% visível, acessível e com margem interna garantida em qualquer resolução ou exibição do banner de Stop Loss.
59. **Correção Definitiva da Sincronização em Tempo Real de Saques e Depósitos (App Desktop vs Painel Web)**:
    - **Causa Raiz Identificada**: Na tabela `capital_transactions` do Supabase Postgres, a coluna `status` não existia no schema cache, fazendo com que requisições `upsert` enviadas pelo App Desktop retornassem o erro `PGRST204` e fossem rejeitadas silenciosamente pelo Supabase. Além disso, `syncAllCapitalTransactionsToSupabase` não disparava a notificação `notifyRealtimeSync('capital_transactions', 'UPSERT')` e o `refetchAllData` em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx) fazia uma mesclagem cumulativa em vez de atualizar o estado diretamente com os dados da nuvem.
    - **Solução Implementada**:
      - Em [supabase.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/lib/supabase.ts), adicionado fallback dinâmico em `upsertCapitalTransactionToSupabase` e `syncAllCapitalTransactionsToSupabase`: os metadados de `status`, `broker` e `time` são serializados como JSON no campo `notes` e a coluna `status` é omitida se a tabela do Postgres não possuir essa coluna, garantindo inserção com código 201 (Created) sem erros.
      - Adicionado o valor padrão `'12:00'` para a coluna `time` para evitar violação da restrição `NOT NULL`.
      - Adicionado `notifyRealtimeSync('capital_transactions', 'UPSERT')` em lote para acionar o evento `SYNC_MUTATION` instantaneamente no canal de Broadcast via WebSockets.
      - Em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx), implementada a lógica de Auto-Heal (autocura): quando a consulta na nuvem retorna 0 registros mas o aplicativo local (Desktop) possui movimentações armazenadas no `localStorage`, o sistema dispara `syncAllCapitalTransactionsToSupabase` automaticamente para enviar todo o histórico local para o Supabase, impedindo que o estado local seja sobrescrito por arrays vazios e garantindo que o Painel Web receba os saques/depósitos sem F5.

60. **Recuperação Multi-Chaves de Histórico Local & Botão de Forçar Sincronização ("⚡ Sincronizar Nuvem")**:
    - **Varredura Multi-Chaves no Hydrate Iniciar (`App.tsx`)**: Atualizada a inicialização do estado de `capitalTransactions` em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx). O sistema agora varre todas as chaves do `localStorage` que contenham o termo `capital` (`trader_journal_capital_history`, `trader_journal_capital_transactions`, `trader_journal_capital_v1`, `trader_journal_capital_txs_default`, etc.), resgatando qualquer histórico que tenha sido importado em sessões anteriores ou versões legadas e subindo imediatamente para o Supabase via `syncAllCapitalTransactionsToSupabase`.
    - **Botão "⚡ Sincronizar Nuvem" (`CapitalHistoryModal.tsx`)**: Adicionado o botão dedicado na barra superior da tela de Gestão de Capital [CapitalHistoryModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/CapitalHistoryModal.tsx). Ao clicar, ele dispara o envio forçado de 100% das movimentações locais armazenadas no aplicativo para a nuvem via Broadcast WebSocket, propagando instantaneamente os depósitos e saques para o Painel Web.

61. **Reformulação da Tela de Gestão de Capital para Página Inteira Dedicada (`CAPITAL_MANAGEMENT`)**:
    - **Remoção do Container de Modal Sobreposto**: Removidas a classe `fixed inset-0 z-50` e a estrutura de pop-up flutuante de [CapitalHistoryModal.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/components/CapitalHistoryModal.tsx), substituindo-as por um container nativo de tela cheia (`min-h-screen bg-black text-white flex flex-col w-full`).
    - **Roteamento Próprio de Página (`currentView === 'CAPITAL_MANAGEMENT'`)**: Adicionada a rota `CAPITAL_MANAGEMENT` no estado `currentView` em [App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx). Ao clicar em "Saques / Depósitos", a plataforma substitui a visualização principal por completo (assim como na tela de Gestão de Risco e Admin), ocupando 100% da largura e altura da tela com topbar nativa ("← Voltar ao Diário de Trade").

## Regras Importantes
- Ambiente: Windows.
- Explicações curtas & diretas ao código.
- Português do Brasil (PT-BR).
















