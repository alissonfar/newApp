---
type: design-doc
status: approved
created: 2026-06-28
tags: [breadcrumb, navigation, refactor, design-system, ui, frontend]
related:
  - .brain/sessions/2026-06-26-sidebar-reorganizacao-design.md
---

# Design: Reorganização e modernização do Breadcrumb

> **Sessão de planejamento.** Define o que muda no `BreadcrumbsNav`, `BreadcrumbContext` e `breadcrumbConfig`. Não é implementação — após aprovação, o plano é delegado ao `newapp-executor`.

## TL;DR

Reescrever o sistema de breadcrumbs seguindo **3 decisões estruturais**:

1. **`menuStructure.js` vira a fonte de verdade única** — `breadcrumbConfig.js` é apagado. Breadcrumb deriva a hierarquia da mesma estrutura declarativa que a sidebar consome.
2. **Label dinâmico vira um MAP scoped por rota** — substitui o singleton `overrideLabel` por `dynamicLabels: Map<pathname, label>`. Hook `useBreadcrumbTrailing(label)` registra no MAP pela rota atual. Cleanup só dispara se a rota que registrou ainda é a ativa. **Isso elimina a race condition pela raiz.**
3. **Visual modernizado com tokens** — fonte `--cg-font-size-sm`, separador `·` (não `›`), item atual em `font-weight: 600` com `var(--cg-color-text-primary)`, hover com fundo `--cg-color-surface-elevated`, ellipsis automático em profundidade via `maxItems` do MUI Breadcrumbs.

**Decisão de produto:** esta é a **Abordagem B** do brainstorm. A abordagem "C" (premium com dropdown em cada nível) está **explicitamente fora de escopo** mas o design deixa um **gancho documentado** pra evoluir depois sem reescrever.

## Contexto lido do vault

- **Stack:** React 19 + CRACO + Tailwind 4 (important:false) + MUI 6 + Emotion. Tema em `src/theme/tokens.css` (variáveis `--cg-*`) + `muiTheme.js` + `GlobalStyles.js`. Glassmorphism sobre gradiente vibrante.
- **ADRs críticos a respeitar:** ADR-006 (estrutura de tokens), ADR-007 (MUI como fonte de verdade), ADR-009 (Tailwind important:false), ADR-012 (cores presas em wrappers globais — `var(--cg-color-*)` + `!important` em `App.css [data-theme="dark"]`).
- **Sidebar reorganizada** em sessão 2026-06-26. `menuStructure.js` já existe e é declarativo. **Esta sessão depende e reaproveita** o trabalho da sidebar.

## Diagnóstico do breadcrumb atual

**Arquivos envolvidos:**
- `src/components/navigation/BreadcrumbsNav.jsx` (105 linhas) — renderiza o breadcrumb
- `src/context/BreadcrumbContext.js` (39 linhas) — gerencia `overrideLabel` (singleton global)
- `src/config/breadcrumbConfig.js` (39 linhas) — mapa `path → label`
- 5 páginas de detalhe usam `useBreadcrumbOverride(label)`:
  - `pages/Emprestimos/EmprestimoDetalhePage.js:32`
  - `pages/Patrimonio/DetalheSubcontaPage.js:193`
  - `pages/Patrimonio/FaturasPage.js:43` (registra label estático)
  - `pages/Patrimonio/ImportacaoOFXDetalhePage.js:38`
  - `pages/Conjunto/DetalheVinculoPage.js:94`

### Problemas concretos

**Comportamento (5):**

1. **Race condition do singleton global.** `useBreadcrumbOverride` chama `setBreadcrumbOverride(null)` no cleanup. Ao navegar de `/emprestimos/123` → `/emprestimos/456`, o cleanup do primeiro efeito pode rodar **depois** do effect do segundo, sobrescrevendo o label novo com `null`. Visível como breadcrumb piscando "Detalhe" → "Maria" → "Detalhe".

2. **`overrideLabel` é global, sem escopo de rota.** Qualquer página de detalhe pode sobrescrever o label de outra, e a ordem é imprevisível (depende da ordem de mount dos effects).

