---
type: decision
status: active
created: 2026-06-28
tags: [breadcrumb, navigation, frontend, refactor, arquitetura]
related:
  - .brain/sessions/2026-06-28-breadcrumb-reorganizacao-design.md
  - .brain/sessions/2026-06-28-breadcrumb-reorganizacao-pos-execucao.md
  - .brain/sessions/2026-06-26-sidebar-reorganizacao-design.md
---

# ADR-017: Breadcrumb — `menuStructure` como fonte de verdade única + label dinâmico scoped por rota

## Contexto

Em junho/2026, durante a reorganização da sidebar (sessão 2026-06-26), o `menuStructure.js` virou a estrutura declarativa que a sidebar consome — fonte única da hierarquia de navegação. Mas o **breadcrumb** continuava lendo de um arquivo separado (`breadcrumbConfig.js`), com:

- **5 problemas comportamentais críticos** (race condition do singleton `overrideLabel`, escopo global, dependência 100% do hook em páginas de detalhe, **duas fontes de verdade** para a hierarquia, fallback de humanização silencioso).
- **7 problemas visuais** (fonte pequena, separador `›` fraco, último item apagado, sem hover state, sem ellipsis, sem adaptação mobile, sem tokens).
- **1 race condition real** que Alisson reportou: navegação rápida entre `/emprestimos/123` → `/emprestimos/456` causava flash de "Detalhes" no breadcrumb.

A sidebar tinha acabado de ser reorganizada e tinha um `menuStructure.js` declarativo pronto para ser reaproveitado. Tinha **uma oportunidade clara**: centralizar a hierarquia de navegação em um único lugar.

## Opções consideradas

### Opção A — Mínimo viável (correção cirúrgica)

- Trocar separador `›` por `·`, aumentar fonte, usar tokens.
- Corrigir race condition do `overrideLabel` (singleton → MAP).
- **Manter `breadcrumbConfig.js` e `menuStructure.js` como arquivos separados** (duas fontes de verdade).

**Pró:** rápido (~2-3h), pouco risco.
**Contra:** mantém o débito técnico de ter 2 fontes de verdade pra hierarquia. Adicionar uma rota nova no futuro = lembrar de atualizar 2 arquivos. Receita pra bug futuro.

### Opção B — Coerente com a sidebar (recomendada e adotada)

- Apagar `breadcrumbConfig.js`.
- Breadcrumb deriva a hierarquia do `menuStructure.js` via `buildParentMap` (função pura).
- Label dinâmico vira MAP scoped por rota (`dynamicLabels: Map<pathname, label>`) com guard `window.location.pathname === pathname` no cleanup.
- Hook `useBreadcrumbOverride` substituído por `useBreadcrumbTrailing` (sem alias deprecated).
- Visual modernizado com tokens, ellipsis automático via `maxItems` do MUI, container glassmorphism, separador `·`, responsivo (mobile com `maxItems=3`, desktop com `maxItems=4`).
- Design deixa **gancho documentado** pra evoluir para a Opção C sem reescrever.

**Pró:** fonte única de verdade, breadcrumb sempre coerente com sidebar, escopo por rota elimina race pela raiz, tokens + glassmorphism integra com design system.
**Contra:** ~5-6h, refactor médio, precisa testar todas as rotas.

### Opção C — Premium (dropdowns em cada nível, atalhos de teclado, indicador de loading)

- Tudo da B + dropdown de atalho em cada nível (estilo GitHub) + persistência de navegação em localStorage + indicador de loading quando label dinâmico está sendo buscado + atalho `Alt+←`.

**Pró:** UX premium tipo GitHub/Linear.
**Contra:** 12-16h, escopo 2-3x maior, risco maior. **Overkill pro estado atual.**

## Decisão

**Escolhemos Opção B** com **gancho explícito pra C no futuro**.

Razões:

1. **Fonte única de verdade é princípio fundamental de arquitetura.** A sidebar já consolidou a hierarquia no `menuStructure.js`. O breadcrumb como **leitor** dessa hierarquia (não como estrutura paralela) elimina o risco de divergência.

2. **A race condition do singleton `overrideLabel` é sintoma de um anti-pattern mais profundo:** estado global mutável indexado por "a página atual" sem escopo. Resolver pela raiz (MAP scoped por rota + guard no cleanup) elimina a categoria inteira de bugs, não só o sintoma.

3. **O design atual deixa terreno preparado pra C** sem reescrever: `buildParentMap` é função pura exportada, `dynamicLabels` é MAP, `items` é array de `{path, label}`. Quando o produto amadurecer, dá pra adicionar dropdowns e atalhos incrementando, não refazendo.

## Consequências

### Pró

