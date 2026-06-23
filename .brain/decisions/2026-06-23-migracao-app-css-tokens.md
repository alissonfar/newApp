---
type: decision
status: active
created: 2026-06-23
tags: [app-css, migracao, dark-mode, legado, css, design-system]
---

# ADR-010: Migração do `App.css` para tokens do design system

## Contexto

Após a modernização visual (Fases 1-6, ver ADRs 006-009), o design system estava unificado em `src/theme/` com tokens `--cg-*` e tema MUI. Porém, o `src/App.css` (532 linhas) e o `src/index.css` ainda tinham regras legadas que conflitavam com o dark mode:

- `h1, h2 { color: var(--cor-texto-destaque); position: relative }` — cor azul fixa `#1976D2` que não muda com tema
- `h1::after, h2::after { background: var(--gradiente-primario) }` — pseudo-elemento de 60×3px com gradiente azul que aparecia como "risco branco" em dark mode contra o gradiente escuro do body
- `body { background: var(--cor-fundo); color: var(--cor-texto) }` — fundo cinza-azulado fixo, sem dark mode
- `input, select, textarea { background-color: #FFFFFF }` — inputs sempre brancos
- `.card { background: var(--cor-fundo-card) }` — cards sempre brancos
- 7 classes/utilitários **mortos** (não usados em nenhum JSX/JSX): `.btn-gerenciar-tags`, `.nav-link`, `.text-gradient`, `.app-button-base`, `.app-header`, `.custom-select`, scrollbar custom, bloco `button { ... }` comentado

A regra `h1, h2` em `App.css` era importada **depois** dos tokens no `index.js`, então vencia o cascade e sobrescrevia regras como `.cg-home__title` em `Home.css`. Resultado: dark mode ficava inconsistente em **TODAS as rotas** (mesmo as refatoradas), porque o `App.css` é global.

## Opções consideradas

- **Opção A:** Aliases para tokens — manter nomes de classes, trocar valores. Rápido, baixo risco.
- **Opção B:** Remover `App.css` quase inteiro, forçar componentes a usar tokens. Arriscado, alto risco de regressão.
- **Opção C (escolhida):** Abordagem A + remover código morto identificado por grep. Equilibra velocidade e limpeza.

## Decisão

**Opção C: Migração do `App.css` para tokens via aliases + remoção de código morto.**

Estrutura final do `App.css` (166 linhas, -69% do original):
- `:root` com aliases para tokens (`--cor-primaria: var(--cg-color-primary)`, etc)
- Regras globais de tipografia (`h1-h6`, `body`) usando `var(--cg-color-text-primary)`
- `input/select/textarea` usando `var(--cg-color-surface-elevated)` e `var(--cg-color-border)`
- `.card` usando `var(--cg-color-surface-elevated)` e `var(--cg-shadow-sm)`
- `.mySelect__*` (react-select) preservado, migrado para tokens
- **Removido o `h1::after` e o `position: relative`** que causava o "risco branco"
- **Removidas 7 classes mortas** identificadas por grep
- Fontes Poppins/DM Sans mantidas (decidido postergar troca por IBM Plex Sans)
- Comentário no topo aponta para o ADR-006 (tokens) e o ADR-008 (glassmorphism)

`index.css` também ajustado: `body` deixou de ter `background-color: var(--cor-fundo)` (sólido redundante), deixando o `GlobalStyles` pintar o gradiente sem competição.

## Consequências

- **Pró:**
  - Dark mode consistente em **todas as rotas** automaticamente (mesmo as não refatoradas — Patrimônio, Pessoas, Tags, Admin)
  - O "risco branco" do `h1::after` desapareceu
  - Inputs e cards agora respondem ao tema
  - 7 classes mortas removidas
  - `App.css` 69% menor (532 → 166 linhas)
  - Aliases preservam compatibilidade com páginas não refatoradas
- **Contra:**
  - Fontes legadas (Poppins/DM Sans) ainda ativas em `h1-h6`, `.app-header h1`, `.card-title`, etc — não-tema-unificado
  - `.mySelect__*` ainda tem regras com `!important` (necessário para sobrescrever react-select)
  - Cascata ainda depende de ordem de import (se alguém importar `App.css` antes de `tokens.css` no futuro, vai quebrar)
- **Mitigação:**
  - Comentário no topo do `App.css` aponta para esta ADR e para a ordem de import
  - ADRs 006-009 explicam o porquê da arquitetura de tokens

## Lições aprendidas

- **Ordem de import CSS importa**: durante a modernização visual, importamos `tokens.css` antes de `App.css` (em `index.js`), mas `App.css` era importado **depois** em `App.js`. Resultado: `App.css` vencia o cascade. A causa raiz do "risco branco" só foi diagnosticada quando olhamos a **ordem efetiva de processamento** dos CSS, não os arquivos individuais.
- **Auditoria > assumir**: o grep que detectou as 7 classes mortas evitou breakage (se removêssemos sem verificar, alguma página não-refatorada poderia ter quebrado).
- **Aliases salvam migrações**: o `tokens.css` já tinha aliases para `--cor-primaria`, `--cor-fundo`, etc, que permitiram a transição gradual. Sem isso, a modernização teria sido muito mais arriscada.

## Relacionado

- [ADR-006](2026-06-23-tokens-estrutura-theme-pasta.md) — estrutura de tokens
- [ADR-007](2026-06-23-mui-fonte-verdade-componentes.md) — tema MUI como fonte
- [ADR-008](2026-06-23-glassmorphism-exige-gradiente-vibrante.md) — gradiente do body
- [ADR-009](2026-06-23-tailwind-important-false-tokens-unica.md) — Tailwind
- [Plano de migração](../sessions/2026-06-23-migracao-app-css-plano.md)
- [Pós-execução da modernização visual](../sessions/2026-06-23-modernizacao-visual-pos-execucao.md)
