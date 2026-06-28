---
type: session
status: active
created: 2026-06-28
tags: [breadcrumb, pos-execucao, refactor, bugfix, design-system, frontend, sessao]
related:
  - .brain/sessions/2026-06-28-breadcrumb-reorganizacao-design.md
  - .brain/decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md
  - .brain/sessions/2026-06-26-sidebar-reorganizacao-design.md
---

# Sessão Consolidada: Reorganização e modernização do Breadcrumb (2026-06-28)

> **Sessão consolidada** que cobre 1 design doc + 1 refactor arquitetural + 1 redesign visual + 1 bug fix (race condition). Marca o **estado atual** do breadcrumb após essas mudanças.

## TL;DR (pra quem tem pressa)

Em 1 sessão, refatoramos o sistema de breadcrumbs do Controle de Gastos. O breadcrumb agora deriva a hierarquia do mesmo `menuStructure.js` que a sidebar consome (fonte única de verdade), tem label dinâmico scoped por rota (sem race condition), visual modernizado com tokens + glassmorphism + separador `·` Linear-style, e ellipsis automático responsivo. **Tudo em ~5-6h de executor + 30min de validação manual.** Nenhuma feature removida, nenhuma regressão detectada.

**Commits envolvidos:** 6 commits pendentes (ainda não comitados — Alisson vai revisar e chamar o `newapp-committer`).

## Linha do tempo

### 2026-06-28 (manhã) — Bug report: race condition no breadcrumb

- **Sintoma:** Alisson reportou inconsistências comportamentais e visuais no breadcrumb. Em navegação rápida entre detalhes (ex: `/emprestimos/123` → `/emprestimos/456`), o label piscava "Detalhe" → "Maria" → "Detalhe" brevemente antes de estabilizar.
- **Causa raiz:** o `BreadcrumbContext.js` mantinha `overrideLabel` como **singleton global** (state único compartilhado entre todas as páginas). O hook `useBreadcrumbOverride` chamava `setBreadcrumbOverride(null)` no cleanup do effect, o que causava race condition em navegações rápidas: o cleanup da rota antiga podia rodar **depois** do mount da rota nova, sobrescrevendo o label novo com `null`.
- **Investigação:** novaapp-planner leu o código atual (`BreadcrumbsNav.jsx` 105 linhas, `BreadcrumbContext.js` 39 linhas, `breadcrumbConfig.js` 39 linhas, 5 páginas de detalhe usando `useBreadcrumbOverride`) e identificou **5 problemas comportamentais + 7 visuais + 1 arquitetural** (duas fontes de verdade pra hierarquia).

### 2026-06-28 (manhã) — Design: 3 abordagens consideradas

**Problema mais profundo que o reportado:** além da race condition, o breadcrumb tinha 2 fontes de verdade pra hierarquia de navegação (`menuStructure.js` que a sidebar consome, e `breadcrumbConfig.js` que o breadcrumb lia). Toda vez que adicionasse uma rota nova, era preciso atualizar os 2 arquivos. Receita pra bug futuro.

**Abordagens consideradas:**

- **A — Mínimo viável:** corrigir só o que está quebrado, manter 2 fontes de verdade. ~2-3h. **Contra:** mantém o débito técnico.
- **B — Coerente com a sidebar (escolhida):** `menuStructure.js` vira fonte única, breadcrumb deriva hierarquia, MAP scoped por rota, visual modernizado. ~5-6h.
- **C — Premium:** tudo da B + dropdowns em cada nível (estilo GitHub) + atalhos de teclado + indicador de loading. 12-16h. **Contra:** overkill pro estado atual.

**Decisão:** Opção B, com **gancho explícito pra C no futuro** documentado no design (sem código ainda — é design, não implementação).

**Alisson escolheu container com glassmorphism** pra integrar visualmente com o resto do projeto (a sidebar reorganizada na sessão 2026-06-26 já usa `var(--cg-color-surface)` em outras superfícies).

**Sistemas de referência considerados:** GitHub (breadcrumbs com dropdowns), Material UI v6 docs (`maxItems` + ellipsis), Vercel Dashboard (path completo com item atual em pill), Linear (separador `·` minimalista, tipografia consistente).

