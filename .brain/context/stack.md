---
type: context
status: active
created: 2026-06-21
tags: [stack, infra, projeto]
---

# Stack do projeto — Controle de Gastos

> **Nota:** Este arquivo é a fonte da verdade sobre o stack. Quando algo mudar, atualize aqui e crie um ADR explicando a mudança.

## Visão geral

Sistema de **controle de gastos pessoais** com:

- Backend Express API (Node.js)
- Frontend React (SPA)
- MongoDB como banco (com replica set)
- Integração com **Pluggy/Open Finance** para importar transações bancárias automaticamente
- Suporte a **multi-tenant** (cada usuário vê só seus dados)
- Sistema de **contas conjuntas** (compartilhar gastos com outras pessoas via código de convite)
- Importação em massa de CSV/OFX além da Pluggy

## Backend (`backend/`)

- **Runtime:** Node.js (versão não pinada no package.json)
- **Framework:** Express 4.18
- **Banco:** MongoDB 8.x via Mongoose 8.2
- **Autenticação:** JWT (`jsonwebtoken` 9.0) — 24h de expiração, armazenado em `localStorage` no frontend
- **Hash de senha:** `bcrypt` 5.1 (com fallback `bcryptjs`)
- **Upload de arquivos:** `multer` 1.4
- **Email:** `nodemailer` 6.10 (verificação de email, recuperação de senha)
- **Integração Open Finance:** `pluggy-sdk` 0.85
- **Parsing:** `csv-parse`, `csv-parser`, `xlsx`, `xml2js` (OFX)
- **Precisão financeira:** `decimal.js` 10.4
- **Outros:** `cors`, `dotenv`, `mongoose-paginate-v2`, `chardet`, `iconv-lite`
- **Dev:** `nodemon` 3.1, `jest` 29.7

### Estrutura de pastas (backend)

```
backend/src/
├── app.js                # entrypoint, carrega .env baseado em NODE_ENV
├── config/               # config.js, email.js
├── controllers/          # 1 controller por recurso (transacao, categoria, etc)
├── middlewares/          # autenticacao, checkRole (isAdmin), multerConfig
├── models/               # 1 model por recurso (Mongoose schemas)
├── services/             # lógica de negócio (ledger, netWorth, pluggy, etc)
├── routes/               # express routers
├── templates/            # templates de email
├── reportEngine/         # geração de relatórios
└── utils/                # helpers
```

### Portas e serviços

- **API:** porta `3001` (configurável via env)
- **MongoDB:** porta `27017` (via docker-compose, replica set `rs0`)
- **.env:** `backend/.env.development` (com `?replicaSet=rs0`) e `backend/.env.production`

### Scripts

| Script | Comando | Notas |
|--------|---------|-------|
| Dev (com reload) | `npm run dev` | nodemon |
| Prod | `npm start` | sem reload |
| Test | `npm test` | Jest (cobertura mínima) |
| Migrations | `node scripts/migrations/NNN-name.js` | rodar em ordem numérica |

### Migrations existentes

```
001-add-default-user-role.js
002-historico-saldo-tipo.js
003-ledger-snapshot-inicial.js
004-categoria-tag-indices-multi-tenant.js
006-emprestimo-transacao-importada.js
```

Em prod: `$env:NODE_ENV="production"; node scripts/migrations/NNN.js`

## Frontend (`controle-gastos-frontend/`)

- **Framework:** React 19.0 (não é Next.js — é SPA puro)
- **Build tool:** CRACO 7.1 (override do CRA webpack pra integrar Tailwind 4)
- **CSS:** Tailwind CSS 4.1 com `important: true` (sobrescreve MUI)
- **UI:** MUI 6.4 (`@mui/material`, `@mui/icons-material`) + Emotion
- **Roteamento:** react-router-dom 7.2
- **HTTP:** axios 1.8 (com interceptors) + `fetch` nativo (api.js)
- **Datas:** date-fns 4.1
- **Formulários/selects:** react-select 5.10
- **Gráficos:** chart.js 4.4 + react-chartjs-2 5.3
- **PDFs:** `@react-pdf/renderer` 4.3 + jspdf 3.0
- **Calendário:** react-calendar 5.1
- **Markdown:** react-markdown 10.1 + rehype-highlight
- **Toast:** react-toastify 11.0
- **Modais/UX:** sweetalert2 11.17
- **Pluggy:** `pluggy-sdk` 0.85 + `react-pluggy-connect` 2.12
- **Precisão financeira:** `decimal.js` 10.4 (compartilhado com backend)

### Portas

- **Dev server:** porta `3004` (forçada via `cross-env PORT=3004 craco start`)

### Estrutura de pastas (frontend)

```
controle-gastos-frontend/src/
├── api.js                       # fetch wrappers (mapeia _id → codigo/id)
├── services/api.js              # axios com interceptors
├── assets/                      # imagens, fontes
├── components/                  # componentes reutilizáveis
│   ├── Category/, Tag/, Transaction/, Layout/, navigation/, etc
│   ├── ImportacaoMassa/         # DetalhesImportacao, NovaImportacao, RevisaoImportacao
│   └── Transaction/             # NovaTransacaoForm (~230 linhas) + hooks
├── config/                      # configs de API, etc
├── context/ e contexts/         # AuthProvider, DataProvider, etc
├── hooks/                       # lógica de domínio (useTransacaoForm, usePagamentos, etc)
├── middleware/                  # PrivateRoute, isAdmin, etc
├── pages/                       # rotas (Home, Transacoes, Relatorio, Pluggy, Admin, etc)
├── utils/                       # helpers, export
└── ...
```

