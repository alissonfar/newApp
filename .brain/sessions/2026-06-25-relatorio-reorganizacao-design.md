---
type: design
status: approved
created: 2026-06-25
approved: 2026-06-25
tags: [relatorios, ui, refactor, layout, filtros, grid, brainstorm]
---

# Design Doc — Reorganização da Página de Relatórios

> Documento de design para reorganizar a página `/relatorios` (tela de filtros, grid de resultados, layout geral). Resolve 6 problemas de UX identificados: filtros ocupam muito espaço, atalhos de data são dropdown em vez de botões, falta atalhos de dia único (Hoje/Ontem/Amanhã), grid sem ordenação/agrupamento/seleção, paginação com botões próprios em vez de componente, sem colapso de filtros.

## 1. Contexto e motivação

### 1.1 A página atual (estado pré-refatoração)

A página `/relatorios` (`controle-gastos-frontend/src/pages/Relatorio/Relatorio.js`, 1.122 linhas) tem 6 problemas principais:

1. **Filtros ocupam muito espaço vertical** — 6 seções empilhadas (Datas, Transação, Tags de Pagamento, Modelo, Pesquisa & Ordenação, Botões), mais de 800px de altura
2. **Atalhos de data são um `<select>`** — `PeriodQuickFilter.js` já existe no projeto mas não é usado
3. **Falta atalhos "Hoje/Ontem/Amanhã"** — só tem atalhos por período (7/30 dias, mês atual)
4. **Grid é simples** — sem ordenação clicável, sem agrupamento, sem seleção de linhas
5. **Paginação é botões próprios** — não usa o `Pagination` component que já existe
6. **Sem colapso/expansão dos filtros** — usuário tem que rolar muito pra ver os resultados

### 1.2 Componentes já existentes (reutilizáveis)

| Componente | Localização | Uso previsto |
|------------|-------------|--------------|
| `PeriodQuickFilter` | `components/shared/PeriodQuickFilter.js` | Atalhos de período (Mês Atual, Últimos 7d, etc.) + 2 inputs de data |
| `SegmentedControl` | `components/shared/SegmentedControl.js` | Toggle "Tipo de Transação" |
| `Pagination` | `components/shared/Pagination.js` | Substituir botões próprios |
| `BulkActionBar` | `components/shared/BulkActionBar.js` | Ações em lote quando há linhas selecionadas |
| `DataTable` | `components/shared/DataTable.js` | Evoluir com header sticky, ordenação, seleção |
| `Button`, `Card`, `SectionHeader` | `components/shared/` | Já em uso, manter |

### 1.3 Decisões consolidadas (do brainstorm 2026-06-25)

| Tema | Decisão |
|------|---------|
| Abordagem | **B — Reorganização + Grid rico** (filtros colapsáveis + grid com header sticky/ordenação/agrupamento/seleção) |
| Colapso dos filtros | **Começa expandido** (default). Botão de colapsar no header. Estado persiste em `localStorage` (se user fecha, lembra). |
| Posição do botão de colapso | **Header da página** (canto superior direito, ícone chevron) |
| Atalhos de data extras | **Incluir Hoje / Ontem / Amanhã** (além dos 8 atalhos por período que já existem) |
| Agrupamento do grid | **Agrupar por** (Data, Pessoa, Categoria, Tipo, ou Nenhum) — sem subtotais nesta fase |

## 2. Wireframe (em ASCII)

