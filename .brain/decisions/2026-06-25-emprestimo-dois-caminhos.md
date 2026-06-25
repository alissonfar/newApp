---
type: decision
status: active
created: 2026-06-25
tags: [emprestimos, schema, pagamento, multi-caminho, backwards-compat]
---

# ADR-015 — Empréstimo suporta 2 caminhos: TX-level (legado) e Pagamento-level (novo)

## Contexto

A decisão do ADR-014 (valor esperado por Transação) simplificou o caso de **1 TX de gasto** vinculada a um Empréstimo. Mas ficou um cenário não-coberto:

**Cenário real (relatado pelo Alisson):** TX de R$ 895,00 dividida em **2 pagamentos** (Alisson R$ 447,50 + Estrela R$ 447,50). Só a parte da Estrela é o valor emprestado — a parte do Alisson é gasto seu normal.

No modelo atual, o campo `emprestimoId` mora no schema `Transacao` (1 valor por TX). A TX ou **é 100% empréstimo** ou **não é**. Não tem como marcar "1 dos pagamentos é empréstimo, o outro não".

## Opções consideradas

### Opção A — Refactor completo: mover `emprestimoId` DEFINITIVAMENTE pro Pagamento
**Rejeitada** (nesta rodada). Conceitualmente mais limpo, mas exige:
- Migration complexa de TXs já vinculadas
- Reescrita de `calcularTotais`, `emprestimoAjuste`, controllers
- Risco alto de regressão logo após refatoração 2

### Opção B — Campo `valorEmprestado` parcial na Transação
**Rejeitada.** Conceitualmente ambíguo ("essa TX é 100% empréstimo mas só X% conta"). Não escala para múltiplos pagamentos.

### Opção C — Adicionar `emprestimoId` no sub-schema `Pagamento` (sem remover o da Transação)
**Escolhida.** Os 2 caminhos coexistem:
- **Caminho A (legado):** `t.emprestimoId` no nível TX. Para TXs de 1 pagamento. Continua funcionando.
- **Caminho B (novo):** `pagamentos[].emprestimoId` no nível do Pagamento. Para TXs com 2+ pagamentos, marcação individual.

**Regra de exclusividade mútua:** TX-level e Pagamento-level não podem coexistir. Backend rejeita com HTTP 400.

**Pró:**
- ✅ Resolve o cenário 50/50 perfeitamente
- ✅ Mantém 100% compatibilidade com TXs existentes (legado)
- ✅ Conceitualmente coerente (a dívida mora no pagamento, que é onde mora a divisão por pessoa)
- ✅ Generaliza para casos futuros (3 pagamentos, 2 com empréstimo, etc.)
- ✅ Esforço médio, sem migration complexa

**Contra:**
- ⚠️ 2 lugares onde mora `emprestimoId` (TX e Pagamento) — pode confundir inicialmente
- ⚠️ Cálculo de `totalEsperado` precisa cobrir ambos os caminhos (ver `calcularTotais` no `emprestimoService.js`)
- ⚠️ `emprestimoAjuste` precisa tratar diferencialmente: legado zera TX inteira, novo zera só os pagamentos emprestados

## Decisão

**Opção C.** Adicionar campo `emprestimoId` (ObjectId, ref Emprestimo, default null) no sub-schema `PagamentoSchema`. Manter o `emprestimoId` no schema `Transacao` por compatibilidade. Adicionar índice sparse em `pagamentos.emprestimoId`.

**Onde mora o `valorEsperadoRetorno`:**
- **Caminho legado (1 pagamento):** campo `valorEsperadoRetorno` no schema `Transacao` (do ADR-014)
- **Caminho novo (2+ pagamentos):** campo `valorEsperadoRetorno` no schema `Pagamento` (adicionado junto com `emprestimoId`)

