# Gestão de Tags e Categorias Inativas — Design

Status: aprovado em 2026-08-11 — pronto para writing-plans.

## Contexto e motivação

O usuário relatou dois problemas ao gerenciar tags e categorias:

1. Ao excluir uma tag ou categoria, o sistema sempre inativa (soft delete) mesmo quando não há absolutamente nada vinculado a ela — nesse caso deveria excluir de fato.
2. Não existe hoje um jeito de recuperar/reativar uma tag ou categoria inativada — precisa de uma tela dedicada de "inativos" com botão de reativação.

## Investigação prévia (estado atual)

Levantamento feito em `backend/src/models/categoria.js`, `backend/src/models/tag.js`, `backend/src/controllers/controladorCategoria.js`, `backend/src/controllers/controladorTag.js`, `backend/src/routes/rotasCategoria.js`, `backend/src/routes/rotasTag.js`, `controle-gastos-frontend/src/components/Tag/TagManagement.js`, `controle-gastos-frontend/src/context/DataContext.js`, `controle-gastos-frontend/src/api.js`, cruzado com `pessoaController.js` (única entidade do sistema que já faz checagem de vínculo antes de excluir).

### Categoria — soft delete completo, mas sem checagem de vínculo

- Modelo (`categoria.js:16`): campo `ativo: Boolean, default: true`.
- `excluirCategoria` (`controladorCategoria.js:97-118`): sempre seta `ativo:false`, nunca hard delete, nunca verifica se há tags/transações vinculadas.
- `ativarCategoria`/`inativarCategoria` (`:120-161`) já existem como endpoints dedicados.
- `obterTodasCategorias` (`:4-31`) já aceita `?incluirInativas=true` (padrão: só ativas).
- Frontend (`TagManagement.js`): já busca com `obterCategorias(true)`, já mostra badge "Ativa"/"Inativa" e botões de toggle (`:262-299`, `:349-377`).

### Tag — soft delete incompleto, sem paridade com Categoria

- Modelo (`tag.js:17`): mesmo campo `ativo: Boolean, default: true`.
- `excluirTag` (`controladorTag.js:97-117`): também seta `ativo:false` (não é hard delete), sem checagem de vínculo.
- **Não existem** `ativarTag`/`inativarTag` no controller, nem rotas `PUT /:id/ativar` / `PUT /:id/inativar` em `rotasTag.js` — uma vez inativada, uma tag fica presa nesse estado permanentemente, sem endpoint para reverter.
- `obterTodasTags` (`:4-29`) sempre força `ativo:true` no filtro (`:16`), ignorando qualquer parâmetro — não existe equivalente a `incluirInativas`.
- `obterTagPorId`/`atualizarTag` também sempre exigem `ativo:true`, então uma tag inativada nem pode ser reeditada.
- Frontend: tags vêm de `DataContext.js` via `obterTags()` sem parâmetro — como o backend nunca traz inativas, elas simplesmente somem da aplicação inteira. A UI de tags em `TagManagement.js` só tem botão "Excluir", sem badge de status nem toggle.

### Padrão de referência: checagem de vínculo em Pessoa

`pessoaController.js:74-94` (`excluir`) é o único lugar do sistema que já verifica vínculo antes de agir: bloqueia a exclusão com erro 400 se a pessoa tiver empréstimos com `status:'ativo'`. Não faz hard delete condicional — só bloqueia ou permite a mesma ação (inativar). O padrão que vamos construir aqui é mais completo: hard delete condicional (não apenas bloqueio).

### Formato de dado que dificulta a checagem de vínculo

`Transacao.pagamentos[].tags` é `{ type: Object }` (`transacao.js:13`) — um objeto livre no formato `{ [categoriaId]: [tagId, ...] }`, não uma referência Mongoose nem um array simples. Não dá para fazer uma query direta tipo `Transacao.find({ 'pagamentos.tags': tagId })` porque `tagId` está dentro do **valor** de uma chave dinâmica, não numa posição fixa do documento.

## Decisões validadas com o usuário

- **Hard delete condicional, para as duas entidades:** se não houver nenhum vínculo (nenhuma transação/pagamento referenciando a tag; para categoria, nenhuma tag e nenhuma transação vinculada), a exclusão remove o documento de fato do banco. Se houver vínculo, mantém o comportamento atual de soft delete (`ativo:false`), recuperável.
- **Categoria também passa a seguir esse padrão** (hoje ela sempre inativa, nunca teve a opção de excluir de fato) — consistência entre as duas entidades.
- **Tela de inativos unificada:** uma única rota nova, com abas "Tags inativas" / "Categorias inativas", em vez de duas rotas separadas.

## Arquitetura da checagem de vínculo

Implementada como aggregation do MongoDB, rodando sob demanda no momento do clique em "Excluir" (não é hot path, não precisa de índice novo):