### Estado: expandido (default)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Relatórios                                                [⌃ Recolher] │
│ Filtre, visualize e exporte suas transações                           │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─── Filtros (Card glass) ────────────────────────────────────────┐  │
│ │ [Período: Mês Atual | Últimos 7d | 30d | 60d | 1 ano | ...]    │  │
│ │ [Hoje] [Ontem] [Amanhã]   Data Ini: [____]  Data Fim: [____] │  │
│ │                                                                │  │
│ │ Tipo: ( Ambos | Gastos | Recebíveis )                         │  │
│ │ Pessoas (incluir): [_____________]   Excluir: [_____________] │  │
│ │                                                                │  │
│ │ Tags:                                                          │  │
│ │   Categoria 1: [tag] [tag] [tag]                               │  │
│ │   Categoria 2: [tag] [tag]                                     │  │
│ │                                                                │  │
│ │ Template: [Relatório Simples ▼]                                │  │
│ │ Pesquisa: [_______________]   Ordenar: [Data ▼] [Desc ▼]       │  │
│ │                                                                │  │
│ │ [Filtrar] [Limpar] [+ Nova TX] [↓ Exportar]                    │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌─── Resumo (Card glass à direita) ─────────────────────────────┐    │
│ │  Recebíveis   Gastos   Saldo                                  │    │
│ │  ↑R$ X        ↓R$ Y    🐷R$ Z                                │    │
│ │                                                               │    │
│ │  Total TXs: N  Total Valor: R$ X  Pessoas: N  Média: R$ X   │    │
│ └───────────────────────────────────────────────────────────────┘    │
│                                                                        │
│ ┌─── Resultados: 50 desta página, 234 no total ──────────────────┐    │
│ │ ⌕ Busca   📋 Layout   ⛕ Filtros      Agrupar por: [Nenhum ▼] │    │
│ │ ┌────────────────────────────────────────────────────────┐    │    │
│ │ │ ☐ │ Data  ▼ │ Descrição       │ Pessoa ▼ │ Valor ▼ │...│    │    │
│ │ ├───┼─────────┼─────────────────┼──────────┼─────────┼───┤    │    │
│ │ │ ☐ │ 16/06   │ Pix - Estrela   │ Alisson  │ 447,50  │...│    │    │
│ │ │ ☐ │ 10/06   │ ...             │          │         │   │    │    │
│ │ └────────────────────────────────────────────────────────┘    │    │
│ │ « Anterior   1 2 3 4 5   Próxima »                            │    │
│ └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### Estado: colapsado

```
┌────────────────────────────────────────────────────────────────────────┐
│ Relatórios                                                [⌄ Expandir] │
│ Filtre, visualize e exporte suas transações                           │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─── Filtros compactos (1 linha) ───────────────────────────────┐  │
│ │ [Mês Atual ▼]  [Hoje][Ontem]   Tipo: [Ambos ▼]   ⌕ [___]    │  │
│ │                                          [Filtrar] [Limpar]  │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌─── Resultados: 50 desta página, 234 no total ──────────────────┐    │
│ │ ... (mesmo grid do estado expandido) ...                      │    │
│ └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Modelo conceitual

### 3.1 O que muda (vs estado atual)

**Layout:**
- **Antes:** filtros em painel vertical ocupando 800px, summary à direita do filtro (layout 2 colunas forçado)
- **Depois:** filtros em card glass colapsável, com `localStorage` lembrando o estado; modo colapsado = 1 linha só de filtros essenciais

**Atalhos de data:**
- **Antes:** `<select>` com 7 opções (Mês Atual, Últimos 7/15/30/60 dias, Mês Anterior) + 2 inputs de data
- **Depois:** botões visuais com `PeriodQuickFilter` (Mês Atual, Últimos 7/30 dias, 1 ano, Este Ano, Mês Anterior) + **3 novos botões** (Hoje, Ontem, Amanhã) + 2 inputs de data (visíveis só quando nenhum atalho selecionado, ou sempre — a definir)

**Tipo de Transação:**
- **Antes:** `<select>` simples com "Ambos | Gasto | Recebível"
- **Depois:** `SegmentedControl` (visual pill, mais claro)

**Grid:**
- **Antes:** `DataTable` simples, sem ordenação por clique, sem seleção
- **Depois:** `DataTable` evoluído com:
  - Header sticky (rolagem mantém colunas visíveis)
  - Ordenação por clique em qualquer coluna (ícone ▲/▼ na coluna ativa)
  - Seleção por linha (checkbox por linha + checkbox no header pra "selecionar todas")
  - Agrupamento opcional (Data, Pessoa, Categoria, Tipo) com header visual de seção
  - Barra de ação em lote (reaproveita `BulkActionBar`) — visível quando há linhas selecionadas

**Paginação:**
- **Antes:** botões próprios "Anterior / Próxima" inline
- **Depois:** componente `Pagination` com numeração de páginas

**Estado de colapso:**
- Persistido em `localStorage` na chave `relatorio:filtersCollapsed` (default: `false` = expandido)

### 3.2 Estrutura de componentes

```
Relatorio.js (página principal)
├── RelatorioFiltersPanel (NOVO)
│   ├── SectionHeader com botão de colapso (header da página, no topo)
│   ├── PeriodQuickFilter (reutilizado, extendido com Hoje/Ontem/Amanhã)
│   ├── SegmentedControl para Tipo
│   ├── Selects de Pessoas (incluir/excluir)
│   ├── Selects de Tags por categoria (reaproveita lógica)
│   ├── Select de Template
│   ├── Input de Pesquisa + Selects de Ordenação
│   └── Botões de Ação (Filtrar, Limpar, Nova TX, Exportar)
├── RelatorioSummaryPanel (refactor do atual)
│   └── 3 StatCards + bloco de Informações Gerais
└── RelatorioResultsPanel (NOVO)
    ├── Toolbar: busca, layout, filtros, agrupar por
    ├── BulkActionBar (reaproveitado, condicional)
    ├── DataTable (evoluído)
    └── Pagination (reutilizado)
