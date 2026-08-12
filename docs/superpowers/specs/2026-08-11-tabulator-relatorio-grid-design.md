# Adoção do Tabulator.js no grid de Relatórios — Design

Status: aprovado em 2026-08-11 — pronto para writing-plans.

## Contexto e motivação

Alisson trouxe pra esta sessão a pasta de documentos `.brain/` de outro projeto (hub-acom), onde o Tabulator.js já foi adotado como grid do "Modo Avançado" do Colibri Itens. A intenção é reaproveitar esse conhecimento prático (decisões, gotchas, armadilhas reais da lib) pra adotar o Tabulator no newApp também, começando pela rota `/relatorios` como piloto ("cobaia"). Depois de validado ali, a intenção declarada é levar o mesmo componente pra outras rotas — a próxima cotada é a de importação em massa — mas isso fica fora do escopo desta rodada.

## Investigação prévia (estado atual)

### Documentação de referência (hub-acom)

Levantada em `C:\PROJETOS\hub-acom\.brain\context\tabulator-colibri-avancado-guia.md`, `C:\PROJETOS\hub-acom\.brain\context\data-grid-componente.md`, `C:\PROJETOS\hub-acom\.brain\context\colibri-itens-pendencias.md`, e as sessões `2026-08-04-colibri-avancado-tabulator-design.md`, `-execucao.md`, `-ux-refinamentos.md`. Principais decisões e gotchas reaproveitados nesta spec:

- Pacote: `tabulator-tables` (motor puro), não `react-tabulator` (wrapper React sem release há ~2 anos).
- Instanciação da tabela adiada via `requestAnimationFrame` + flag de cancelamento — necessário porque o Tabulator quebra sob React Strict Mode em dev (`offsetWidth`/`el is null`).
- Sincronização de dados via `useEffect([rows]) → table.replaceData(rows)`, nunca `reactiveData: true` (feito pra Vue, assume mutação in-place — quebra a garantia de imutabilidade que o React assume).
- Handle imperativo (`gridRef.current`) como ponte entre a tabela e a página, em vez da página acessar a instância do Tabulator diretamente.
- Tema padrão do Tabulator cobre só ~4 seletores (fundo/header/linha/seleção) — todo o resto (filtros, popups/menus, paginação, agrupamento) precisa de CSS explícito ou fica ilegível em dark mode.
- Gotchas reais da API de filtro de cabeçalho (`headerFilter: 'list'` + `multiselect`): compara contra o dado bruto da célula (não o texto formatado); precisa de `headerFilterFunc: 'in'` explícito; só aplica no blur, não por clique em cada opção.
- `titleFormatterParams: { rowRange: 'active' }` necessário pro checkbox "selecionar todos" respeitar o filtro ativo (sem isso, seleciona todas as linhas da tabela, ignorando filtro).

### Estado atual do grid de Relatórios (newApp)

- `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js`: página orquestradora — fetch server-side paginado (`obterTransacoesPaginadas`, `PAGE_SIZE=50`), filtros num hook (`useRelatorioFilters`), export CSV/PDF, modal de edição (`ModalTransacao`+`NovaTransacaoForm`).
- `controle-gastos-frontend/src/components/Relatorio/RelatorioResultsPanel.js`: painel de resultados — toolbar (busca/agrupar), `BulkActionBar` condicional, `DataTable`, `EmptyState`, `Pagination`.
- `controle-gastos-frontend/src/components/shared/DataTable.js`: componente de tabela **headless próprio, construído sobre `@tanstack/react-table`** — sort clicável (client-side, só dentro da página atual — não é full-dataset), seleção via `Set` controlado pelo pai, agrupamento custom, resize de coluna persistido em `localStorage`, footer de soma condicional, variant `glass`. Também usado em Contas Fixas — **não é exclusivo do Relatório**.
- `controle-gastos-frontend/src/index.js`: confirma `<React.StrictMode>` ativo — o gotcha de timing do hub-acom se aplica aqui também.
- `controle-gastos-frontend/package.json`: React 19, projeto **JS puro** (sem TypeScript), CRACO+Tailwind+MUI. `@tanstack/react-table` já é dependência (usada só pelo `DataTable.js`).

## Decisões validadas com o usuário

