# Descontinuação de Conta Conjunta — Design

Status: aprovado em 2026-08-05; revisado em 2026-08-07 (escopo estendido pro módulo de Importação, que não tinha sido investigado na primeira passada) — pronto para writing-plans.

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

### Revisão 2026-08-07 — módulo de Importação (segundo ponto de acoplamento, não coberto na investigação original)

A investigação de 2026-08-05 não cobriu `backend/src/models/transacaoImportada.js`, `backend/src/controllers/transacaoImportadaController.js` e `backend/src/controllers/importacaoController.js`. Levantamento adicional mostrou que o fluxo de importação (upload → parse → revisão → finalização) tem um caminho **paralelo e independente** para conta conjunta:

- `TransacaoImportada` (o registro de linha em revisão, antes de virar `Transacao` real) tem seu **próprio subdocumento `contaConjunta`**, com `vinculoId: { ref: 'VinculoConjunto' }` — schema espelhado do de `Transacao`, mas é uma definição própria (`backend/src/models/transacaoImportada.js:175-177`), incluindo lógica equivalente no método de serialização (`:220-227`).
- `transacaoImportadaController.js` inclui `contaConjunta` em `camposPermitidos` (edição da linha em revisão, `:74`) e tem um bloco dedicado de leitura/gravação (`:114-125`).
- `importacaoController.js`, na finalização (`PUT /:id/finalizar`), **copia** `contaConjunta` de `TransacaoImportada` pra a `Transacao` real recém-criada (`:645-651` e `:715-718`, ambos os caminhos: transação nova e transação com correspondência em duplicata).

Isso invalida a afirmação original de "ponto de acoplamento único" — há dois pontos de acoplamento: `transacaoService.validarSomaPagamentos` (já mapeado) e o par `transacaoImportadaController.js` + `importacaoController.js` na importação.

Também confirmado: `backend/src/app.js` registra a rota (`:81` require, `:109` `app.use('/api/vinculos-conjuntos', ...)`), que precisa ser removido além do arquivo de rota em si.

No frontend, além das telas de gestão de vínculo já citadas, há três outros pontos com referência real a `contaConjunta` (não triviais/comentário):

- `controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js` — a tela de revisão de importação lê e **exibe** `transacao.contaConjunta` por linha (`:325`, `:1201-1205`): "Sim · Outro pagou/Eu paguei · Total: X · Minha parte: Y".
- `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js` — a função `flattenTransactions` monta um campo `vinculo` a partir de `tr.contaConjunta` (`:51-56`) e o inclui em toda linha achatada exibida/exportada no relatório.
- `controle-gastos-frontend/src/api.js` (`:577-618`) — client com os 5 métodos do módulo (`listarVinculosConjuntos`, `criarVinculoConjunto`, `obterVinculoConjunto`, `atualizarVinculoConjunto`, `excluirVinculoConjunto`).
- `controle-gastos-frontend/src/App.js` (`:42-43`, rota em `:279`) e `controle-gastos-frontend/src/components/Layout/menuStructure.js` (`:126`) — rota `/conjunto` e item de menu "Contas Conjuntas".

Não foi encontrado acoplamento em `emprestimoService.js` nem em `menuStructure.js` além do item de menu citado (falso positivo inicial era a palavra "desvinculou", sem relação).

Também identificado durante a investigação de `app.js`: a rota `/api/acertos` (`backend/src/routes/rotasAcertos.js` + `backend/src/controllers/acertoController.js`) é um terceiro arquivo de rota dedicado exclusivamente a estornar `AcertoConjunto` (delega pra `vinculoService.estornarAcerto`) — não citado na investigação original, precisa ser removido junto.

## Decisões validadas com o usuário

- **Dado histórico:** transações antigas com `contaConjunta.ativo && pagoPor === 'outro'` já têm `transacao.valor` e `pagamentos[]` gravados como a parte do usuário (não o valor total). **Mantido como está** — semanticamente correto (reflete o que de fato saiu/entrou do bolso do usuário). Não haverá reprocessamento/expansão pro valor total.
- **Saldo pendente:** usuário confirmou que não há vínculo com saldo devedor em aberto hoje — não é necessário gerar acerto final antes da remoção.

## O que remover

