---
type: session
status: active
created: 2026-06-23
tags: [app-css, migracao, dark-mode, legado, design-system]
---

# Migração do App.css — Plano de execução

> **Contexto:** Durante a validação visual da modernização, identificamos que o `App.css` global (532 linhas) tem regras que conflitam com o novo design system, especialmente em **dark mode** (texto azul fixo `#1976D2`, fundo branco hardcoded em inputs/cards, `h1::after` com gradiente permanente). O arquivo também tem 7 classes/utilitários que ninguém mais usa (verificado via grep).

## Objetivo

Migrar o `App.css` para usar os tokens do design system (`--cg-*`), resolver conflitos com dark mode, e remover código morto. Resultado: dark mode consistente em todas as rotas (mesmo as não refatoradas), e `App.css` reduzido a ~250 linhas.

## Auditoria (já feita)

### Conflitos com dark mode (precisam migrar para tokens)

| Linha | Regra atual | Migração proposta |
|---|---|---|
| 7-54 | `:root` com `--cor-fundo: #F5F7FA` (fixo) | **Manter** (legado, mas é alias para `var(--cg-color-background)`) |
| 57-63 | `h1-h6 { color: var(--cor-texto) }` | Migrar para `var(--cg-color-text-primary)` |
| 65-72 | `h1, h2 { color: var(--cor-texto-destaque); position: relative }` | Migrar cor para `var(--cg-color-text-primary)`; **remover `position: relative`** (afeta o `h1::after`) |
| 74-83 | `h1::after, h2::after { background: var(--gradiente-primario) }` | **REMOVER** (o "risco gradiente" que aparece como fundo branco luminoso) |
| 86-94 | `body { background: var(--cor-fundo); color: var(--cor-texto) }` | `background: var(--cg-color-background)`; `color: var(--cg-color-text-primary)` |
| 97-106 | `input, select, textarea { background: #FFFFFF; color: var(--cor-texto) }` | `background: var(--cg-color-surface-elevated)`; `color: var(--cg-color-text-primary)` |
| 167-177 | `.card { background: var(--cor-fundo-card) }` | `background: var(--cg-color-surface-elevated)` |
| 290-314 | `.custom-select { background: #fff }` | **REMOVER TUDO** (classe morta — ver auditoria abaixo) |
| 317-394 | `.mySelect__*` com `!important` e cores fixas | Migrar para tokens, mantendo `!important` (necessário para sobrescrever react-select) |

### Código morto (pode ser removido)

| Linha | Item | Motivo |
|---|---|---|
| 114-139 | Bloco `button { ... }` global | **Já está comentado** desde a era Tailwind |
| 193-202 | `@media (max-width: 768px) { button { ... } }` | O bloco `button` está comentado |
| 204-221 | Scrollbar custom | Sobrescrito por `GlobalStyles.js` |
| 224-250 | `.app-header`, `.header-left`, `.logo`, `.app-header h1` | `.app-header` não é usada (substituída por MainLayout) |
| 253-271 | `.btn-gerenciar-tags` | **Ninguém usa** (grep confirmou) |
| 273-287 | `.nav-link` | **Ninguém usa** (grep confirmou) |
| 289-314 | `.custom-select` | **Ninguém usa** (grep confirmou) |
| 141-164 | `.app-button-base` | **Ninguém usa** (grep confirmou) |
| 526-531 | `.text-gradient` | **Ninguém usa** (grep confirmou) |

### AINDA USADO (preservar mas migrar)

| Item | Onde é usado |
|---|---|
| `.mySelect__*` (react-select) | `Transaction/EditarTransacaoItem.css`, `Transaction/NovaTransacaoForm.css`, `pages/Relatorio/Relatorio.css` |
| Fontes Poppins/DM Sans | Múltiplos `var(--fonte-titulos)` e `var(--fonte-corpo)` no projeto — **decidido: manter por enquanto** |

## Plano de execução (2 commits)

### Commit 1 — Migrar `App.css` para tokens + remover código morto

**Arquivo:** `src/App.css` (substituir completo)

