# AGENTS.md — Controle de Gastos

## ⚠️ Antes de mexer em cores/tema/dark mode, LEIA ISTO

**Os seguintes ADRs explicam armadilhas conhecidas e como resolvê-las:**

- **ADR-006** — Estrutura de tokens (`src/theme/`)
- **ADR-007** — Tema MUI como fonte de verdade
- **ADR-008** — Glassmorphism exige gradiente vibrante atrás
- **ADR-009** — Tailwind `important: false`
- **ADR-010** — Migração do `App.css` para tokens
- **ADR-011** — Gradiente do body: split `GlobalStyles` + `MuiCssBaseline` (bug Emotion+stylis)
- **ADR-012** — ⚠️ **CRÍTICO: Elementos com cor presa de wrappers globais** (th, td, checkbox, etc) — `!important` + CSS variable em `App.css [data-theme="dark"]`

**Regra de ouro para qualquer mudança de cor em dark mode:**
1. Use CSS variable reativa (`var(--cg-color-XXX)`) que muda automaticamente em `[data-theme="dark"]`
2. **NUNCA** use inline style hardcoded (`style={{ background: '#XXX' }}`)
3. **NUNCA** mexa em state React, useEffect, ou hacks para forçar re-render
4. Se o elemento tem cor "presa" (não reage ao toggle sem reload), provavelmente é wrapper global de tipografia — use `!important` em `App.css` para sobrescrever
5. SEMPRE valide via browser-use ou DevTools que `getComputedStyle().color` muda SEM reload

**Para entender a saga completa:** `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-pos-execucao.md`

## Project layout

```
backend/                    Express API (port 3001)
controle-gastos-frontend/   React SPA (port 3004)
docker-compose.yml          MongoDB replica set (port 27017)
```

Not a workspace monorepo — each directory has its own `package.json` and `node_modules`.

## Prerequisites & startup

```powershell
# 1. Start MongoDB (requires replica set for transactions)
docker-compose up -d

# 2. Backend (from backend/)
npm run dev          # nodemon src/app.js

# 3. Frontend (from controle-gastos-frontend/)
npm start            # cross-env PORT=3004 craco start
```

The MongoDB dev connection string in `backend/.env.development` includes `?replicaSet=rs0`. Transactions (used in some service-layer operations) will fail without a replica set.

## Environment switching

Backend picks `.env.development` vs `.env.production` via `NODE_ENV` (see `app.js:5-9`). Frontend uses a single `.env` with `REACT_APP_API_BASE=http://localhost:3001/api`.

## Key commands

| Command | Directory | Notes |
|---------|-----------|-------|
| `npm run dev` | `backend/` | nodemon with auto-reload |
| `npm start` | `backend/` | production start (no reload) |
| `node scripts/migrations/NNN-name.js` | `backend/` | one-shot DB migration |
| `npm start` | `controle-gastos-frontend/` | dev server (port 3004 forced) |
| `npm run build` | `controle-gastos-frontend/` | production build via craco |
| `npm test` | `backend/` | Jest (coverage minimal) |

## Auth

- JWT stored in `localStorage` under key `token`. Expiry: 24h.
- Protected routes require email verification (`emailVerificado` field). The `PrivateRoute` component redirects to `/email-nao-verificado` if unverified.
- Admin routes check `usuario.role === 'admin'` via `isAdmin` middleware.
- On 401, the axios interceptor reads `error.response.data.redirectUrl` or falls back to `/login`.

## Database migrations

Scripts: `backend/scripts/migrations/`. Run once per environment, in numeric order:

```
node backend/scripts/migrations/001-add-default-user-role.js
node backend/scripts/migrations/002-historico-saldo-tipo.js
node backend/scripts/migrations/003-ledger-snapshot-inicial.js
node backend/scripts/migrations/004-categoria-tag-indices-multi-tenant.js
```

For production: `$env:NODE_ENV="production"; node backend/scripts/migrations/NNN-name.js` (PowerShell) or set `NODE_ENV=production` first.

## Frontend conventions

- **CRACO** (`craco.config.js`) overrides CRA webpack for Tailwind CSS integration. Use `craco start`/`craco build`, not `react-scripts`.
- **Tailwind `important: true`**: all Tailwind utilities get `!important` to override MUI styles.
- **Two API clients**: `src/api.js` (native `fetch` wrappers) and `src/services/api.js` (axios instance with interceptors). Both use `getToken()` from localStorage.
- **_id → codigo/id mapping**: The fetch-based API layer maps mongo `_id` to `codigo` (categories, tags) or `id` (transactions) for UI compatibility.
- **Context providers** hierarchy: `AuthProvider > DataProvider > BreadcrumbProvider > ImportacaoProvider`.

### Transaction form architecture (refactored)

```
hooks/                        Domain logic (no UI)
  useTransacaoForm.js         Core form state: tipo, descricao, data, valor, etc.
  usePagamentos.js            Payment array CRUD, sum validation, splitEqually
  useContaConjunta.js         Conta conjunta state, fluxo A/B, validation
  useParcelamento.js          Installment preview, debounced backend fetch

components/Transaction/
  NovaTransacaoForm.js        ~230 lines — orchestrates hooks, renders tabs, handles submit
  EditarTransacaoItem.js      ~170 lines — inline editor for bulk import (uses TagSelector)
  TransacaoTabs.js            Tab bar + sticky footer (Salvar/Salvar+Continuar)
  TabPrincipal.js             Tipo, Descricao, Data, Valor, Observacao
  TabPagamentos.js            Payment list with add/remove/duplicate/rateio + TagSelector
  TabAvancado.js              Parcelamento, Conta Conjunta, Subconta
  TagSelector.js              Reusable react-select for payment tags (React.memo)
  DateFieldWithShortcuts.js   Date input + Hoje/Ontem buttons
  ValorMonetarioInput.js      Numeric input with validation warning indicator
  ShortcutsHelp.js            Keyboard shortcuts overlay
```

The form is used in 5 contexts (`Home`, `Transacoes`, `Relatorio`, `DetalhesImportacaoPage`, `ImportarTransacoesForm`). All props and contracts are preserved. When editing import transactions, `NovaTransacaoForm` uses a dynamic `import()` of `importacaoService` to avoid circular dependencies.

## Backend conventions

- CORS allows all origins (`origin: '*'`).
- Routes are at `src/routes/`, controllers at `src/controllers/`, services at `src/services/`, models at `src/models/`.
- `decimal.js` is used in both backend and frontend for precise financial math.
- File uploads go to `backend/uploads/` (excluded from nodemon watch and `.gitignore`).
- Import flow: `POST /api/importacoes` → upload file to `/:id/arquivo` → parse + classify → review via `/:id/transacoes` → `PUT /:id/finalizar` creates real Transacao docs.

## Testing

Backend tests use Jest (`npm test` from `backend/`). Coverage is sparse — only `ledgerService` and `netWorthService` have tests. Frontend has `craco test` set up but no actual test files found.
