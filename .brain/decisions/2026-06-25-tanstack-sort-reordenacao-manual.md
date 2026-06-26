---
type: decision
status: active
created: 2026-06-25
tags: [tanstack-table, sort, performance, react, data-table, bug-fix]
---

# ADR-016: TanStack Table — sort controlado exige reordenação manual quando `data` é prop estável

## Contexto

Em junho/2026, durante a reorganização da página de Relatórios, decidimos usar **TanStack Table v8** (`@tanstack/react-table`) no lugar do `DataTable` custom. O `sort` deveria ser **client-side** (instantâneo, sem chamada de API), com o estado controlado pelo componente pai via props (`sortColumn` + `sortDirection`).

A primeira tentativa foi usar a API padrão do TanStack:

```js
const [sorting, setSorting] = useState([]);

const table = useReactTable({
  data: rows,
  state: { sorting },          // controlled state
  onSortingChange: setSorting, // callback
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

**O sort simplesmente não funcionava.** Clicar no header mudava o ícone de sort (▲/▼) mas as **rows não reordenavam visualmente**. O user reportou o sintoma 3 vezes em 4 sessões de tentativa de fix.

## Diagnóstico (assertivo, com logs)

Adicionamos 4 logs cirúrgicos com prefixo `[DataTable][DIAG2]` mapeando a cadeia completa:

| # | Local | O que revelou |
|---|-------|---------------|
| 1 | `useReactTable` config | `onSort: function`, `sortingState: [1 elemento]` |
| 2 | `handleHeaderClick` | ✅ Chamado, chama `onSort('data')` |
| 3 | `onSortingChange` (callback do TanStack) | ❌ **NUNCA É CHAMADO** quando o pai chama `onSort` diretamente |
| 4 | `onClick` do header | ✅ Disparado ao clicar |

A análise dos logs mostrou:
- ✅ Click chega no header
- ✅ `handleHeaderClick` chama `onSort` (do pai) que atualiza `sortingState`
- ✅ `useReactTable` re-renderiza com novo `sortingState`
- ❌ **`getSortedRowModel` retorna rows na MESMA ORDEM sempre**

Tentamos 3 fixes antes de chegar na causa raiz:
1. `useMemo(() => rows, [rows, sortingState])` para forçar nova referência
2. Adicionar `onSortingChange` callback
3. Verificar tipos de dados

**Nenhum funcionou.** Os logs mostravam que `sortingState` mudava, `useReactTable` re-renderizava, mas `getSortedRowModel` retornava rows na mesma ordem.

## A causa raiz (final, baseada nos logs)

**O `data: rows` passado pro `useReactTable` é a mesma prop do backend, com referência estável.** O TanStack Table v8 tem um sistema interno de **cache do `getSortedRowModel()`** que só recalcula quando:

1. A referência de `data` muda
2. O `state.sorting` muda
3. O `state.columnFilters` muda
4. Outros state slices relevantes

**No nosso caso:**
- `data: rows` é o array do backend, **passado como prop estável** (mesma referência entre renders do componente pai)
- O pai chama `setSortColumn`/`setSortDirection` em vez de atualizar o `data`
- O TanStack **não detecta mudança** porque a referência de `data` é a mesma

**Conclusão:** TanStack sort é **memoizado por referência de data**. Se a referência é estável, o sort não recalcula, mesmo com `sortingState` mudando.

**Detalhe adicional (achado durante a investigação):** o `useMemo(() => rows, [rows, sortingState])` que tentamos como fix **não funciona** porque ele **sempre retorna a mesma referência de `rows`** (a prop original). O React só recria a referência do `useMemo` quando as deps mudam de REFERÊNCIA, mas o **resultado** do useMemo pode ser a mesma referência do input.

## Opções consideradas

### Opção A — Forçar re-criação da referência de `data` no pai (`Relatorio.js`)
**O que fazer:** quando o sort muda, criar um **novo array** de `filteredRows` com as rows reordenadas antes de passar pro `DataTable`.

**Pró:** TanStack sort continua sendo usado.
**Contra:** Mistura lógica de sort no pai (que já tem `handleSortChange` próprio). Acoplamento. Mais código pra manter.

### Opção B — Sort manual dentro do `useMemo` do `tableData`
**O que fazer:** dentro do `DataTable`, o `useMemo` que monta o `data` pro TanStack **faz a reordenação manual** baseado no `sortingState`. O TanStack sort fica como fallback (não é mais necessário, mas não atrapalha).

**Pró:**
- ✅ Lógica de sort fica encapsulada no `DataTable` (single source of truth)
- ✅ Funciona com qualquer prop estável (não precisa o pai se preocupar)
- ✅ Comportamento previsível: `data` é sempre a versão reordenada
- ✅ Não depende do cache do TanStack (que tem bugs conhecidos com refs estáveis)

**Contra:**
- Reimplementa parte do que o TanStack sort já faz (mas TanStack sort é só um wrapper sobre `Array.sort` mesmo)

### Opção C — Trocar TanStack Table por outra lib
**Rejeitada.** Trocar de lib por causa de um bug de cache seria over-engineering. TanStack Table v8 é a melhor opção do mercado para tabelas headless em React, e a maioria dos bugs são documentados e contornáveis.

### Opção D — Adicionar `autoResetAll: false` e forçar reset manual via key
**Rejeitada.** O TanStack v8 tem o sistema `autoResetAll` que reseta o sort quando `data` muda. Mas como `data` não muda (mesma referência), o reset não dispara. Forçar via `key` prop seria hack.

## Decisão

**Opção B: sort manual dentro do `useMemo` do `tableData`.**

**Implementação:**

```js
const tableData = useMemo(() => {
  if (!sortingState || sortingState.length === 0) {
    return rows; // sem sort, retorna original
  }

  const { id: sortCol, desc } = sortingState[0];
  const sortDir = desc ? 'desc' : 'asc';

  return [...rows].sort((a, b) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];

    // nulls vão pro final
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      // Strings: localeCompare pt-BR (ignora acentos, case-insensitive)
      comparison = aVal.localeCompare(bVal, 'pt-BR', { sensitivity: 'base' });
    } else if (aVal instanceof Date || bVal instanceof Date) {
      comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
    } else {
      comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }

    return sortDir === 'desc' ? -comparison : comparison;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [rows, sortingState]);
