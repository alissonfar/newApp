---
type: decision
status: active
created: 2026-09-05
tags: [settlement, recebimentos, fechamento, bug, pessoa]
related:
  - .brain/specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md
  - .brain/decisions/2026-08-31-fechamento-modelagem.md
---

# ADR-021: "Pessoa" de um Settlement vem de `appliedTransactions`, nunca de `receivingTransactionId`

## Contexto

Um `Settlement` tem dois lados: `receivingTransactionId` (a transação `recebivel` — dinheiro que
entrou, sempre com `pagamentos[].pessoa` = o próprio usuário, já que é dinheiro caindo na conta dele)
e `appliedTransactions[]` (os gastos pendentes quitados, cada um com `pagamentoIndex` opcional
apontando pra fatia específica de `pagamentos[]` que foi quitada — onde de fato mora o nome de quem
devia, ex: "Cleia").

Três pontos do código (`HistoricoRecebimentosPage.pessoaRecebimento`, `settlementService.listar`
filtro `pessoa`, `fechamentoService.linkarRecebimento`) liam `receivingTransactionId.pagamentos` pra
descobrir "a pessoa" de um recebimento — sempre o próprio usuário, nunca quem pagou. Isso quebrava a
tela de histórico (mostrava o usuário como pessoa), o filtro de pessoa (nunca achava nada) e o
Fechamento (nunca conseguia linkar um recebimento).

Spec completa: [`2026-09-05-fix-pessoa-recebimento-settlement-design.md`](../specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md).

## Decisão

"A pessoa de um Settlement" é sempre derivada de `appliedTransactions[].transactionId.pagamentos[pagamentoIndex]`
(fallback: todos os pagadores da transação, se `pagamentoIndex` não foi gravado) — nunca de
`receivingTransactionId`. Centralizado numa função única `pessoasDoSettlement()` em
`settlementService.js`, calculada no backend e devolvida pronta (`pessoas: [...]`) pro frontend só
exibir.

Um Settlement pode legitimamente conciliar dívidas de mais de uma pessoa ao mesmo tempo (confirmado
com dado real: um recebimento quitou parcelas da Cleia e da Milena juntas) — "linkar ao Fechamento de
uma pessoa X" significa "X aparece em pelo menos uma das `appliedTransactions`", não "todas são de X".

## Consequências

- **Pró:** resolve os 3 sintomas com uma única mudança de leitura, sem migração de dado — o dado já
  estava certo, só a leitura estava no lado errado.
- **Pró:** centraliza o cálculo, evita que a mesma lógica seja reimplementada (e quebrada de novo) em
  um quarto lugar no futuro.
- **Contra (limitação aceita, fora de escopo):** o formulário de transação nova ainda não diferencia
  `tipo: 'recebivel'` de `tipo: 'gasto'` no campo Pessoa — continua nascendo com o próprio usuário.
  Não afeta esta correção (que lê `appliedTransactions`, não o lado `recebivel`), mas fica registrado
  como possível rodada futura.
- **Impacto em outras áreas:** nenhum model alterado; `Transacao`, `FechamentoInstancia` intocados.

## Referências

- Spec completa: [`2026-09-05-fix-pessoa-recebimento-settlement-design.md`](../specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md)
- ADR-020 (modelagem do Fechamento) — casamento por nome com `Pessoa`, técnica reaproveitada aqui
