# Sistema de Controle de Gastos — Guia de trabalho para o Claude

Este arquivo orienta como trabalhar neste repositório. Leia antes de planejar ou executar qualquer mudança. Para convenções técnicas detalhadas (fluxo de auth, migrations, arquitetura do form de transação, ADRs de dark mode), **leia também `AGENTS.md` na raiz do repo** — este arquivo não duplica o conteúdo dele.

## Quem sou eu

**Alisson** — trabalho na ACOM Sistemas Corporativos (ERP para foodservice, ecossistema Everest), na área de projetos/setup. Estou cursando Análise e Desenvolvimento de Sistemas. Este projeto (Controle de Gastos) é pessoal/uso compartilhado, fora do escopo ACOM.

**Perfil técnico:**
- Conheço conceitos de programação, mas **não programo diretamente** — sou "vibe coder": construo com agentes de IA, não escrevendo código eu mesmo.
- Perfil "arquiteto": penso em fluxos, sistemas e regras de negócio antes de pensar em implementação.
- Leio código, mas **não consigo identificar bugs visuais/de comportamento sozinho** — quando reportar algo, explique o que está acontecendo e o que aquilo **causa na prática**, não só "editei o arquivo X".
- Conheço os conceitos do stack, mas não tenho profundidade — não assuma que eu sei o motivo por trás de uma escolha técnica; confirme entendimento em decisões importantes.

**Como se comunicar comigo:**
- Pode usar termos técnicos livremente, mas **sempre explique o que aquilo significa/faz na prática**.
- Ao terminar uma mudança, explique em termos de **comportamento do app** (o que passou a funcionar/mudar), não só quais arquivos foram tocados.
- Prefiro que decisões com múltiplas alternativas sejam apresentadas como opções claras, com uma marcada como **(Recomendado)** e o porquê explicado — não decida por mim em silêncio.
- Seja opinativo: gosto de sugestões que eu não pensei ainda. Se um pedido meu tem problema, aponte antes de simplesmente executar.
- Seja detalhista nos reportes — eu não estou olhando o código junto, estou confiando no que é reportado.

## O que é o projeto

Sistema de Controle de Gastos: app web de controle de gastos pessoal/compartilhado, com transações multi-participante, controle de patrimônio líquido, importações (CSV/OFX) e relatórios. Duas apps independentes, não é monorepo:

- `backend/` — Express + MongoDB (Mongoose), porta 3001
- `controle-gastos-frontend/` — React 19 SPA (CRACO + Tailwind + MUI), porta 3004
- `docker-compose.yml` — MongoDB replica set, porta 27017

Cada pasta tem seu próprio `package.json`/`node_modules`; comandos npm sempre de dentro da pasta correspondente.

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

- **Backend** em camadas: `src/routes/` → `src/controllers/` → `src/services/` → `src/models/`, um arquivo de rota por domínio em `/api/<domain>`. **`decimal.js` para todo cálculo financeiro dos dois lados — nunca float puro para dinheiro.**
- **Auth**: JWT em `localStorage` (expira em 24h). `emailVerificado` protege rotas via `PrivateRoute`; `role === 'admin'` protege rotas de admin. Interceptor do axios trata 401 lendo `redirectUrl` ou caindo pra `/login`.
- **Importações**: `POST /api/importacoes` → upload em `/:id/arquivo` → parse/classificação → revisão em `/:id/transacoes` → `PUT /:id/finalizar` materializa as `Transacao` reais. Patrimônio (OFX) segue caminho paralelo em `/api/patrimonio/importacoes-ofx`.
- **Conta conjunta**: transações podem ter `contaConjunta` (`vinculoId`, `pagoPor`, `parteUsuario`, `parteOutro`) dividindo o gasto com outro participante. Acertos (`acertos`) quitam as transações não acertadas mais antigas primeiro (FIFO). Regra de negócio sensível — ver `RESUMO_TECNICO_SISTEMA.md` antes de mexer.
- **Frontend**: dois clientes de API coexistem (`src/api.js` fetch-based, `src/services/api.js` axios-based) — ambos leem o token via `getToken()`, mas o de fetch remapeia `_id` do Mongo pra `codigo`/`id`. Nesting de contexto: `AuthProvider > DataProvider > BreadcrumbProvider > ImportacaoProvider`. O form de transação (`components/Transaction/`) é a peça mais complexa da UI, reusado em 5 contextos — lógica em hooks (`useTransacaoForm`, `usePagamentos`, `useContaConjunta`, `useParcelamento`), separada dos componentes de tab.