```js
// Vínculo de uma TAG: tagId aparece em algum array de valores de pagamentos.tags,
// em qualquer transação ativa do usuário.
Transacao.aggregate([
  { $match: { usuario, status: 'ativo' } },
  { $unwind: '$pagamentos' },
  { $project: { tagsArr: { $objectToArray: { $ifNull: ['$pagamentos.tags', {}] } } } },
  { $unwind: '$tagsArr' },
  { $match: { 'tagsArr.v': tagId } },
  { $limit: 1 }
]);
```

Para **categoria**, o vínculo é considerado existente se **qualquer uma** das condições for verdadeira:
1. Existe alguma `Tag` com `categoria: categoriaId` (a categoria ainda "contém" tags cadastradas — mesmo que essas tags não estejam usadas em nenhuma transação, excluir a categoria quebraria a integridade delas).
2. A mesma aggregation acima, mas casando `tagsArr.k === categoriaId` em vez de `tagsArr.v`.

Essa lógica de checagem vira uma função utilitária compartilhada (ex: `backend/src/services/vinculoTagCategoriaService.js`, com `tagEstaVinculada(tagId, usuario)` e `categoriaEstaVinculada(categoriaId, usuario)`), usada pelos dois controllers.

## Backend — mudanças

**`controladorTag.js` / `controladorCategoria.js` — `excluirTag`/`excluirCategoria`:**
1. Roda a checagem de vínculo correspondente.
2. Sem vínculo → `deleteOne()` (hard delete de fato).
3. Com vínculo → mantém o comportamento atual (`ativo:false`), retornando no response um aviso indicando que foi inativada por ter vínculos (para o frontend mostrar toast informativo, não erro).

**`controladorTag.js` — novos endpoints**, espelhando o padrão que `controladorCategoria.js` já tem:
- `ativarTag` / `inativarTag`, seguindo a mesma implementação de `ativarCategoria`/`inativarCategoria`.
- `obterTodasTags` passa a aceitar `?incluirInativas=true` (mesmo padrão de `obterTodasCategorias`), em vez de forçar `ativo:true` sempre.
- `obterTagPorId`/`atualizarTag`: revisar se a exigência de `ativo:true` no filtro de busca deve cair — uma tag inativada precisa continuar sendo editável/consultável (ex: pela própria tela de reativação), então o filtro por `ativo` deve ser removido dessas duas operações.

**`rotasTag.js` — novas rotas:**
- `PUT /api/tags/:id/ativar`
- `PUT /api/tags/:id/inativar`

## Frontend — mudanças

- **Nova rota `/tags/inativos`** (novo componente, ex: `pages/TagsInativos/TagsInativos.js`), com duas abas: "Tags inativas" e "Categorias inativas". Reaproveita o padrão visual de card + botão de ação já usado em `TagManagement.js` (ícone `FaCheckCircle`, já importado no arquivo, para o botão de reativar).
  - Busca tags com `obterTags({ incluirInativas: true })` e filtra client-side por `ativo === false` (evita mudar o contrato de `obterTags()` usado em outros lugares).
  - Busca categorias com `obterCategorias(true)` (já existe) e mesmo filtro client-side.
- **Botão "Ver inativos"** no cabeçalho de `TagManagement.js`, ao lado dos botões existentes, navegando para `/tags/inativos`.
- **Tag ganha paridade visual com Categoria em `TagManagement.js`**: badge "Ativa"/"Inativa" e botão de toggle inline na listagem normal de tags (hoje só existe para categoria) — assim uma tag inativada continua visível/reativável na tela principal, sem obrigar a ir na tela separada.
- **`api.js`**: novos métodos `ativarTag(id)` / `inativarTag(id)`, e `obterTags` passa a aceitar um parâmetro opcional `incluirInativas` (mantendo compatibilidade — chamadas existentes sem parâmetro continuam trazendo só ativas).
- `DataContext.js` continua chamando `obterTags()` sem parâmetro — o comportamento do resto do app (formulário de transação, relatórios etc.) não muda, só ativas.
- Registro da nova rota em `App.js`, seguindo o padrão das rotas existentes (`PrivateRoute`, mesmo layout).

## Tratamento de erro / mensagens

- Exclusão bloqueada por vínculo (backend retorna sucesso, mas com flag indicando que foi inativada em vez de excluída): toast informativo — "Tag/Categoria inativada por ter transações vinculadas" — deixa claro que a ação teve efeito, só que diferente do hard delete esperado.
- Exclusão sem vínculo: toast de sucesso simples de exclusão definitiva.
- Reativação: toast de sucesso, item some da lista de inativos e reaparece na listagem normal.

## Fora de escopo

- Migração/backfill de tags ou categorias já inativadas hoje no banco (elas simplesmente passam a aparecer na nova tela de inativos e ficam reativáveis, sem necessidade de script).
- Mudança na lógica de negócio de importação em massa (`mergeTagsPadrao` etc.) — fora do escopo deste documento, tratado separadamente no item de divisão de pagamentos.