```

## 4. Mudanças por arquivo

### 4.1 Backend

**Nenhuma mudança.** O endpoint `obterTransacoesPaginadas` já retorna todos os dados necessários:
- `data` (array de TXs)
- `total`, `page`, `totalPages` (paginação)
- `summary` (totalValue, totalGastos, totalRecebiveis, netValue, totalPeople, totalRows)

E os params `sortBy`, `sortDir` já são aceitos. Ordenação server-side funciona.

### 4.2 Frontend

#### `controle-gastos-frontend/src/components/shared/DataTable.js` (evoluir)

**Adicionar:**
- `onSort` (callback): chamado quando user clica no header de uma coluna
- `sortColumn`, `sortDirection` (props): indicam qual coluna está ordenada e em que direção (controlado pelo pai)
- `selectable` (boolean): mostra checkbox por linha
- `onSelectionChange` (callback): chamado quando seleção muda
- `selectedIds` (Set/Array): IDs selecionados (controlado pelo pai)
- `stickyHeader` (boolean): header sticky (default `false` pra não quebrar uso atual, mas `true` no Relatorio)
- `groupBy` (string opcional): 'data' | 'pessoa' | 'categoria' | 'tipo' | null
- `renderGroupHeader` (callback): renderiza o header de cada grupo

**Manter compatibilidade (CRÍTICO):** todas as props atuais continuam funcionando **idênticas** para quem já usa (Home, Transações). Quem não passar `onSort`, `selectable`, `stickyHeader`, `groupBy` etc, tem o comportamento atual. **Atenção executor:** validar com `grep` que Home, Transações e outras telas continuam funcionando após o upgrade do `DataTable`.

**Layout:** mudar a estrutura de `<div class="cg-data-table__row">` para usar `position: sticky; top: 0; z-index: 1` no header. Suporte a seleção via input checkbox no início de cada row + header.

#### `controle-gastos-frontend/src/components/shared/PeriodQuickFilter.js` (estender)

**Decisão fixa:** adicionar 3 novas constantes em `dateUtils.js` e fazer o `PeriodQuickFilter` renderizar esses 3 botões automaticamente antes dos atalhos por período (controlado por nova prop `showDayButtons`).

**Em `dateUtils.js`:**
```js
// dateUtils.js
export const PERIODOS_DIA_UNICO = {
  HOJE: 'HOJE',
  ONTEM: 'ONTEM',
  AMANHA: 'AMANHA'
};

