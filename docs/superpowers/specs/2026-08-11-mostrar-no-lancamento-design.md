# Reduzir Tags/Categorias no Lançamento — Design

Status: aprovado em 2026-08-11 — pronto para writing-plans.

## Contexto e motivação

O usuário quer diminuir a quantidade de tags/categorias exibidas nas telas onde se escolhe uma tag para lançar uma transação nova (ex: uma tag "Fatura Cartão Abril 2025" que ele nunca mais vai usar para lançar algo novo) — **sem perder o dado** e **sem afetar os filtros de relatório**, que precisam continuar mostrando todas as tags/categorias ativas para permitir consultar o histórico.

Isso é um eixo diferente do ciclo ativo/inativo já existente ([ADR-020](../../.brain/decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md)): `ativo:false` é soft-delete completo, esconde de tudo, inclusive relatórios. O que se quer aqui é um novo flag, ortogonal: a tag continua ativa e visível em relatórios, mas oculta especificamente nas telas de lançamento.

## Decisões validadas com o usuário

- **Curadoria manual**, sem automação por uso/idade — o usuário marca item por item, mesmo padrão de UX que já existe para `Tag.mostrarNoDashboard`.
- **Existe em Tag e em Categoria** — ocultar uma categoria esconde o grupo inteiro (categoria + todas as tags dela) do lançamento, independente do flag individual de cada tag.
- **Módulo de Recebimentos conta como lançamento** (respeita a ocultação) — porque a tag escolhida ali é aplicada a transações futuras na conciliação, mesma lógica de "lançar algo novo".
- **Ao editar uma transação com tag/categoria oculta:** ela continua pré-selecionada (nunca perde dado), mas o seletor não permite adicionar *outras* tags/categorias ocultas naquela edição — mesma lista reduzida do lançamento novo. Para usar uma tag oculta de novo, o caminho é reativar sua visibilidade em `/tags`.

## Levantamento de onde tags/categorias são escolhidas hoje (frontend)

Feito por grep em `controle-gastos-frontend/src`, cruzando usos do componente compartilhado `TagSelector.js` e pickers avulsos (`react-select` direto):

### Telas de "lançamento" (precisam respeitar a ocultação)

- `components/Transaction/TabPagamentos.js` — form principal de nova transação, via `TagSelector.js`.
- `components/Transaction/EditarTransacaoItem.js` — edição de transação, via `TagSelector.js`.
- `pages/ContasFixas/ContaFixaFormModal.js` — conta fixa recorrente, via `TagSelector.js`.
- `pages/Recebimentos/components/TabConfiguracao.js` — configura a tag aplicada/removida numa regra de conciliação; picker próprio (`react-select` direto, não usa `TagSelector.js`).
- `components/Recebimentos/ConfiguracaoRecebimentosModal.js` — mesma natureza, picker próprio.

### Telas de "filtro" ou exibição (NÃO mudam — continuam mostrando tudo que é ativo)

- `components/Relatorio/RelatorioFiltersPanel.js` — filtro de relatório, componente próprio, não usa `TagSelector.js`.
- `components/Transaction/TransactionCard.js` — exibição read-only de tags já lançadas.
- `pages/Recebimentos/components/TabResumo.js`, `pages/Recebimentos/components/TabSelecao.js` — exibição read-only (`TagBadge`), não têm picker.

## Modelo de dados

Novo campo em ambos os schemas, mesmo padrão de `Tag.mostrarNoDashboard`:

```js
// backend/src/models/tag.js e backend/src/models/categoria.js
mostrarNoLancamento: { type: Boolean, default: true }
```

Sem necessidade de migration: o Mongoose aplica o valor default na hidratação de documentos existentes que não têm o campo persistido — não precisa de um script de backfill.

## Regra de visibilidade combinada

| `ativo` | `mostrarNoLancamento` | Aparece no lançamento? | Aparece em relatório/filtro? |
|---|---|---|---|
| `false` | (irrelevante) | Não | Não (comportamento já existente) |
| `true` | `true` (default) | Sim | Sim |
| `true` | `false` | Não | Sim |

Categoria oculta (`mostrarNoLancamento:false`) esconde o grupo inteiro — a categoria e todas as suas tags — das telas de lançamento, mesmo que alguma tag individual tenha `mostrarNoLancamento:true`. Isso evita a inconsistência de mostrar tags "soltas" sem a categoria visível agrupando-as.

