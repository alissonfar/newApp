---
type: glossary
status: active
created: 2026-06-25
tags: [glossario, emprestimos, termos, dominio]
---

# Glossário — Módulo de Empréstimos

> Termos e conceitos do módulo de Empréstimos. Lê-se do mais conceitual (topo) pro mais técnico (rodapé).

## Conceitos de domínio

### Empréstimo (Loan)
Uma obrigação entre você e outra pessoa. **Sempre** no sentido de "EU estou emprestando para outra pessoa" (direção implícita, removida do schema na refatoração 1). Se você pegou emprestado de alguém, isso **não** é modelado neste módulo.

### Desembolso (Disbursement)
Dinheiro que **saiu do seu bolso** pra emprestar. Modelado como uma Transação de **gasto** vinculada ao Empréstimo (via `emprestimoId` no nível TX, ou via `pagamentos[].emprestimoId` no nível do pagamento).

### Recebimento (Receipt)
Dinheiro que **entrou** na sua conta como parte da devolução. Modelado como uma Transação de **recebível** vinculada ao Empréstimo.

### TX de juros auto
Transação **gerada automaticamente pelo sistema** na quitação do Empréstimo (quando `totalReceived >= totalEsperado`). Tem flag `emprestimoEhJurosAuto: true` e representa o lucro realizado do Empréstimo. Aparece como receita normal nos relatórios.

### Quitação (Settlement)
Status `quitado` do Empréstimo, atingido automaticamente quando `totalReceived >= totalEsperado`. Transição irreversível (decisão do design doc: usuário gerencia o status manualmente após edição).

### Cancelamento
Status `cancelado` do Empréstimo. **TXs vinculadas permanecem ativas** (órfãs de propósito). Documentado como pendência fora de escopo (Bloco 4 da FASE 2 da refatoração 1).

## Conceitos de valor

### Valor esperado (`valorEsperadoRetorno`)
**Quanto eu espero receber de volta** desta transação como um todo. Mora no schema `Transacao` (1 pagamento) ou `Pagamento` (2+ pagamentos). É a entrada do usuário, NÃO calculada pelo sistema.

### Total esperado do Empréstimo
Soma do `valorEsperadoRetorno` de todas as TXs (ou pagamentos) vinculados. Calculado em `calcularTotais` no `emprestimoService.js`.

### Total desembolsado
Soma do `valor` das TXs (ou pagamentos) tipo `gasto` vinculados. Calculado em `calcularTotais`.

### Total recebido
Soma do `valor` das TXs (ou pagamentos) tipo `recebivel` vinculados (excluindo TX de juros auto). Calculado em `calcularTotais`.

### Saldo a receber
`totalEsperado - totalReceived` (= quanto ainda falta a pessoa te pagar).

### Lucro esperado
`totalEsperado - totalDesembolsado` (= quanto você vai lucrar se a pessoa pagar tudo que combinado). Label sempre "Lucro esperado", cor verde se positivo, vermelha se negativo. **"Prejuízo" como card foi removido** (decisão do design doc — agora se a soma esperada for menor que a desembolsada, o card mostra "Lucro" em vermelho).

### Lucro realizado
`totalReceived - totalDesbursed` (= quanto você já lucrou de fato). É o que a TX de juros auto tem como `valor` (criada na quitação).

## Conceitos técnicos (caminhos)

### Caminho legado — TX-level
- **Onde mora o vínculo:** `transacao.emprestimoId` (campo da Transação, nível superior)
- **Quando usar:** TX com 1 pagamento, marcada inteira como empréstimo
- **UI:** aba Avançado do form de TX, seção "Esta transação faz parte de um empréstimo"
- **Exibição na lista:** TX **some** da lista de TXs geral (`_emprestimoEsconderNaLista: true`)

### Caminho novo — Pagamento-level
- **Onde mora o vínculo:** `transacao.pagamentos[].emprestimoId` (campo no sub-schema `Pagamento`)
- **Quando usar:** TX com 2+ pagamentos, só ALGUNS são empréstimo (cenário 50/50)
- **UI:** aba Pagamentos do form de TX, coluna "Empréstimo" por linha de pagamento
- **Exibição na lista:** TX **continua visível** (mas o pagamento emprestado é descontado do valor exibido)

### Regra de exclusividade mútua
TX-level e Pagamento-level **não podem coexistir**. Backend rejeita com HTTP 400. Garantia implementada no `validarExclusividadeEmprestimo` em `controladorTransacao.js`.