3. **Dependência 100% do hook em páginas de detalhe.** Se a página de detalhe esquecer de chamar `useBreadcrumbOverride`, o breadcrumb mostra "Detalhe" (placeholder genérico do `BreadcrumbsNav.jsx:34`). Não há fallback de URL.

4. **`breadcrumbConfig.js` está acoplado à URL, mas `menuStructure.js` está acoplado à semântica.** Os dois não conversam, então breadcrumbs não refletem a hierarquia real da sidebar. **Duas fontes de verdade = bug garantido no futuro.**

5. **Rotas que não estão no `breadcrumbConfig.js` mostram o segmento cru da URL** (ex: `/patrimonio/contas` se não tiver entry → "contas" minúsculo em vez de "Contas").

**Visual (7):**

6. **Fonte muito pequena** (`0.9rem`) e cor `text.secondary` (cinza apagado) — some no glassmorphism do gradiente vibrante.

7. **Separador `›` fraco**, sem cor de destaque.

8. **Último item em `text.secondary`** (mais apagado) — quebra convenção de UX. O item atual deveria ser o **mais** destacado, não o mais apagado.

9. **Sem hover state** nos links — o underline só aparece no hover, mas sem cor de feedback visual.

10. **Truncamento silencioso** em rotas profundas (ex: `/patrimonio/importacoes-ofx/abc123/editar`) — itens vão saindo da tela sem ellipsis.

11. **Sem adaptação mobile** — em viewport pequeno, breadcrumb pode quebrar linha de forma feia.

12. **Não usa tokens do projeto** — cores hardcoded em `sx={{}}`. Não respeita o design system estabelecido pós-modernização visual.

## A proposta

### 1. Arquitetura

```
menuStructure.js (fonte de verdade única)
  ↓
BreadcrumbContext.js (estado: dynamicLabels: Map<pathname, label>)
  ↓
BreadcrumbsNav.jsx (lê menuStructure + context, renderiza via MUI Breadcrumbs)
```

**Princípios:**

- **Single source of truth:** tudo que é sobre a estrutura de navegação vem de `menuStructure.js`. Adicionar uma rota nova = mexer em 1 arquivo.
- **Scoped state:** o label dinâmico é indexado por `pathname`, não global. A página de detalhe registra seu label no MAP sob a key da **sua** rota. Outra página não consegue sobrescrever.
- **Hook contract estável:** `useBreadcrumbTrailing(label)` é o substituto direto de `useBreadcrumbOverride(label)`. Assinatura idêntica, semântica melhor.

### 2. Hierarquia derivada do `menuStructure.js`

**Problema:** o `menuStructure.js` atual lista os itens da sidebar, mas não cobre rotas-filhas como `/emprestimos/123` (detalhe). O breadcrumb precisa de uma forma de **achar o ancestral mais próximo** de qualquer rota.

**Solução:** adicionar um campo `parentMap` derivado do `menuStructure`. Função pura:

```js
/**
 * Dado o menuStructure, retorna um mapa path → parentPath.
 * Ex: '/emprestimos/123' → '/emprestimos'
 *     '/emprestimos'     → '/'
 *     '/'                → null
 */
export function buildParentMap(menuStructure) {
  const map = new Map();
  const homeKey = '/';

  function visit(items, parentPath) {
    for (const item of items) {
      if (item.type === 'item' && item.path) {
        map.set(item.path, parentPath);
      } else if (item.type === 'submenu') {
        // O submenu PAI pode ter path próprio (ex: '/emprestimos' em Empréstimos)
        if (item.path) map.set(item.path, parentPath);
        // Filhos do submenu
        for (const child of item.items || []) {
          if (child.path) map.set(child.path, item.path || parentPath);
        }
      } else if (item.type === 'section') {
        visit(item.items || [], parentPath);
      }
    }
  }

  visit(menuStructure, homeKey);
  return map;
}
```