## Backend — mudanças

- `models/tag.js`, `models/categoria.js`: adicionar o campo `mostrarNoLancamento` conforme acima.
- `controladorTag.js` (`criarTag`, `atualizarTag`) e `controladorCategoria.js` (`criarCategoria`, `atualizarCategoria`): ler/persistir `req.body.mostrarNoLancamento` quando enviado, mesmo padrão que já existe para `mostrarNoDashboard` em `criarTag`/`atualizarTag`.
- **Sem mudança nos endpoints de listagem** (`obterTodasTags`, `obterTodasCategorias`) — o filtro de exibição no lançamento é uma decisão de UI, não de quais documentos existem; o backend continua devolvendo todos os itens ativos, e o frontend decide o que exibir em cada tela.

## Frontend — mudanças

### Utilitário compartilhado

Novo arquivo `controle-gastos-frontend/src/utils/tagVisibility.js`, com duas funções puras reusadas nos 3 pontos de código que precisam filtrar:

```js
/**
 * Filtra categorias para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false, mais qualquer categoria cujo id esteja
 * em `categoriasJaSelecionadas` (edição não perde a categoria já em uso,
 * mesmo que tenha sido ocultada depois).
 */
export function filtrarCategoriasParaLancamento(categorias, categoriasJaSelecionadas = []) {
  const selecionadasSet = new Set(categoriasJaSelecionadas.map(String));
  return (categorias || []).filter(
    cat => cat.mostrarNoLancamento !== false || selecionadasSet.has(String(cat._id))
  );
}

/**
 * Filtra tags para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false E cuja categoria também está visível
 * (via `categoriasVisiveis`, já filtradas), mais qualquer tag cujo id
 * esteja em `tagsJaSelecionadas`.
 */
export function filtrarTagsParaLancamento(tags, categoriasVisiveis, tagsJaSelecionadas = []) {
  const categoriasVisiveisSet = new Set((categoriasVisiveis || []).map(c => String(c._id)));
  const selecionadasSet = new Set(tagsJaSelecionadas.map(String));
  return (tags || []).filter(tag => {
    if (selecionadasSet.has(String(tag._id))) return true;
    if (tag.mostrarNoLancamento === false) return false;
    return categoriasVisiveisSet.has(String(tag.categoria));
  });
}
```

### `TagSelector.js`

Aplica os dois filtros acima sobre `categorias`/`allTags` recebidos via props, antes de montar `optionsByCategory`. `tagsJaSelecionadas`/`categoriasJaSelecionadas` são derivadas do próprio `paymentTags` recebido (todas as chaves = categorias já em uso; todos os valores = tags já em uso) — não precisa de prop nova, o componente já tem essa informação.

### `TabConfiguracao.js` e `ConfiguracaoRecebimentosModal.js`

Aplicam `filtrarTagsParaLancamento` sobre a lista de `tags` antes de montar `options` do `react-select`, passando a tag atualmente selecionada (se houver) como já-selecionada — mesma regra de não perder o que já estava configurado.

### `TagManagement.js`

Novo checkbox "Mostrar no lançamento" nos formulários de criar/editar Tag (ao lado do "Mostrar no Dashboard" já existente) e nos formulários de criar/editar Categoria (novo — Categoria hoje não tem nenhum checkbox). Estado local (`novoTagMostrarNoLancamento`, `editTagMostrarNoLancamento`, `novoCatMostrarNoLancamento`, `editCatMostrarNoLancamento`) espelhando o padrão já usado para `mostrarNoDashboard`.

### `api.js`

`criarTag`/`atualizarTag`/`criarCategoria`/`atualizarCategoria` já enviam o corpo da requisição como um objeto repassado — não precisam de mudança de assinatura, só os componentes que os chamam passam a incluir `mostrarNoLancamento` no payload.

## Fora de escopo

- Nenhuma mudança em `RelatorioFiltersPanel.js`, `TransactionCard.js`, ou telas somente-leitura de Recebimentos — todas continuam mostrando qualquer tag/categoria ativa, independente de `mostrarNoLancamento`.
- Nenhuma automação por uso/idade — puramente curadoria manual, conforme decidido.
- Nenhum "escape hatch" (ex: link "mostrar tudo") dentro do seletor de lançamento para uma transação **nova** — se precisar usar uma tag oculta ocasionalmente, o caminho é reativar a visibilidade dela em `/tags` antes de lançar.
