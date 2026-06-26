---
type: playbook
status: active
created: 2026-06-25
tags: [debug, tanstack-table, sort, react, frontend, troubleshooting]
---

# Como debugar bug de sort no TanStack Table v8

> **Lição aprendida em 2026-06-25:** TanStack Table v8 memoiza o `getSortedRowModel()` por REFERÊNCIA de `data`. Se a prop `data` é estável (mesma referência entre renders), o sort não recalcula, mesmo com `state.sorting` mudando. Esse bug é **traiçoeiro** porque o ícone de sort muda (▲/▼) mas as rows não reordenam visualmente. Levou 3 sessões de tentativa de fix até ser diagnosticado com logs assertivos.

## Sintomas clássicos (pra reconhecer o bug)

O user reporta um ou mais desses:
- "Cliquei no header e nada acontece"
- "O ícone do sort muda mas a tabela fica na mesma ordem"
- "O sort funciona quando recarrego a página mas não quando clico no header"
- "O sort funciona na primeira vez mas para de funcionar depois"
- "Console não mostra nenhum erro, mas a tabela não reordena"

Se você está debugando sort que "parece funcionar mas não reordena", este playbook é pra você.

## Diagnóstico assertivo (4-5 logs cirúrgicos)

**Não tente adivinhar a causa. Coloque logs com prefixo único** (ex: `[DataTable][DIAG2]`) em **pontos-chave da cadeia de sort** e peça pro user testar.

### Os 5 pontos de log (no componente que usa `useReactTable`)

```js
// LOG 1: Antes do useReactTable — mostra a config que está sendo passada
console.log('[DataTable][DIAG2] useReactTable CONFIG:', {
  hasOnSort: typeof onSort,
  hasManualSorting: false,  // ou true, dependendo da config
  hasSortInState: Array.isArray(sortingState) && sortingState.length > 0,
  sortingState,
  columnsCount: tanstackColumns.length
});

const table = useReactTable({ /* ... */ });

// LOG 2: handleHeaderClick (chamado quando user clica no header)
const handleHeaderClick = (col) => {
  console.log('[DataTable][DIAG2] handleHeaderClick CHAMADO. col:', col, '| onSort type:', typeof onSort, '| canSort:', !!onSort && col.key !== '__select');
  if (onSort && col.key !== '__select') {
    console.log('[DataTable][DIAG2] handleHeaderClick → chamando onSort com:', col.key);
    onSort(col.key);
  }
};

// LOG 3: onSortingChange (callback do TanStack) — esse é o PONTO-CHAVE
onSortingChange: (updaterOrValue) => {
  console.log('[DataTable][DIAG2] onSortingChange CHAMADO! updaterOrValue:', updaterOrValue, '| type:', typeof updaterOrValue, '| sortingState:', sortingState, '| onSort type:', typeof onSort);
  // ...
}

// LOG 4: onClick do <div> do header (evento DOM)
<div
  onClick={(e) => {
    console.log('[DataTable][DIAG2] HEADER onClick. colDef:', colDef, '| canSort:', canSort);
    if (canSort) handleHeaderClick(colDef);
  }}
  ...
>

// LOG 5: sortedRows (resultado final do sort)
const sortedRows = useMemo(() => {
  const result = table.getRowModel().rows.map((tr) => tr.original);
  console.log('[DataTable][DIAG2] sortedRows RECALCULOU. length:', result.length, '| first 3 datas:', result.slice(0, 3).map(r => r.data));
  return result;
}, [table.getRowModel().rows, rows, sortingState]);
```

### Como ler o resultado

**A cadeia completa é:** 4 (DOM click) → 2 (handleHeaderClick) → 3 (onSortingChange) → pai atualiza state → 1 (CONFIG re-log) → 5 (sortedRows)

**O primeiro log que PARAR de aparecer** aponta EXATAMENTE onde a cadeia quebra:

| Se aparecer até... | Significa que... | Próximo fix |
|--------------------|------------------|-------------|
| Log 4 (DOM click) | Problema é no render/condição que faz o header não ser clicável | Verificar `canSort`, `enableSorting` na config da coluna |
| Log 2 (handleHeaderClick) mas não 3 (onSortingChange) | `onSort` (passado pelo pai) é undefined ou não é função | Verificar a cadeia de props `onSort` até o componente |
| Log 3 (onSortingChange) mas pai não atualiza | `onSort` callback crasha silenciosamente | Adicionar try/catch + log dentro do `onSort` |
| Tudo até log 3 mas pai não propaga | Problema no `handleSortChange` do pai | Verificar a função que o pai passa pro `onSort` |
| Tudo mas log 5 mostra rows na MESMA ordem | **TanStack cache** (ver ADR-016) | **Reordenação manual no useMemo do `data`** |
| Tudo mas log 5 mostra rows em ordem diferente | Sort funciona, mas outro lugar reverte | Procurar quem renderiza a prop errada |