**Importante:** o `menuStructure` atual não tem `path` em `submenu` (só `key`). Vou precisar adicionar `path` em alguns submenus pra que o breadcrumb consiga associar rotas filhas. Especificamente:
- `submenu 'transacoes'` não tem path próprio (a sidebar não tem um item "/transacoes" — os 3 filhos são caminhos independentes). Solução: NÃO adicionar path no pai. O parentMap vai mapear cada filho (`/importacao`, `/recebimentos/novo`, etc) direto para `parentPath = '/'`. Aceitável.
- `submenu 'patrimonio'` tem path próprio `/patrimonio` para o item "Resumo". O parentMap vai funcionar: `/patrimonio` → `'/'`, `/patrimonio/contas` → `/patrimonio`, etc.
- `submenu 'emprestimos'` tem path próprio `/emprestimos` (Lista). O parentMap vai funcionar igual ao patrimonio.

**Tabela de mapeamento esperada:**

| Pathname | Parent (parentMap) | Label |
|---|---|---|
| `/` | null | "Home" (de `breadcrumbMap['/']` ou `name` do `homeItem`) |
| `/relatorio` | `/` | "Relatórios" |
| `/importacao` | `/` | "Importação em Massa" |
| `/recebimentos/novo` | `/` | "Recebimentos" |
| `/tags` | `/` | "Tags" |
| `/patrimonio` | `/` | "Patrimônio" (nome do submenu pai) |
| `/patrimonio/contas` | `/patrimonio` | "Contas" |
| `/patrimonio/simulador` | `/patrimonio` | "Simulador de Rendimentos" |
| `/patrimonio/evolucao` | `/patrimonio` | "Evolução" |
| `/patrimonio/importacoes-ofx` | `/patrimonio` | "Importar OFX" |
| `/patrimonio/transferencias` | `/patrimonio` | "Transferências" |
| `/pluggy` | `/patrimonio` | "Open Finance" |
| `/emprestimos` | `/` | "Empréstimos" (nome do submenu pai) |
| `/emprestimos/123` | `/emprestimos` | "Detalhes" + label dinâmico (via MAP) |
| `/pessoas` | `/emprestimos` | "Pessoas" |
| `/conjunto` | `/` | "Contas Conjuntas" |
| `/conjunto/abc` | `/conjunto` | label dinâmico |
| `/insights` | `/` | "Insights" |
| `/modelos-relatorio` | `/` | "Modelos de Relatório" |

**Rota `/emprestimos/123` (detalhe):** o parentMap retorna `/emprestimos`. Aí o breadcrumb monta a hierarquia `Home › Empréstimos › [label dinâmico]`. O último item usa o label do `dynamicLabels.get('/emprestimos/123')`, com fallback para "Detalhes do Empréstimo" (label atual do `breadcrumbConfig.js:29`).

**Rota não coberta pelo `menuStructure`** (ex: rota de admin que não está no menu): fallback para `parentMap` mais próximo (matching pelo prefixo mais longo). Se não achar nada, breadcrumb mostra `Home › [último segmento formatado]`.

### 3. `BreadcrumbContext.js` — refatorado

**Estado novo:**

```js
const BreadcrumbContext = createContext(null);

export function BreadcrumbProvider({ children }) {
  // MAP de pathname → label dinâmico. Não é singleton global.
  const [dynamicLabels, setDynamicLabels] = useState(new Map());

  // Registra/atualiza o label da rota atual. Idempotente.
  const setDynamicLabel = useCallback((pathname, label) => {
    setDynamicLabels(prev => {
      const next = new Map(prev);
      if (label && typeof label === 'string') {
        next.set(pathname, label);
      } else {
        next.delete(pathname);
      }
      return next;
    });
  }, []);

  // Remove o label de uma rota específica (cleanup).
  const clearDynamicLabel = useCallback((pathname) => {
    setDynamicLabels(prev => {
      if (!prev.has(pathname)) return prev;
      const next = new Map(prev);
      next.delete(pathname);
      return next;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{
      dynamicLabels,
      setDynamicLabel,
      clearDynamicLabel,
    }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook para páginas de detalhe registrarem o label dinâmico do breadcrumb.
 * Substitui useBreadcrumbOverride. Comportamento:
 * - Registra label sob a key do pathname atual.
 * - Cleanup só dispara se a rota que registrou AINDA É a ativa.
 *   Isso elimina a race condition quando o usuário navega entre detalhes.
 *
 * @param {string|null} label - Nome da entidade (ex: vinculo?.nome, subconta?.nome)
 */
export function useBreadcrumbTrailing(label) {
  const { setDynamicLabel, clearDynamicLabel } = useBreadcrumbContext();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!label) return;
    setDynamicLabel(pathname, label);
    return () => {
      // Verifica se a rota que registrou ainda é a ativa.
      // Se o usuário já navegou pra outra, NÃO limpa (outra página
      // pode ter registrado label novo).
      if (window.location.pathname === pathname) {
        clearDynamicLabel(pathname);
      }
    };
  }, [label, pathname, setDynamicLabel, clearDynamicLabel]);
}
```