- **Hierarquia centralizada.** Adicionar uma rota nova no `menuStructure.js` = breadcrumb segue automaticamente. Sem mais "esqueci de atualizar o breadcrumbConfig".
- **Race condition eliminada pela raiz.** Não é só corrigir o `setBreadcrumbOverride(null)` no cleanup — é tornar o estado **impossível de conflitar** por construção (cada rota é chave do MAP, não tem como uma página sobrescrever a label de outra).
- **Visual coerente com o resto do projeto.** Tokens (`var(--cg-color-*)`), glassmorphism (`var(--cg-color-surface)` + `backdrop-filter: blur(12px)`), separador `·` Linear-style. Dark mode reativo sem reload (validado com `getComputedStyle()`).
- **Responsivo out-of-the-box.** `maxItems=3` mobile, `maxItems=4` desktop via `useMediaQuery(theme.breakpoints.down('md'))`. Ellipsis automático em profundidade.
- **Acessibilidade.** `aria-current="page"` no último item, `aria-label="breadcrumb"` (já existia), separador decorativo, links com `MuiLink component={Link}` (focus state acessível por default do MUI).

### Contra

- **5 páginas de detalhe tiveram que ser migradas de `useBreadcrumbOverride` pra `useBreadcrumbTrailing`.** Mudança mecânica (2 linhas por arquivo), mas é uma quebra de contrato pra qualquer página futura que use o hook antigo. Documentado na sessão de pós-execução.
- **`FALLBACK_LABELS` virou um mapa hardcoded em `menuStructure.js`** pra cobrir `/profile`, `/como-utilizar`, `/admin` (rotas que não estão no menu da sidebar). Se uma rota nova ficar fora do menu, o desenvolvedor precisa adicionar manualmente no `FALLBACK_LABELS`. Aceitável — é uma lista estável e curta, e fica perto da lógica de fallback.
- **Gancho pra C ainda é só design, não código.** Quando o produto amadurecer, vai precisar de trabalho adicional (mesmo que incremental). Documentado mas não implementado.

### Impacto em outras áreas

- **Sidebar:** zero impacto. O `menuStructure.js` foi levemente estendido (adicionou `path` em 2 submenus e 3 funções puras), mas a sidebar continua consumindo do mesmo jeito.
- **Páginas de detalhe:** as 5 páginas que usavam `useBreadcrumbOverride` agora usam `useBreadcrumbTrailing`. Contrato idêntico (recebe `label`, registra no MAP), semântica melhor.
- **Backend:** zero impacto. Tudo é frontend.
- **Testes:** zero impacto. Não há testes E2E cobrindo breadcrumb (nem valem a pena para este caso — é um componente puramente visual+estrutural).
- **Outros agentes (committer, executor):** o committer vai empacotar em 6 commits separados. Executor já aplicou tudo.

## Implementação

Design doc completo: [`2026-06-28-breadcrumb-reorganizacao-design.md`](../sessions/2026-06-28-breadcrumb-reorganizacao-design.md)
Pós-execução: [`2026-06-28-breadcrumb-reorganizacao-pos-execucao.md`](../sessions/2026-06-28-breadcrumb-reorganizacao-pos-execucao.md)

**Commits esperados** (estrutura sugerida no design doc, ainda não aplicados — Alisson vai revisar e chamar o `newapp-committer`):

1. `refactor(breadcrumb): adicionar buildParentMap e findLabelInMenu no menuStructure`
2. `refactor(breadcrumb): trocar singleton overrideLabel por dynamicLabels Map`
3. `feat(breadcrumb): usar menuStructure como fonte de verdade única`
4. `feat(breadcrumb): modernizar visual com tokens, separador · e ellipsis`
5. `refactor(breadcrumb): migrar useBreadcrumbOverride para useBreadcrumbTrailing`
6. `chore(breadcrumb): apagar breadcrumbConfig.js`

## Critérios de aceitação (validados)

- [x] Race condition eliminada (testado com 3 navegações rápidas em sequência)
- [x] Fonte de verdade única: `menuStructure.js` (breadcrumbConfig.js apagado)
- [x] 5 páginas de detalhe migradas para `useBreadcrumbTrailing`
- [x] Visual modernizado: tokens, glassmorphism, separador `·`, ellipsis responsivo
- [x] Dark mode reativo sem reload (validado com `getComputedStyle().color`)
- [x] Mobile responsivo (`maxItems=3` mobile, `maxItems=4` desktop)
- [x] Lint passa (0 erros, 0 warnings)
- [x] 8 cenários validados via `browser-use` (Home, Patrimônio resumo, Patrimônio contas, Detalhe empréstimo, Conta conjunta detalhe, Rota profunda, Mobile, Dark mode)
- [x] Acessibilidade: `aria-current="page"` no último item