// Helper que retorna { dataInicio, dataFim } para um dia único
export const getSingleDateRange = (period) => {
  const today = getCurrentDateBR();
  let target;
  switch (period) {
    case PERIODOS_DIA_UNICO.HOJE: target = today; break;
    case PERIODOS_DIA_UNICO.ONTEM: target = new Date(today); target.setDate(target.getDate() - 1); break;
    case PERIODOS_DIA_UNICO.AMANHA: target = new Date(today); target.setDate(target.getDate() + 1); break;
    default: return null;
  }
  return { dataInicio: toStringDate(target), dataFim: toStringDate(target) };
};
```

**Em `PeriodQuickFilter.js`:** aceita nova prop `showDayButtons` (default `false` — mantém compatibilidade com `Recebimentos` que já usa). Quando `true`, renderiza os 3 botões "Hoje/Ontem/Amanhã" antes dos atalhos por período. Reaproveita o helper `getSingleDateRange`.

#### `controle-gastos-frontend/src/components/Relatorio/RelatorioFiltersPanel.js` (NOVO)

**Responsabilidade:** renderizar o painel de filtros (5 seções) com layout inteligente.

**Props:**
```js
{
  draftFilters, appliedFilters, categorias, tags, pessoasOptions, tagsPorCategoria,
  reportTemplates, selectedTemplate, quickRange, collapsed, onChange, onApply, onClear,
  onCreate, onExportClick
}
```

**Estrutura interna:**
```jsx
<Card variant="glass" padding="md">
  {/* Seção 1: Período */}
  <div className="filtros-secao">
    <h4>Período</h4>
    <PeriodQuickFilter
      value={quickRange}
      dataInicio={draftFilters.dataInicio}
      dataFim={draftFilters.dataFim}
      onChange={({ dataInicio, dataFim }) => onChange({ ...draftFilters, dataInicio, dataFim })}
      showDayButtons
      showCustomInputs
    />
  </div>
  {/* Seção 2: Transação */}
  <div className="filtros-secao">
    <h4>Transação</h4>
    <SegmentedControl
      options={[
        { value: 'both', label: 'Ambos' },
        { value: 'gasto', label: 'Gastos' },
        { value: 'recebivel', label: 'Recebíveis' }
      ]}
      value={draftFilters.selectedTipo || 'both'}
      onChange={(v) => onChange({ ...draftFilters, selectedTipo: v })}
    />
    <Select pessoas (incluir) /> <Select pessoas (excluir) />
  </div>
  {/* Seção 3: Tags de Pagamento */}
  <div className="filtros-secao">... grid de Selects por categoria ...</div>
  {/* Seção 4: Modelo de Relatório */}
  <div className="filtros-secao">... select de template ...</div>
  {/* Seção 5: Pesquisa & Ordenação */}
  <div className="filtros-secao">... input pesquisa + selects ...</div>
  {/* Seção 6: Botões de Ação */}
  <div className="filtros-secao filtros-acoes">... [Filtrar] [Limpar] [+ Nova TX] [↓ Exportar] ...</div>
</Card>
```

**Layout responsivo:**
- 1 coluna no mobile
- 2 colunas no desktop (Período + Transação na esquerda, Tags + Modelo na direita)
- Pesquisa & Ordenação + Botões de Ação em linha própria embaixo

**Decisão de simplicidade:** primeira versão implementa 1 coluna (estado atual), 2 colunas fica pra iteração futura se o user sentir falta.

**No modo colapsado:** o `RelatorioFiltersPanel` NÃO é renderizado. Em vez disso, é renderizado um `RelatorioFiltersCompact` (1 linha) com: atalho de período atual + 3 botões de dia + SegmentedControl de tipo + input de pesquisa + botões Filtrar/Limpar. Isso libera o espaço vertical que estava sendo ocupado pelo painel completo.

#### `controle-gastos-frontend/src/components/Relatorio/RelatorioResultsPanel.js` (NOVO)

**Responsabilidade:** renderizar o grid de resultados + toolbar + bulk actions + paginação.

**Props:**
```js
{
  filteredRows, total, page, totalPages, totalSummary,
  selectedIds, setSelectedIds, groupBy, setGroupBy,
  searchTerm, setSearchTerm, sortColumn, sortDirection, onSortChange,
  onPageChange, onEdit, onDelete, categorias, tags,
  showFilters
}
```

**Estrutura interna:**
```jsx
<Card variant="glass" padding="md">
  <SectionHeader title={`Resultados (${rows.length} desta página, ${total} no total)`} />
  
  {/* Toolbar */}
  <div className="resultados-toolbar">
    <input type="search" placeholder="Buscar..." value={searchTerm} onChange={...} />
    <select>Agrupar por: Nenhum | Data | Pessoa | Categoria | Tipo</select>
    <Button icon={<FaFilter />}>Filtros</Button>
  </div>
  
  {/* Bulk Action Bar (condicional) */}
  {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} actions={...} />}
  
  {/* Grid */}
  {rows.length > 0 ? (
    <DataTable
      columns={...}
      rows={rows}
      renderCell={...}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={onSortChange}
      stickyHeader
      groupBy={groupBy}
      renderGroupHeader={renderGroupHeader}
    />
  ) : (
    <EmptyState ... />
  )}
  
  {/* Paginação */}
  {totalPages > 1 && <Pagination current={page} total={totalPages} onChange={onPageChange} />}
