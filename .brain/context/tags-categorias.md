---
type: context
status: active
created: 2026-08-11
tags: [tags, categorias, pagamentos, regras-de-negocio]
related:
  - .brain/decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md
  - .brain/decisions/2026-08-11-mostrar-no-lancamento.md
---

# Tags e Categorias — regras de negócio

> Fonte da verdade sobre como Tag/Categoria funcionam hoje. Atualize aqui quando a regra mudar, e crie um ADR explicando o porquê.

## Modelo de dados

- `Categoria` (`backend/src/models/categoria.js`): `nome`, `descricao`, `cor`, `icone`, `ativo` (boolean, default `true`).
- `Tag` (`backend/src/models/tag.js`): mesmos campos + `categoria` — **string** com o `_id` da categoria (não é `ObjectId` ref do Mongoose), + `mostrarNoDashboard`, `mostrarNoLancamento`.
- `Categoria` também tem `mostrarNoLancamento` (boolean, default `true`).
- Uma tag é usada num pagamento através de `Transacao.pagamentos[].tags`, um objeto livre (`type: Object` no schema, não estruturado): `{ [categoriaId: string]: [tagId: string, ...] }`. Ou seja, cada pagamento pode ter várias tags por categoria.

## Ciclo ativo/inativo

Ver [ADR-020](../decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md) para o histórico da decisão. Resumo do comportamento atual:

- **Exclusão é condicional:** sem nenhum vínculo (nenhuma transação/pagamento usando a tag; para categoria, nenhuma tag cadastrada nela e nenhuma transação vinculada) → hard delete de fato. Com vínculo → soft-delete (`ativo:false`), recuperável.
- **Verificação de vínculo** é feita via aggregation em `backend/src/services/vinculoTagCategoriaService.js` (`tagEstaVinculada`, `categoriaEstaVinculada`), usando `$objectToArray` sobre `pagamentos.tags` porque o campo não é diretamente indexável.
- **Cascata categoria → tags:** inativar uma categoria inativa em cascata todas as suas tags ativas; ativar uma categoria reativa em cascata as tags que estavam inativas. Não distingue "inativada pela cascata" de "já estava inativa antes" — reativar a categoria reativa tudo.
- **Bloqueio tag → categoria:** não é possível ativar uma tag cuja categoria está inativa (HTTP 400 do backend) — precisa ativar a categoria primeiro.
- **Tela principal `/tags`** mostra só itens **ativos**. Tudo que é inativo só aparece em `/tags/inativos` (duas abas: Tags inativas / Categorias inativas — categorias em `Accordion` mostrando as tags vinculadas).
- **`DataContext`** (`controle-gastos-frontend/src/context/DataContext.js`) mantém `tags`/`categorias` globais (só ativos, via `refreshData()`). Qualquer tela que muta tag/categoria (`TagManagement.js`, `TagsInativos.js`) precisa chamar `refreshData()` depois da mutação, senão outras telas ficam com dado velho até reload manual — bug já corrido uma vez em `TagsInativos.js` (2026-08-11).

## Visibilidade no lançamento (`mostrarNoLancamento`)

Ver [ADR-022](../decisions/2026-08-11-mostrar-no-lancamento.md). Eixo **ortogonal** ao ciclo ativo/inativo: uma tag/categoria pode continuar `ativo:true` (visível em relatórios) e ainda assim ficar oculta especificamente nas telas de lançamento.

- Campo `mostrarNoLancamento: Boolean, default: true` em Tag e Categoria. Curadoria 100% manual (checkbox em `TagManagement.js`, ao lado de "Mostrar no Dashboard") — sem automação por uso/idade.
- Categoria oculta esconde o grupo inteiro (categoria + todas as tags dela) do lançamento, independente do flag de cada tag.
- **Filtragem é só frontend** — o backend (`obterTodasTags`/`obterTodasCategorias`) não filtra por esse campo, continua devolvendo tudo que é ativo. A regra vive em `controle-gastos-frontend/src/utils/tagVisibility.js` (`filtrarCategoriasParaLancamento`, `filtrarTagsParaLancamento`), reusada em:
  - `TagSelector.js` (form de nova transação, edição de transação, conta fixa recorrente).
  - `pages/Recebimentos/components/TabConfiguracao.js` e `components/Recebimentos/ConfiguracaoRecebimentosModal.js` (filtro próprio, sem passar pelo utilitário compartilhado, porque essas telas não agrupam por categoria).
- **Editar preserva, sem expandir:** uma tag/categoria oculta já usada numa transação continua pré-selecionada na edição, mas não dá para adicionar *outra* oculta na mesma edição — precisa reativar em `/tags` primeiro. Não existe "mostrar tudo" (escape hatch) dentro do seletor.
- **Relatório e telas read-only não mudam:** `RelatorioFiltersPanel.js`, `TransactionCard.js`, abas de exibição de Recebimentos continuam mostrando qualquer item ativo, independente desse campo.

## Tags em pagamentos: divisão/rateio

- `usePagamentos.js` (`splitEqually` = "Rateio igual", `splitInto` = "Dividir em") replicam as tags do **pagamento de índice 0** (o "principal") para os demais pagamentos, de forma **aditiva**: para cada tag que o principal tem e um pagamento de destino não tem, adiciona; nunca remove/sobrescreve tags já distribuídas manualmente nos outros pagamentos.
- A função utilitária `mergeTagsAditivo` (em `usePagamentos.js`) espelha o mesmo padrão que já existe no backend em `mergeTagsPadrao` (`backend/src/services/importacaoService.js`), usado para aplicar a tag inferida automaticamente (`tagSugerida`, ex: mês da fatura) a todos os pagamentos de uma transação importada.
- Comportamento é "retroativo por design": re-clicar em "Rateio igual"/"Dividir em" depois de adicionar mais tags no pagamento principal replica de novo, sem apagar o que já tinha sido distribuído manualmente nos outros.

## Alerta de duplicidade no formulário de transação

`useDuplicateCheck.js` (usado em `TabResumo.js` do formulário de transação avulsa) chama `obterTransacoesPaginadas` (não `obterTransacoes`) para checar se já existe uma transação parecida na mesma data — precisa mandar `page` além de `search`/`dataInicio`/`dataFim`/`limit`, porque o backend (`controladorTransacao.js`, `obterTodasTransacoes`) só aplica esses filtros no branch paginado; sem `page`, ele cai num branch legado que ignora todos os filtros de busca/data e devolve todas as transações ativas do usuário.
