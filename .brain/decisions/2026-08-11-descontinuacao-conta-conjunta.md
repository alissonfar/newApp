---
type: decision
status: active
created: 2026-08-11
tags: [conta-conjunta, transacao, remocao, arquitetura]
---

# ADR-019: Descontinuação do módulo de Conta Conjunta

## Contexto

O módulo de "conta conjunta" (vínculo com um participante externo, divisão pagoPor/parteUsuario/parteOutro, saldo devedor calculado e acertos em FIFO) deixou de fazer sentido para o uso real do sistema. O usuário confirmou que não há saldo pendente em aberto hoje, o que torna a remoção segura sem precisar de um acerto final.

Esse é um caso de decisão tomada antes do vault estar em uso pra valer (spec aprovada em 2026-08-05, ver `docs/superpowers/specs/2026-08-05-descontinuacao-conta-conjunta-design.md`) — documentada aqui retroativamente na execução, conforme a nota de migração do `CLAUDE.md`.

## Opções consideradas

- **Manter o módulo, só parar de usar na UI:** rejeitada — deixaria código morto e um segundo caminho de validação (`transacaoService.validarSomaPagamentos` com ramo condicional) vivo sem necessidade, aumentando a superfície de manutenção.
- **Remover só a UI, manter backend "por segurança":** rejeitada — o objetivo era reduzir complexidade; manter rotas/models mortos no backend não protege nada e ainda expõe endpoints sem uso real.
- **Remover o módulo por completo, mantendo `Transacao.pagamentos[]` intacto (decisão escolhida):** `pagamentos[]` é ortogonal — já é o mecanismo real de divisão de valor entre pessoas, usado inclusive por Conta Fixa. Conta conjunta era uma camada adicional por cima dele (vínculo + saldo + acerto), não a base da divisão em si.

## Decisão

Remover inteiramente: `models/vinculoConjunto.js`, `models/acertoConjunto.js`, `services/vinculoService.js` (FIFO), os controllers/rotas de `/api/vinculos-conjuntos` e `/api/acertos`, o subdocumento `Transacao.contaConjunta`, o subdocumento equivalente em `TransacaoImportada.contaConjunta` (achado durante a revisão da spec — a investigação original de 2026-08-05 não cobria o módulo de Importação), as funções `validarContaConjunta`/`prepararValorEContaConjunta` e o ramo condicional em `validarSomaPagamentos` (`transacaoService.js`), e toda a UI (hook `useContaConjunta`, campos no form de transação, páginas `/conjunto` e `/conjunto/:id`, item de menu, exibição em Relatório e na revisão de Importação).

Dado histórico é mantido como está: transações antigas com `contaConjunta.pagoPor === 'outro'` já tinham `transacao.valor`/`pagamentos[]` gravados como a parte do usuário (não o valor total da compra) — isso é semanticamente correto e não é reprocessado.

Migration de dados (`$unset` de `contaConjunta` + `drop` das coleções `vinculoconjuntos`/`acertoconjuntos`) foi **descartada por decisão explícita do usuário** — ele não está preocupado com os dados antigos remanescentes no banco, então o campo órfão fica nos documentos (o Mongoose simplesmente ignora campos fora do schema).

## Consequências

- Pró: menos um sistema de validação condicional em `transacaoService.js` — `validarSomaPagamentos` volta a ser uma regra única e simples.
- Pró: menos 2 rotas HTTP, 2 models, 1 service inteiro (FIFO de acertos) e ~1100 linhas de frontend removidas.
- Contra: o campo `contaConjunta` continua existindo como metadado morto em documentos antigos no MongoDB (sem migration) — não afeta o app (schema não lê mais o campo), mas aparece se alguém inspecionar o banco diretamente via `mongosh`.
- Impacto em outras áreas: nenhum — `pagamentos[]`, Conta Fixa, Empréstimos e `ledgerService`/Patrimônio são ortogonais e não foram tocados.