**Regras de cálculo (`calcularTotais` em `emprestimoService.js`):**
- `totalDisbursed` = soma do `t.valor` (caminho A) + soma do `pagamentos[].valor WHERE pagamentos[].emprestimoId = X` (caminho B, sem duplicar TXs do caminho A)
- `totalReceived` = mesma lógica
- `totalEsperado` = soma do `t.valorEsperadoRetorno` (caminho A) + soma do `pagamentos[].valorEsperadoRetorno WHERE pagamentos[].emprestimoId = X` agrupado 1x por TX (caminho B)

**Regras de relatórios (`emprestimoAjuste` em `utils/emprestimoAjuste.js`):**
- **Caminho legado (TX-level):** zera `t.valor` e `pagamentos[].valor` da TX inteira, marca `_emprestimoEsconderNaLista: true`. TX some da lista de TXs geral.
- **Caminho novo (pagamento-level):** zera APENAS o `pagamentos[].valor` dos pagamentos emprestados, mantém a TX visível. Marca `_emprestimoParcial: true` na TX, `_emprestimoEsconder: true` nos pagamentos individuais emprestados. **O resto da TX (pagamentos não emprestados) CONTA normalmente como gasto do usuário** nos relatórios.

**Comportamento na UI:**
- Form de TX com 1 pagamento: seção "Esta transação faz parte de um empréstimo" na aba Avançado (caminho legado).
- Form de TX com 2+ pagamentos: aba Avançado esconde seção legado, mostra hint. Usuário marca por pagamento na aba Pagamentos (nova coluna "Empréstimo" com suíte completa: pessoa, vincular/criar, valor esperado, tipo, prazo).

**Componente reutilizável:**
- `EmprestimoFormFields.js` (criado nesta sessão) encapsula a suíte interna de campos (pessoa, radio vincular/criar, select empréstimo OU campos criar, valor esperado). Usado por `EmprestimoSecao` (caminho legado) e `TabPagamentos` (caminho novo, por linha de pagamento).

**Replicação em parcelamento:**
- Se uma TX é parcelada e o user marca o pagamento como empréstimo, **todas as parcelas** recebem o `pagamentos[].emprestimoId` replicado.
- Edições posteriores de parcelamento: parcelas existentes mantêm o vínculo, **novas parcelas não herdam**.

**Botão "Excluir do empréstimo" no detalhe:**
- Caminho legado: remove a TX inteira do Empréstimo (chama `atualizarTransacao` com `emprestimoId: null`).
- Caminho novo: abre modal explicativo "Para desvincular este pagamento, edite a TX e desmarque o checkbox do pagamento." (não remove direto da tela de detalhe porque pode ter outros pagamentos da mesma TX no Empréstimo).

## Consequências

### Pró
- Resolve cenário 50/50 (e generaliza)
- Mantém compatibilidade com TXs existentes
- Conceitualmente coerente
- Componente reutilizável reduz duplicação

### Contra
- 2 lugares com `emprestimoId` (risco de confusão)
- Lógica de `emprestimoAjuste` mais complexa
- Cálculo de totais precisa cobrir 2 caminhos (3 aggregates separados)
- UI adaptativa (legado vs novo) precisa ser explicada

### Impacto em outras áreas
- **Relatórios:** `emprestimoAjuste` precisa ser estendido para cobrir caminho novo (ver playbook `Mongoose strict mode` e a sessão de debug)
- **Frontend:** novo componente `EmprestimoFormFields.js`, `usePagamentos.js` estendido, `NovaTransacaoForm.js` com payload complexo
- **Testes:** 7 testes novos cobrindo cenário canônico (Estrela), mix legado+novo, parcelamento, 2 empréstimos distintos, recebível parcial

## Implementação

- Design: `2026-06-24-emprestimos-pagamento-level-design.md`
- Pós-execução: `2026-06-24-emprestimos-pos-execucao.md` (sessão consolidada)
- Componente reutilizável: `controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js`
- Schema: `backend/src/models/transacao.js` (campo `emprestimoId` no `PagamentoSchema`)
- Service: `backend/src/services/emprestimoService.js` (3 aggregates em `calcularTotais`)
- Ajuste: `backend/src/utils/emprestimoAjuste.js` (caminho novo)