- **Design doc:** [`2026-06-28-breadcrumb-reorganizacao-design.md`](2026-06-28-breadcrumb-reorganizacao-design.md) (approved)
- **ADR:** [ADR-017](../../decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md)

### 2026-06-28 (manhã) — Execução: Fases 0-4 (delegadas ao `newapp-executor`)

Executor aplicou:

- **Fase 1:** adicionou `path: '/patrimonio'` e `path: '/emprestimos'` nos submenus correspondentes do `menuStructure.js` (necessário pro `buildParentMap` derivar a hierarquia).
- **Fase 2:** adicionou 3 funções puras no `menuStructure.js`:
  - `buildParentMap(structure)` — converte a estrutura aninhada em `Map<path, parentPath>`.
  - `findLabelInMenu(path, structure)` — busca recursiva do label canônico de um path.
  - `humanizeSegment(path)` — fallback final (formata slug, detecta IDs, usa `FALLBACK_LABELS` pra rotas estáveis fora do menu como `/profile`, `/como-utilizar`, `/admin`).
- **Fase 3:** refatorou `BreadcrumbContext.js`:
  - `overrideLabel: string | null` → `dynamicLabels: Map<pathname, label>`.
  - `setBreadcrumbOverride(label)` → `setDynamicLabel(pathname, label)` + `clearDynamicLabel(pathname)`.
  - `useBreadcrumbOverride(label)` → `useBreadcrumbTrailing(label)`.
  - **Guard no cleanup:** `if (window.location.pathname === pathname) clearDynamicLabel(pathname)`. **Resolve a race condition pela raiz** (não é só corrigir o `setBreadcrumbOverride(null)`, é tornar o estado impossível de conflitar por construção).
- **Fase 4:** refatorou `BreadcrumbsNav.jsx`:
  - Importa `buildParentMap`, `findLabelInMenu`, `humanizeSegment` do `menuStructure.js`.
  - Implementa `buildBreadcrumbItems(pathname, parentMap, dynamicLabels)` com `findAncestor` (cobre rotas dinâmicas como `/emprestimos/:id`).
  - Usa `<MuiLink component={Link}>` em vez de `<Link style>` (remove inline styles, usa tokens).
  - Configura `maxItems={4}` desktop, `maxItems={3}` mobile via `useMediaQuery(theme.breakpoints.down('md'))`.
  - `itemsBeforeCollapse={1}` + `itemsAfterCollapse={isMobile ? 1 : 2}` (ellipsis do MUI).
  - Separador `·` (middle dot, U+00B7) com `var(--cg-color-text-muted)`.
  - Container `<Box>` com `var(--cg-color-surface)` + `backdropFilter: blur(12px)` (glassmorphism aprovado).
  - `aria-current="page"` no último item (acessibilidade).
  - **100% tokens**, zero hex hardcoded. Respeita ADR-012 (dark mode reativo sem reload).

**Detalhe da resposta do executor:** ele reportou **resposta vazia** na primeira delegação (só o status `completed`). Diagnóstico via inspeção de arquivos (`git status`, `Read` em cada arquivo) confirmou que o trabalho foi feito corretamente, mas a fase 5 (migração das 5 páginas) e fase 6 (apagar `breadcrumbConfig.js`) ficaram pendentes. **Lição aprendida: validar resultado do executor via inspeção de artefatos, não só confiar no output textual.**

### 2026-06-28 (manhã) — Execução: Fases 5-7 (segunda delegação)

- **Fase 5:** migrou as 5 páginas de detalhe de `useBreadcrumbOverride` → `useBreadcrumbTrailing` (2 linhas por arquivo, mecânico):
  - `pages/Emprestimos/EmprestimoDetalhePage.js`
  - `pages/Patrimonio/DetalheSubcontaPage.js`
  - `pages/Patrimonio/FaturasPage.js`
  - `pages/Patrimonio/ImportacaoOFXDetalhePage.js`
  - `pages/Conjunto/DetalheVinculoPage.js`