</Card>
```

#### `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js` (refactor)

**O que muda:** quebra em sub-componentes e hooks.

**Hooks novos:**
- `useRelatorioFilters` (lógica de filtros: state, apply, clear, persistência de colapso)
- `useRelatorioResults` (lógica de resultados: state, fetch, paginação, ordenação server-side)
- `useRelatorioSelection` (lógica de seleção em lote)

**Estrutura do componente:**
```jsx
const Relatorio = () => {
  const filters = useRelatorioFilters(initialFilters);
  const results = useRelatorioResults();
  const selection = useRelatorioSelection();
  
  return (
    <div className="cg-relatorio">
      <SectionHeader
        title="Relatórios"
        subtitle="Filtre, visualize e exporte suas transações"
        action={<Button icon={filters.collapsed ? <FaChevronDown /> : <FaChevronUp />} onClick={filters.toggleCollapsed}>{filters.collapsed ? 'Expandir' : 'Recolher'}</Button>}
      />
      
      {!filters.collapsed && (
        <RelatorioFiltersPanel
          {...filters}
          onApply={results.applyFilters}
        />
      )}
      
      {filters.collapsed && <RelatorioFiltersCompact {...filters} onApply={results.applyFilters} />}
      
      <RelatorioSummaryPanel summary={results.summary} />
      
      <RelatorioResultsPanel
        {...results}
        selectedIds={selection.selectedIds}
        onSelectionChange={selection.setSelectedIds}
      />
    </div>
  );
};
```

#### `controle-gastos-frontend/src/pages/Relatorio/Relatorio.css` (atualizar)

- Layout principal: `display: grid; grid-template-columns: 2fr 1fr; gap: 24px;` (filtros à esquerda, summary à direita)
- Quando `filters.collapsed`: layout muda pra `1fr` (tudo empilhado, filtros só com 1 linha)
- Ajustes de espaçamento entre seções do `RelatorioFiltersPanel`
- Responsividade mobile: 1 coluna quando `< 768px`

## 4.3. Dark mode / light mode (atenção a armadilhas conhecidas)

O projeto tem um histórico de bugs sutis em dark mode documentados nos **ADRs 006-012** e no `AGENTS.md` raiz. Esta seção lista as **4 armadilhas conhecidas** que o executor DEVE evitar ao implementar esta reorganização. Não são "nice to have" — são obrigatórias.

### Armadilha 1 — NUNCA usar `style={{ background: '#XXX' }}` inline com cor hardcoded

**O que é:** usar `style={{ background: '#f1f5f9' }}` ou similar em JSX, em vez de `style={{ background: 'var(--cg-color-thead-bg)' }}`.

**Por que quebra:** a cor fica "presa" no tema atual. Quando o user troca de light pra dark (sem reload), o elemento não muda de cor.

**Onde usar tokens existentes:**
- Background de card/header: `var(--cg-color-surface)` ou `var(--cg-color-surface-elevated)`
- Background de thead: `var(--cg-color-thead-bg)` (já tem override dark)
- Texto primário: `var(--cg-color-text-primary)`
- Texto secundário: `var(--cg-color-text-secondary)` ou `var(--cg-color-text-muted)`
- Borda: `var(--cg-color-border)` ou `var(--cg-color-border-strong)`
- Glass: `var(--cg-glass-border)` ou `var(--cg-glass-border-dark)` (já adaptam)
- Spacing: `var(--cg-spacing-{xs,sm,md,base,lg,xl,2xl,3xl})`
- Radius: `var(--cg-radius-{sm,md,lg,xl,full})`
- Shadow: `var(--cg-shadow-{sm,md,lg,glow})`

**Como evitar:** o executor deve usar `grep -rn 'style={{.*background' controle-gastos-frontend/src/components/Relatorio/` antes de commitar pra garantir que não sobrou cor hardcoded.

### Armadilha 2 — Elementos com cor presa de wrapper global de tipografia

**O que é:** alguns elementos (especialmente `<th>`, `<td>`, `<input type="checkbox">`) têm `color` e/ou `-webkit-text-fill-color` aplicados por wrappers de tipografia (MUI/Tailwind) que **não reagem** ao toggle de tema.

**Como evitar:** o executor deve adicionar regra no `App.css` dentro de `[data-theme="dark"]` com `!important` em `color` e `-webkit-text-fill-color` se necessário. Padrão:

```css
[data-theme="dark"] {
  /* Novos elementos específicos desta página (se houver cor presa) */
  .novo-elemento {
    color: var(--cg-color-text-primary) !important;
    -webkit-text-fill-color: var(--cg-color-text-primary) !important;
  }
}
```

**Onde ver regras existentes:** `controle-gastos-frontend/src/App.css` (linhas 50-150, dentro do bloco `[data-theme="dark"]`). Já tem regras para `thead th, th, td`, `.checkbox-label input[type="checkbox"]`, `.status-card`, etc.

**Validação obrigatória:** após implementar, o executor deve alternar o tema (light → dark → light) **sem reload** e validar via DevTools que `getComputedStyle(element).color` muda. Se não muda, tem cor presa em algum lugar.

### Armadilha 3 — Glassmorphism sem gradiente vibrante atrás

**O que é:** o efeito glass (`backdrop-filter: blur()` + `background: rgba(255,255,255,0.X)`) **só funciona visualmente** quando há um gradiente vibrante do body atrás. Em uma página com background branco liso, o glass vira "card branco opaco" — perde o sentido.

**Onde verificar:** os cards de filtros e de resultados usam `variant="glass"` (do `Card.js` shared). Precisam estar dentro de uma `<div>` que tenha o gradiente do body atrás.

**No design atual do Relatório:** a página herda o gradiente do `<body>` definido em `App.css` (via ADR-008 e ADR-011). Como o `MainLayout` envolve a página, o gradiente do body já está visível. **Não precisa fazer nada extra** — só garantir que o executor não mude o `MainLayout` ou o body.

**Como validar:** ver o print 1 (estado atual da sua página `/relatorios`) — o fundo tem gradiente suave. Esse gradiente tem que continuar aparecendo atrás dos cards de glass.

### Armadilha 4 — Componentes MUI sem `ThemeProvider` (já resolvido, mas não regredir)

**O que é:** o projeto usa MUI 6.4 com `ThemeProvider` configurado em `src/theme/muiTheme.js`. Componentes MUI (Button, Select, Menu, etc) herdam cores do tema automaticamente.

**Como evitar:** o executor NÃO deve usar `<MuiButton>` diretamente se quiser comportamento específico — deve usar o `Button` shared (que já está configurado com a família glass). O mesmo vale para `MuiSelect` (usar `Select` do `react-select` com `classNamePrefix` consistente) e `MuiMenu` (usar o `Menu` do MUI mas verificar que está dentro do `ThemeProvider`).

**Validação:** se um `MuiSelect` aparecer com cor azul MUI default (em vez da cor `--cg-color-primary`), o `ThemeProvider` não está envolvendo. Verificar `MainLayout.js` ou `App.js`.

### Checklist de validação pós-implementação (dark mode)

O executor DEVE executar este checklist antes de declarar a implementação como pronta:

- [ ] `grep -rn "style={{[^}]*'#[0-9a-fA-F]" controle-gastos-frontend/src/components/Relatorio/ controle-gastos-frontend/src/pages/Relatorio/ controle-gastos-frontend/src/components/shared/DataTable.js controle-gastos-frontend/src/components/shared/PeriodQuickFilter.js` → 0 matches (ou só matches com fallback intencional)
- [ ] `grep -rn "style={{[^}]*background" controle-gastos-frontend/src/components/Relatorio/ controle-gastos-frontend/src/pages/Relatorio/` → todos usando `var(--cg-color-*)`
- [ ] Alternar tema light → dark → light sem reload, validar via DevTools:
  - [ ] `getComputedStyle(document.querySelector('.cg-data-table__th')).color` muda
  - [ ] `getComputedStyle(document.querySelector('.cg-data-table__td')).color` muda
  - [ ] `getComputedStyle(document.querySelector('.relatorio-filtros-card')).backgroundColor` muda
  - [ ] `getComputedStyle(document.querySelector('.period-quick-filter__btn--active')).backgroundColor` muda
  - [ ] `getComputedStyle(document.querySelector('.ds-segmented-control__btn--active')).color` muda
- [ ] Smoke test em 2-3 outras páginas (Home, Transações, Empréstimos) — não regrediu dark mode em nenhuma

### Tokens disponíveis (resumo rápido pro executor)

O executor não precisa decorar — esta é uma referência rápida. Pra lista completa, ver `controle-gastos-frontend/src/theme/tokens.css`.

| Token | Light | Dark |
|-------|-------|------|
| `--cg-color-primary` | `#2563EB` | `#60a5fa` |
| `--cg-color-background` | `#FAFAFA` | `#0A0E27` |
| `--cg-color-surface` | `rgba(255,255,255,0.65)` | `rgba(15,23,42,0.55)` |
| `--cg-color-surface-elevated` | `rgba(255,255,255,0.85)` | `rgba(15,23,42,0.75)` |
| `--cg-color-text-primary` | `#09090B` | `#F8FAFC` |
| `--cg-color-text-secondary` | `#3F3F46` | `#CBD5E1` |
| `--cg-color-text-muted` | `#71717A` | `#94A3B8` |
| `--cg-color-border` | `rgba(15,23,42,0.08)` | `rgba(248,250,252,0.08)` |
| `--cg-color-thead-bg` | `#f1f5f9` | `rgba(15,23,42,0.75)` |