Backend:
- `models/vinculoConjunto.js`, `models/acertoConjunto.js` (entidades inteiras)
- `services/vinculoService.js` (FIFO e cálculo de saldo)
- `controllers/vinculoConjuntoController.js`, `routes/rotasVinculoConjunto.js`
- `controllers/acertoController.js`, `routes/rotasAcertos.js` (rota `/api/acertos`, dedicada a estornar `AcertoConjunto`)
- Em `app.js`: os `require`s de `rotasVinculoConjunto`/`rotasAcertos` e os `app.use('/api/vinculos-conjuntos', ...)`/`app.use('/api/acertos', ...)`
- Subdocumento `contaConjunta` do schema `Transacao`
- Em `transacaoService.js`: `validarContaConjunta`, `prepararValorEContaConjunta`, e o ramo condicional em `validarSomaPagamentos` (volta a validar sempre soma = `transacao.valor`, sem exceção)
- Em `controladorTransacao.js`: qualquer leitura/gravação de `req.body.contaConjunta`
- Subdocumento `contaConjunta` do schema `TransacaoImportada` (`models/transacaoImportada.js`), incluindo o trecho equivalente no método de serialização
- Em `transacaoImportadaController.js`: `contaConjunta` de `camposPermitidos` e o bloco de leitura/gravação dedicado
- Em `importacaoController.js`: os dois trechos que copiam `contaConjunta` de `TransacaoImportada` pra `Transacao` na finalização

Frontend:
- Telas/componentes de gestão de vínculo e acertos: `pages/Conjunto/ConjuntoPage.js`(+`.css`), `pages/Conjunto/DetalheVinculoPage.js`, `hooks/useContaConjunta.js`
- Campos de `contaConjunta` no form de transação (`components/Transaction/TabAvancado.js`, `TabResumo.js`, `NovaTransacaoForm.js`), mantendo intacta a divisão via `pagamentos[]` já existente no mesmo form
- Exibição de `contaConjunta` em `pages/ImportacaoMassa/DetalhesImportacaoPage.js` (tela de revisão de importação)
- Campo `vinculo` derivado de `contaConjunta` em `pages/Relatorio/Relatorio.js` (`flattenTransactions`)
- Os 5 métodos de API em `src/api.js` (`listarVinculosConjuntos`, `criarVinculoConjunto`, `obterVinculoConjunto`, `atualizarVinculoConjunto`, `excluirVinculoConjunto`)
- Rota `/conjunto` e imports de `ConjuntoPage`/`DetalheVinculoPage` em `App.js`
- Item de menu "Contas Conjuntas" em `components/Layout/menuStructure.js`
- Em `middleware/transformarDados.js`: nenhuma referência encontrada — confirmar novamente na execução caso o arquivo tenha mudado

## O que permanece intacto

`Transacao.pagamentos[]` inteiro — estrutura, validação de soma (simplificada, sem o ramo especial), uso em relatórios/filtros/parcelamento. Nenhuma mudança de comportamento pra quem usa divisão de pagamento hoje fora do contexto de conta conjunta.

## Migração de dados

Como não há saldo pendente, a remoção é segura sem acerto final. Necessário script de migration (conforme regra do projeto: usuário roda manualmente, nunca o Claude):
- `$unset` do campo `contaConjunta` em todas as `Transacao` existentes (valor em si do documento não é alterado, só o metadado de vínculo)
- `$unset` do campo `contaConjunta` em todas as `TransacaoImportada` existentes (mesma lógica — descoberto na revisão de 2026-08-07, ver seção de Importação acima)
- `drop` das coleções `vinculoconjuntos` e `acertoconjuntos`

O script será entregue completo junto com o comando exato (PowerShell) na fase de execução, para o usuário rodar e confirmar o resultado — não será executado automaticamente.

## Testes

- `ledgerService`/`netWorthService` não são afetados (módulo de Patrimônio, sem relação com conta conjunta) — não é necessário rodar `npm test` por causa desta mudança especificamente, mas deve ser rodado de qualquer forma como checagem de regressão padrão antes de reportar como concluído.
- Validação principal é manual: garantir que criar/editar transação com múltiplos `pagamentos[]` continua funcionando exatamente como antes, sem os campos de conta conjunta.

## Fora de escopo

- Conta Fixa — spec separado (`2026-08-05-conta-fixa-design.md`), desenhado desde já para não depender de `contaConjunta`, usando `pagamentos[]` normalmente.
