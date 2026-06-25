---
type: design
status: approved
created: 2026-06-24
approved: 2026-06-24
tags: [emprestimos, design-doc, pagamento-level, refactor, brainstorm]
---

# Design Doc — Empréstimo no Nível do Pagamento (Pagamento-level `emprestimoId`)

> Documento de design para suportar o cenário onde **uma TX com múltiplos pagamentos tem apenas ALGUNS pagamentos** que são parte de um Empréstimo (ex: dividir uma compra 50/50, sendo que 1 dos pagamentos é o valor que a pessoa te deve).

## 1. Contexto e motivação

### 1.1 O caso concreto

Na TX de **R$ 895,00** (Pix para Igor Rodrigues Pacheco, 16/06/2026, importação #6a32bda626b5b4ff3e9d774b), os pagamentos são:

- Alisson: R$ 447,50
- Estrela: R$ 447,50

A parte do pagamento da **Estrela** (R$ 447,50) é um valor emprestado — Estrela te deve essa parte. Mas a TX **inteira** não é empréstimo (a sua metade é gasto seu normal).

### 1.2 O que o sistema atual não resolve

O campo `emprestimoId` mora no schema `Transacao` (1 valor por TX). A TX ou **é 100% empréstimo** ou **não é**. Não tem como marcar "1 dos pagamentos é empréstimo".

### 1.3 Decisões consolidadas (do brainstorm de 2026-06-24)

| # | Tema | Decisão |
|---|------|---------|
| 1 | Onde mora o `emprestimoId` novo | No sub-schema `Pagamento` (campo novo, opcional) |
| 2 | `emprestimoId` da Transação | **Mantido** por compatibilidade (TX-level legado continua funcionando) |
| 3 | Valor parcial dentro de 1 pagamento | **Não suportado** — cada pagamento é 100% ou 0% empréstimo |
| 4 | Parcelamento | **Replica para todas as parcelas** — se 1 parcela tem `emprestimoId` em algum pagamento, todas as outras parcelas herdam |
| 5 | Botão "Excluir do empréstimo" | **Estendido** — além de desvincular a TX inteira (legado), permite desvincular **uma parcela específica** do parcelamento |
| 6 | UX do form de TX | **Adaptativa** — 1 pagamento = seção legado na aba Avançado; 2+ pagamentos = força marcação por pagamento na aba Pagamentos |

## 2. Modelo conceitual

### 2.1 Os 2 caminhos (coexistem)

**Caminho A — TX-level (legado, 1 pagamento):**
```
Transacao
├── emprestimoId: <id>           ← toda a TX é empréstimo
├── pagamentos: [{pessoa: 'A', valor: 200, emprestimoId: null}]
```

**Caminho B — Pagamento-level (novo, múltiplos pagamentos):**
```
Transacao
├── emprestimoId: null            ← TX NÃO é empréstimo (no nível TX)
├── pagamentos: [
│     {pessoa: 'Alisson',  valor: 447.50, emprestimoId: null},    ← não é
│     {pessoa: 'Estrela',  valor: 447.50, emprestimoId: <id>}     ← SÓ este é
│   ]
```

**Regra de ouro:** TX-level e Pagamento-level são **mutuamente exclusivos**. Se a TX tem `emprestimoId` no nível TX, nenhum pagamento pode ter `emprestimoId` (e vice-versa). Backend rejeita se ambos tiverem.

### 2.2 Comportamento nos Relatórios (canônico: cenário Estrela)

Este é o ponto crítico do design. **O comportamento nos relatórios (dashboard, lista de TX, relatório avançado, export) é diferente para o caminho legado vs pagamento-level:**

#### Caminho A — TX-level legado (`t.emprestimoId = X`)
- A TX **inteira** é "escondida" dos relatórios (`_emprestimoEsconderNaLista: true`).
- `t.valor` zerado, todos `pagamentos[].valor` zerados.
- O **resumo** do relatório desconta a TX inteira do total de gastos (ou soma como receita, no caso de recebíveis).
- **NÃO conta como gasto/recebível do usuário** — porque é 100% empréstimo.

#### Caminho B — Pagamento-level novo (`pagamentos[].emprestimoId = X`, `t.emprestimoId: null`)
- **A TX NÃO é escondida** dos relatórios (continua aparecendo na lista de TXs).
- **Cada pagamento é tratado individualmente:**
  - **Pagamento COM `emprestimoId`:** valor zerado no resumo, marcado com `_emprestimoEsconder: true` (frontend pode ocultar visualmente, mas mantemos o doc visível pra rastreabilidade).
  - **Pagamento SEM `emprestimoId`:** valor **NORMAL** no resumo — **CONTA** como gasto/recebível do usuário.
- Flag `_emprestimoParcial: true` na TX indica "essa TX tem pagamentos emprestados e não".

#### Exemplo canônico (Estrela, 50/50)

**TX:** R$ 895,00, 2 pagamentos (Alisson 447,50 + Estrela 447,50), 1 emprestado (Estrela).

| Item | Relatório (dashboard, lista, export) | Cálculo do Empréstimo |
|------|--------------------------------------|------------------------|
| TX (visível) | Aparece na lista | NÃO conta como 1 TX |
| Pagamento Alisson (R$ 447,50) | **CONTA como gasto seu** (+R$ 447,50 no total de gastos) | NÃO conta |
| Pagamento Estrela (R$ 447,50) | NÃO conta (zerado) | **CONTA** como desembolso do Empréstimo |
| **Total em "Gastos"** | **R$ 447,50** | — |
| **Empréstimo "Estrela" — Desembolsado** | — | **R$ 447,50** |
| **Empréstimo "Estrela" — Saldo a receber** | — | `valorEsperado - recebido` (ex: 500 - 0 = R$ 500) |
| **Empréstimo "Estrela" — Lucro esperado** | — | `valorEsperado - 447,50` (ex: R$ 52,50) |

**Resumo:** o gasto do usuário (R$ 447,50) **entra no relatório como despesa real**. O gasto da Estrela (R$ 447,50) é "túnel" — sai do bolso do usuário mas não conta como despesa, vai pro Empréstimo.

#### Onde isso é aplicado (4 consumidores do `ajustarRecebiveisDeEmprestimo`)

Todos esses pontos vão herdar a nova lógica do `emprestimoAjuste` automaticamente (sem mudança de assinatura):

1. **`controladorTransacao.js:114`** — `GET /api/transacoes` (sem paginação, lista geral)
2. **`controladorTransacao.js:228`** — `GET /api/transacoes` (paginado, com `dataPage`)
3. **`controladorTransacao.js:351`** — `GET /api/transacoes/export` (export CSV/OFX)
4. **`reportEngine/filterService.js:129`** — `fetchFilteredTransactions` (relatório avançado)

> **Confirmação conceitual:** o `controladorRelatorio` e o `controladorRelatorioAvancado` ambos consomem `fetchFilteredTransactions` (via `reportEngine/index.js:54`), que aplica o `ajustarRecebiveisDeEmprestimo` na linha 129. Logo, **dashboard, lista de TX, relatório avançado e export** todos vão ter o comportamento correto automaticamente.

### 2.3 Cálculo de totais do Empréstimo

O `calcularTotais` (em `emprestimoService.js`) precisa cobrir os 2 caminhos **sem duplicar**:

**Lógica:**
```
1. Aggregate de TXs com `t.emprestimoId = X` no nível TX (caminho legado):
   - Para cada tipo (gasto/recebivel), soma t.valor
   - Para esperado, soma t.valorEsperadoRetorno (apenas em gastos)

2. Aggregate de Pagamentos com `pagamentos[].emprestimoId = X`:
   - SEM incluir TXs já contadas no passo 1
   - Para cada tipo, soma pagamentos[].valor (mas o tipo é o da TX, não do pagamento)
   - Para esperado, soma pagamentos[].valorEsperadoRetorno (campo NOVO por pagamento)
```

> **Detalhe importante:** como `valorEsperadoRetorno` hoje só existe na TX (não no pagamento), e o caminho novo é por-pagamento, precisamos decidir: **o valor esperado vai por TX ou por pagamento?**
>
> **Decisão:** o `valorEsperadoRetorno` continua na **TX** (modelo atual), mas o **vínculo de empréstimo** vai no **pagamento**. Isso significa: se uma TX tem 2 pagamentos (50/50) e 1 deles é empréstimo, a TX inteira tem **1 único `valorEsperadoRetorno`** que se aplica ao **pagamento emprestado**.
>
> Justificativa conceitual: o "valor esperado" é "quanto espero receber de volta desta transação como um todo" — e se aplica ao pagamento que é a parte do empréstimo. Se o usuário quiser embutir lucro só na parte da Estrela, ele ajusta o `valorEsperadoRetorno` da TX para refletir isso (ex: 500 se a parte dela é 447,50 com lucro de 50).

## 3. Mudanças por arquivo

### 3.1 Backend

#### `backend/src/models/transacao.js`
- **ADICIONAR** campo `emprestimoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Emprestimo', default: null }` no `PagamentoSchema` (linha 10).
- Comentário: "Quando setado, este pagamento específico é parte de um Empréstimo. Mutuamente exclusivo com `t.emprestimoId` da Transação."
- ADICIONAR índice `{ 'pagamentos.emprestimoId': 1 }, { sparse: true }` para otimizar aggregations.

#### `backend/src/services/emprestimoService.js`

**`calcularTotais` (atual linha 29)** — refatorar para cobrir 2 caminhos:

```js
async function calcularTotais(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;

  // CAMINHO 1: TX-level legado (t.emprestimoId = X)
  const txLevelAgg = await Transacao.aggregate([
    {
      $match: {
        emprestimoId: objectId,
        usuario: new mongoose.Types.ObjectId(usuarioId),
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$valor' },
        totalEsperado: {
          $sum: { $cond: [{ $eq: ['$tipo', 'gasto'] }, '$valorEsperadoRetorno', 0] }
        }
      }
    }
  ]);

  // CAMINHO 2: Pagamento-level novo (pagamentos[].emprestimoId = X)
  // SEM incluir TXs já contadas no caminho 1
  // (TXs com t.emprestimoId = X são contadas no caminho 1, não aqui)
  const pagamentoLevelAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: new mongoose.Types.ObjectId(usuarioId),
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true },
        'pagamentos.emprestimoId': objectId,
        // Excluir TXs que já estão no caminho 1 (t.emprestimoId = X)
        // (cobre t.emprestimoId = null E t.emprestimoId = outroEmprestimo)
        emprestimoId: { $ne: objectId }
      }
    },
    { $unwind: '$pagamentos' },
    {
      $match: {
        'pagamentos.emprestimoId': objectId
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$pagamentos.valor' }
        // NOTA: valorEsperadoRetorno fica no nível da TX, somado uma vez
        // (não por pagamento). Ver tratamento abaixo.
      }
    }
  ]);

  // Esperado por pagamento: agrega separado (uma vez por TX, não por pagamento)
  // Importante: agrupar por _id da TX ANTES de somar, para não contar 2x se uma TX
  // tem 2 pagamentos com mesmo emprestimoId.
  const esperadoPagamentoAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: new mongoose.Types.ObjectId(usuarioId),
        status: 'ativo',
        tipo: 'gasto',
        'pagamentos.emprestimoId': objectId,
        emprestimoId: { $ne: objectId },
        valorEsperadoRetorno: { $ne: null, $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$_id',  // agrupar por TX (cada TX conta 1 vez)
        valorEsperado: { $first: '$valorEsperadoRetorno' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$valorEsperado' }
      }
    }
  ]);

  // Combinar os 2 caminhos
  let totalDisbursed = 0, totalReceived = 0, totalEsperado = 0;
  
  for (const r of txLevelAgg) {
    if (r._id === 'gasto') {
      totalDisbursed += r.total;
      totalEsperado += r.totalEsperado || 0;
    } else if (r._id === 'recebivel') {
      totalReceived += r.total;
    }
  }
  
  for (const r of pagamentoLevelAgg) {
    if (r._id === 'gasto') totalDisbursed += r.total;
    else if (r._id === 'recebivel') totalReceived += r.total;
  }
  
  totalEsperado += esperadoPagamentoAgg[0]?.total || 0;

  return {
    totalDisbursed,
    totalReceived,
    totalEsperado,
    saldoAReceber: 0,
    lucro: 0
  };
}
```

**`obterEmprestimoComTotais` (atual linha 66)** — sem mudança (usa `calcularTotais` que já retorna `totalEsperado`).

**`recalcularStatus` (atual linha 138)** — sem mudança conceitual. Usa `calcularTotais` que já cobre os 2 caminhos.

#### `backend/src/controllers/controladorTransacao.js`

**`criar` / `atualizar` (criarTransacao linha ~590+, atualizarTransacao linha 667+)** — estender para:
1. Aceitar `emprestimoId` em cada `pagamentos[]` do payload
2. Validar regra de exclusividade mútua:
   ```js
   const txHasEmprestimo = !!transacao.emprestimoId;
   const pagamentosComEmprestimo = (transacao.pagamentos || []).filter(p => p.emprestimoId);
   if (txHasEmprestimo && pagamentosComEmprestimo.length > 0) {
     return res.status(400).json({
       erro: 'Transação não pode ter emprestimoId no nível TX e em pagamentos ao mesmo tempo.'
     });
   }
   ```
3. Persistir o campo em cada `pagamentos[].emprestimoId`
4. **Parcelamento:** ao criar parcelas (lógica existente do `criarParcelamento` ou similar), replicar o `pagamentos[].emprestimoId` para todas as parcelas. Procurar o ponto exato no código.
5. **Desvincular pagamento individual:** novo endpoint `PUT /api/transacoes/:id/desvincular-pagamento` (opcional — pode ser via mesmo `atualizarTransacao` com `pagamentos: [{...sem emprestimoId}]`).

**Decisão de endpoint:** vamos usar o **mesmo `PUT /api/transacoes/:id`** para desvincular pagamento individual (enviar o `pagamentos[]` com o campo `emprestimoId: null` no pagamento específico). Sem novo endpoint.

#### `backend/src/utils/emprestimoAjuste.js`

**`ajustarRecebiveisDeEmprestimo` (atual linha 27)** — estender para cobrir pagamento-level. **Este é o ponto crítico do design** — garante o comportamento correto nos relatórios:

```js
async function ajustarRecebiveisDeEmprestimo(transacoes, userId) {
  // ... código existente (caminho legado) ...
  
  // Adicionar: detectar TXs com pagamentos emprestados (mesmo sem t.emprestimoId)
  const txComPagamentoEmprestado = transacoes.filter(t => 
    t && t.emprestimoId == null &&  // NÃO é empréstimo no nível TX
    Array.isArray(t.pagamentos) && 
    t.pagamentos.some(p => p.emprestimoId)
  );
  
  for (const t of txComPagamentoEmprestado) {
    // TX NÃO é empréstimo no nível TX, mas tem pagamentos emprestados
    // (caminho novo pagamento-level)
    
    t._emprestimoParcial = true;  // flag nova: TX tem pagamentos emprestados
    
    // Calcular o valor que DEVE ser descontado do total de gastos da TX
    // (soma dos pagamentos emprestados) — o RESTO continua valendo.
    let valorDescontar = 0;
    for (const p of t.pagamentos) {
      if (p.emprestimoId) {
        valorDescontar += Number(p.valor) || 0;
        p._emprestimoEsconder = true;  // frontend pode ocultar este pagamento
        p._emprestimoInfo = {
          tipo: t.tipo === 'gasto' ? 'desembolso' : 'recebimento',
          pessoaNome: '<lookup do emprestimo>',  // buscar nome do empréstimo
          valor: p.valor
        };
      }
    }
    
    // Subtrair o valor descontado do valor total da TX
    // (assim o summary do relatório fica: TX.valor - valorDescontar)
    if (t.tipo === 'gasto') {
      t.valor = (Number(t.valor) || 0) - valorDescontar;
      // NÃO marcar t._emprestimoEsconderNaLista = true
      // (a TX inteira deve continuar visível — só os pagamentos emprestados somem)
    } else if (t.tipo === 'recebivel') {
      // Mesma lógica para recebíveis (se aplicável)
      t.valor = (Number(t.valor) || 0) - valorDescontar;
    }
  }
  
  return transacoes;
}
```

**Comportamento esperado (confirmação do brainstorm):**

| Cenário | Comportamento |
|---------|---------------|
| TX com `t.emprestimoId` (legado) | Zera tudo da TX, marca `_emprestimoEsconderNaLista: true`. Não conta como gasto/recebível. |
| TX com 1+ pagamento `emprestimoId` mas `t.emprestimoId: null` (pagamento-level) | **Zera SÓ os pagamentos emprestados.** Resto da TX (pagamentos não emprestados) **CONTA normalmente** como gasto/recebível. Marca `_emprestimoParcial: true`. |
| `EmprestimoBadge` | Aparece em ambos os casos (legado: na TX inteira; novo: nos pagamentos individuais emprestados) |

**Detalhe importante:** a flag `_emprestimoEsconderNaLista: true` (legado) **NÃO** é setada no caminho novo — a TX inteira deve continuar visível na lista de TXs, mas com os pagamentos emprestados marcados individualmente.

### 3.2 Frontend

#### `controle-gastos-frontend/src/components/Transaction/TabPagamentos.js`

**Adicionar por linha de pagamento:**
- Coluna nova "Empréstimo" (ou ícone compacto)
- Checkbox "parte de empréstimo" (só visível se a TX tem 2+ pagamentos OU se o usuário habilitou manualmente)
- Select de qual Empréstimo (aparece quando checkbox marcado)
- Mutuamente exclusivo com a seção legado da aba Avançado

**Layout proposto:**
```
┌─────────────────────────────────────────────────┐
│ Pessoa  │ Valor  │ Tags  │ Parcel. │ Empréstimo │ [+]
├─────────────────────────────────────────────────┤
│ Alisson │ 447,50 │       │   —     │ [ ]        │
│ Estrela │ 447,50 │       │   —     │ [✓] Estrela│
└─────────────────────────────────────────────────┘
```

#### `controle-gastos-frontend/src/components/Emprestimos/EmprestimoSecao.js`

**Lógica adaptativa** (baseado no brainstorm):
- Se a TX tem 1 pagamento: mantém comportamento atual (caminho legado)
- Se a TX tem 2+ pagamentos: **esconde a seção** "Esta transação faz parte de um empréstimo" (o usuário vai usar a coluna na aba Pagamentos)

```js
// Lógica proposta (no useEmprestimoForm.js ou no EmprestimoSecao.js):
const qtdPagamentos = pagamentos.length;
const esconderSecaoLegado = qtdPagamentos > 1;
```

**Hint visível na aba Avançado quando escondido:**
> "Esta transação tem múltiplos pagamentos. Para marcar parte deles como empréstimo, vá na aba 'Pagamentos' e marque individualmente."

#### `controle-gastos-frontend/src/hooks/usePagamentos.js`

**Estender para gerenciar `emprestimoId` por pagamento:**
- Adicionar `emprestimoId` ao state de cada pagamento
- Adicionar `setPagamentoEmprestimoId(idx, empId)` setter
- Adicionar `getPagamentosComEmprestimo()` getter (para validações)

#### `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js`

**`handleSubmit` (atual linha 93)** — ajustar para:
1. Validar exclusividade mútua (TX-level vs pagamento-level) antes de enviar
2. Garantir que o payload inclui `emprestimoId` em cada `pagamentos[]` quando setado
3. Replicar para parcelas (lógica de parcelamento)

#### `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js`

**Estender a tabela de movimentações** (criada na refatoração anterior):
- Coluna nova "Ações" já tem botão "Excluir do empréstimo" (legado)
- **Adicionar:** quando a TX foi vinculada por **pagamento** (caminho novo), o botão muda de comportamento:
  - Para TX-level legado: "🗑️ Excluir do empréstimo" (remove toda a TX)
  - Para pagamento-level novo (parcelamento): "🗑️ Excluir esta parcela do empréstimo" (remove só esta parcela do vínculo, mantém as outras)
- Tooltip explica a diferença

**Detalhe do parcelamento:** o backend replica o `pagamentos[].emprestimoId` para todas as parcelas. Se o usuário desvincula 1 parcela, **as outras continuam vinculadas** (decisão do brainstorm #4 + #5).

#### `controle-gastos-frontend/src/components/Transaction/EditarTransacaoItem.js`

**Adaptar para o novo modelo** (mesma lógica adaptativa do `NovaTransacaoForm.js`):
- Se a TX tem 1 pagamento E `emprestimoId` no nível TX: manter comportamento atual (1 campo "valor esperado" na seção legado)
- Se a TX tem 2+ pagamentos OU `emprestimoId` em pagamentos: mostrar controles por pagamento (similar ao TabPagamentos)
- Validação de exclusividade mútua antes de salvar

### 3.3 Testes

#### `backend/src/services/__tests__/emprestimoService.test.js`

**Adicionar testes:**
- Cenário 1: TX com 2 pagamentos (50/50), 1 pagamento com `emprestimoId` → totais do Empréstimo = metade do valor
- Cenário 2: 2 TXs (1 legado, 1 pagamento-level) vinculadas ao mesmo Empréstimo → soma correta
- Cenário 3: TX com parcelamento, 1 parcela desvinculada via pagamento → outras parcelas continuam contando
- Cenário 4: TX com 2 pagamentos, AMBOS com `emprestimoId` (TX-level null) → soma dos 2 pagamentos
- Validação: TX com `emprestimoId` E pagamentos com `emprestimoId` → erro de validação

#### `backend/src/utils/__tests__/emprestimoAjuste.test.js`

**Adicionar testes:**
- Cenário de "empréstimo parcial" — TX com 1 pagamento emprestado e 1 não, o valor total da TX é a soma, mas o relatório só desconta o pagamento emprestado
- `EmprestimoBadge` aparece em ambos os caminhos (legado e novo)

## 4. Migration

**Nenhuma.** O novo campo em `PagamentoSchema` tem `default: null`, então TXs existentes ficam com `pagamentos[].emprestimoId = null` automaticamente. O caminho legado continua funcionando sem mudança.

## 5. Sequência de implementação (5 passos)

| # | Passo | Arquivos | Validação |
|---|-------|----------|-----------|
| 1 | **Schema: campo no Pagamento** | `backend/src/models/transacao.js` (ADICIONAR `emprestimoId` no PagamentoSchema) | Schema carrega. |
| 2 | **Service: `calcularTotais` cobre 2 caminhos** | `backend/src/services/emprestimoService.js` (refatorar `calcularTotais`) | Testes unitários passam. |
| 3 | **Controller: aceitar `emprestimoId` em pagamentos** | `backend/src/controllers/controladorTransacao.js` (criar, atualizar) | Testes passam. Validação de exclusividade funciona. |
| 4 | **Frontend: coluna "Empréstimo" em TabPagamentos + EmprestimoSecao adaptativa** | `TabPagamentos.js`, `EmprestimoSecao.js`, `usePagamentos.js`, `useEmprestimoForm.js` | Build compila. Fluxo manual funciona. |
| 5 | **Frontend: Estender "Excluir do empréstimo" para parcela individual + testes** | `EmprestimoDetalhePage.js`, `EditarTransacaoItem.js`, testes | Build compila. Testes passam. |

## 6. Critérios de aceitação

### Backend
- [ ] Schema `Pagamento` tem `emprestimoId` opcional
- [ ] `calcularTotais` cobre TX-level E pagamento-level, sem duplicar
- [ ] `POST /api/transacoes` aceita `emprestimoId` em `pagamentos[]`
- [ ] `POST /api/transacoes` rejeita TX com `emprestimoId` no nível TX E em pagamentos (exclusividade mútua)
- [ ] Parcelamento replica `pagamentos[].emprestimoId` para todas as parcelas
- [ ] Desvincular 1 parcela não afeta as outras (PUT /api/transacoes/:id com `pagamentos[].emprestimoId: null` na parcela específica)
- [ ] `recalcularStatus` ainda detecta quitação corretamente (caminho legado + novo)
- [ ] Testes passam (3 suites + novos cenários)

### Frontend
- [ ] TabPagamentos tem coluna "Empréstimo" com checkbox + select por linha
- [ ] EmprestimoSecao: 1 pagamento = seção legado visível; 2+ = escondida com hint
- [ ] Hint visível na aba Avançado quando tem 2+ pagamentos
- [ ] Botão "Excluir do empréstimo" no detalhe:
  - TX-level legado: "🗑️ Excluir do empréstimo" (remove TX inteira)
  - Pagamento-level parcelamento: "🗑️ Excluir esta parcela" (remove só 1)
- [ ] `EmprestimoBadge` aparece em ambos os caminhos

### Cenários manuais
- [ ] **Cenário Estrela (CANÔNICO)**: TX 895 (Alisson 447,50 + Estrela 447,50), marcar pagamento da Estrela como empréstimo
  - [ ] TX continua **visível** na lista de TXs (não escondida)
  - [ ] **Resumo do dashboard** mostra: Total de gastos = R$ 447,50 (só a parte do Alisson)
  - [ ] **Resumo da lista de TXs (paginado)**: TX aparece com valor R$ 447,50 (descontado o empréstimo)
  - [ ] **Relatório avançado (`controladorRelatorioAvancado`)**: TX aparece com valor R$ 447,50, não R$ 895
  - [ ] **Export CSV/OFX**: TX exportada com valor R$ 447,50
  - [ ] **Empréstimo "Estrela"** mostra: Desembolsado R$ 447,50, Saldo a receber = valorEsperado, Lucro esperado = valorEsperado - 447,50
- [ ] **Parcelamento 3x**: 1 parcela marcada como empréstimo (pagamento-level) → todas as 3 réplicas herdam o vínculo. Desvincular 1 → outras 2 continuam contando no Empréstimo.
- [ ] **TX com 1 pagamento (legado)**: seção "Esta transação faz parte de um empréstimo" visível normalmente. Comportamento idêntico ao atual (zera tudo, marca `_emprestimoEsconderNaLista`).

## 7. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Dupla contagem no `calcularTotais` (somar TX-level + pagamento-level quando ambos têm vínculo) | Filtro explícito `emprestimoId: { $ne: objectId }` no aggregate de pagamento-level para excluir TXs já contadas no caminho 1. Teste unitário cobre. |
| Inconsistência entre UX legado e novo | EmprestimoSecao adaptativa: esconde seção legado quando 2+ pagamentos. Hint explica. |
| Parcelamento: o que acontece se o usuário cria empréstimo em 1 parcela, depois edita o parcelamento (muda quantidade, intervalo, valor) | Replicação inicial cobre. **Decisão:** na edição do parcelamento, o sistema **mantém o `pagamentos[].emprestimoId` em todas as parcelas existentes** (não replica para novas parcelas criadas após a edição). Se o usuário criar NOVAS parcelas depois, elas NÃO herdam o vínculo. Documentar como comportamento conhecido. |
| `EmprestimoBadge` ficar inconsistente entre legado e novo | Componente único (`EmprestimoBadge.js`) verifica ambos os caminhos (TX-level e pagamento-level). |
| Migration de dados não ser trivial | **Nenhuma migration necessária** — campo novo com `default: null`. Legado intacto. |
| Performance do aggregate com `$unwind` em TXs com muitos pagamentos | Índice em `pagamentos.emprestimoId` (sparse) criado. Para usuários com 100+ pagamentos por TX, monitorar. |
| Regra de exclusividade mútua quebrar uso existente | TXs existentes só têm `emprestimoId` em 1 lugar (TX ou nenhum). Validação só bloqueia uso NOVO misto. |

## 8. Não-objetivos

- NÃO suportar valor parcial dentro de 1 pagamento (decisão brainstorm #3)
- NÃO migrar dados existentes (não precisa — campo novo opcional)
- NÃO mudar a TX-level legada (continua funcionando)
- NÃO tocar em outras áreas (Pluggy, Ledger, NetWorth, Vinculo)
- NÃO mudar decimal.js (mantido Number)
- NÃO adicionar UI de gerenciamento de parcelamento + empréstimo (escopo da regra #4 do brainstorm cobre)

## 9. Próximo passo

Após aprovação deste design doc:

1. **Delegar ao `newapp-executor`** (via tool `task` quando Alisson pedir explicitamente) com este design doc como brief.
2. Executor aplica os 5 passos em sequência.
3. Executor reporta a cada fase ou pede `question` se travar.
4. Após conclusão, Alisson valida manualmente o cenário Estrela (`http://localhost:3004/emprestimos/<id>` com 1 TX de 2 pagamentos, 1 emprestado).