### Referências no vault

- ADR-006 (estrutura de tokens) — base
- ADR-007 (tema MUI como fonte de verdade)
- ADR-008 (glassmorphism + gradiente)
- ADR-009 (Tailwind lê dos tokens)
- ADR-011 (gradiente do body via split Emotion+stylis)
- **ADR-012 (cor presa de wrappers) — CRÍTICO**
- `AGENTS.md` raiz do projeto — seção "⚠️ Antes de mexer em cores/tema/dark mode, LEIA ISTO"

---

## 5. Critérios de aceitação

### Funcionais
- [ ] Filtros aparecem em painel glass colapsável
- [ ] Botão "Recolher" no header fecha os filtros; estado persiste em `localStorage`
- [ ] Atalhos de data: 8 atalhos por período (existentes) + 3 botões (Hoje/Ontem/Amanhã)
- [ ] "Tipo de Transação" usa `SegmentedControl` (pill visual)
- [ ] Grid tem header sticky (rolagem mantém colunas visíveis)
- [ ] Clicar no header de uma coluna ordena (server-side via `sortBy`/`sortDir`)
- [ ] Checkbox por linha + checkbox "selecionar todas" no header
- [ ] Quando há linhas selecionadas, `BulkActionBar` aparece com ações (estornar grupo, excluir)
- [ ] Dropdown "Agrupar por" agrupa linhas com header visual de seção (Data/Pessoa/Categoria/Tipo)
- [ ] Paginação usa o componente `Pagination` com numeração