### Componente reutilizável `EmprestimoFormFields.js`
Encapsula a suíte interna de campos de Empréstimo (pessoa, radio vincular/criar, select empréstimo OU campos criar, valor esperado, tipo, prazo). Usado tanto pelo `EmprestimoSecao` (caminho legado) quanto pelo `TabPagamentos` (caminho novo, por linha de pagamento). Localização: `controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js`.

## Conceitos de UI

### Movimentações (tabela)
Tabela na tela de detalhe do Empréstimo que lista as TXs (ou pagamentos) vinculados. Para o caminho legado, 1 linha por TX. Para o caminho novo, 1 linha por pagamento emprestado.

### Botão "Excluir do empréstimo"
- **Caminho legado:** remove a TX inteira do Empréstimo (chama `atualizarTransacao` com `emprestimoId: null`).
- **Caminho novo:** abre modal explicativo "Para desvincular este pagamento, edite a TX e desmarque o checkbox do pagamento." (não remove direto da tela de detalhe porque pode ter outros pagamentos da mesma TX no Empréstimo).

### Tag de identificação (pagamento-level)
Tag azul `↗ Estrela` exibida ao lado da descrição da TX na tabela "Movimentações" quando o pagamento é vinculado a um Empréstimo (caminho novo). Identifica qual pessoa é a devedora.

## Conceitos de cálculo (módulos backend)

### `calcularTotais(emprestimoId, usuarioId)` — `emprestimoService.js`
Calcula `totalDisbursed`, `totalReceived`, `totalEsperado` para um Empréstimo. Faz 3 aggregates separados:
1. **Caminho 1 (TX-level legado):** filtra `t.emprestimoId = X`, soma `t.valor` e `t.valorEsperadoRetorno`.
2. **Caminho 2 (Pagamento-level novo):** filtra `pagamentos[].emprestimoId = X` excluindo TXs já contadas no caminho 1, soma `pagamentos[].valor`.
3. **Esperado do pagamento (caminho 2):** agrupa por TX (1x por TX) e soma `pagamentos[].valorEsperadoRetorno`.

### `recalcularStatus(emprestimoId, usuarioId)` — `emprestimoService.js`
Detecta transição `ativo → quitado` quando `totalReceived >= totalEsperado`. Cria/atualiza/deleta a TX de juros auto. Idempotente. Sem auto-reversão `quitado → ativo` (decisão do design doc — usuário gerencia status manualmente).

### `ajustarRecebiveisDeEmprestimo(transacoes, userId)` — `emprestimoAjuste.js`
Trata TXs de Empréstimo para fins de relatórios:
- **Caminho legado (TX-level):** zera `t.valor` e `pagamentos[].valor` da TX inteira, marca `_emprestimoEsconderNaLista: true`.
- **Caminho novo (Pagamento-level):** zera APENAS os `pagamentos[].valor` emprestados, mantém a TX visível com valor descontado. Marca `_emprestimoParcial: true` na TX, `_emprestimoEsconder: true` nos pagamentos emprestados. **O resto da TX (pagamentos não emprestados) CONTA normalmente como gasto do usuário nos relatórios.**

## Conceitos de migrations

### Migration 008 — Simplificação do módulo
Normaliza Empréstimos e TIs antigos. Remove `direcao`, `taxaJurosPercentual`, `valorJurosFixo`. Converte `tipoRetorno: 'juros_*'` → `'valor_fixo'`. Idempotente. Localização: `backend/scripts/migrations/008-emprestimo-simplificacao.js`.

### Migration 009 — Limpeza
Deleta TODOS os Empréstimos (ativos, quitados, cancelados), desvincula TODAS as TXs de Empréstimo (`emprestimoId: null`, `emprestimoEhJurosAuto: false`), deleta TIs com `emprestimoConfig.ativo = true`. As TXs originais permanecem ativas. Idempotente. Localização: `backend/scripts/migrations/009-emprestimo-limpeza.js`. **Usada antes do deploy da refatoração 2 (valor esperado por TX), porque o Alisson não tinha usado o módulo em produção.**

## Conceitos de bug conhecido (pra não cair de novo)

### Mongoose strict mode descartando campos
Mongoose tem `strict: true` por padrão — campos extras no body do request são **descartados silenciosamente**. SEM erro, SEM warning. Diagnóstico: console.log do body recebido + console.log do doc salvo após `save()`. Solução: adicionar campo no schema. Ver [playbook de debug Mongoose strict](../playbooks/debug-campos-descartados-mongoose-strict.md).

### `emprestimoId` do nível TX vs do nível Pagamento
Backend SÓ lê `req.body.emprestimoId` no nível TX por default. Para caminho novo, precisa ler `req.body.pagamentos[].emprestimoId` (e cada um separadamente). Controller já cobre ambos (refatoração 2 + bug fix 2026-06-25).
