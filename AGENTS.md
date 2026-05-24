# AGENTS.md — Controle de Gastos

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

## Backend conventions

- CORS allows all origins (`origin: '*'`).
- Routes are at `src/routes/`, controllers at `src/controllers/`, services at `src/services/`, models at `src/models/`.
- `decimal.js` is used in both backend and frontend for precise financial math.
- File uploads go to `backend/uploads/` (excluded from nodemon watch and `.gitignore`).
- Import flow: `POST /api/importacoes` → upload file to `/:id/arquivo` → parse + classify → review via `/:id/transacoes` → `PUT /:id/finalizar` creates real Transacao docs.

## Testing

Backend tests use Jest (`npm test` from `backend/`). Coverage is sparse — only `ledgerService` and `netWorthService` have tests. Frontend has `craco test` set up but no actual test files found.
