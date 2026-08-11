---
type: decision
status: active
created: 2026-08-11
tags: [pagamentos, transacao, divisao, arquitetura]
related:
  - .brain/decisions/2026-08-11-descontinuacao-conta-conjunta.md
  - .brain/context/divisoes-pre-configuradas.md
---

# ADR-023: Divisões Pré-Configuradas — presets de percentual sobre `pagamentos[]`, sem tocar em `/pessoas`

## Contexto

O usuário divide recorrentemente o mesmo tipo de gasto (ex: aluguel) entre as mesmas pessoas, sempre na mesma proporção. Sem essa feature, cada nova transação exigia digitar de novo o nome da pessoa e recalcular o valor de cada parte manualmente na aba Pagamentos. A demanda surgiu no mesmo dia em que o módulo de Conta Conjunta foi descontinuado ([ADR-019](2026-08-11-descontinuacao-conta-conjunta.md)) — importante deixar claro que essa feature **não é uma reintrodução de Conta Conjunta**: não há vínculo persistente entre transações, saldo devedor ou acerto. É só um atalho de preenchimento em cima do mecanismo que já existia e sobrou (`Transacao.pagamentos[]`).

## Opções consideradas

- **Presets sempre 2 pessoas (você + 1 outra):** rejeitada — usuário quis suportar divisões entre 3+ pessoas também (`partes: [{pessoa, percentual}]` como array, não par fixo).
- **Nome da pessoa no preset vindo do cadastro `/pessoas` (Empréstimos):** rejeitada — criaria acoplamento entre o módulo de Empréstimos e o de presets de divisão só pra evitar digitar o nome uma vez a mais. O campo `pessoa` do preset é texto livre, exatamente como já é o campo `Pessoa` de cada pagamento hoje.
- **Aplicar preset preservando pagamentos existentes (merge):** rejeitada — mais complexo de raciocinar sobre o que "merge" significa quando os pagamentos atuais não batem com o preset. A opção escolhida (substituir tudo) segue exatamente o precedente já existente de `splitInto(n)` ("Dividir em N"), que já se comporta assim.
- **Gerenciamento dos presets como item novo na sidebar:** rejeitada por pedido explícito do usuário — não queria poluir o menu com uma função pouco usada. Virou uma 4ª aba dentro de `/profile` (Meu Perfil), sem entrada em `menuStructure.js`.

## Decisão

Nova entidade `DivisaoPreset` (`backend/src/models/divisaoPreset.js`), escopada por `usuario`, com `nome` + `partes: [{pessoa, percentual}]` (mínimo 2 partes, soma deve ser 100% com tolerância de 0,1). CRUD completo e simples (`backend/src/controllers/divisaoPresetController.js`, `backend/src/routes/rotasDivisaoPreset.js`, registrado em `/api/divisao-presets`), seguindo exatamente o padrão já usado por `Pessoa` (`pessoaController.js`).

**Sem soft-delete.** Diferente de Tag/Categoria ([ADR-020](2026-08-11-tags-categorias-ciclo-ativo-inativo.md)), nada referencia um `DivisaoPreset` por id — ele é só "copiado" pros pagamentos no momento em que o usuário clica em aplicar. Exclusão é sempre `deleteOne()` definitivo.

No frontend: `usePagamentos.applyPreset(preset)` — nova função que substitui todos os pagamentos atuais por N novos (um por parte do preset), calculando `valor = total × percentual/100` com a última parte absorvendo a diferença de arredondamento (mesmo padrão de `splitInto`), e propagando as tags do pagamento 1 pros demais via `mergeTagsAditivo` (função já existente, reaproveitada sem duplicação). Um dropdown "Aplicar divisão" aparece na `TabPagamentos` ao lado de "Dividir em", só quando existe pelo menos 1 preset salvo.

Gerenciamento (criar/editar/excluir presets) fica numa 4ª aba "Divisões" em `/profile`, sem link na sidebar — único ponto de acesso pra essa tela.

## Consequências

- Pró: reaproveita 100% a infraestrutura de `pagamentos[]` e `mergeTagsAditivo` já existente — nenhuma mudança de schema em `Transacao`.
- Pró: não recria o acoplamento de Conta Conjunta (sem vínculo persistente entre transações, sem saldo, sem acerto) — decisão consciente de manter as duas features conceitualmente distintas.
- Contra: nome da pessoa no preset é texto livre — se o usuário digitar "Marina" num preset e "marina" (minúsculo) num pagamento manual, não há dedup nem autocomplete entre os dois. Aceito conscientemente para não acoplar com `/pessoas`.
- Impacto em outras áreas: nenhum — `Transacao`, Conta Fixa, Empréstimos e `ledgerService`/Patrimônio são ortogonais e não foram tocados.
