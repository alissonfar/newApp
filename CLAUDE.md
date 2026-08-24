# Sistema de Controle de Gastos — Guia de trabalho para o Claude

Este arquivo tem só o que é **específico deste projeto**. Como eu trabalho em geral (perfil,
comunicação, tiers, git, vault, testes) está em `~/.claude/CLAUDE.md` — os dois se combinam
automaticamente, não repita um no outro. Para convenções técnicas detalhadas (fluxo de auth,
migrations, arquitetura do form de transação, ADRs de dark mode), **leia também `AGENTS.md`** na raiz
do repo — este arquivo não duplica o conteúdo dele.

## O que é o projeto

Este projeto (Controle de Gastos) é pessoal/uso compartilhado, fora do escopo ACOM. App web de
controle de gastos pessoal/compartilhado, com transações multi-participante, controle de patrimônio
líquido, importações (CSV/OFX) e relatórios. Duas apps independentes, não é monorepo:

- `backend/` — Express + MongoDB (Mongoose), porta 3001
- `controle-gastos-frontend/` — React 19 SPA (CRACO + Tailwind + MUI), porta 3004
- `docker-compose.yml` — MongoDB replica set, porta 27017

Cada pasta tem seu próprio `package.json`/`node_modules`; comandos npm sempre de dentro da pasta
correspondente.

## Comandos

```powershell
# MongoDB (replica set obrigatório — transactions da service layer falham sem isso)
docker-compose up -d

# Backend (a partir de backend/)
npm run dev            # nodemon, auto-reload
npm start               # sem reload
npm test                # Jest — cobertura ainda pequena (só ledgerService & netWorthService)

# Frontend (a partir de controle-gastos-frontend/)
npm start                # craco start, fixo na porta 3004
npm run build            # craco build — NÃO rodar automaticamente, só quando eu disser "tarefa concluída"
npm test                 # craco test — ainda sem arquivos de teste
```

Testar um único arquivo Jest: `npx jest path/to/file.test.js` (a partir de `backend/`).

## Arquitetura (resumo — detalhe completo em `AGENTS.md`)

- **Backend** em camadas: `src/routes/` → `src/controllers/` → `src/services/` → `src/models/`, um
  arquivo de rota por domínio em `/api/<domain>`. **`decimal.js` para todo cálculo financeiro dos dois
  lados — nunca float puro para dinheiro.**
- **Auth**: JWT em `localStorage` (expira em 24h). `emailVerificado` protege rotas via `PrivateRoute`;
  `role === 'admin'` protege rotas de admin. Interceptor do axios trata 401 lendo `redirectUrl` ou
  caindo pra `/login`.
- **Importações**: `POST /api/importacoes` → upload em `/:id/arquivo` → parse/classificação → revisão
  em `/:id/transacoes` → `PUT /:id/finalizar` materializa as `Transacao` reais. Patrimônio (OFX) segue
  caminho paralelo em `/api/patrimonio/importacoes-ofx`.
- **Conta conjunta**: transações podem ter `contaConjunta` (`vinculoId`, `pagoPor`, `parteUsuario`,
  `parteOutro`) dividindo o gasto com outro participante. Acertos (`acertos`) quitam as transações não
  acertadas mais antigas primeiro (FIFO). Regra de negócio sensível — ver `RESUMO_TECNICO_SISTEMA.md`
  antes de mexer.
- **Frontend**: dois clientes de API coexistem (`src/api.js` fetch-based, `src/services/api.js`
  axios-based) — ambos leem o token via `getToken()`, mas o de fetch remapeia `_id` do Mongo pra
  `codigo`/`id`. Nesting de contexto: `AuthProvider > DataProvider > BreadcrumbProvider >
  ImportacaoProvider`. O form de transação (`components/Transaction/`) é a peça mais complexa da UI,
  reusado em 5 contextos — lógica em hooks (`useTransacaoForm`, `usePagamentos`, `useContaConjunta`,
  `useParcelamento`), separada dos componentes de tab.

## Dark mode / theming — ler antes de mexer em cores

Histórico documentado de bugs sutis aqui (bug de gradiente Emotion + stylis, captura de cor no wrapper
global em `th`/`td`/checkboxes etc.), ADRs 006–012 em `AGENTS.md`. Regra de ouro: usar variáveis CSS
reativas (`var(--cg-color-XXX)`) que respondem a `[data-theme="dark"]`, nunca cor inline hardcoded, e
validar o toggle de tema via `getComputedStyle()` sem reload de página. Writeup completo do incidente:
`.brain/sessions/2026-06-23-modernizacao-visual-pos-execucao.md`.

## Banco de dados / migrations — regra importante

Modelo **manual e deliberado**: eu prefiro rodar comandos de escrita/destrutivos eu mesmo (ver regra
geral em `~/.claude/CLAUDE.md`).

- **Pode rodar livremente (leitura):** queries de inspeção via `mongosh`, `npm test`, leitura de
  scripts em `backend/scripts/migrations/`.
- **Não rode sozinho, apenas sugira o comando exato para eu rodar:** qualquer migration em
  `backend/scripts/migrations/` (ex: `node scripts/migrations/006-emprestimo-transacao-importada.js`,
  com `NODE_ENV=production` quando for prod), ou qualquer operação que altere dados/schema.
- Ao propor uma migration nova, me entregue o script pronto e o comando exato (sintaxe PowerShell) —
  eu executo e confirmo o resultado.

## Testes — específico deste projeto

Cobertura automatizada existe, mas é pequena: **`ledgerService` e `netWorthService`** no backend
(frontend ainda sem testes). O formato do roteiro de teste manual está em `~/.claude/CLAUDE.md`; aqui
só importa saber: **se a mudança tocar `ledgerService` ou `netWorthService`, rode `npm test` no
backend antes de reportar como pronto**, além do roteiro manual — pro resto do projeto, o roteiro
manual é a única verificação.

## Memória de longo prazo: vault Obsidian

Pasta `.brain/` na raiz do repo — já existe, mas ainda pouco alimentada. Taxonomia (decisions/
context/sessions/playbooks/specs/plans) e regras de uso estão em `~/.claude/CLAUDE.md`; aqui só a
localização e uma nota de migração.

**Nota de migração:** o vault está começando a ser usado pra valer agora. Se notar uma decisão
importante já tomada no passado (ex: nos ADRs de dark mode em `AGENTS.md`, ou nas escolhas de
arquitetura do form de transação) que ainda não está em `.brain/context/` ou `.brain/decisions/`,
sinalize e proponha migrar — pode ser incremental, conforme mexemos em cada área.