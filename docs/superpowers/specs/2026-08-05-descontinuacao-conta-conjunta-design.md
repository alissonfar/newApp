# Descontinuação de Conta Conjunta — Design

Status: aprovado em 2026-08-05, aguardando review final do usuário antes de writing-plans.

## Contexto e motivação

O usuário decidiu descontinuar o módulo de "conta conjunta" (vínculo entre pessoas com saldo devedor acumulado e acertos em FIFO). O motivo declarado: "não faz mais sentido para mim no momento". A divisão de valores dentro de uma transação (quem pagou quanto) deve continuar existindo — mas via o mecanismo que já é usado hoje pra isso, `Transacao.pagamentos[]`, que é ortogonal ao sistema de conta conjunta.

## Investigação prévia (arquitetura atual)

Levantamento feito em `backend/src/models/transacao.js`, `services/transacaoService.js`, `services/vinculoService.js`, `models/vinculoConjunto.js`, `models/acertoConjunto.js`, `controllers/controladorTransacao.js`, e cruzado com `RESUMO_TECNICO_SISTEMA.md` / `.brain/context/glossary-emprestimos.md`.

### `pagamentos[]` — mantido

Array obrigatório em `Transacao`, unidade atômica de "quem pagou/é dono de quanto" dentro de **uma** transação: `pessoa`, `valor`, `tags` (por categoria), `parcelamento` por linha, `installmentNumber/Total/GroupId`, `emprestimoId`/`valorEsperadoRetorno` (caminho pagamento-level de Empréstimos). Usado em relatórios, filtros, exportação e parcelamento. Regra: soma de `pagamentos[].valor` = `transacao.valor` (tolerância 0.01).

### `contaConjunta` — removido

Subdocumento único em `Transacao` (`ativo`, `vinculoId`, `pagoPor`, `valorTotal`, `parteUsuario`, `parteOutro`, `acertadoEm`), com duas entidades de suporte:
- `VinculoConjunto` — o relacionamento com a outra pessoa.
- `AcertoConjunto` — registro de acerto de saldo, com `transacoesQuitadas[]` e lógica de FIFO (mais antigo primeiro) em `vinculoService.registrarAcerto`.

### Ponto de acoplamento (único)

Em `transacaoService.validarSomaPagamentos`: quando `contaConjunta.ativo && pagoPor === 'outro'`, a soma de `pagamentos[]` deve igualar `contaConjunta.parteUsuario` em vez de `transacao.valor` — porque nesse fluxo (`prepararValorEContaConjunta`), `transacao.valor` já foi reduzido pra representar só a parte do usuário, não o valor total da compra. Fora desse caso, `pagamentos[]` sempre soma pro valor cheio. Essa é a única dependência estrutural entre os dois sistemas — `pagamentos[]` não referencia `vinculoId`/acertos em nenhum outro ponto.

### `ledgerService` — não relacionado

Pertence ao módulo de Patrimônio (saldo de contas/carteiras via eventos append-only), sem nenhuma referência a `Transacao`, `pagamentos` ou `contaConjunta`. Fora de escopo desta remoção.

## Decisões validadas com o usuário

- **Dado histórico:** transações antigas com `contaConjunta.ativo && pagoPor === 'outro'` já têm `transacao.valor` e `pagamentos[]` gravados como a parte do usuário (não o valor total). **Mantido como está** — semanticamente correto (reflete o que de fato saiu/entrou do bolso do usuário). Não haverá reprocessamento/expansão pro valor total.
- **Saldo pendente:** usuário confirmou que não há vínculo com saldo devedor em aberto hoje — não é necessário gerar acerto final antes da remoção.

## O que remover

Backend:
- `models/vinculoConjunto.js`, `models/acertoConjunto.js` (entidades inteiras)
- `services/vinculoService.js` (FIFO e cálculo de saldo)
- `controllers/vinculoConjuntoController.js`, `routes/rotasVinculoConjunto.js`
- Subdocumento `contaConjunta` do schema `Transacao`
- Em `transacaoService.js`: `validarContaConjunta`, `prepararValorEContaConjunta`, e o ramo condicional em `validarSomaPagamentos` (volta a validar sempre soma = `transacao.valor`, sem exceção)
- Em `controladorTransacao.js`: qualquer leitura/gravação de `req.body.contaConjunta`

Frontend:
- Telas/componentes de gestão de vínculo e acertos
- Campos de `contaConjunta` no form de transação (mantendo intacta a divisão via `pagamentos[]` já existente no mesmo form)

## O que permanece intacto

`Transacao.pagamentos[]` inteiro — estrutura, validação de soma (simplificada, sem o ramo especial), uso em relatórios/filtros/parcelamento. Nenhuma mudança de comportamento pra quem usa divisão de pagamento hoje fora do contexto de conta conjunta.

## Migração de dados

Como não há saldo pendente, a remoção é segura sem acerto final. Necessário script de migration (conforme regra do projeto: usuário roda manualmente, nunca o Claude):
- `$unset` do campo `contaConjunta` em todas as `Transacao` existentes (valor em si do documento não é alterado, só o metadado de vínculo)
- `drop` das coleções `vinculoconjuntos` e `acertoconjuntos`

O script será entregue completo junto com o comando exato (PowerShell) na fase de execução, para o usuário rodar e confirmar o resultado — não será executado automaticamente.

## Testes

- `ledgerService`/`netWorthService` não são afetados (módulo de Patrimônio, sem relação com conta conjunta) — não é necessário rodar `npm test` por causa desta mudança especificamente, mas deve ser rodado de qualquer forma como checagem de regressão padrão antes de reportar como concluído.
- Validação principal é manual: garantir que criar/editar transação com múltiplos `pagamentos[]` continua funcionando exatamente como antes, sem os campos de conta conjunta.

## Fora de escopo

- Conta Fixa — spec separado (`2026-08-05-conta-fixa-design.md`), desenhado desde já para não depender de `contaConjunta`, usando `pagamentos[]` normalmente.