- **Fase 6:** apagou `breadcrumbConfig.js` (zero referências restantes em `src/`, validado por `grep`). Diretório `src/config/` ficou vazio (decidiu não remover o diretório, preserva estrutura caso queira reusar).
- **Fase 7:** validação visual completa com `browser-use` (8 cenários + race condition test):
  1. Home (`/`) → "Home" em destaque ✅
  2. Patrimônio (`/patrimonio`) → "Home · Patrimônio" ✅
  3. Patrimônio contas (`/patrimonio/contas`) → "Home · Patrimônio · Contas" ✅
  4. Detalhe empréstimo (`/emprestimos/<id>`) → "Home · Empréstimos · [nome]" ✅
  5. Conta conjunta detalhe (`/conjunto/<id>`) → "Home · Contas Conjuntas · [nome]" ✅
  6. Rota profunda 4 níveis → ellipsis visível (maxItems=4) ✅
  7. Mobile (375px) → ellipsis mais enxuto (maxItems=3), container adaptado ✅
  8. Dark mode → cores reagem sem reload (validado com `getComputedStyle().color` mudando) ✅
  - **Teste de race condition:** navegação rápida entre 3 vínculos em sequência (`/conjunto/abc` → `/conjunto/def` → `/conjunto/ghi`). Resultado: breadcrumb final = "Home · Contas Conjuntas · Teste Terceiro" (correto, **sem flash de "Detalhes"**). O guard `window.location.pathname === pathname` no cleanup funcionou perfeitamente.

### 2026-06-28 (manhã) — Validação manual (Alisson)

Alisson validou manualmente no browser. Resultado positivo (reportou "resultado final é positivo", "Vou verificar manualmente mesmo, mas a princípio, o resultado final é positivo"). Delegou a atualização da documentação pra o `newapp-planner`.

## Arquivos alterados

```
controle-gastos-frontend/src/components/Layout/menuStructure.js              (M, +118/-1)  ← +path em 2 submenus + 3 funções puras + FALLBACK_LABELS
controle-gastos-frontend/src/components/navigation/BreadcrumbsNav.jsx         (M, +133/-29) ← reescrito com tokens, glassmorphism, ellipsis responsivo
controle-gastos-frontend/src/context/BreadcrumbContext.js                     (M, +47/-19)  ← singleton → MAP scoped + guard no cleanup
controle-gastos-frontend/src/config/breadcrumbConfig.js                       (D)            ← apagado, 0 referências em src/
controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js       (M, ~2 linhas) ← useBreadcrumbOverride → useBreadcrumbTrailing
controle-gastos-frontend/src/pages/Patrimonio/DetalheSubcontaPage.js          (M, ~2 linhas) ← idem
controle-gastos-frontend/src/pages/Patrimonio/FaturasPage.js                  (M, ~2 linhas) ← idem
controle-gastos-frontend/src/pages/Patrimonio/ImportacaoOFXDetalhePage.js     (M, ~2 linhas) ← idem
controle-gastos-frontend/src/pages/Conjunto/DetalheVinculoPage.js             (M, ~2 linhas) ← idem
```

**9 alterações**: 7 modifications + 1 deletion + 1 design doc.

## Validação

- **Lint:** `cd controle-gastos-frontend && npx eslint src/` passou (exit 0, sem warnings).
- **Validação visual:** 8 cenários + race condition test, todos OK.
- **Acessibilidade:** `aria-current="page"` no último item, separador decorativo, `aria-label="breadcrumb"` (já existia).
- **Dark mode:** validado via `getComputedStyle().color` mudando sem reload (regra do ADR-012).
- **Responsividade:** validado em 1920×1080 desktop e 375×812 mobile (iPhone X viewport).

## Decisões arquiteturais (resumo)

| # | Decisão | ADR |
|---|---|---|
| 1 | `menuStructure.js` é fonte de verdade única | [ADR-017](../../decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md) |
| 2 | Label dinâmico é MAP scoped por rota (não singleton) | [ADR-017](../../decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md) |
| 3 | Hook `useBreadcrumbTrailing` substitui `useBreadcrumbOverride` (sem alias) | [ADR-017](../../decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md) |
| 4 | Container com glassmorphism (decisão visual do Alisson) | [ADR-008](../../decisions/2026-06-23-glassmorphism-exige-gradiente-vibrante.md) |
| 5 | Tokens do projeto (`var(--cg-color-*)`) — zero hex hardcoded | [ADR-007](../../decisions/2026-06-23-mui-fonte-verdade-componentes.md), [ADR-012](../../decisions/2026-06-23-css-variable-para-cores-presas-em-dark-mode.md) |
| 6 | Abordagem C (premium) documentada como evolução futura, não implementada | (em design doc) |