### Não-regressão
- [ ] Endpoint backend não é tocado
- [ ] `useData` (Context) continua alimentando categorias/tags
- [ ] Export PDF/CSV continua funcionando
- [ ] Modal de edição de TX continua funcionando
- [ ] Tela funciona com 50/página (paginação server-side)
- [ ] Modais de estorno/exclusão continuam funcionando

### UX
- [ ] Modo expandido (default): filtros em painel glass, summary à direita, grid abaixo
- [ ] Modo colapsado: filtros em 1 linha (período + tipo + pesquisa + botões), grid abaixo
- [ ] Atalhos visíveis como botões (não dropdown)
- [ ] Header sticky do grid tem sombra sutil pra indicar rolagem
- [ ] Botão de colapso tem `title` (tooltip) explicando o que faz
- [ ] **Dark mode / light mode:** alternar tema (sem reload) muda cor de todos os elementos novos sem exceção (ver checklist seção 4.3)
- [ ] **Nenhuma cor hardcoded** em JSX inline (`style={{ background: '#XXX' }}` ou similar) — usar `var(--cg-color-*)` em todos os lugares
- [ ] Glassmorphism continua funcionando (gradiente do body visível atrás dos cards)

## 6. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar `DataTable` em outras páginas (Home, Transações) | Manter 100% compatibilidade — props novas são opt-in. Quem não passar `selectable`/`stickyHeader`/etc, tem comportamento atual. |
| Quebrar `PeriodQuickFilter` em `Recebimentos` (que já usa) | Manter 100% compatibilidade — prop nova `showDayButtons` (default `false`). |
| Persistência de `localStorage` quebrar em modo privado | Try/catch em volta do `setItem`/`getItem`. Fallback pro default. |
| Grid lento com 50+ linhas agrupadas | Aceitável por ora. Virtualização via `react-window` fica para iteração futura se virar problema. |
| `BulkActionBar` ter ações incompatíveis com seleção | Validar que as ações (estornar grupo, excluir) fazem sentido para todas as linhas selecionadas (mesmo grupo, mesmo status, etc). Documentar limitações. |
| Tema/dark mode quebrar | Usar tokens CSS variable (`var(--cg-color-*)`) em todos os novos estilos. Testar via DevTools antes de finalizar. |
| Over-engineering (YAGNI) | Primeira versão entrega: filtros colapsáveis, atalhos de dia, SegmentedControl, header sticky, ordenação clicável, agrupamento básico, BulkActionBar. Persistência de `localStorage` simples. Sem virtualização, sem filtros inline por coluna. |

