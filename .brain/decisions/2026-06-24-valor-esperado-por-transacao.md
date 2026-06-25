---
type: decision
status: active
created: 2026-06-24
tags: [emprestimos, schema, valor-esperado, transacao]
---

# ADR-014 — `valorEsperadoRetorno` mora na Transação, não no Empréstimo

## Contexto

O módulo de Empréstimos permite vincular **múltiplas Transações de desembolso** a um único Empréstimo (ex: você emprestou R$ 600, depois R$ 500, ambos para a Estrela — mas o combinado em cada um é diferente: "vou receber R$ 800 do primeiro" e "vou receber R$ 500 do segundo").

No modelo original, o campo `valorEsperadoRetorno` morava no schema `Emprestimo` (1 número global). O sistema tratava o Empréstimo como tendo **um único valor esperado** — herdado da primeira TX ou definido no cadastro.

**Fricção reportada pelo Alisson:** na tela `/emprestimos/6a3bc4d19673558cc78c136e` (Empréstimo "Estrela"), os 4 cards de totais mostravam valores conceitualmente errados:
- "Valor esperado" = R$ 800 (mas a soma real é R$ 1.300 = 800 + 500)
- "Saldo a receber" = R$ 800 (mas deveria ser R$ 1.300)
- "Prejuízo" = R$ 1.100 (conceitualmente errado, "prejuízo" não deveria existir como label)

A regra do design doc anterior (refatoração 1) era "complemento de Empréstimo = editar `valorEsperadoRetorno` no mesmo Empréstimo", mas isso escondia a realidade: **cada TX de gasto tem sua própria expectativa de retorno**.

## Opções consideradas

### Opção A — Manter `valorEsperadoRetorno` no Empréstimo, somar TXs para exibir
Calcular o total esperado dinamicamente como `sum(t.valorEsperadoRetorno WHERE t.emprestimoId = X)`, mas manter o campo no schema Empréstimo.

**Pró:** Schema do Empréstimo não muda.
**Contra:** Conceitualmente confuso (o Empréstimo tem 1 valor esperado, mas o display soma vários). Não resolve o problema de ter múltiplos esperados por TX.

### Opção B — Mover `valorEsperadoRetorno` para a Transação
**Escolhida.** Cada TX de gasto vinculada a um Empréstimo tem seu próprio `valorEsperadoRetorno`. O total do Empréstimo = soma dos esperados das TXs.

**Pró:**
- ✅ Coerente com a realidade: cada gasto carrega sua própria expectativa
- ✅ Generaliza para qualquer número de TXs (1, 2, 5, 50)
- ✅ A TX é auto-contida (não precisa consultar Empréstimo pra saber o esperado dela)
- ✅ Cálculo do Empréstimo fica natural: `totalEsperado = sum(tx.valorEsperadoRetorno WHERE tx.emprestimoId = X AND tx.tipo = 'gasto' AND tx.status = 'ativo')`

**Contra:**
- ❌ Mudança estrutural no schema (mover campo)
- ❌ Migration 009 de limpeza necessária (Alisson não usou em produção, então trivial)
- ❌ Quebra código que lia `emprestimo.valorEsperadoRetorno` (precisa ser substituído por `sum(t.valorEsperadoRetorno)` em vários lugares)
- ❌ Conceito de "complemento" muda: ao invés de "criar 2º Empréstimo", agora é "vincular mais TX ao mesmo Empréstimo" (decisão já documentada na refatoração 1)

### Opção C — Manter campo no Empréstimo E adicionar campo por TX (2 fontes)
**Rejeitada.** Duas fontes de verdade = inconsistência garantida. Pior que as outras opções.

## Decisão

**Opção B.** O campo `valorEsperadoRetorno` é **removido** do schema `Emprestimo` e **adicionado** ao schema `Transacao` (Number, min 0, default null).

**Fórmulas do Empréstimo (estado pós-decisão):**
- `totalEsperado = SUM(t.valorEsperadoRetorno WHERE t.emprestimoId = X AND t.tipo = 'gasto' AND t.status = 'ativo' AND t.emprestimoEhJurosAuto != true)`
- `saldoAReceber = totalEsperado - totalReceived`
- `lucro = totalEsperado - totalDesembolsado` (label sempre "Lucro esperado", cor verde se positivo, vermelha se negativo)
- **"Prejuízo" deixa de existir** como card — se a soma esperada for menor que a desembolsada (caso degenerado), o card mostra "Lucro" em vermelho

## Consequências

### Pró
- Modelo conceitualmente coerente (esperado mora onde o gasto mora)
- Suporta naturalmente o cenário multi-TX (cada TX com seu próprio esperado)
- Cálculo de saldo a receber e lucro esperado fazem sentido matematicamente
- Migration 009 simples (Alisson não usou em produção, então é limpeza)

### Contra
- 16+ arquivos modificados (schema, controllers, services, frontend, testes)
- Migration 009 de limpeza
- Conceito de "complemento" do Empréstimo muda (não cria mais 2º Empréstimo, só vincula mais TXs)

### Impacto em outras áreas
- **Relatórios:** `emprestimoAjuste` continua zerando TXs inteiras vinculadas (caminho legado, 1 pagamento). Sem impacto no comportamento geral.
- **Pluggy:** não usa Empréstimo, sem impacto.
- **Ledger/NetWorth:** não usa Empréstimo, sem impacto.

## Implementação

- Design: `2026-06-24-emprestimos-valor-esperado-por-tx-design.md`
- Pós-execução: `2026-06-24-emprestimos-pos-execucao.md` (sessão de pós-execução consolidada)
- Migration: `backend/scripts/migrations/009-emprestimo-limpeza.js`