```

**Suporta:** strings (com `localeCompare` pt-BR), numbers, Dates, ISO date strings (ordenação lexicográfica = cronológica), nulls (vão pro final).

## Consequências

### Pró
- ✅ Sort funciona consistentemente, independente da referência de `data`
- ✅ Lógica de sort encapsulada no `DataTable` (pai não precisa se preocupar)
- ✅ Comportamento previsível e debugável
- ✅ TanStack sort fica como fallback (não atrapalha)

### Contra
- Reimplementa `Array.sort` (que TanStack já faz), mas a lógica é genérica o suficiente
- Mantém o `// eslint-disable-next-line react-hooks/exhaustive-deps` (linha-deps warning proposital)

### Impacto em outras áreas
- **Outras páginas que usam `DataTable`** (`/transacoes`, `/detalhes-importacao/:id`): sort agora funciona **consistentemente** em todas elas. **Efeito colateral positivo** — não precisaram de fix específico.

## Lição aprendida (a mais importante)

**TanStack Table v8 memoiza o `getSortedRowModel` por REFERÊNCIA de `data`.** Se a prop `data` tem a mesma referência entre renders (caso comum quando vem de um `useState` no pai que só atualiza em filtros, não em sorts), o sort **não recalcula**.

**Sintomas típicos (pra reconhecer esse bug no futuro):**
- Click no header muda o ícone de sort (▲/▼) mas rows não reordenam
- `state.sorting` atualiza corretamente (verificável via log)
- `useReactTable` re-renderiza (verificável via log)
- `getSortedRowModel` retorna rows na mesma ordem (verificável via log)

**Diagnóstico assertivo:** adicionar 4-5 logs com prefixo único (ex: `[DataTable][DIAG2]`) em pontos-chave da cadeia de sort. O **primeiro log que PARAR de aparecer** aponta onde a cadeia quebra.

## Como evitar esse bug no futuro

**3 regras ao usar TanStack Table v8:**

1. **Se a prop `data` é uma prop estável** (vem de um `useState` do pai que só atualiza em outras condições): fazer a reordenação manual no `useMemo` do `data` antes de passar pro TanStack.

2. **OU**: garantir que a prop `data` é sempre **uma nova referência** quando o sort muda. Isso pode ser feito com `useMemo(() => [...data], [data, sortingState])` no pai — mas **só funciona se a prop original muda de referência**, não se ela é sempre a mesma.

3. **OU**: usar `key` prop no `DataTable` que muda a cada sort (`<DataTable key={`${data.length}-${sortColumn}-${sortDirection}`} />`). Isso força o React a recriar o componente inteiro, perdendo o cache do TanStack. **Solução hack, mas funciona.**

**Recomendação:** seguir a Regra 1 (sort manual no `useMemo` do `data`). É a mais limpa e encapsula a lógica no `DataTable`.

## Relacionado

- ADR-015 (Empréstimo: 2 caminhos) — contexto do mesmo período de mudanças
- ADR-014 (Valor esperado por Transação) — contexto do mesmo período
- ADR-013 (Empréstimo sem FIFO) — primeira refatoração grande do módulo de Empréstimos
- ADR-006-012 (Tema, dark mode, glassmorphism) — regras de UI que continuam valendo
- Sessão: `2026-06-25-relatorio-pos-execucao-consolidada.md` — registro da sessão que culminou neste ADR
- Playbook: `debug-tanstack-table-sort.md` — como debugar esse tipo de bug no futuro
- Doc oficial TanStack Table: https://tanstack.com/table/latest/docs/guide/sorting
- Stack: `context/stack.md`