- **Escopo:** Tabulator entra só na rota `/relatorios`. `DataTable.js` **não é alterado** — continua servindo Contas Fixas sem mudança nenhuma. Os dois componentes de grid coexistem no app.
- **Paginação:** mantém o padrão server-side atual (50/página, fetch por página controlado por `Relatorio.js`, `Pagination` component fora do grid). Paginação nativa do Tabulator fica desligada (`pagination: false`); o grid só exibe as linhas que recebe via `replaceData()`.
- **Edição:** nenhuma edição inline na célula nesta rodada — mantém o padrão atual (clique em "Editar" abre `ModalTransacao`/`NovaTransacaoForm`). Isso elimina a parte mais arriscada da integração (editor de célula custom via `createRoot`), que o hub-acom precisou pra um combobox interativo — não é o caso aqui.
- **Filtros de cabeçalho:** dado que o refino no grid é sobre os dados já carregados na página (não redundante com o painel de filtros externo — decisão explícita: "os filtros no grid são um refino desejável", mesmo que a informação já seja filtrável na tela cheia), todas as colunas de dado ganham filtro de cabeçalho nesta rodada (ver seção Colunas).
- **Seleção:** listener em `rowSelectionChanged` do Tabulator atualiza o `Set` de `selectedIds` no React a cada mudança — `BulkActionBar` continua em tempo real, sem mudar contrato com `RelatorioResultsPanel`.
- **Bundle:** `TabulatorFull` (import completo, todos os módulos) — simplicidade sobre otimização de bundle nesta primeira adoção. Import seletivo fica como possível trabalho futuro, não pendência bloqueante.
- **Formatters de célula:** DOM puro (`document.createElement`), sem montar componentes React via `createRoot` — paradigma nativo do Tabulator, mais leve, adequado porque as células desta rodada são só exibição + clique (sem estado interno).
- **Tema dark mode:** cobertura completa desde o início (não incremental) — arquivo de tema dedicado cobrindo cabeçalho, filtros, popups/menus, paginação, agrupamento, tudo via `var(--cg-color-XXX)`. Evita o padrão de bug sutil de tema já documentado no histórico do projeto (ADRs 006–012 em `AGENTS.md`).
- **Rodapé de soma:** removido do grid (não replica `showFooter` do `DataTable` atual) — `RelatorioSummaryPanel` já mostra o total geral vindo do backend (todos os registros filtrados, não só a página); manter os dois criaria dois números de "total" diferentes na tela ao mesmo tempo.

## Arquitetura

Novo componente `TabulatorRelatorioGrid`, em `controle-gastos-frontend/src/components/Relatorio/tabulator/`:

| Arquivo | Responsabilidade |
|---|---|
| `tabulator/TabulatorRelatorioGrid.js` | Componente principal — instancia o Tabulator (via `requestAnimationFrame` adiado), define colunas/formatters/filtros, sincroniza dados via `replaceData()`, expõe handle imperativo via `gridRef` |
| `tabulator/formatters.js` | Funções formatter em DOM puro: descrição+badge de empréstimo, chips de tags, coluna de ações (Editar/Excluir) |
| `tabulator/tabulator-theme.css` | Tema completo ligado a `var(--cg-color-XXX)` |

`RelatorioResultsPanel.js` passa a renderizar `<TabulatorRelatorioGrid />` no lugar do `<DataTable />` atual, recebendo as mesmas props que já chegam do pai (`rows`, `selectedIds`, `setSelectedIds`, `groupBy`, `setGroupBy`, `onEdit`, `onDelete`) — a troca fica encapsulada dentro do painel; `Relatorio.js` não muda.

Handle imperativo exposto via `gridRef.current`:
```js
{ setGroupBy, getSelectedData, capturarEstadoFiltro, aplicarEstadoFiltro }
```
Os dois últimos (`capturarEstadoFiltro`/`aplicarEstadoFiltro`) ficam disponíveis para uso futuro (ex. eventual "visões salvas"), mas não são consumidos nesta rodada — não implementar UI pra eles agora.

## Colunas e filtros de cabeçalho

| Coluna | Filtro de cabeçalho | Lógica |
|---|---|---|
| `descricao` | Texto livre ("contém") | `like` |
| `data` | Dropdown checkbox (datas distintas presentes na página) | `headerFilterFunc: 'in'` |
| `pessoa` | Dropdown checkbox (`headerFilter: 'list'`, `multiselect`) | `headerFilterFunc: 'in'` |
| `valorPagamento` | Texto livre (igualdade/"começa com") | comparação simples |
| `tipo` | Dropdown checkbox | `headerFilterFunc: 'in'` |
| `tags` | Dropdown checkbox (tags achatadas a partir de `tagsPagamento`) | função customizada — **OR**: bate se a linha tiver qualquer uma das tags marcadas |
| `acoes` | — (não filtrável) | — |