**Por que isso resolve a race condition:**

Cenário problemático anterior:
1. User está em `/emprestimos/123` (label "Maria")
2. User clica em `/emprestimos/456` (label "João")
3. React desmonta componente 1, monta componente 2
4. Cleanup de 1 roda: `setBreadcrumbOverride(null)` ← BUG: apaga o label de 456
5. Effect de 2 roda: `setBreadcrumbOverride('João')` ← restaura, mas o frame intermediário mostra "Detalhes"

Cenário novo:
1. User está em `/emprestimos/123` (MAP.get('/emprestimos/123') = "Maria")
2. User clica em `/emprestimos/456`
3. Cleanup de 1 roda: verifica `window.location.pathname === '/emprestimos/123'` → **false** (já mudou) → não faz nada
4. Effect de 2 roda: MAP.set('/emprestimos/456', 'João') → breadcrumb mostra "João" imediatamente

A comparação `window.location.pathname === pathname` no cleanup é a chave. React-router dispara o cleanup com a closure antiga do `pathname`, mas o `window.location` está sincronizado com a rota atual. Se a rota atual é outra, a página 1 não tem mais autoridade sobre o label.

**Alternativa considerada e descartada:** usar `useRef` para guardar o último pathname registrado e comparar. Mais limpo em React puro, mas o `window.location` já está disponível globalmente e é mais fácil de raciocinar. Mantém.

### 4. `BreadcrumbsNav.jsx` — refatorado

**Estrutura:**

```jsx
import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Breadcrumbs, Typography, Link as MuiLink } from '@mui/material';
import { menuStructure, buildParentMap } from '../Layout/menuStructure';
import { useBreadcrumbContext } from '../../context/BreadcrumbContext';

function BreadcrumbsNav() {
  const location = useLocation();
  const { dynamicLabels } = useBreadcrumbContext();
  const pathname = location.pathname;

  // Memoiza o parentMap (estável enquanto menuStructure não muda)
  const parentMap = useMemo(() => buildParentMap(menuStructure), []);

  // Monta a hierarquia: array de {path, label} da raiz até o pathname atual
  const items = useMemo(() => {
    return buildBreadcrumbItems(pathname, parentMap, dynamicLabels);
  }, [pathname, parentMap, dynamicLabels]);

  if (items.length === 0) return null;

  return (
    <Breadcrumbs
      separator="·"
      aria-label="breadcrumb"
      maxItems={4}
      itemsBeforeCollapse={1}
      itemsAfterCollapse={1}
      sx={{ /* tokens */ }}
    >
      {items.map((item, index) =>
        item.isLast ? (
          <Typography
            key={item.path || `last-${index}`}
            color="text.primary"
            sx={{ fontWeight: 600, fontSize: 'var(--cg-font-size-sm)' }}
            aria-current="page"
          >
            {item.label}
          </Typography>
        ) : (
          <MuiLink
            key={item.path || `item-${index}`}
            component={Link}
            to={item.path}
            underline="hover"
            color="text.secondary"
            sx={{
              fontSize: 'var(--cg-font-size-sm)',
              px: 0.5,
              py: 0.25,
              borderRadius: 'var(--cg-radius-sm)',
              transition: 'background-color 150ms ease',
              '&:hover': {
                backgroundColor: 'var(--cg-color-surface-elevated)',
                textDecoration: 'none',
              },
            }}
          >
            {item.label}
          </MuiLink>
        )
      )}
    </Breadcrumbs>
  );
}
```

**Função `buildBreadcrumbItems(pathname, parentMap, dynamicLabels)`:**

