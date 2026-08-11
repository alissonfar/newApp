---
type: decision
status: active
created: 2026-08-11
tags: [tags, categorias, soft-delete, hard-delete, arquitetura]
related:
  - .brain/context/tags-categorias.md
---

# ADR-020: Ciclo ativo/inativo de Tags e Categorias — exclusão condicional e cascata

## Contexto

O sistema já tinha soft-delete (`ativo: Boolean`) em `Tag` e `Categoria`, mas de forma incompleta e inconsistente:

- **Categoria**: soft-delete completo (rotas `ativar`/`inativar`, listagem com `?incluirInativas=true`, UI com badge), mas a exclusão **sempre** inativava — nunca havia opção de excluir de fato, mesmo sem nenhum dado vinculado.
- **Tag**: soft-delete incompleto — o `DELETE` setava `ativo:false`, mas não existia rota para reverter (`ativar`), nem filtro de listagem para trazer inativas de volta. Uma tag excluída ficava presa nesse estado para sempre.
- Nenhuma das duas entidades verificava vínculo (transações/pagamentos usando a tag/categoria) antes de agir — o único precedente no sistema era `Pessoa` (`pessoaController.js`), que bloqueia a exclusão se houver empréstimo ativo vinculado, mas não faz hard-delete condicional.
- A tela principal (`/tags`) exibia itens inativos misturados com ativos (badge "Inativa"), o que o usuário reportou como bug de UX — itens inativados "continuavam aparecendo".

## Opções consideradas

- **Manter soft-delete sempre, só consertar a assimetria Tag/Categoria:** rejeitada — não resolve o problema real de "lixo" acumulando no banco para itens nunca usados (ex: uma tag criada por engano e excluída no mesmo minuto continuaria ocupando um documento para sempre).
- **Hard delete sempre, perdendo o histórico de itens vinculados a transações:** rejeitada — quebraria a integridade referencial de transações antigas que ainda referenciam a tag/categoria por id.
- **Hard delete condicional (escolhida):** se não há nenhum vínculo (nenhuma transação/pagamento referenciando a tag; para categoria, nenhuma tag cadastrada nela e nenhuma transação vinculada), a exclusão remove o documento de fato. Se há vínculo, mantém o soft-delete de sempre.

## Decisão

### Verificação de vínculo

`pagamentos[].tags` é armazenado como objeto livre `{ [categoriaId]: [tagId, ...] }` (campo `Object`/Mixed no schema `Transacao`, não uma referência Mongoose) — não dá para indexar/buscar diretamente. A verificação usa uma aggregation (`backend/src/services/vinculoTagCategoriaService.js`) que faz `$objectToArray` em `pagamentos.tags` para poder checar se um `tagId` aparece em algum valor, ou um `categoriaId` aparece em alguma chave, entre as transações ativas do usuário.

- `tagEstaVinculada(tagId, usuarioId)`: verdadeiro se algum pagamento tem esse `tagId` no array de valores de alguma categoria.
- `categoriaEstaVinculada(categoriaId, usuarioId)`: verdadeiro se **(a)** existe alguma `Tag` cadastrada nessa categoria (mesmo que nenhuma transação a use — excluir a categoria quebraria a integridade dessas tags), **ou (b)** algum pagamento tem tags registradas sob essa categoria.

### Exclusão (`DELETE /api/tags/:id`, `DELETE /api/categorias/:id`)

Sem vínculo → `deleteOne()` de fato. Com vínculo → soft-delete (`ativo:false`), como já era. A resposta HTTP inclui `{ inativada: true|false }` para o frontend distinguir e mostrar a mensagem certa.

### Cascata categoria ↔ tags (decisão tomada durante a execução, não estava na spec original)

Depois de implementar a tela `/tags/inativos`, o usuário identificou um estado inconsistente possível: inativar uma categoria não mexia nas tags dela, deixando tags `ativo:true` "presas" embaixo de uma categoria `ativo:false`. Duas regras foram adicionadas:

1. **Inativar categoria → inativa em cascata todas as tags ativas dela** (`Tag.updateMany({categoria, ativo:true}, {ativo:false})`).
2. **Ativar categoria → reativa em cascata todas as tags inativas dela** (cascata simétrica).
3. **Ativar uma tag cuja categoria está inativa é bloqueado** (HTTP 400, mensagem explicando qual categoria precisa ser ativada primeiro) — evita recriar o estado inconsistente pelo caminho inverso.

**Efeito colateral aceito conscientemente:** a cascata não distingue "tag inativada porque a categoria foi inativada" de "tag que já estava inativa antes, por decisão manual". Reativar a categoria reativa todas as tags dela, mesmo as que o usuário tinha inativado manualmente antes da categoria ser inativada. Rastrear a origem da inativação exigiria um campo extra (ex: `inativadaPorCascata: Boolean`) — descartado por complexidade desnecessária para um app pessoal; o usuário foi avisado explicitamente e aceitou o tradeoff.

### Tela `/tags/inativos`

Rota única com duas abas (não duas rotas separadas): "Tags inativas" e "Categorias inativas". Categorias renderizam como `Accordion` (MUI, mesmo componente já usado em `HistoricoRecebimentosPage.js`) mostrando as tags vinculadas a cada uma; tags inativas mostram um chip com ícone/cor/nome da categoria a que pertencem. A tela principal (`/tags`) passou a excluir tudo que é inativo da consulta (antes trazia tudo com badge) — só ativos aparecem lá agora.

## Consequências

- Pró: elimina acúmulo de documentos "lixo" (tags/categorias nunca usadas e excluídas) sem arriscar integridade referencial de dados em uso.
- Pró: elimina o estado inconsistente tag-ativa-sob-categoria-inativa nos dois sentidos (cascata + bloqueio).
- Contra: cascata de reativação pode reativar tags que o usuário queria manter inativas por conta própria (ver efeito colateral aceito acima).
- Achado durante a execução, não na spec original: bug de atualização — ações em `/tags/inativos` não chamavam o `refreshData()` do `DataContext` global, deixando a tela `/tags` com dado desatualizado até reload manual. Corrigido no mesmo commit da tela.