## Dark mode / theming — ler antes de mexer em cores

Histórico documentado de bugs sutis aqui (bug de gradiente Emotion + stylis, captura de cor no wrapper global em `th`/`td`/checkboxes etc.), ADRs 006–012 em `AGENTS.md`. Regra de ouro: usar variáveis CSS reativas (`var(--cg-color-XXX)`) que respondem a `[data-theme="dark"]`, nunca cor inline hardcoded, e validar o toggle de tema via `getComputedStyle()` sem reload de página. Writeup completo do incidente: `.brain/sessions/2026-06-23-modernizacao-visual-pos-execucao.md`.

## Banco de dados / migrations — regra importante

Modelo **manual e deliberado**: eu prefiro rodar comandos de escrita/destrutivos eu mesmo.

- **Pode rodar livremente (leitura):** queries de inspeção via `mongosh`, `npm test`, leitura de scripts em `backend/scripts/migrations/`.
- **Não rode sozinho, apenas sugira o comando exato para eu rodar:** qualquer migration em `backend/scripts/migrations/` (ex: `node scripts/migrations/006-emprestimo-transacao-importada.js`, com `NODE_ENV=production` quando for prod), ou qualquer operação que altere dados/schema.
- Ao propor uma migration nova, me entregue o script pronto e o comando exato (sintaxe PowerShell) — eu executo e confirmo o resultado.

## Testes: smoke test manual guiado

A cobertura automatizada hoje é pequena (só `ledgerService` e `netWorthService` no backend, frontend sem testes) — não vou expandir isso como prioridade padrão. Por isso, **todo reporte de mudança que altera algo visível/clicável precisa vir com um roteiro de teste manual claro**, não só "está pronto".

Formato esperado ao final de uma mudança:

```
🧭 Como testar

1. Abra [URL com porta detectada]/rota
2. [Caminho exato: ex. "Login → /transacoes → clique em 'Nova transação'"]
3. O que deve acontecer: [ex. "modal abre com o form de conta conjunta"]
4. Critério de sucesso: [o que confirma que está OK]
5. Problemas comuns a observar: [2-3 itens plausíveis, sem alarmismo]
```

Regras:
- **Nunca hardcode a porta** (3004/3001 pode mudar) — detecte a porta real antes de listar URLs.
- Linguagem de produto ("clique no botão X"), não técnica ("dispare o evento onClick").
- Se a mudança não afeta nada visível/testável manualmente (refactor interno, ajuste de tipo), pode dispensar o roteiro — mas diga isso explicitamente.
- Se a mudança tocar `ledgerService` ou `netWorthService` (que já têm teste automatizado), rode `npm test` no backend antes de reportar como pronto, além do roteiro manual.

## Memória de longo prazo: vault Obsidian (`.brain/`)

A pasta `.brain/` já existe no projeto, mas está pouco alimentada até agora — vamos começar a usá-la de fato a partir daqui, no mesmo padrão do Hub ACOM:

| Pasta | Conteúdo | Escrever quando |
|---|---|---|
| `decisions/` | ADRs — por que escolhemos X em vez de Y | decisão de arquitetura tomada (ex: os ADRs 006–012 de dark mode deveriam estar/já estar aqui) |
| `context/` | Info estável: stack, regras de negócio (ex: FIFO de acertos, split de conta conjunta) | descobrir info estável nova |
| `sessions/` | Logs de sessões de trabalho | ao final de uma sessão relevante |
| `playbooks/` | Procedimentos recorrentes (migration, deploy, debug) | procedimento reutilizável identificado |

**Sempre verifique o vault antes de propor algo novo** — se já existe decisão/contexto documentado (ou em `RESUMO_TECNICO_SISTEMA.md` / `AGENTS.md`), referencie em vez de redecidir. Salve automaticamente quando aplicável, e me avise o que foi salvo e onde, para eu revisar no Obsidian.

**Nota de migração:** como o vault está começando a ser usado pra valer agora, se em algum momento você notar uma decisão importante já tomada no passado (ex: nos ADRs de dark mode, ou nas escolhas de arquitetura do form de transação) que não está documentada em `.brain/context/` ou `.brain/decisions/`, sinalize e proponha migrar isso pra lá — não precisa fazer de uma vez, pode ser incremental conforme mexemos em cada área.