### Hierarquia de Context Providers

```
AuthProvider > DataProvider > BreadcrumbProvider > ImportacaoProvider
```

### Duas API clients (importante!)

1. `src/api.js` — wrappers em `fetch` nativo, **mapeia `_id` → `codigo` (categorias/tags) ou `id` (transações)** pra compatibilidade com UI
2. `src/services/api.js` — axios com interceptors, **NÃO mapeia `_id`** — devolve cru

Ambas usam `getToken()` do `localStorage`. **Cuidado** ao misturar as duas.

## Autenticação e multi-tenant

- JWT no `localStorage` (chave `token`), expiração 24h
- Middleware `autenticacao.js` valida JWT em rotas protegidas
- Middleware `checkRole.js` valida `usuario.role === 'admin'`
- Frontend: `PrivateRoute` redireciona pra `/login` se 401, ou `/email-nao-verificado` se `emailVerificado === false`
- **Multi-tenant:** categorias e tags são scopadas por usuário (índices criados na migration 004)
- Interceptor axios lê `error.response.data.redirectUrl` pra redirecionamento customizado

## Features críticas (validadas)

Lista das features que **NÃO podem ser quebradas**:

1. **Integração Pluggy/Open Finance** — importar transações automaticamente dos bancos
2. **Importação em massa CSV/OFX** — fluxo de upload → parse → classificar → revisar → finalizar
3. **Multi-tenant + JWT + verificação de email** — isolamento de dados por usuário
4. **Contas conjuntas e acertos** — compartilhamento de gastos com outras pessoas
5. **Cálculos financeiros com decimal.js** — ledger patrimonial, faturas, patrimônio líquido (NUNCA usar float nativo pra dinheiro)
6. **Sistema de relatórios e insights** — templates customizáveis, exportação PDF

> **Nota:** Esta lista é provisória. Alisson marcou "tem outras que faltam" na sessão de setup inicial. Voltar aqui quando identificar features adicionais.

## Princípios (guias fortes, não dogmas)

- **JWT + emailVerificado:** toda rota nova deve exigir ambos (a menos que justificado)
- **Multi-tenant:** toda query a categoria/tag deve filtrar por usuário
- **decimal.js:** NUNCA usar float nativo para valores monetários (sempre `new Decimal(...)`)
- **Conventional Commits em português** (padrão dos commits do projeto, validado pelo newapp-committer)
- **Frontend = React puro (não Next.js)**, com CRACO + Tailwind `important: true` + MUI
- **CORS liberado** (`origin: '*'`) — política atual do backend

## Agentes configurados

- **`newapp-planner`** (primary, via Tab) — planejamento, escreve no vault `.brain/`
- **`newapp-executor`** (subagent, via `@`) — execução, edita código do projeto
- **`newapp-committer`** (subagent, via `@`) — commits estruturados em Conventional Commits (PT-BR)

Sintaxe de permissões documentada em [ADR-002](../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md). Como criar novos agentes: [playbook](../playbooks/criar-novo-agente.md).

## Skills instaladas

### Em `.agents/skills/` (instaladas via npx)
- `brainstorming` — planejamento estruturado (planner carrega no modo completo)
- `find-skills` — meta-skill para descobrir e instalar outras skills (ambos os agentes podem usar)

### Em `.opencode/skills/` (pré-existentes)
- `browser-use` — automação de browser
- `frontend-design` — **forçada** no executor ao criar/modificar UI
- `pluggy-doctor` — **forçada** no executor ao tocar em código Pluggy
- `pluggy-integration` — **forçada** no executor ao implementar algo novo com Pluggy
- `pluggy-open-finance` — boas práticas Open Finance
- `pluggy-payments` — pagamentos via Pluggy (PIX, Boleto, Smart Transfers)

> **NÃO instaladas:** as 2 skills do Supabase (`supabase`, `supabase-postgres-best-practices`) — projeto usa MongoDB, não Supabase.
>
> **Estratégia de skills:** ver [ADR-005](../decisions/2026-06-21-estrategia-skills-forcar-vs-opcional.md).

## Comandos principais

| O que | Onde | Comando |
|-------|------|---------|
| Subir MongoDB | raiz | `docker-compose up -d` |
| Dev backend | `backend/` | `npm run dev` |
| Dev frontend | `controle-gastos-frontend/` | `npm start` |
| Lint backend | `backend/` | `npm run lint` (⚠️ não tem script — usa padrão) |
| Build frontend | `controle-gastos-frontend/` | `npm run build` |
| Test backend | `backend/` | `npm test` |
| Migration | `backend/` | `node scripts/migrations/NNN.js` |

> **Atenção:** o backend não tem script `lint` no package.json. Precisa decidir se vamos adicionar ou rodar eslint direto via npx. (Issue aberta — ver ADR futuro.)

## Histórico de mudanças desta nota

- **2026-06-21:** criação inicial durante setup do vault.