```js
function buildBreadcrumbItems(pathname, parentMap, dynamicLabels) {
  // Caso raiz: '/'
  if (pathname === '/' || pathname === '') {
    return [{ path: '/', label: 'Home', isLast: true }];
  }

  // Sobe a árvore de pais até chegar em '/'
  const chain = [];
  let current = pathname;
  let safetyCounter = 0;

  while (current && safetyCounter < 20) {
    const parent = parentMap.get(current);

    // Define o label:
    // 1. Label dinâmico (do MAP) tem prioridade
    // 2. Senão, busca o item no menuStructure pelo path
    // 3. Fallback: humaniza o segmento
    let label = dynamicLabels.get(current);
    if (!label) {
      label = findLabelInMenu(current, menuStructure);
    }
    if (!label) {
      label = humanizeSegment(current);
    }

    chain.unshift({ path: current, label, isLast: current === pathname });
    current = parent;
    safetyCounter++;
  }

  // Adiciona Home se não estiver na chain
  const hasHome = chain.some(item => item.path === '/');
  if (!hasHome) {
    chain.unshift({ path: '/', label: 'Home', isLast: false });
  }

  return chain;
}
```

**Função `findLabelInMenu(path, menuStructure)`:**

```js
function findLabelInMenu(path, menuStructure) {
  for (const node of menuStructure) {
    if (node.type === 'item' && node.path === path) return node.name;
    if (node.type === 'submenu' && node.path === path) return node.name;
    if (node.type === 'section' || node.type === 'submenu') {
      for (const child of node.items || []) {
        if (child.path === path) return child.name;
      }
    }
    if (node.type === 'submenu') {
      // Retorna o nome do submenu como label do pai
      // (cobre casos onde o path do pai não está no map)
    }
  }
  return null;
}
```

**`humanizeSegment(segment)`:** transforma `minhas-faturas` em `Minhas Faturas`, lida com IDs, etc. Mantém heurística atual do `BreadcrumbsNav.jsx:10-13` para detectar IDs.

### 5. Visual (tokens)

**Container do breadcrumb (no MainLayout):** ✅ **APROVADO com container glassmorphism.**

```jsx
<Box
  sx={{
    mb: 2,
    px: 1.5,
    py: 1,
    borderRadius: 'var(--cg-radius-md)',
    backgroundColor: 'var(--cg-color-surface)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--cg-color-border, rgba(255,255,255,0.08))',
  }}
>
  <Breadcrumbs ...>...</Breadcrumbs>
</Box>
```

**Decisão do Alisson (2026-06-28):** container com glassmorphism, integra visualmente com o resto do projeto (Fase 6 da sidebar já usa `var(--cg-color-surface)` em outras superfícies). Segue a mesma estética.

**Item atual (último):**
- `color: var(--cg-color-text-primary)`
- `fontWeight: 600`
- `fontSize: var(--cg-font-size-sm)` (14px)
- Sem hover
- `aria-current="page"`

**Itens anteriores (links):**
- `color: var(--cg-color-text-secondary)`
- `fontWeight: 500`
- `fontSize: var(--cg-font-size-sm)` (14px)
- Hover: `backgroundColor: var(--cg-color-surface-elevated)` + `borderRadius: var(--cg-radius-sm)` + transition 150ms
- `underline="hover"` (MUI Link, default já é esse comportamento)

**Separador:**
- Caractere: `·` (middle dot, U+00B7) — Linear-style, mais moderno que `›`
- Cor: `var(--cg-color-text-muted)`
- `mx: 1` (8px)

**Ellipsis (rotas profundas):**
- `maxItems={4}` (mostra no máximo 4 itens antes de colapsar)
- `itemsBeforeCollapse={1}` (sempre mostra o 1º: Home)
- `itemsAfterCollapse={2}` (sempre mostra o penúltimo + último)
- Visual: `...` clicável, expande no hover (comportamento default do MUI)

**Mobile:**
- `maxItems={3}` (mais enxuto)
- `itemsBeforeCollapse={1}`
- `itemsAfterCollapse={1}`
- Container: sem mudança de cor, mas `px: 1` em vez de 1.5 (economia)

### 6. Migração das 5 páginas de detalhe

**Substituir `useBreadcrumbOverride` por `useBreadcrumbTrailing`** em:

