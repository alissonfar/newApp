---
type: decision
status: active
created: 2026-06-23
tags: [theme, tokens, estrutura, design-system]
---

# ADR-006: Estrutura de tokens (JS + CSS) em `src/theme/`

## Contexto

Antes da modernização visual, o projeto tinha:
- ~70 arquivos CSS locais com variáveis CSS duplicadas e conflitantes
- 3 valores diferentes para `--cor-primaria` em 3 lugares (`#2563eb`, `#2c5282`, `#3b82f6`)
- Zero tema MUI configurado (apenas tema React-PDF em `components/PDF/theme.js`)
- Tokens espalhados sem fonte de verdade

A modernização visual (Fases 1-3) precisava de um sistema de design unificado que:
- Servisse o **tema MUI** (precisa de valores JS)
- Servisse o **CSS global** (precisa de CSS variables)
- Não regredisse páginas não refatoradas (precisa de compatibilidade)

## Opções consideradas

- **Opção A:** Apenas `tokens.css` (CSS variables). Tema MUI teria que parsear CSS.
- **Opção B:** Apenas `tokens.js`. CSS global teria que usar `style={{...}}` em cada componente.
- **Opção C (escolhida):** `tokens.js` + `tokens.css` + `muiTheme.js`. JS é a fonte de verdade; CSS é gerado manualmente (compartilhado, com comentário de sincronização).
- **Opção D:** Design tokens como JSON + build step para gerar CSS e JS. Mais complexo, sem ganho claro para o escopo.

## Decisão

**Opção C: estrutura dupla `tokens.js` + `tokens.css` em `src/theme/`.**

- **`src/theme/tokens.js`** — fonte de verdade em JS. Lido por `muiTheme.js` e por `tailwind.config.js` (Fase 5).
- **`src/theme/tokens.css`** — gerado manualmente a partir do `tokens.js`, com comentário `/* ATUALIZAR TAMBÉM EM tokens.js */` no topo. Consumido pelo CSS global e pelo `MainLayout.css`.
- **`src/theme/muiTheme.js`** — `createTheme()` MUI consumindo `tokens.js`. Exporta `lightTheme` e `darkTheme`.
- **`src/theme/GlobalStyles.js`** — Emotion `MuiGlobalStyles` com gradiente, scrollbar, prefers-reduced-motion.

Aliases de variáveis CSS legadas (`--cor-primaria`, `--cor-fundo`, etc) ficam no `tokens.css` apontando para os novos tokens `--cg-*`. Isso garante que páginas não refatoradas continuem funcionando durante a migração.

## Consequências

- **Pró:**
  - Tema MUI tem acesso direto a valores JS (sem `getComputedStyle`)
  - CSS global consome as mesmas variáveis
  - Tailwind lê os tokens via `require()` (Fase 5)
  - Compatibilidade com código legado via aliases
- **Contra:**
  - Dois arquivos para manter sincronizados (`tokens.js` e `tokens.css`)
  - Risco de divergência se algum dev editar um e esquecer do outro
- **Mitigação do contra:**
  - Comentário explícito no topo de `tokens.css`
  - `git diff` em PRs que tocam em um deve alertar sobre o outro

## Relacionado

- Design doc: `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-design.md`
- Plano: `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-plano.md`
- ADR-007 (tema MUI como fonte de verdade)
- ADR-009 (Tailwind lê dos tokens)
