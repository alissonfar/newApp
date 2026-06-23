---
type: decision
status: active
created: 2026-06-23
tags: [app-css, migracao, dark-mode, legado, css-global]
---

# ADR-010: Migração do `App.css` global para tokens do design system

## Contexto

Após a modernização visual (Fases 1-6, ver [ADR-006](../decisions/2026-06-23-tokens-estrutura-theme-pasta.md) a [ADR-009](../decisions/2026-06-23-tailwind-important-false-tokens-unica.md)), o app tinha design system moderno em `src/theme/`, mas o `App.css` (532 linhas, importado globalmente) ainda tinha regras legadas que conflitavam com dark mode.

**Sintoma concreto:** o título `<h1>` "Dashboard - Alisson" da Home tinha um pseudo-elemento `h1::after` com `background: linear-gradient(135deg, #2196F3, #1976D2)` (risco gradiente azul fixo) que aparecia como **"fundo branco luminoso"** em dark mode, matando o texto claro. Pior: a regra `h1, h2` em `App.css:65-72` sobrescrevia `.cg-home__title` em `Home.css:19` por ordem de cascade (App.css é importado depois).

**Outras regras conflitantes identificadas:**

| Linha | Regra | Problema |
|---|---|---|
| 7-54 | `:root` com `--cor-fundo: #F5F7FA` (fixo) | Cores hardcoded, não seguem tema |
| 57-63 | `h1-h6 { color: var(--cor-texto) }` | Texto azul escuro fixo em todos os modos |
| 65-72 | `h1, h2 { color: var(--cor-texto-destaque); position: relative }` | Azul fixo + cria contexto para o `::after` |
| 74-83 | `h1::after, h2::after` | O "risco branco" no dark |
| 86-94 | `body { background: var(--cor-fundo) }` | Body branco em dark, sobrescreve gradiente do GlobalStyles |
| 97-106 | `input, select, textarea { background: #FFFFFF }` | Inputs sempre brancos |
| 167-177 | `.card { background: var(--cor-fundo-card) }` | Cards sempre brancos |
| 317-394 | `.mySelect__*` com `#fff !important` | react-select sempre branco |

**Código morto detectado via grep:**

| Linha | Item | Status |
|---|---|---|
| 114-139 | Bloco `button { ... }` global | Já estava comentado |
| 193-202 | `@media { button { padding } }` | Bloco pai comentado |
| 204-221 | Scrollbar custom | Sobrescrito por `GlobalStyles.js` |
| 224-250 | `.app-header` | Não usada (substituída por MainLayout) |
| 253-271 | `.btn-gerenciar-tags` | Ninguém usa |
| 273-287 | `.nav-link` | Ninguém usa |
| 289-314 | `.custom-select` | Ninguém usa |
| 141-164 | `.app-button-base` | Ninguém usa |
| 526-531 | `.text-gradient` | Ninguém usa |

**Ainda em uso (preservar mas migrar):**
- `.mySelect__*` (react-select) — usado em `Transaction/EditarTransacaoItem.css`, `Transaction/NovaTransacaoForm.css`, `pages/Relatorio/Relatorio.css`
- Fontes Poppins/DM Sans via `--fonte-titulos`/`--fonte-corpo` — múltiplas páginas referenciam. **Decidido postergar** a troca para IBM Plex Sans (precisaria de fase dedicada).

## Opções consideradas

- **Opção A (escolhida):** Migrar regras de cores para `--cg-*` tokens via aliases, remover código morto, preservar `.mySelect__*`. Resultado: App.css cai de 532 → 166 linhas (-69%), dark mode consistente em **todas as rotas**.
- **Opção B:** Remover 100% do `App.css` que conflita, forçar todos os componentes a usar `tokens` ou `MuiTheme`. Mais radical, alto risco de regressão.
- **Opção C:** Deixar como está, conviver com o conflito. Inviável — sintoma é visível em dark mode em todas as rotas.

## Decisão

**Opção A: migração por aliases + remoção de código morto.**

1. **Migração de cores:** todas as regras que usavam `var(--cor-*)` (aliases) agora apontam para `var(--cg-*)` (tokens). Onde não havia alias, criar.

2. **Migração de valores hardcoded** (`#FFFFFF`, `#1976D2`, etc) → `var(--cg-color-*)` tokens.

3. **Remoção do `h1::after`:** o "risco gradiente" era decorativo e não cabe no novo design system (glassmorphism tem sua própria identidade visual). Também removemos o `position: relative` que existia só para ancorar o `::after`.

4. **Preservação do `.mySelect__*`:** ainda é usado em 3 páginas. Migrado para tokens (`var(--cg-color-surface-elevated)`, etc) mantendo `!important` (necessário para sobrescrever react-select).

5. **Remoção de 9 classes/blocos mortos** (ver tabela acima). Validado por grep em todos os `.js`/`.jsx` do projeto.

6. **Manutenção das fontes Poppins/DM Sans** via `--fonte-titulos`/`--fonte-corpo` com fallback para `--cg-font-family` (IBM Plex Sans). Troca postergada para fase futura.

7. **`index.css` body simplificado:** removido o `background-color: var(--cor-fundo)` que era redundante com o `GlobalStyles` (que pinta o gradiente). Apenas `font-family` e `color` ficaram.

## Consequências

- **Pró:**
  - Dark mode funciona em **TODAS as rotas** (mesmo as não refatoradas), porque `h1-h6`, `body`, `input/select/textarea`, `.card` agora respondem ao tema
  - App.css caiu de 532 → 166 linhas (-69%)
  - O "risco branco" do `h1::after` desapareceu
  - Aliases legados (`var(--cor-*)`) preservam compatibilidade com páginas que ainda usam CSS legacy
  - Sem regressão em `.mySelect__*` (TagSelector) — feature crítica
- **Contra:**
  - 2 regras de `@layer` (Tailwind preflight) podem ainda conflitar com algumas classes utilitárias (`bg-primary`, `text-primary` em App.css vs Tailwind) — não foi problema observado
  - Fontes Poppins/DM Sans ainda dominam em algumas áreas (decidido postergar)
  - Algumas páginas podem ter CSS específico que ainda pinta cores hardcoded (precisam de migração individual, fora do escopo)
- **Mitigação:**
  - Aliases preservam `--cor-*` para retrocompatibilidade
  - `.mySelect__*` migrado mas com `!important` (react-select exige)
  - Smoke test em todas as rotas em light e dark

## Resultado

- 2 commits: `6c6acafd` (App.css) + `424138ad` (index.css body)
- App.css: 532 → 166 linhas (-69%)
- Dark mode consistente em todas as rotas
- 9 classes/blocos mortos removidos
- Zero regressões em features críticas

## Relacionado

- ADR-006 (estrutura de tokens)
- ADR-007 (tema MUI como fonte de verdade)
- ADR-008 (glassmorphism exige gradiente vibrante)
- ADR-009 (Tailwind important: false)
- Sessão: `2026-06-23-migracao-app-css-plano.md`
- Pós-execução: `2026-06-23-modernizacao-visual-pos-execucao.md`