- `pages/Emprestimos/EmprestimoDetalhePage.js:32` → `useBreadcrumbTrailing(emprestimo?.pessoaNomeSnapshot || null)`
- `pages/Patrimonio/DetalheSubcontaPage.js:193` → `useBreadcrumbTrailing(subconta?.nome)`
- `pages/Patrimonio/FaturasPage.js:43` → `useBreadcrumbTrailing('Minhas Faturas')` (label estático, mas o novo hook funciona igual)
- `pages/Patrimonio/ImportacaoOFXDetalhePage.js:38` → `useBreadcrumbTrailing(importacao?.nomeArquivo)`
- `pages/Conjunto/DetalheVinculoPage.js:94` → `useBreadcrumbTrailing(vinculo?.nome)`

**Compatibilidade:** o nome `useBreadcrumbOverride` pode ser mantido como **alias deprecated** que delega pro novo, por 1 sprint. Decidi **NÃO manter** — são só 5 usos e a migração é trivial. Remoção completa.

### 7. Apagar `breadcrumbConfig.js`

`breadcrumbConfig.js` vira **morto**. Deletar o arquivo e remover o import de `BreadcrumbsNav.jsx`. Toda info de label agora vem de `menuStructure.js` (com fallback de humanização).

**Risco:** se houver rotas que estão no `breadcrumbConfig` mas **não** no `menuStructure`, o breadcrumb vai cair no fallback de humanização de segmento. Vou validar isso na Fase 1 do plano de execução (inventário completo).

### 8. Gancho pra Abordagem C (premium) — documentação

A Abordagem C (dropdown em cada nível, atalho de teclado) está **fora de escopo desta sessão**, mas o design atual deixa o terreno preparado:

- **`buildParentMap` é função pura exportada** — pode ser reusada para popular dropdowns de atalho.
- **`dynamicLabels` é MAP** — pode ser exposto para auto-complete de busca.
- **`items` é um array de `{path, label}`** — fácil de transformar em `MenuList` para fly-outs.
- **Hook `useBreadcrumbTrailing`** pode ser complementado com `useBreadcrumbSiblings(pathname)` que retorna os filhos do pai atual (pra fly-out do submenu).

**Quando evoluir pra C:** quando você sentir falta de "atalho rápido pra outra subpágina" ou "deep linking de estado de navegação". Por enquanto, o breadcrumb é **read-only** (mostra onde estou) e não **actionable** (não tem atalhos).

## Plano de execução (para o `newapp-executor`)

> O executor vai seguir as fases abaixo. Cada fase é testável independentemente.

### Fase 0: Inventário de rotas (10min)
- Listar todas as rotas do `App.js` e cruzar com `breadcrumbConfig.js` e `menuStructure.js`.
- Identificar rotas que estão no breadcrumbConfig mas NÃO no menuStructure (precisam de tratamento especial no fallback).
- Identificar rotas que estão no menuStructure mas NÃO no breadcrumbConfig (já cobertas pelo novo design).
- Output: lista de rotas + status de cobertura. Sem mudança de código.

### Fase 1: Adicionar `path` no `menuStructure.js` (10min)
- Adicionar `path` no submenu `patrimonio` (`/patrimonio`).
- Adicionar `path` no submenu `emprestimos` (`/emprestimos`).
- Verificar que o `parentMap` consegue derivar a hierarquia completa (rodar mentalmente o algoritmo para todas as rotas).

### Fase 2: Funções puras no `menuStructure.js` (15min)
- Adicionar `buildParentMap(menuStructure)` exportada.
- Adicionar `findLabelInMenu(path, menuStructure)` exportada.
- Adicionar `humanizeSegment(segment)` exportada.
- **Sem mudar o export existente** — só adicionar exports novos.

### Fase 3: Refatorar `BreadcrumbContext.js` (20min)
- Trocar `overrideLabel` por `dynamicLabels: Map<pathname, label>`.
- Renomear `setBreadcrumbOverride` para `setDynamicLabel(pathname, label)`.
- Adicionar `clearDynamicLabel(pathname)`.
- Renomear `useBreadcrumbOverride` para `useBreadcrumbTrailing(label)`.
- Implementar guard de `window.location.pathname === pathname` no cleanup.
- Atualizar import em `BreadcrumbsNav.jsx`.