### Como pedir pro user testar

Dá pro user um passo-a-passo simples:

1. Recarrega a página (`Ctrl+Shift+R`)
2. Limpa o console (`Ctrl+L`)
3. Aplica um filtro
4. Clica no header 1x
5. Copia TUDO que apareceu com o prefixo
6. Clica no header de novo
7. Copia TUDO de novo
8. Cola os 2 grupos aqui

**Não tente interpretar você mesmo** antes de receber os logs. Os logs vão dizer exatamente onde a cadeia quebra, sem achismo.

## Soluções comuns (baseadas no ponto onde a cadeia quebra)

### Quebra no log 4 (DOM click não dispara)

```js
// Verificar se o <th> ou <div> do header tem onClick condicional
<div
  onClick={canSort ? () => handleHeaderClick(colDef) : undefined}
  ...
>

// canSort pode ser false por:
// 1. onSort undefined (pai não passou)
// 2. col.key === '__select' (coluna de seleção, sempre não-sortable)
// 3. enableSorting: false na config da coluna
```

**Fix:** garantir que `onSort` é uma função válida E que a coluna tem `enableSorting: true`.

### Quebra no log 2 (handleHeaderClick chamado mas onSort undefined)

```js
// Verificar a cadeia de props:
// Pai passa onSortChange={handleSortChange} pro DataTable?
// DataTable tem prop onSort que recebe onSortChange?
// onSortingChange chama onSort(...)?
```

**Fix:** garantir que `onSort` é uma função que recebe `(column, direction)` ou `(column)`.

### Quebra no log 3 (onSortingChange não é chamado)

**Isso indica que o TanStack sort está em modo "controlled" mas o `onSortingChange` não é chamado pelo TanStack.** Pode ser:
1. O `state.sorting` está sendo passado de forma errada (não é um array de `{id, desc}`)
2. O `manualSorting: false` está mal configurado

**Fix:** verificar a forma de `sortingState` (deve ser `[{id: 'col', desc: true/false}]`).

### Tudo OK mas log 5 mostra rows na MESMA ordem (CASO MAIS COMUM)

**Causa:** TanStack memoiza `getSortedRowModel` por REFERÊNCIA de `data`. Se a prop `data` é estável (mesma referência entre renders), o sort não recalcula.

**Fix:** ver [ADR-016](.brain/decisions/2026-06-25-tanstack-sort-reordenacao-manual.md) — fazer reordenação manual no `useMemo` do `data`.

```js
const tableData = useMemo(() => {
  if (!sortingState || sortingState.length === 0) return rows;
  
  const { id: sortCol, desc } = sortingState[0];
  const sortDir = desc ? 'desc' : 'asc';
  
  return [...rows].sort((a, b) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal, 'pt-BR', { sensitivity: 'base' });
    } else if (aVal instanceof Date || bVal instanceof Date) {
      comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
    } else {
      comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
    
    return sortDir === 'desc' ? -comparison : comparison;
  });
}, [rows, sortingState]);
```

## Anti-padrão: NÃO tentar adivinhar

**O erro que cometemos 3 vezes** nesta sessão:
- Tentamos fix 1: `useMemo(() => rows, [rows, sortingState])` — não funcionou (retornava mesma referência)
- Tentamos fix 2: adicionar `onSortingChange` callback — não funcionou (TanStack chamava mas pai sobrescrevia)
- Tentamos fix 3: usar `getRowModel().rows` no render — não funcionou (cache não invalidava)

**A lição:** SEMPRE adicione logs primeiro. Os logs vão dizer onde a cadeia quebra em 30 segundos. Tentar 3 fixes diferentes sem dados concretos é desperdício de tempo.

## Validação após fix

1. ✅ User clica no header → rows reordenam visivelmente
2. ✅ Ícone de sort (▲/▼) acompanha a direção
3. ✅ Console limpo (sem warnings de keys, sem logs de diag)
4. ✅ Sort funciona em outras colunas (não só na "Data")
5. ✅ Smoke test em outras páginas que usam o mesmo `DataTable` (ex: `/transacoes`)

## Remoção dos logs de diagnóstico

**APÓS validação positiva do user:**

```bash
# Procurar todos os console.log com o prefixo único
grep -rn "console.log.*\[DataTable\]\[DIAG" src/
# Remover cada um
```

**Não deixe os logs de diagnóstico no código de produção.** Eles poluem o console e adicionam overhead.

## Referências

- ADR-016: Reordenação manual no TanStack Table — a decisão que resolve o bug
- Sessão: `2026-06-25-relatorio-pos-execucao-consolidada.md` — registro da sessão
- Doc oficial TanStack Table: https://tanstack.com/table/latest/docs/guide/sorting
- Stack: `context/stack.md`