## Lições aprendidas

1. **Resposta vazia do executor ≠ trabalho não feito.** O executor reportou `completed` com output textual vazio na primeira delegação. Inspecionar os artefatos diretamente (`git status`, `Read` em cada arquivo) confirmou que Fases 1-4 foram aplicadas corretamente. **Sempre validar resultado de subagentes via inspeção de artefatos**, especialmente quando a resposta textual é vazia ou suspeita.

2. **Source of truth única é princípio, não otimização.** O problema das 2 fontes de verdade (`menuStructure.js` + `breadcrumbConfig.js`) não era urgente — funcionava. Mas era um **débito técnico com juros altos**: cada rota nova era 2 arquivos pra atualizar, com risco de divergência. Centralizar antes de adicionar mais rotas foi a decisão certa.

3. **Race condition em singleton é sintoma, não causa.** A correção ingênua seria "no cleanup, não chame `setBreadcrumbOverride(null)`". Mas a causa raiz é que o estado é global e compartilhado sem escopo. A correção certa foi tornar o estado **impossível de conflitar** (MAP indexado por rota) e adicionar o guard `window.location.pathname === pathname` no cleanup como cinto de segurança.

4. **Validar divergências entre design doc e realidade.** O design doc mencionava rota `/patrimonio/importacoes-ofx/<id>/editar` (4 níveis), mas essa rota **não existe no `App.js`** — só existe `/patrimonio/importacoes-ofx/:id` (3 níveis). Executor adaptou e validou com rota equivalente de 4 níveis (`/patrimonio/contas/:subcontaId`). **Vale documentar essa divergência** ou abrir follow-up se quiser criar a rota `/editar`.

5. **Decisões visuais pendentes devem ser perguntadas cedo.** O design doc marcou "container com glassmorphism" como decisão pendente. Alisson confirmou via `question` ANTES da Fase 4, evitando rework.

6. **Vínculos de teste criados para validação ficaram no banco.** O executor criou 3 vínculos ("Teste Vinculo Race", "Teste Segundo", "Teste Terceiro") na conta `alissonfariascamargo@gmail.com` para validar Cenário 5 + race condition. IDs: `6a41362d6c15dd40d7efe9f8`, `6a4136336c15dd40d7efe9fc`, `6a4136336c15dd40d7efe9ff`. **Alisson pode deletar quando quiser via UI ou API.**

## Pontos de atenção / Follow-ups sugeridos

1. **Diretório `src/config/` ficou vazio** após a remoção de `breadcrumbConfig.js`. Remover o diretório vazio ou deixá-lo pra futuro uso (decisão do Alisson, não urgente).

2. **Vínculos de teste** (3 vínculos) precisam ser deletados da conta de produção se Alisson não quiser que persistam.

3. **Abordagem C (premium) está documentada mas não implementada.** Quando o produto amadurecer, evoluir incrementalmente:
   - Dropdown de atalho em cada nível (reusa `buildParentMap` exportado)
   - Persistência de navegação em `localStorage` (reusa MAP de `dynamicLabels`)
   - Atalho de teclado `Alt+←` para voltar
   - Indicador de loading quando label dinâmico está sendo buscado

4. **Rota `/patrimonio/importacoes-ofx/<id>/editar` mencionada no design doc não existe.** Decidir se é desejada e criar (não urgente, é follow-up opcional).

## Próximo passo

1. **Alisson chama o `newapp-committer`** pra empacotar as 9 alterações em 6 commits Conventional Commits PT-BR (estrutura sugerida no design doc).
2. Alisson deleta os 3 vínculos de teste quando quiser.
3. Atualizar o `stack.md` (arquitetura do breadcrumb mudou) e o `README.md` (índice do módulo Breadcrumb).

## Histórico de atualizações desta nota

- **2026-06-28:** criação inicial durante a sessão de reorganização do breadcrumb.