### Fase 4: Refatorar `BreadcrumbsNav.jsx` (30min)
- Remover import de `breadcrumbConfig.js`.
- Adicionar import de `menuStructure.js` (parentMap, findLabelInMenu, humanizeSegment).
- Implementar `buildBreadcrumbItems(pathname, parentMap, dynamicLabels)`.
- Usar `<MuiLink component={Link}>` em vez de `<Link style>` (remove inline styles, usa tokens).
- Aplicar tokens em todos os `sx`.
- Configurar `maxItems={4}`, `itemsBeforeCollapse={1}`, `itemsAfterCollapse={2}`.
- Trocar separador para `·`.
- Adicionar `aria-current="page"` no último item.
- Adicionar container `<Box>` com glassmorphism (decisão a confirmar — ver Pontos de atenção).

### Fase 5: Migrar 5 páginas de detalhe (10min)
- Trocar `useBreadcrumbOverride` por `useBreadcrumbTrailing` em:
  - `EmprestimoDetalhePage.js:32`
  - `DetalheSubcontaPage.js:193`
  - `FaturasPage.js:43`
  - `ImportacaoOFXDetalhePage.js:38`
  - `DetalheVinculoPage.js:94`

### Fase 6: Apagar `breadcrumbConfig.js` (5min)
- Deletar o arquivo.
- Verificar que não há mais imports dele no projeto (`grep -r "breadcrumbConfig"`).

### Fase 7: Validação visual (20min)
- Rodar `npm start` (porta 3004).
- Validar com `browser-use` em **8 cenários**:
  1. Home (`/`) → "Home" em destaque, sem links antes
  2. Patrimônio resumo (`/patrimonio`) → "Home › Patrimônio"
  3. Patrimônio contas (`/patrimonio/contas`) → "Home › Patrimônio › Contas"
  4. Detalhe de empréstimo (`/emprestimos/123`) → "Home › Empréstimos › [nome da pessoa]"
  5. Conta conjunta detalhe (`/conjunto/abc`) → "Home › Contas Conjuntas › [nome do vínculo]"
  6. Rota profunda (`/patrimonio/importacoes-ofx/abc/editar`) → ellipsis no meio
  7. Mobile (resize 375px) → ellipsis mais enxuto, container adaptado
  8. Dark mode → cores reagem sem reload (validar `getComputedStyle().color` muda — regra do ADR-012)
- **Teste de race condition:** navegar rapidamente entre `/emprestimos/123` → `/emprestimos/456` → `/emprestimos/789` (3 cliques em sequência). Conferir via console que o MAP tem 3 keys (`123`, `456`, `789`) — não é mais singleton. Visual: cada breadcrumb mostra o nome correto imediatamente, sem flash de "Detalhes".

### Fase 8: Commit estruturado (10min)
- Chamar `newapp-committer` para empacotar em Conventional Commits PT-BR.
- Sugestão de commits:
  - `refactor(breadcrumb): adicionar buildParentMap e findLabelInMenu no menuStructure`
  - `refactor(breadcrumb): trocar singleton overrideLabel por dynamicLabels Map`
  - `feat(breadcrumb): usar menuStructure como fonte de verdade única`
  - `feat(breadcrumb): modernizar visual com tokens, separador · e ellipsis`
  - `refactor(breadcrumb): migrar useBreadcrumbOverride para useBreadcrumbTrailing`
  - `chore(breadcrumb): apagar breadcrumbConfig.js`

## Pontos de atenção / Riscos

1. **Rotas órfãs (Fase 0):** se houver rotas no `breadcrumbConfig.js` que NÃO estão no `menuStructure.js`, o fallback de humanização vai pegar. Risco: label feio tipo "faturas" minúsculo. **Mitigação:** Fase 0 do plano é exatamente pra mapear isso. Se houver rotas órfãs relevantes, decidir caso a caso (adicionar no menuStructure, ou adicionar override explícito).