Para `pessoa`/`tipo`/`data`, `valuesLookup` é passado como **função** retornando pares `{label, value}` já formatados — necessário porque o filtro do Tabulator compara contra o dado bruto da célula, nunca o texto exibido (gotcha documentado no hub-acom). Para `tags`, como o dado bruto da célula é um objeto (`tagsPagamento`, chaveado por categoria), o filtro usa `headerFilterFunc` customizado (não o `'in'` pronto) que extrai os IDs de tag da linha e testa interseção com o array de valores marcados no dropdown.

Dropdown multiselect precisa do rodapé "Aplicar"/"Limpar" injetado via `MutationObserver` (mesmo padrão do hub-acom) — o Tabulator só resolve o filtro multiselect no blur, não por clique em cada opção, e não existe flag de configuração pra mudar isso.

## Seleção, agrupamento e ações

**Seleção:** `selectableRows: true`. Listener em `rowSelectionChanged` chama `setSelectedIds(new Set(table.getSelectedData().map(r => r.id)))` a cada mudança. Checkbox "selecionar todos" usa `titleFormatterParams: { rowRange: 'active' }` pra respeitar o filtro ativo (incluindo os novos filtros de coluna).

**Agrupamento:** o `<select>` "Agrupar por" que já existe na toolbar de `RelatorioResultsPanel` continua como está — só passa a chamar `gridRef.current.setGroupBy([campo])` (ou `[]` pra limpar) em vez de props pro `DataTable`. Cabeçalho de grupo mantém o mesmo texto/formatação que `renderGroupHeader` já produz hoje (contagem, data em pt-BR, labels de tipo).

**Ações:** coluna `acoes` com formatter DOM puro criando os botões Editar/Excluir, delegando pros mesmos `onEdit`/`onDelete` já recebidos como prop — comportamento idêntico ao atual (abre modal / SweetAlert2 de estorno), zero mudança de lógica de negócio.

## Tema dark mode

`tabulator-theme.css` cobre, todos via `var(--cg-color-XXX)` (nunca cor hardcoded):
- Cabeçalho de coluna + ícones de ordenação/filtro
- Popups de filtro (dropdown checkbox, incluindo o rodapé "Aplicar"/"Limpar" injetado via `MutationObserver`)
- Linhas (normal, hover, selecionada, agrupada)
- Cabeçalho de grupo

Validação: alternar o toggle de tema em ambos os modos e conferir via `getComputedStyle()` sem reload de página — regra já estabelecida no `CLAUDE.md` do projeto pra qualquer trabalho de cor.

## Tratamento de erros

Nenhuma mudança de contrato de erro: `fetchData` em `Relatorio.js` já trata erro de rede (toast + `errorTransactions`) antes dos dados chegarem no grid. Pontos novos de falha, específicos do grid:
- Falha de timing na construção da tabela (StrictMode) → mitigado pelo `requestAnimationFrame` + flag de cancelamento.
- Dataset vazio → `TabulatorRelatorioGrid` só é montado quando `rows.length > 0`; `RelatorioResultsPanel` continua decidindo entre grid e `EmptyState` como já faz hoje — nenhuma mudança nesse fluxo.

## Fora de escopo (registrado para não ser redecidido)

- Migrar `DataTable.js` ou Contas Fixas para Tabulator.
- Levar o Tabulator pra rota de importação em massa (próximo passo cotado, mas não desta rodada).
- Edição inline na célula.
- "Visões salvas" (filtro nomeado persistido) — o handle imperativo já expõe os métodos necessários, mas a feature em si não é implementada agora.
- Import seletivo de módulos do Tabulator (otimização de bundle).
- Rodapé de soma no grid.

## Teste manual esperado (pós-implementação)

Mudança visível/clicável — smoke test guiado ao final, cobrindo: grid renderizando as linhas da página atual, filtros de cabeçalho por coluna (texto livre e dropdown multiselect), seleção de linha + `BulkActionBar`, agrupar por cada opção do select, ações Editar/Excluir, alternância de tema claro/escuro. Não é necessário rodar `npm test` (mudança não toca `ledgerService`/`netWorthService`).