**Conteúdo novo (proposto):**
```css
/* src/App.css */
/* Reset mínimo + regras globais migradas para tokens do design system */
/* Ver: .brain/decisions/2026-06-23-tokens-estrutura-theme-pasta.md */

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&display=swap');

:root {
  /* Aliases legados (compat) */
  --cor-primaria: var(--cg-color-primary);
  --cor-secundaria: #1976D2;
  --cor-fundo: var(--cg-color-background);
  --cor-fundo-card: var(--cg-color-surface-elevated);
  --cor-fundo-hover: rgba(37, 99, 235, 0.08);
  --cor-texto: var(--cg-color-text-primary);
  --cor-texto-suave: var(--cg-color-text-muted);
  --cor-texto-destaque: var(--cg-color-primary);
  --cor-sucesso: var(--cg-color-success);
  --cor-erro: var(--cg-color-error);
  --cor-alerta: var(--cg-color-warning);
  --cor-branca: #ffffff;

  /* Fontes (mantidas por enquanto) */
  --fonte-titulos: 'Poppins', var(--cg-font-family);
  --fonte-corpo: 'DM Sans', var(--cg-font-family);

  /* Sombras (mantidas por compat com páginas não refatoradas) */
  --sombra-card: var(--cg-shadow-sm);
  --sombra-hover: var(--cg-shadow-md);
  --transicao-padrao: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --borda-radius: var(--cg-radius-md);

  /* Gradientes (apenas para utilitários remanescentes) */
  --gradiente-primario: linear-gradient(135deg, #2563EB, #1d4ed8);
  --gradiente-secundario: linear-gradient(135deg, #60a5fa, #2563EB);
  --gradiente-destaque: linear-gradient(45deg, #2563EB 0%, #60a5fa 50%, #2563EB 100%);
}

/* Títulos globais — migrado para tokens */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--fonte-titulos);
  color: var(--cg-color-text-primary);
  margin-bottom: 1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* h1, h2: cor primária para destaque (sem ::after gradiente, sem position: relative) */
h1, h2 {
  color: var(--cg-color-text-primary);
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 1.5rem;
}

/* Body — migrado para tokens */
body {
  margin: 0;
  font-family: var(--cg-font-family);
  color: var(--cg-color-text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Inputs e selects — migrado para tokens */
input, select, textarea {
  font-family: var(--cg-font-family);
  font-size: 0.95rem;
  padding: 10px 12px;
  border: 1px solid var(--cg-color-border);
  border-radius: var(--cg-radius-md);
  color: var(--cg-color-text-primary);
  background-color: var(--cg-color-surface-elevated);
  transition: var(--transicao-padrao);
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--cg-color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

/* .card — migrado para tokens */
.card {
  background: var(--cg-color-surface-elevated);
  border-radius: var(--cg-radius-md);
  padding: 20px;
  box-shadow: var(--cg-shadow-sm);
  transition: var(--transicao-padrao);
}

.card:hover {
  box-shadow: var(--cg-shadow-md);
}

/* Utilitários de cor */
.text-primary { color: var(--cg-color-primary); }
.bg-primary { background-color: var(--cg-color-primary); color: white; }
.border-primary { border: 1px solid var(--cg-color-primary); }

/* mySelect (react-select) — preservado, migrado para tokens */
.mySelect__control {
  font-family: var(--cg-font-family) !important;
  background-color: var(--cg-color-surface-elevated) !important;
  border: 1px solid var(--cg-color-border) !important;
  border-radius: var(--cg-radius-md) !important;
  min-height: 42px !important;
  box-shadow: none !important;
  transition: var(--transicao-padrao) !important;
}
.mySelect__control:hover { border-color: var(--cg-color-primary) !important; }
.mySelect__control--is-focused {
  border-color: var(--cg-color-primary) !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
}
.mySelect__menu {
  font-family: var(--cg-font-family) !important;
  border-radius: var(--cg-radius-md) !important;
  border: 1px solid var(--cg-color-border) !important;
  box-shadow: var(--cg-shadow-md) !important;
  z-index: 9999;
}
.mySelect__option {
  font-size: 0.95rem !important;
  color: var(--cg-color-text-primary) !important;
  cursor: pointer;
  transition: var(--transicao-padrao) !important;
}
.mySelect__option--is-focused {
  background-color: var(--cg-color-primary-muted) !important;
  color: var(--cg-color-primary) !important;
}
.mySelect__option--is-selected {
  background-color: var(--cg-color-primary) !important;
  color: white !important;
  font-weight: 500 !important;
}
.mySelect__multi-value {
  background-color: var(--cg-color-primary-muted) !important;
  border-radius: var(--cg-radius-md) !important;
  margin: 2px;
}
.mySelect__multi-value__label {
  font-family: var(--cg-font-family) !important;
  color: var(--cg-color-primary) !important;
  font-size: 0.9rem !important;
  font-weight: 500 !important;
}
.mySelect__multi-value__remove {
  color: var(--cg-color-primary) !important;
  cursor: pointer;
  transition: var(--transicao-padrao) !important;
}
.mySelect__multi-value__remove:hover {
  background-color: var(--cg-color-primary) !important;
  color: white !important;
}
.mySelect__placeholder {
  color: var(--cg-color-text-muted) !important;
  font-size: 0.95rem !important;
}
.mySelect__input {
  font-family: var(--cg-font-family) !important;
  color: var(--cg-color-text-primary) !important;
}
```