2. **Dark mode (ADR-012):** qualquer cor nova no breadcrumb precisa ser `var(--cg-color-*)` reativa. Vou usar `var(--cg-color-text-primary)`, `var(--cg-color-text-secondary)`, `var(--cg-color-text-muted)`, `var(--cg-color-surface)`, `var(--cg-color-surface-elevated)`, `var(--cg-radius-sm)`, `var(--cg-radius-md)`, `var(--cg-font-size-sm)`. **Zero hex hardcoded.** Validar com `getComputedStyle().color` que muda sem reload.

3. **Container com glassmorphism:** é uma decisão visual que pode ser **rejeitada** (se você preferir breadcrumb solto, sem card). Default = **com container**. Se rejeitar, removo o `<Box>` wrapper. Decidir antes da Fase 4.

4. **`maxItems` com `itemsBeforeCollapse` e `itemsAfterCollapse`:** a soma deve ser `<= maxItems`. `1 + 2 = 3 < 4` ✓. Mobile: `1 + 1 = 2 < 3` ✓. Validar visualmente que o ellipsis renderiza `...` clicável.

5. **Race condition com StrictMode:** o `useEffect` do hook roda 2x em dev. O MAP.set é idempotente (set com mesma key+value = no-op), então não há problema. O guard do cleanup (`window.location.pathname === pathname`) também é seguro: se a rota mudou, não limpa.

6. **`window.location` vs `useLocation()` do react-router:** no cleanup, eu uso `window.location` em vez de `location.pathname` (que viria do `useLocation` no escopo do effect). Por quê? Porque o `useLocation` na closure do effect é a versão **no momento do mount**. Se a rota mudou, o effect ainda vê a rota antiga, e a checagem falharia. `window.location` é sincronizado com o browser. **Confirmar empiricamente** na Fase 7 com teste de race.

7. **Submenu sem path próprio (`transacoes`):** os 3 filhos (`/importacao`, `/recebimentos/novo`, `/recebimentos/historico`) vão ter parent `null` (raiz) na primeira passada, porque o pai do submenu não tem path. Vou ajustar o algoritmo: se o pai do submenu não tem path, **o pai dos filhos é o pai do submenu** (que no caso seria `'/'`). Já está contemplado no pseudo-código acima.

8. **Performance:** `buildBreadcrumbItems` é chamado em todo render. Com `useMemo` na dependência de `pathname, parentMap, dynamicLabels`, o cálculo só roda quando a rota muda ou labels mudam. `parentMap` é estável (derivado de `menuStructure` que é estático). Custo: O(n) na chain, n ≤ 5. Trivial.

9. **Acessibilidade:** `aria-current="page"` no último, `aria-label="breadcrumb"` (já tem). Foco visível em links (MUI Link tem default, mas vou validar contraste em dark mode). Tooltip do ellipsis do MUI tem `aria-label` próprio.

## Decisões deliberadas (não voltar)

- ✂️ **Apagar `breadcrumbConfig.js`**, não manter como alias. Migração é direta e remove fonte duplicada de verdade.
- 🎨 **Container com glassmorphism no breadcrumb** (decisão pendente de validação do Alisson — confirmar antes da Fase 4).
- 🔤 **Separador `·`** (middle dot), não `›`. Mais moderno, menos "web 1.0".
- 📏 **`maxItems={4}` desktop, `maxItems={3}` mobile.** Mais que isso fica poluído visualmente.
- 🪝 **Hook `useBreadcrumbTrailing` substitui `useBreadcrumbOverride`** — sem alias deprecated, remoção completa.
- 🚫 **Abordagem C (premium) está fora de escopo** — design deixa gancho, não implementação.
- 🎯 **Fonte de verdade única: `menuStructure.js`.** Qualquer adição de rota nova = atualizar `menuStructure` e o breadcrumb segue automaticamente.

## Próximo passo

1. **Alisson confirma as 2 decisões pendentes:**
   - Container com glassmorphism? (sim/não)
   - Confirmar Fase 0 do inventário antes de começar (pra identificar rotas órfãs)
2. Se aprovado, eu delego ao `newapp-executor` executar **Fase 0 → 8** sequencialmente
3. O executor vai PARAR e perguntar via `question` se travar em qualquer fase
4. `newapp-committer` empacota os commits no final
