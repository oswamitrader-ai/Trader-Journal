# Manual Técnico: Ferramenta de Captura Automática de Ordens em Tempo Real

Documentação técnica do motor de interceptação de ordens para corretoras de Opções Binárias e Digitais (Exnova, IQ Option, Quotex, PocketOption, etc.) integrado à extensão Chrome do TradeLock.

---

## 1. Visão Geral da Arquitetura

O sistema de captura automática funciona em 4 camadas que se comunicam em tempo real:

```
[ Corretora (Exnova / IQ Option) ]
              │ (WebSocket / XHR / Fetch)
              ▼
[ injected.js (world: 'MAIN') ]
  ├── Proxy window.WebSocket
  ├── Hook WebSocket.prototype.addEventListener
  ├── Interceptador XHR & Fetch
  └── Descompactador de Arrays JSON & Filtro de Ruído
              │ (window.postMessage)
              ▼
[ content.js (Content Script) ]
              │ (chrome.runtime.sendMessage)
              ▼
[ background.js (Service Worker) ]
  ├── Transmite para o Trader Journal Web (localhost / app)
  ├── Atualiza PnL no chrome.storage.local
  └── Dispara o Bloqueio da Trava Anti-Fúria se atingir o Stop Loss
              │
              ▼
[ Trader Journal Web App & DOM Bridge #anti-furia-status-bridge ]
```

---

## 2. Funcionamento Interno de Cada Camada

### A. Camada 1: `injected.js` (O Motor de Interceptação Nativas)
- **Local no Código**: [src/utils/extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts#L384-L680)
- **Isolamento de CSP**: Executado no contexto nativo `world: 'MAIN'` do Manifest V3 do Chrome. Isso garante privilégios nativos de janela (`window`) sem violação da política de segurança da Exnova.
- **Técnicas de Interceptação**:
  1. **Proxy de `window.WebSocket`**: Substitui o construtor global do WebSocket para anexar listeners de mensagem em novos sockets.
  2. **Hook em `WebSocket.prototype.addEventListener`**: Garante captura mesmo se o aplicativo da corretora reutilizar instâncias de WebSocket abertas previamente.
  3. **XHR & Fetch Interceptor**: Captura respostas de requisições HTTP REST de histórico e resultado.

### B. Camada 2: Processamento, Filtragem e Deduplicação (`buildTrade`)
- **Descompactação de Arrays (`Array.isArray(parsed)`)**:
  - A Exnova envia atualizações agrupadas em listas JSON (`[ { name: "position-changed", msg: { ... } } ]`).
  - O motor percorre item a item para que nenhuma ordem seja ignorada.
- **Filtro de Ruído de Cotações (`IGNORED_NAMES`)**:
  - Descarta mensagens contínuas de cotação (`quote-generated`, `candle-generated`, `heartbeat`, `timesync`) para não sobrecarregar a memória nem o console.
- **Reconhecimento de Ordem Fechada (`isClosed`)**:
  - Filtra eventos de abertura de ordem e aceita apenas resultados definitivos:
    - Textuais: `win`, `loose`, `loss`, `equal`, `draw`.
    - Booleans: `raw.win === true / false`.
    - Status: `status: "closed"`, `status: "finished"`.
    - Indicadores de tempo: `close_time != null`, `close_reason != null`, `win_amount != null`.
- **Cálculo de PnL e Resultado (`GAIN` / `LOSS` / `BREAKEVEN`)**:
  - Se `profit_amount > 0`: PnL = Lucro Líquido.
  - Se `win_enrolled_amount > 0`: PnL = Retorno Total - Investimento.
  - Se `LOSS`: PnL = `-Valor Investido`.
- **Mapeamento de Pares por ID (`activeMap`)**:
  - Converte os IDs numéricos internos da Exnova (`1` → `EUR/USD`, `2` → `EUR/GBP`, `4` → `GBP/USD`, `5` → `USD/JPY`, `76` → `AUD/CAD`, `81` → `EUR/JPY`).
- **Deduplicação**:
  - Armazena os IDs em `processedIds (Set)` para garantir que um mesmo trade não seja duplicado se recebido simultaneamente via WebSocket e HTTP.

### C. Camada 3: Comunicação e Transmissão (`content.js` e `background.js`)
- `injected.js` envia o evento `AUTO_TRADE_CAPTURED` via `window.postMessage`.
- `content.js` escuta a janela e repassa para o Service Worker `background.js`.
- `background.js` transmite a ordem via WebSocket/Tabs para a aba aberta do **Trader Journal**, que insere o trade no diário automaticamente.
- Se o acumulado do dia ultrapassar o Stop Loss (`todayPnl <= -dailyLossLimit`), o `background.js` redireciona imediatamente as abas das corretoras para a tela de bloqueio `blocked.html` (Duelo Touro vs Urso).

---

## 3. Manual de Diagnóstico & Troubleshooting (Para o Agente de IA / Desenvolvedor)

Se a ferramenta de captura parar de registrar operações no futuro, siga este passo a passo de diagnóstico:

### 🔍 Passo 1: Inspecionar o histórico bruto de mensagens no navegador
Abra o DevTools Console (**F12**) na página da Exnova e digite:
```javascript
console.log(window.__antiFuriaLastRawMessages);
```
- **Se o array estiver vazio**: O `injected.js` não foi injetado (a extensão precisa ser recarregada em `chrome://extensions` ou a aba precisa de **F5**).
- **Se houver mensagens no array**: A Exnova alterou a estrutura do pacote WebSocket. Copie a estrutura do JSON e vá para o Passo 2.

### 🔍 Passo 2: Atualizar os seletores no arquivo `src/utils/extensionGenerator.ts`
1. Verifique o nome do evento no JSON retornado:
   - Exemplo: se o evento da Exnova mudou para `name: "digital-deal-finished"`, adicione esse termo na função `isTradeCloseEvent` em `src/utils/extensionGenerator.ts`:
     ```javascript
     name === 'digital-deal-finished'
     ```
2. Verifique o campo de resultado no objeto `msg`:
   - Se a corretora mudou o campo de lucro para `net_profit`, adicione no `buildTrade`:
     ```javascript
     const pnl = Number(raw.net_profit || raw.pnl || raw.profit) || 0;
     ```

### 🔍 Passo 3: Recompilar e Recarregar a Extensão
1. Baixe o novo arquivo `.zip` gerado na plataforma.
2. Em `chrome://extensions`, clique no botão de recarregar 🔄.
3. Dê **F5 (Atualizar)** na aba da corretora.

---

## 4. Arquivos Principais do Módulo
- **Gerador da Extensão**: [src/utils/extensionGenerator.ts](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/utils/extensionGenerator.ts)
- **Status Bridge DOM**: [src/App.tsx](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/src/App.tsx)
- **Documentação do Projeto**: [project_context.md](file:///c:/Users/swami/Downloads/Trader-Journal-main/Trader-Journal-main/_agent/project_context.md)