## Fluxo de trabalho

Separo o trabalho em três momentos — **Planejar → Executar → Commitar**. A profundidade de cada um varia pelo porte da mudança. Uso as skills do Superpowers (`.claude/skills/`) escalonadas em 3 tiers, pra não gastar processo (e tokens) demais em coisa pequena.

**Como decidir o tier:** avalie complexidade, nº de arquivos/domínios tocados e se envolve decisão de arquitetura. Se ficar em dúvida entre dois tiers, **pergunte antes de escalar** — não assuma o tier maior "pra garantir", e não desça de tier sozinho pra economizar se a mudança claramente pedir mais estrutura.

### Tier 1 — Ajuste pontual
Bug isolado, fix de estilo/UI, mudança em 1 arquivo, comportamento já conhecido.

- **Planejar:** direto, sem brainstorming, sem plano formal. Se for bug, aciona `systematic-debugging` (investigar causa raiz antes de propor fix).
- **Executar:** mesma sessão, validando com o que existir de teste automatizado relevante (ex: `npm test` se tocar `ledgerService`/`netWorthService`).
- **Commitar:** como sempre — só com minha aprovação explícita.

### Tier 2 — Mudança média
2-4 arquivos, lógica já conhecida, sem decisão de arquitetura nova. Ex: ajuste em um hook do form de transação, novo campo em um relatório.

- **Planejar:** brainstorming curto só se houver ambiguidade real (não obrigatório). Sempre passa por `writing-plans` — quebra em tarefas pequenas e verificáveis, que eu aprovo antes de executar.
- **Executar:** `executing-plans` — mesma sessão, em lotes, com checkpoint comigo entre eles. **Não** aciona subagente isolado por tarefa (custo desnecessário nesse porte).
- **Commitar:** como sempre.

### Tier 3 — Feature nova / módulo novo / mudança cross-cutting
Toca múltiplos domínios, envolve decisão de arquitetura, ou é módulo novo (ex: mexer a fundo em conta conjunta/acertos, ou um novo tipo de importação).

- **Planejar:** `brainstorming` completo (perguntas, alternativas, design apresentado em pedaços pra eu validar) → `writing-plans`.
- **Executar:** `subagent-driven-development` — subagente novo por tarefa, com revisão em duas etapas (conformidade com spec, depois qualidade). O custo extra vale a pena aqui porque evita contexto poluído numa mudança grande.
- **Commitar:** como sempre.

**Nomeação explícita:** as skills não carregam sozinhas no início da sessão — não uso o hook de `session-start` do plugin oficial (ver por quê no fim deste documento). Então, ao identificar que um pedido é Tier 3, diga isso explicitamente antes de agir: "isso é Tier 3 — vou usar brainstorming + writing-plans + subagent-driven-development, ok?"

**TDD (`test-driven-development`):** cobertura automatizada hoje é pequena e não é meu foco padrão (ver seção Testes acima) — **não acione essa skill por padrão**, nem em Tier 3. Só se eu pedir explicitamente pra adicionar/expandir testes automatizados em algo específico.

**Regra de ouro:** na dúvida, pergunte — não improvise. Prefiro decisões explícitas (mesmo que pareçam óbvias) a suposições silenciosas.

## Git / Commits

Use **Conventional Commits em português**:

```
<tipo>(<escopo>): <descrição curta, imperativo presente>

<corpo explicando O QUE mudou e POR QUÊ>
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `security`.

- Nunca `git add .` ou `git add -A` cego — liste os arquivos e adicione especificamente.
- Nunca commitar sem eu aprovar a mensagem antes.
- Nunca commitar arquivos sensíveis (`.env`, secrets, tokens) — se aparecer, pare e avise.
- Nunca código de debug/comentado não intencional (`console.log`, `debugger`) — se não for intencional, pare e pergunte.
- Nunca fazer push, reset, rebase ou checkout destrutivo sem eu pedir explicitamente.

## O que nunca fazer sem permissão explícita

- Instalar/desinstalar pacotes (`npm install`, `npm i`)
- Rodar `npm run build` (craco build) automaticamente
- Rodar migrations em `backend/scripts/migrations/`
- Fazer commit, push, ou qualquer alteração destrutiva no git
- Remover arquivos (`rm`, `del`)
- Rodar `docker-compose down` com remoção de volumes (perda do replica set local)