## 7. Sequência de implementação (5 passos)

| # | Passo | Arquivos | Validação |
|---|-------|----------|-----------|
| 1 | **Estender `PeriodQuickFilter` + `dateUtils`** com botões Hoje/Ontem/Amanhã | `dateUtils.js`, `PeriodQuickFilter.js` | Atalho renderiza + calcula data corretamente |
| 2 | **Evoluir `DataTable`** com header sticky, ordenação, seleção, agrupamento | `DataTable.js` | Compatibilidade com uso atual mantida; novas props funcionam |
| 3 | **Criar `RelatorioFiltersPanel`** e `RelatorioSummaryPanel` | 2 arquivos novos | Layout organizado; PeriodQuickFilter + SegmentedControl integrados |
| 4 | **Criar `RelatorioResultsPanel`** + refactor do `Relatorio.js` pra usar sub-componentes | 1 arquivo novo + refactor do `Relatorio.js` | Página renderiza; filtros colapsáveis funcionam; agrupamento e ordenação funcionam |
| 5 | **Persistência de `localStorage`** + ajustes finais de tema/dark mode | `useRelatorioFilters.js` + CSS | Recarregar página preserva estado de colapso; dark mode OK |

## 8. Não-objetivos (explicitamente fora desta rodada)

- NÃO migrar para `decimal.js` (decisão consciente do projeto, mantida)
- NÃO mudar backend
- NÃO mexer em outras páginas (Home, Transações) além do necessário para compatibilidade do `DataTable`
- NÃO adicionar virtualização (só se virar problema real de performance)
- NÃO adicionar filtros inline por coluna no grid (complexidade extra, ver depois)
- NÃO adicionar gráficos ou visualizações (relatórios avançados já cobrem)
- NÃO mudar tema/cores além de usar tokens existentes

## 8.1. Funcionalidades futuras (registradas para iteração posterior)

Decisões conscientes de **NÃO** incluir nesta rodada, com critérios claros de **quando** ativar. Servem como ponto de retorno se a Alisson sentir falta.

### Virtualização do grid

- **O que é:** técnica que renderiza só as linhas visíveis na tela (em vez de todas). Browser só mantém ~20 `<div>`s no DOM, reciclando conforme o user rola.
- **Quando ativar:** se a paginação passar de **200 linhas por página** E o user reportar lentidão ao rolar. Hoje a paginação é de 50/página (suficiente). Backend já suporta paginação custom via `?limit=`.
- **Biblioteca candidata:** `react-window` (leve, popular, MIT).
- **Impacto:** refactor do `DataTable` para usar `FixedSizeList` do `react-window`. Adiciona ~1 dependência. Zero impacto na UX quando não está ativado.

### Filtros inline por coluna

- **O que é:** em vez de ter todos os filtros num painel à esquerda, cada coluna do grid teria um ícone 🔽 no header que abre um input de filtro específico (data range pra coluna "Data", valor range pra "Valor", select pra "Pessoa", etc).
- **Quando ativar:** se o user sentir falta de **filtragem rápida por coluna** sem precisar abrir o painel de filtros à esquerda. Exemplo de uso: "quero ver só as TXs do mês passado com valor > R$ 1000".
- **Complexidade:** **significativa**. Cada coluna vira stateful, backend precisa aceitar múltiplos filtros por coluna, podem confundir (filtros em 2 lugares: painel à esquerda + headers da tabela).
- **Cobertura atual:** atalhos de data (Hoje/Ontem/Amanhã/Mês Atual/etc) + campo de pesquisa por texto cobrem **~80%** dos casos de uso. Os 20% restantes são edge cases que valem a pena questionar se precisam de feature ou se a busca por texto resolve.

## 9. Próximo passo

Após aprovação deste design doc:

1. **Delegar ao `newapp-executor`** (via tool `task` quando Alisson pedir explicitamente) com este design doc como brief.
2. Executor aplica os 5 passos em sequência.
3. Executor reporta a cada fase ou pede `question` se travar.
4. Após conclusão, Alisson valida manualmente.

## 10. Referências

- Componentes reutilizáveis: `controle-gastos-frontend/src/components/shared/`
- Página atual: `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js` (1.122 linhas)
- Skill `frontend-design` (carregada no brainstorm)
- Skill `brainstorming` (carregada no brainstorm)
- AGENTS.md: regras de tema/cores (ADRs 006-012)