**Resultado esperado:**
- `App.css` cai de **532 → ~180 linhas** (-66%)
- Todas as cores legadas viraram aliases para `--cg-*` tokens
- Dark mode consistente em **todas as rotas** (mesmo as não refatoradas), porque `h1`, `body`, `input`, `.card` agora respondem ao tema
- O "risco branco" do `h1::after` desaparece
- Classes mortas removidas
- `.mySelect__*` preservado mas migrado

**Validação:**
1. `npm run build` passa
2. Smoke test: abrir `/login`, `/registro`, `/`, `/relatorio`, `/pluggy`, `/patrimonio` em light e dark
3. Verificar que o título "Dashboard - Alisson" tem **fundo transparente** e **texto branco em dark** / **texto escuro em light**
4. Smoke test: criar/editar/excluir transação (features críticas)
5. Verificar que o react-select (TagSelector em NovaTransacaoForm) ainda funciona

**Commit:** `refactor(theme): migrar App.css para tokens do design system e remover código morto`

---

### Commit 2 — (Opcional) Atualizar `index.css` body

**Arquivo:** `src/index.css` (linhas 46-51)

**Mudança:**
```css
/* ANTES */
body {
  margin: 0;
  font-family: var(--fonte-principal);
  background-color: var(--cor-fundo);
  color: var(--cor-texto);
}

/* DEPOIS */
body {
  margin: 0;
  font-family: var(--cg-font-family);
  color: var(--cg-color-text-primary);
  /* background: deixado para o GlobalStyles pintar o gradiente */
}
```

**Motivo:** `index.css` define `background-color: var(--cor-fundo)` que aponta para `--cg-color-background` (sólido). Isso é redundante com o `GlobalStyles` que já pinta o gradiente. Pode causar conflito sutil.

**Validação:** smoke test em /login e / (gradiente continua visível).

**Commit:** `chore(theme): remover background redundante do body em index.css`

---

## Critérios de aceite

- [ ] `App.css` reduzido de 532 para ~180 linhas
- [ ] Dark mode funciona em **TODAS as rotas** (mesmo as não refatoradas)
- [ ] O "risco branco" do `h1::after` desapareceu
- [ ] Inputs em dark mode têm fundo escuro translúcido (não branco)
- [ ] Cards em dark mode têm fundo escuro translúcido (não branco)
- [ ] `react-select` (TagSelector) continua funcional em light e dark
- [ ] `npm run build` passa
- [ ] Funcionalidades críticas intactas (criação de transação, multi-tenant, decimal.js)

## Não-objetivos (fora do escopo)

- Migrar páginas não refatoradas (Patrimônio, Pessoas, Tags, Admin) — cada uma é uma fase independente
- Trocar Poppins/DM Sans por IBM Plex — decidido adiar
- Substituir `react-select` por `MuiAutocomplete` — fora do escopo
- Adicionar tema específico para `.mySelect__multi-value` em dark — pode ser melhorado depois
