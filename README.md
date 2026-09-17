# Painel de Gerenciamento Trader

Painel completo de gerenciamento de capital e risco para traders com cálculos de assertividade, drawdown máximo, variação comparativa, calendário de pregões, alertas de metas e mentor tático com IA (Gemini).

---

## 🚀 Como fazer o Deploy na Vercel

O projeto já está configurado para deploy instantâneo na Vercel com suporte completo a Single-Page Application (SPA) e funções Serverless para as rotas de IA.

### Opção 1: Via GitHub (Recomendado)

1. **Suba o código para o seu repositório GitHub:**
   ```bash
   git init
   git add .
   git commit -m "feat: painel trader pronto para vercel"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Acesse a [Vercel](https://vercel.com/):**
   - Clique em **"Add New..."** ➜ **"Project"**.
   - Importe o repositório do GitHub.

3. **Configuração do Projeto na Vercel:**
   - O `Framework Preset` será detectado automaticamente como **Vite**.
   - O `Build Command` e `Output Directory` já estão pré-configurados no `vercel.json` (`vite build` e `dist`).

4. **Variáveis de Ambiente (Environment Variables):**
   - Em **Environment Variables**, adicione:
     - `GEMINI_API_KEY`: sua chave de API do Google AI Studio ([obter chave aqui](https://aistudio.google.com/app/apikey)).
     - `VITE_SUPABASE_URL`: `https://mreykdrbyfrwqovsleqi.supabase.co`
     - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_6ntxWuCoI_0Upy2PVIB6Nw__mMUiPUX`

5. **Clique em "Deploy":**
   - Em menos de 1 minuto seu aplicativo estará online com URL segura e HTTPS ativa!

---

## 🗄️ Banco de Dados Supabase (PostgreSQL)

O projeto está integrado ao banco de dados Supabase para persistência de trades e regras de risco na nuvem com sincronização em tempo real:

- **Script SQL de Criação:** O arquivo `supabase-schema.sql` na raiz do projeto contém todas as tabelas (`trades` e `risk_settings`) e regras RLS.
- **Como aplicar no Supabase:**
  1. Abra o painel do seu projeto: [Supabase SQL Editor](https://supabase.com/dashboard/project/mreykdrbyfrwqovsleqi/sql).
  2. Crie uma nova query (`New query`).
  3. Cole o conteúdo de `supabase-schema.sql` e clique em **Run**.
  4. O painel exibirá imediatamente o status verde de conexão com Supabase e permitirá sincronizar suas operações locais para a nuvem.

---

### Opção 2: Via Vercel CLI

1. Instale a CLI da Vercel globalmente (se ainda não tiver):
   ```bash
   npm i -g vercel
   ```

2. No diretório do projeto, execute:
   ```bash
   vercel
   ```

3. Configure a variável de ambiente:
   ```bash
   vercel env add GEMINI_API_KEY
   ```

4. Para publicar em produção:
   ```bash
   vercel --prod
   ```

---

## 🛠️ Arquitetura das Rotas no Vercel

- O arquivo `vercel.json` encaminha as requisições `/api/*` diretamente para a Serverless Function em `api/index.ts`.
- Todas as rotas de navegação do frontend são redirecionadas para `index.html` (SPA fallback).
- A chave secreta `GEMINI_API_KEY` roda de forma segura no lado do servidor (Serverless), sem nunca ser exposta no navegador do usuário.
