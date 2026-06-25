---
type: decision
status: superseded
created: 2026-06-21
superseded: 2026-06-21
tags: [emprestimos, calculo, fifo, arquitetura]
---

# ADR-013 — Empréstimo sem FIFO: lucro simples baseado em soma de TXs

> **STATUS (2026-06-25):** Esta decisão foi **integrada** como parte da refatoração maior do módulo de Empréstimos de 2026-06-21 (ver `2026-06-21-emprestimos-design.md`). Foi promovida a ADR-013 e marcada como `superseded` para preservar o histórico da decisão.

## Contexto

O módulo de Empréstimos original calculava o lucro de um empréstimo usando **FIFO + split por transação**: cada recebimento era dividido entre "principal devolvido" e "juros", e os juros geravam uma TX-extra com flag `emprestimoEhJurosAuto`. O algoritmo:

```
Ordena TXs vinculadas por data ASC.
Para cada gasto (desembolso): soma em "desembolsado", ZERA o valor na listagem de relatórios.
Para cada recebível (não auto): "principal = min(recebimento, restante de principal); juros = recebimento - principal".
Soma de "juros" vai pra uma transação-extra com flag `emprestimoEhJurosAuto: true`.
```

O modelo tinha 4 tipos de retorno (`valor_fixo`, `juros_percentual`, `juros_fixo`, `sem_juros`) e 2 direções (`concedido`, `recebido`), com campos `taxaJurosPercentual` e `valorJurosFixo` que eram **persistidos mas não calculavam nada**.

**Fricção reportada pelo Alisson:** "o módulo de Empréstimos não está se comportando como esperado." Análise bloco-a-bloque revelou que o motor FIFO era conceitualmente torto e não alinhado com o modelo mental do usuário.

## Opções consideradas

### Opção A — Manter FIFO + split, melhorar UX e clareza do help-text
Manter o algoritmo, mas melhorar a documentação, o help-text e o display.

**Pró:** Sem mudança de cálculo, sem risco de regressão.
**Contra:** Não resolve a fricção conceitual. O Alisson continuaria não entendendo por que "valor_fixo" não gerava lucro automaticamente.

### Opção B — Substituir por cálculo simples `lucro = soma_recebíveis - soma_gastos`
**Escolhida.** Sem split, sem FIFO, sem campos de taxa ignorados.

**Pró:**
- ✅ Modelo conceitualmente claro: "se eu recebi mais do que gastei, tenho lucro"
- ✅ Alinhado com o modelo mental do Alisson: "valor_fixo" = "esse é o valor final que vou receber" (e o lucro é subproduto)
- ✅ Elimina campos `taxaJurosPercentual`/`valorJurosFixo` (não são mais necessários)
- ✅ Reduz 4 tipos de retorno para 2 (`valor_fixo`, `sem_juros`)

**Contra:**
- ❌ Quebra `recalcularStatus` (precisa ser reescrito sem split)
- ❌ Quebra `emprestimoAjuste` (split removido)
- ❌ Requer migration 008 (normalizar `tipoRetorno: 'juros_*'` → `'valor_fixo'`, `direcao: 'recebido'` → `'concedido'`, remover campos órfãos)
- ❌ Decisão consciente: **NÃO** migra o módulo para `decimal.js` (mantém `Number` puro, aceitando risco de 1 centavo)

### Opção C — Migrar para `decimal.js` ao mesmo tempo
Refatorar o módulo inteiro para usar `decimal.js` (consistente com `useSimulacao.js`, `vinculoService.js`).

**Pró:** Consistência com o resto do projeto.
**Contra:** Escopo expandido (briefing original: "Não adicione novas funcionalidades"). Decisão consciente de adiar para rodada futura.

## Decisão

**Opção B.** Lucro calculado como `soma_recebíveis - soma_gastos`, sem FIFO nem split. 2 tipos de retorno (`valor_fixo`, `sem_juros`). Campos `taxaJurosPercentual` e `valorJurosFixo` removidos do schema.

## Consequências

### Pró
- Cálculo de lucro trivial de entender e validar
- Alinhamento conceitual entre UX e modelo de dados
- Eliminação de campos "fantasma" (persistidos mas não usados)
- Redução de 50% do código no `emprestimoService` e `emprestimoAjuste`

### Contra
- Migration 008 necessária (idempotente, não destrutiva)
- Re-escrita de 3 arquivos de teste
- Divergência consciente do AGENTS.md ("NUNCA float nativo pra dinheiro") — registrada como exceção

### Impacto em outras áreas
- **Relatórios:** summary precisa compensar (TXs de Empréstimo continuam escondidas, mas a compensação é refeita sem split)
- **Pluggy:** não usa Empréstimo, sem impacto
- **Ledger/NetWorth:** não usa Empréstimo, sem impacto
- **Vinculo/Conta Conjunta:** não usa Empréstimo, sem impacto

## Implementação

- Design: `2026-06-21-emprestimos-design.md`
- Pós-execução: `2026-06-21-emprestimos-pos-execucao.md`
- Migration: `backend/scripts/migrations/008-emprestimo-simplificacao.js`
