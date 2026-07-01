# [Bug Fix + Reverter Quitação] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bug de cálculo de lucro no módulo de Empréstimos (caminho 2 — pagamento-level era ignorado por 2 funções), e adicionar feature de "Reverter quitação" como botão na tela de detalhe do Empréstimo.

**Architecture:** Refatorar o cálculo agregando 3 totais (caminho 1 + caminho 2 + esperado pagamento) numa única função privada compartilhada. As 3 funções públicas (`calcularTotais`, `calcularLucro`, `calcularTotaisRecebEDisbursed`) consomem essa função. Adicionar service `reverterQuitacao` que deleta TX de juros auto + volta status pra ativo + dispara recálculo. Endpoint `POST /api/emprestimos/:id/reverter-quitacao`. UI: botão "Reverter quitação" no header da tela de detalhe + modal SweetAlert2.

**Tech Stack:** Node.js + Express + Mongoose (backend, porta 3001), React 19 + CRACO + MUI + SweetAlert2 (frontend, porta 3004), Jest (testes backend), decimal.js (valores monetários — **exceção consciente no módulo de Empréstimos: usa `Number` puro, ver ADR-013**), multi-tenant via `req.userId`, JWT + emailVerificado.

## Global Constraints

- **decimal.js:** NÃO aplicar ao módulo de Empréstimos. Decisão consciente (ADR-013). Continuar com `Number` puro.
- **Multi-tenant:** toda query a Transacao/Emprestimo filtra por `req.userId`/`usuario`.
- **JWT + emailVerificado:** toda rota nova usa `autenticacao` middleware (rotasEmprestimo.js já chama `router.use(autenticacao)` no topo).
- **Conventional Commits em PT-BR:** `fix(emprestimos): ...`, `feat(emprestimos): ...`, `feat(emprestimos-ui): ...`.
- **Caminho legado (TX-level) NÃO pode regredir:** os 7 testes existentes de `emprestimoService.test.js` + testes de `emprestimoQuitacao.test.js` precisam continuar passando. Eles validam cenário 100% caminho 1.
- **NÃO criar migration:** o conserto do "Estrela" é via UI (botão reverter), não via migration.
- **Frontend tokens:** usar `var(--cg-color-*)` ao invés de hex hardcoded. Padrão de modal SweetAlert2 do projeto.

---

## File Structure

**Backend (modificado):**

```
backend/src/
├── services/
│   ├── emprestimoService.js              [modificado: +_agregarTotaisEmprestimo, refatora calcularTotais/calcularLucro, +reverterQuitacao]
│   └── __tests__/
│       └── emprestimoService.test.js    [modificado: +2 testes]
├── utils/
│   ├── emprestimoQuitacao.js            [modificado: refatora calcularTotaisRecebEDisbursed]
│   └── __tests__/
│       └── emprestimoQuitacao.test.js   [modificado: atualiza 1 teste existente + 2 novos]
├── controllers/
│   └── emprestimoController.js          [modificado: +handler reverterQuitacao]
└── routes/
    └── rotasEmprestimo.js               [modificado: +POST /:id/reverter-quitacao]
```

**Frontend (novo/modificado):**

```
controle-gastos-frontend/src/
├── api.js                                [modificado: +reverterQuitacaoEmprestimo()]
├── components/
│   └── Emprestimos/
│       └── ReverterQuitacaoModal.js     [novo]
└── pages/
    └── Emprestimos/
        └── EmprestimoDetalhes.js        [modificado: +botão "Reverter quitação"]
```

---

## Task 1: Extrair função privada `_agregarTotaisEmprestimo`

**Files:**
- Modify: `backend/src/services/emprestimoService.js:29-136` (substituir `calcularTotais` por refator + nova função privada)
- Test: `backend/src/services/__tests__/emprestimoService.test.js` (atualizar testes existentes que dependem de 3 aggregates separadas)

**Interfaces:**
- Produces: `_agregarTotaisEmprestimo(emprestimoId, usuarioId) → { totalDesembolsadoC1, totalDesembolsadoC2, totalRecebidoC1, totalRecebidoC2, totalEsperadoC1, totalEsperadoC2 }` (todos Number)

**Contexto:** Hoje `calcularTotais` faz 3 aggregates inline. Vamos extrair essa lógica pra uma função privada e fazer `calcularTotais` consumir ela.

- [ ] **Step 1.1: Substituir `calcularTotais` em `backend/src/services/emprestimoService.js`**

Substituir o bloco completo da função `calcularTotais` (linhas 29-136) por:

```javascript
/**
 * Função privada compartilhada: agrega todos os totais de um Empréstimo
 * (desembolso, recebimento, esperado) considerando os 2 caminhos:
 *  - C1 (caminho 1 / legado): t.emprestimoId = X no nível da Transação
 *  - C2 (caminho 2 / novo): pagamentos[].emprestimoId = X no nível do Pagamento
 *
 * Quem consome (calcularTotais, calcularLucro, calcularTotaisRecebEDisbursed)
 * soma C1 + C2 conforme precisar. Separar por caminho evita double-counting
 * (regra de exclusividade mútua do ADR-015).
 *
 * Exclui TXs de juros auto (emprestimoEhJurosAuto) e TXs inativas.
 *
 * @returns {Promise<{
 *   totalDesembolsadoC1: number,
 *   totalDesembolsadoC2: number,
 *   totalRecebidoC1: number,
 *   totalRecebidoC2: number,
 *   totalEsperadoC1: number,
 *   totalEsperadoC2: number
 * }>}
 */
async function _agregarTotaisEmprestimo(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;
  const usuarioObjId = typeof usuarioId === 'string'
    ? new mongoose.Types.ObjectId(usuarioId)
    : usuarioId;

  // CAMINHO 1 — TX-level legado (t.emprestimoId = X).
  // Soma t.valor por tipo e t.valorEsperadoRetorno (apenas em gastos).
  const txLevelAgg = await Transacao.aggregate([
    {
      $match: {
        emprestimoId: objectId,
        usuario: usuarioObjId,
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$valor' },
        totalEsperado: {
          $sum: {
            $cond: [
              { $eq: ['$tipo', 'gasto'] },
              { $ifNull: ['$valorEsperadoRetorno', 0] },
              0
            ]
          }
        }
      }
    }
  ]);

  // CAMINHO 2 — Pagamento-level novo (pagamentos[].emprestimoId = X).
  // Exclui TXs já contadas no caminho 1.
  const pagamentoLevelAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: usuarioObjId,
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true },
        'pagamentos.emprestimoId': objectId,
        emprestimoId: { $ne: objectId }
      }
    },
    { $unwind: '$pagamentos' },
    { $match: { 'pagamentos.emprestimoId': objectId } },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$pagamentos.valor' }
      }
    }
  ]);

  // Esperado do pagamento (caminho 2): agrupa por TX (1x por TX) e soma
  // pagamentos[].valorEsperadoRetorno. Assume que todos os pagamentos
  // emprestados de uma mesma TX pro mesmo Empréstimo têm o mesmo valor
  // esperado (coerente com o modelo de "complemento").
  const esperadoPagamentoAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: usuarioObjId,
        status: 'ativo',
        tipo: 'gasto',
        'pagamentos.emprestimoId': objectId,
        emprestimoId: { $ne: objectId }
      }
    },
    { $unwind: '$pagamentos' },
    {
      $match: {
        'pagamentos.emprestimoId': objectId,
        'pagamentos.valorEsperadoRetorno': { $ne: null, $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$_id',
        valorEsperado: { $first: '$pagamentos.valorEsperadoRetorno' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$valorEsperado' }
      }
    }
  ]);

  let totalDesembolsadoC1 = 0;
  let totalRecebidoC1 = 0;
  let totalEsperadoC1 = 0;
  for (const r of txLevelAgg) {
    if (r._id === 'gasto') {
      totalDesembolsadoC1 = r.total;
      totalEsperadoC1 = r.totalEsperado || 0;
    } else if (r._id === 'recebivel') {
      totalRecebidoC1 = r.total;
    }
  }

  let totalDesembolsadoC2 = 0;
  let totalRecebidoC2 = 0;
  for (const r of pagamentoLevelAgg) {
    if (r._id === 'gasto') totalDesembolsadoC2 = r.total;
    else if (r._id === 'recebivel') totalRecebidoC2 = r.total;
  }

  const totalEsperadoC2 = esperadoPagamentoAgg[0]?.total || 0;

  return {
    totalDesembolsadoC1,
    totalDesembolsadoC2,
    totalRecebidoC1,
    totalRecebidoC2,
    totalEsperadoC1,
    totalEsperadoC2
  };
}

async function calcularTotais(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    totalDisbursed: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    totalReceived: t.totalRecebidoC1 + t.totalRecebidoC2,
    totalEsperado: t.totalEsperadoC1 + t.totalEsperadoC2,
    saldoAReceber: 0, // preenchido em quem consome (com `totalEsperado - totalReceived`)
    lucro: 0          // preenchido em quem consome (com `totalEsperado - totalDisbursed`)
  };
}
```

- [ ] **Step 1.2: Atualizar `module.exports` em `emprestimoService.js`**

Atualizar o `module.exports` no final do arquivo (linhas 282-291) para incluir `_agregarTotaisEmprestimo` e `reverterQuitacao` como exports (pra `emprestimoQuitacao.js` poder usar via lazy require e pra `emprestimoController.js` poder importar):

```javascript
module.exports = {
  validarDadosEmprestimo,
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO,
  _agregarTotaisEmprestimo,    // <-- NOVO
  calcularTotais,
  obterEmprestimoComTotais,
  calcularLucro,
  recalcularStatus,
  validarEmprestimoParaTransacao,
  reverterQuitacao             // <-- NOVO (Task 6)
};
```

- [ ] **Step 1.3: Rodar testes existentes — devem passar**

Run: `cd backend && npm test -- --testPathPattern=emprestimoService`
Expected: PASS em todos os 7 testes (o helper `mockAggregateSequence` empilha retornos pro `aggregate` na ordem correta, e a função privada usa 3 chamadas — pode precisar de ajuste do helper na Task 2.1).

- [ ] **Step 1.4: Commit**

```bash
git add backend/src/services/emprestimoService.js
git commit -m "refactor(emprestimos): extrair _agregarTotaisEmprestimo compartilhado"
```

---

## Task 2: Refatorar `calcularLucro` pra enxergar caminho 2

**Files:**
- Modify: `backend/src/services/emprestimoService.js:168-198`

**Interfaces:**
- Produces: `calcularLucro(emprestimoId, usuarioId) → Number` (lucro = soma recebidos - soma gastos, considerando caminho 1 + caminho 2)

- [ ] **Step 2.1: Substituir `calcularLucro` em `emprestimoService.js`**

Substituir o bloco completo da função `calcularLucro` (linhas 168-198) por:

```javascript
/**
 * Calcula o lucro realizado de um empréstimo:
 *   lucro = soma_recebíveis - soma_gastos
 * (sem FIFO, sem split por transação).
 *
 * Considera os 2 caminhos:
 *  - C1 (legado): t.emprestimoId = X
 *  - C2 (novo): pagamentos[].emprestimoId = X
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<number>}
 */
async function calcularLucro(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  const totalDesembolsado = t.totalDesembolsadoC1 + t.totalDesembolsadoC2;
  const totalRecebido = t.totalRecebidoC1 + t.totalRecebidoC2;
  return totalRecebido - totalDesembolsado;
}
```

- [ ] **Step 2.2: Atualizar helper `mockAggregateSequence` em `emprestimoService.test.js`**

O helper empilha 4 retornos (linhas 95-115 do teste). Agora `_agregarTotaisEmprestimo` faz 3 chamadas e `calcularLucro` faz 0 (consome `_agregarTotaisEmprestimo`).

Substituir o helper `mockAggregateSequence` (linhas 95-115) por:

```javascript
function mockAggregateSequence(
  txLevelResult,
  esperadoPagamentoResult,
  pagamentoLevelResult = []
) {
  const calls = [];
  if (txLevelResult !== undefined) calls.push(txLevelResult);
  if (pagamentoLevelResult !== undefined) calls.push(pagamentoLevelResult);
  if (esperadoPagamentoResult !== undefined) {
    if (typeof esperadoPagamentoResult === 'number') {
      calls.push(esperadoPagamentoResult > 0 ? [{ _id: null, total: esperadoPagamentoResult }] : []);
    } else {
      calls.push(esperadoPagamentoResult);
    }
  }
  for (const r of calls) {
    mockTransacaoAggregate.mockResolvedValueOnce(r);
  }
}
```

- [ ] **Step 2.3: Ajustar os call sites de `mockAggregateSequence` no teste**

Procurar todas as ocorrências de `mockAggregateSequence(...)` no arquivo `emprestimoService.test.js` (devem ser umas 4-5) e remover o 4º argumento de cada uma. O 4º argumento era usado pelo `calcularLucro` antigo (que fazia aggregate); agora `calcularLucro` consome `_agregarTotaisEmprestimo` (que já foi mockado nos 3 retornos anteriores).

Exemplo (hipotético):
```javascript
// ANTES:
mockAggregateSequence(
  [{ _id: 'gasto', total: 600 }],
  [],
  [{ _id: 'recebivel', total: 850 }],   // lucroResult (REMOVER)
  []                                     // pagamentoLevelResult
);

// DEPOIS:
mockAggregateSequence(
  [{ _id: 'gasto', total: 600 }],
  [],
  []                                     // pagamentoLevelResult
);
```

- [ ] **Step 2.4: Rodar testes — devem continuar passando**

Run: `cd backend && npm test -- --testPathPattern=emprestimoService`
Expected: PASS em todos os testes (7 antigos + ajustes).

- [ ] **Step 2.5: Commit**

```bash
git add backend/src/services/emprestimoService.js backend/src/services/__tests__/emprestimoService.test.js
git commit -m "fix(emprestimos): calcularLucro enxerga caminho 2 via _agregarTotaisEmprestimo"
```

---

## Task 3: Adicionar 2 testes novos em `emprestimoService.test.js`

**Files:**
- Modify: `backend/src/services/__tests__/emprestimoService.test.js`

**Interfaces:**
- Cobre: `calcularTotais` e `calcularLucro` em cenário caminho 2 (pagamento-level) e cenário mix (caminho 1 + caminho 2)

- [ ] **Step 3.1: Adicionar describe block novo no final do arquivo**

Adicionar antes do último `});` do arquivo (depois de todos os describes existentes):

```javascript
describe('emprestimoService - caminho 2 (pagamento-level) — bug fix 2026-06-30', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('calcularTotais soma desembolso de caminho 2 (pagamento-level)', async () => {
    // Cenário: 2 TXs de gasto, cada uma com 1 pagamento que tem emprestimoId
    // (caminho 2 puro, sem t.emprestimoId em nenhuma TX).
    mockAggregateSequence(
      [],  // caminho 1: vazio (nenhuma TX com t.emprestimoId)
      0,   // esperado pagamento: 0
      [    // caminho 2: 2 pagamentos de R$ 500 cada
        { _id: 'gasto', total: 1000 }
      ]
    );

    const totais = await calcularTotais(EMP_ID, USER_ID);
    expect(totais.totalDisbursed).toBe(1000);
    expect(totais.totalReceived).toBe(0);
  });

  test('calcularLucro retorna lucro correto em cenário mix caminho 1 + caminho 2', async () => {
    // Cenário "Estrela" simplificado:
    //   - caminho 1: 1 gasto de R$ 600
    //   - caminho 2: 3 pagamentos de gasto (R$ 500 + R$ 447,50 + R$ 380 = R$ 1.327,50)
    //   - caminho 1: 1 recebimento de R$ 2.127,50
    //   - Total desembolso = 600 + 1.327,50 = 1.927,50
    //   - Total recebido = 2.127,50
    //   - Lucro esperado = 2.127,50 - 1.927,50 = 200,00
    mockAggregateSequence(
      [   // caminho 1
        { _id: 'gasto', total: 600, totalEsperado: 800 },
        { _id: 'recebivel', total: 2127.50 }
      ],
      0,   // esperado pagamento
      [   // caminho 2 (3 pagamentos somam 1.327,50)
        { _id: 'gasto', total: 1327.50 }
      ]
    );

    const lucro = await calcularLucro(EMP_ID, USER_ID);
    expect(lucro).toBe(200);
  });
});
```

- [ ] **Step 3.2: Rodar testes — 2 novos devem passar**

Run: `cd backend && npm test -- --testPathPattern=emprestimoService -t "caminho 2"`
Expected: PASS nos 2 testes novos (e os 7 antigos continuam passando).

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/services/__tests__/emprestimoService.test.js
git commit -m "test(emprestimos): cobrir caminho 2 em calcularTotais e calcularLucro"
```

---

## Task 4: Refatorar `calcularTotaisRecebEDisbursed` em `emprestimoQuitacao.js`

**Files:**
- Modify: `backend/src/utils/emprestimoQuitacao.js:46-69` (mudar assinatura pra receber `usuarioId` e usar `_agregarTotaisEmprestimo`)
- Modify: `backend/src/utils/emprestimoQuitacao.js:113` e `:147` (atualizar call sites)

**Interfaces:**
- Produces: `calcularTotaisRecebEDisbursed(emprestimoId, usuarioId) → { desembolso: number, recebimento: number }`

- [ ] **Step 4.1: Substituir `calcularTotaisRecebEDisbursed` em `emprestimoQuitacao.js`**

Substituir o bloco completo da função (linhas 46-69) por:

```javascript
/**
 * Helper: retorna o desembolso total e o recebimento total do Empréstimo,
 * somando caminho 1 (TX-level legado) e caminho 2 (pagamento-level novo).
 *
 * Usado por `recalcularJurosAuto` pra montar a observação da TX de juros
 * automáticos.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<{ desembolso: number, recebimento: number }>}
 */
async function calcularTotaisRecebEDisbursed(emprestimoId, usuarioId) {
  // Lazy require pra evitar circular dependency com services/emprestimoService
  const { _agregarTotaisEmprestimo } = require('../services/emprestimoService');
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    desembolso: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    recebimento: t.totalRecebidoC1 + t.totalRecebidoC2
  };
}
```

- [ ] **Step 4.2: Atualizar call site em `recalcularJurosAuto` (linha 113)**

Localizar a chamada existente em `emprestimoQuitacao.js:113`:

```javascript
// ANTES:
const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId);

// DEPOIS:
const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId, emprestimo.usuario);
```

- [ ] **Step 4.3: Atualizar call site em `recalcularJurosAuto` (linha 147)**

Mesma mudança: adicionar `, emprestimo.usuario` como segundo argumento.

- [ ] **Step 4.4: Atualizar teste existente `calcularTotaisRecebEDisbursed` no arquivo de teste**

Localizar o describe "emprestimoQuitacao - calcularTotaisRecebEDisbursed" (linhas 213-228) e atualizar pra:

```javascript
describe('emprestimoQuitacao - calcularTotaisRecebEDisbursed (com caminho 2)', () => {
  test('retorna desembolso + recebimento considerando caminho 1 E caminho 2', async () => {
    const empId = new mongoose.Types.ObjectId();
    const userId = USER_ID;

    // _agregarTotaisEmprestimo é lazy-required e mockado indiretamente
    // via mockTransacaoAggregate. Como o mock é global, podemos simular
    // os 3 retornos que _agregarTotaisEmprestimo espera.
    mockTransacaoAggregate
      .mockResolvedValueOnce([   // caminho 1: 1 gasto + 1 recebimento
        { _id: 'gasto', total: 600, totalEsperado: 800 },
        { _id: 'recebivel', total: 2127.50 }
      ])
      .mockResolvedValueOnce([   // caminho 2: 1 pagamento gasto de 1.327,50
        { _id: 'gasto', total: 1327.50 }
      ])
      .mockResolvedValueOnce([]);  // esperado pagamento: 0

    const totais = await calcularTotaisRecebEDisbursed(empId, userId);
    expect(totais.desembolso).toBe(1927.50);  // 600 + 1.327,50
    expect(totais.recebimento).toBe(2127.50);
  });
});
```

- [ ] **Step 4.5: Rodar testes — devem passar**

Run: `cd backend && npm test -- --testPathPattern=emprestimoQuitacao`
Expected: PASS em todos os testes (ajustado + 1 cenário caminho 2).

- [ ] **Step 4.6: Commit**

```bash
git add backend/src/utils/emprestimoQuitacao.js backend/src/utils/__tests__/emprestimoQuitacao.test.js
git commit -m "fix(emprestimos): calcularTotaisRecebEDisbursed enxerga caminho 2"
```

---

## Task 5: Adicionar 1 teste novo em `emprestimoQuitacao.test.js`

**Files:**
- Modify: `backend/src/utils/__tests__/emprestimoQuitacao.test.js`

**Interfaces:**
- Cobre: `recalcularJurosAuto` cria TX de juros auto com valor correto em cenário caminho 2 (integração do fix)

- [ ] **Step 5.1: Adicionar test novo dentro do describe `recalcularJurosAuto`**

Localizar o describe "emprestimoQuitacao - recalcularJurosAuto (parâmetro = lucro)" (começa na linha 76) e adicionar no final:

```javascript
test('criada: lucro correto em cenário caminho 2 (pagamento-level) — bug fix 2026-06-30', async () => {
  const emprestimo = makeEmprestimo();

  // 1ª chamada: Transacao.findOne (procura TX juros auto existente) → null
  // 2ª chamada: Transacao.find (buscar último recebimento pra snapshot) → 1 doc
  // 3ª chamada: Transacao.aggregate (dentro de calcularTotaisRecebEDisbursed
  //             → _agregarTotaisEmprestimo, 3 chamadas empilhadas)
  mockTransacaoFindOne.mockReturnValueOnce({
    session: () => Promise.resolve(null)
  });
  mockTransacaoFind.mockReturnValueOnce({
    sort: () => ({
      lean: () => Promise.resolve([{
        _id: 'rec1',
        data: new Date('2026-06-30'),
        categoria: 'cat1',
        categoriaNome: 'Cat',
        pagamentos: [{ pessoa: 'Estrela', valor: 2127.50, tags: {} }]
      }])
    })
  });
  // 3 aggregates empilhados de _agregarTotaisEmprestimo:
  mockTransacaoAggregate
    .mockResolvedValueOnce([   // caminho 1: 1 gasto + 1 recebimento
      { _id: 'gasto', total: 600, totalEsperado: 800 },
      { _id: 'recebivel', total: 2127.50 }
    ])
    .mockResolvedValueOnce([   // caminho 2: 1.327,50
      { _id: 'gasto', total: 1327.50 }
    ])
    .mockResolvedValueOnce([]);  // esperado pagamento: 0

  let savedInstance = null;
  mockSaveInstance.mockImplementation(function () {
    savedInstance = this;
    return Promise.resolve({ _id: 'novoId' });
  });

  const lucro = 200; // 2.127,50 - 1.927,50
  const resultado = await recalcularJurosAuto(emprestimo, lucro);

  expect(resultado.acao).toBe('criada');
  expect(savedInstance).toBeTruthy();
  expect(savedInstance.valor).toBe(200);  // <-- O FIX: antes gravava 1.527,50
  expect(savedInstance.emprestimoEhJurosAuto).toBe(true);
  expect(savedInstance.observacao).toContain('Desembolsos: R$ 1927.50');
  expect(savedInstance.observacao).toContain('Recebimentos: R$ 2127.50');
  expect(savedInstance.observacao).toContain('Lucro: R$ 200.00');
});
```

- [ ] **Step 5.2: Rodar testes — 1 novo deve passar**

Run: `cd backend && npm test -- --testPathPattern=emprestimoQuitacao -t "criada: lucro correto em cenário caminho 2"`
Expected: PASS no teste novo.

- [ ] **Step 5.3: Commit**

```bash
git add backend/src/utils/__tests__/emprestimoQuitacao.test.js
git commit -m "test(emprestimos): recalcularJurosAuto usa cálculo correto em caminho 2"
```

---

## Task 6: Implementar service `reverterQuitacao`

**Files:**
- Modify: `backend/src/services/emprestimoService.js` (adicionar função após `recalcularStatus`)

**Interfaces:**
- Produces: `reverterQuitacao(emprestimoId, usuarioId) → Promise<EmprestimoDetalhado>` (retorna via `obterEmprestimoComTotais`)
- Throws: `Error('Empréstimo não encontrado.')`, `Error('Apenas empréstimos quitados podem ter a quitação revertida.')`

- [ ] **Step 6.1: Adicionar função `reverterQuitacao` em `emprestimoService.js`**

Localizar o final do arquivo (após `validarEmprestimoParaTransacao`, antes do `module.exports`) e adicionar:

```javascript
/**
 * Reverte a quitação de um Empréstimo:
 *  1. Deleta a TX de juros automáticos (se existir)
 *  2. Volta o Empréstimo para status 'ativo' e limpa dataQuitacao
 *  3. Dispara recalcularStatus() — sistema detecta que ainda está quitado
 *     (totalReceived >= totalEsperado) e recria a TX de juros com o valor
 *     correto (calculado agora com caminho 2 enxergado)
 *
 * Edge cases:
 *  - Se a TX de juros auto já foi deletada manualmente antes, o deleteOne
 *    é no-op (0 docs removidos). O recalcularStatus recria a TX normalmente.
 *  - Se o usuário desvinculou TXs de desembolso depois da quitação, o
 *    recalcularStatus pode detectar que NÃO está mais quitado. Empréstimo
 *    fica 'ativo' e a TX de juros auto NÃO é recriada.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<Object>} Empréstimo detalhado (via obterEmprestimoComTotais)
 * @throws {Error} se Empréstimo não encontrado ou não está 'quitado'
 */
async function reverterQuitacao(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;
  const usuarioObjId = typeof usuarioId === 'string'
    ? new mongoose.Types.ObjectId(usuarioId)
    : usuarioId;

  const emprestimo = await Emprestimo.findOne({ _id: objectId, usuario: usuarioObjId });
  if (!emprestimo) {
    throw new Error('Empréstimo não encontrado.');
  }
  if (emprestimo.status !== 'quitado') {
    throw new Error('Apenas empréstimos quitados podem ter a quitação revertida.');
  }

  // 1. Deleta TX de juros auto (idempotente — 0 docs se já não existir)
  await Transacao.deleteOne({
    emprestimoId: emprestimo._id,
    emprestimoEhJurosAuto: true,
    status: 'ativo'
  });

  // 2. Volta Empréstimo pra ativo
  emprestimo.status = 'ativo';
  emprestimo.dataQuitacao = null;
  await emprestimo.save();

  // 3. Recalcula status (pode recriar TX de juros auto se ainda estiver quitado)
  await recalcularStatus(emprestimo._id, usuarioObjId);

  // 4. Retorna Empréstimo detalhado
  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioObjId });
  return await obterEmprestimoComTotais(atualizado);
}
```

- [ ] **Step 6.2: Verificar que o `module.exports` já tem `reverterQuitacao`**

A Task 1.2 já adicionou `reverterQuitacao` no `module.exports`. Verificar se está lá.

- [ ] **Step 6.3: Commit (apenas o service, ainda sem controller/rota)**

```bash
git add backend/src/services/emprestimoService.js
git commit -m "feat(emprestimos): service reverterQuitacao deleta TX juros e recalcula"
```

---

## Task 7: Adicionar handler no controller e rota

**Files:**
- Modify: `backend/src/controllers/emprestimoController.js` (adicionar `reverterQuitacao` após `cancelar`)
- Modify: `backend/src/routes/rotasEmprestimo.js` (adicionar rota)

**Interfaces:**
- Produces: `POST /api/emprestimos/:id/reverter-quitacao` → 200 com Empréstimo detalhado, 400/404 em erro

- [ ] **Step 7.1: Adicionar handler `reverterQuitacao` em `emprestimoController.js`**

Localizar o final do controller (após `exports.listarTransacoes`) e adicionar:

```javascript
exports.reverterQuitacao = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });

    const detalhado = await service.reverterQuitacao(oid, req.userId);
    res.json(detalhado);
  } catch (error) {
    console.error('Erro ao reverter quitação:', error);
    let status = 500;
    if (error.message.includes('não encontrado')) status = 404;
    else if (error.message.includes('Apenas empréstimos quitados')) status = 400;
    res.status(status).json({ erro: error.message });
  }
};
```

- [ ] **Step 7.2: Adicionar rota em `rotasEmprestimo.js`**

Adicionar a linha após `router.post('/:id/cancelar', emprestimoController.cancelar);` (linha 14):

```javascript
router.post('/:id/reverter-quitacao', emprestimoController.reverterQuitacao);
```

- [ ] **Step 7.3: Testar manualmente via curl (opcional, mas recomendado)**

Cenário: Empréstimo "Estrela" real (já em estado bugado).

```bash
# Em backend/:
# 1. Subir o backend em modo dev
npm run dev &

# 2. Login pra pegar token (ajustar email/senha)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","senha":"suasenha"}'

# 3. Chamar endpoint (substituir :id e TOKEN)
curl -X POST http://localhost:3001/api/emprestimos/SEU_EMPRESTIMO_ID/reverter-quitacao \
  -H "Authorization: Bearer SEU_TOKEN"
```

Expected: 200 com Empréstimo detalhado (status recalculado, dataQuitacao null, TX de juros auto nova com valor correto de R$ 200,00).

- [ ] **Step 7.4: Commit**

```bash
git add backend/src/controllers/emprestimoController.js backend/src/routes/rotasEmprestimo.js
git commit -m "feat(emprestimos): endpoint POST /:id/reverter-quitacao"
```

---

## Task 8: Adicionar função de API no frontend

**Files:**
- Modify: `controle-gastos-frontend/src/api.js` (após `cancelarEmprestimo`)

**Interfaces:**
- Produces: `reverterQuitacaoEmprestimo(id) → Promise<EmprestimoDetalhado>`

- [ ] **Step 8.1: Adicionar função `reverterQuitacaoEmprestimo` em `api.js`**

Localizar o final da seção de Empréstimos (após `obterTransacoesEmprestimo`, linha 822) e adicionar:

```javascript
export async function reverterQuitacaoEmprestimo(id) {
  const resposta = await fetch(`${API_BASE}/emprestimos/${id}/reverter-quitacao`, {
    method: 'POST',
    headers: getHeaders()
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao reverter quitação.`);
  return dados;
}
```

- [ ] **Step 8.2: Commit**

```bash
git add controle-gastos-frontend/src/api.js
git commit -m "feat(emprestimos-ui): cliente API reverterQuitacaoEmprestimo"
```

---

## Task 9: Criar componente `ReverterQuitacaoModal`

**Files:**
- Create: `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js`

**Interfaces:**
- Produces: função `abrirModalReverterQuitacao({ emprestimo, transacaoJurosAuto, onConfirmado })` que abre SweetAlert2, confirma, chama API, dispara `onConfirmado` após sucesso

- [ ] **Step 9.1: Criar o arquivo do componente**

Criar `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js` com:

```javascript
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { reverterQuitacaoEmprestimo } from '../../api';

/**
 * Modal de confirmação para reverter a quitação de um Empréstimo.
 *
 * Comportamento:
 *  - Explica o que vai acontecer (3 itens)
 *  - Pede confirmação (botão vermelho destrutivo)
 *  - Chama POST /api/emprestimos/:id/reverter-quitacao
 *  - Toast de sucesso/erro
 *  - Chama onConfirmado() se callback foi passado (refetch na tela pai)
 *
 * @param {Object} params
 * @param {Object} params.emprestimo - objeto Emprestimo (precisa de _id, pessoaNomeSnapshot, status)
 * @param {Object} [params.transacaoJurosAuto] - TX de juros auto atual (pra mostrar valor que será removido)
 * @param {Function} [params.onConfirmado] - callback chamado após sucesso
 */
export async function abrirModalReverterQuitacao({ emprestimo, transacaoJurosAuto, onConfirmado }) {
  if (!emprestimo || emprestimo.status !== 'quitado') return;

  const valorErrado = transacaoJurosAuto?.valor;
  const valorErradoTexto = valorErrado != null
    ? `R$ ${Number(valorErrado).toFixed(2).replace('.', ',')}`
    : 'valor atual';
  const pessoaNome = emprestimo.pessoaNomeSnapshot || 'a pessoa';

  const resultado = await Swal.fire({
    title: 'Reverter quitação do empréstimo?',
    html: `
      <div style="text-align: left;">
        <p>Esta operação irá:</p>
        <ul style="margin: 0.5em 0; padding-left: 1.5em;">
          <li>Remover a transação de juros automáticos de <strong>${valorErradoTexto}</strong></li>
          <li>Voltar o empréstimo com <strong>${pessoaNome}</strong> ao status <strong>ativo</strong></li>
          <li>Recalcular e recriar a transação de juros com o valor correto</li>
        </ul>
        <p style="color: var(--cg-color-warning); margin-top: 1em;">
          Esta operação não pode ser desfeita automaticamente.
        </p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Reverter',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--cg-color-error)',
    cancelButtonColor: 'var(--cg-color-text-secondary)',
    reverseButtons: true,
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      try {
        const resultado = await reverterQuitacaoEmprestimo(emprestimo._id);
        return resultado;
      } catch (error) {
        Swal.showValidationMessage(
          error.message || 'Erro ao reverter quitação.'
        );
        return false;
      }
    },
    allowOutsideClick: () => !Swal.isLoading()
  });

  if (resultado.isConfirmed && resultado.value) {
    const novoLucro = resultado.value?.lucro ?? 0;
    toast.success(
      `Quitação revertida. Sistema recalculou: nova TX de juros com R$ ${novoLucro.toFixed(2).replace('.', ',')}.`
    );
    if (typeof onConfirmado === 'function') {
      onConfirmado(resultado.value);
    }
  }
}
```

- [ ] **Step 9.2: Commit**

```bash
git add controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js
git commit -m "feat(emprestimos-ui): modal de confirmação reverter quitação"
```

---

## Task 10: Adicionar botão "Reverter quitação" na tela de detalhe

**Files:**
- Modify: arquivo de tela de detalhe do Empréstimo (a localizar via grep)

**Interfaces:**
- Adiciona botão "Reverter quitação" no header, condicional a `emprestimo.status === 'quitado'`
- Botão chama `abrirModalReverterQuitacao({ ... })` passando o Empréstimo, a TX de juros auto atual (se houver) e callback de refetch

- [ ] **Step 10.1: Localizar a tela de detalhe do Empréstimo**

Grep por "Cancelar empréstimo" pra achar a tela onde fica o botão "Cancelar" atual.

Run (PowerShell):
```powershell
Select-String -Path "C:\PROJETOS\newApp\controle-gastos-frontend\src" -Pattern "Cancelar empréstimo" -SimpleMatch -Recurse
```

Expected: 1-2 arquivos `.js` ou `.jsx`. O caminho exato vai depender do resultado do grep (provavelmente algo como `pages/Emprestimos/EmprestimoDetalhes.js` ou similar).

- [ ] **Step 10.2: Adicionar import e botão no arquivo da tela**

No arquivo encontrado no Step 10.1, adicionar:

```javascript
// No topo do arquivo, com os outros imports
import { abrirModalReverterQuitacao } from '../../components/Emprestimos/ReverterQuitacaoModal';
```

Localizar o trecho onde está o botão "Cancelar empréstimo" atual e adicionar o botão "Reverter quitação" ao lado. Estrutura sugerida (ajustar conforme estilo do arquivo):

```jsx
{emprestimo.status === 'quitado' && (
  <Button
    variant="outlined"
    color="warning"
    onClick={() => {
      const txJurosAuto = movimentacoes.find(m => m.emprestimoEhJurosAuto);
      abrirModalReverterQuitacao({
        emprestimo,
        transacaoJurosAuto: txJurosAuto,
        onConfirmado: () => recarregarEmprestimo() // nome do refetch na tela
      });
    }}
  >
    Reverter quitação
  </Button>
)}
```

**Nota sobre `movimentacoes` e `recarregarEmprestimo`:** são nomes hipotéticos. O executor deve adaptar conforme os nomes reais que existirem no arquivo (grep por `useEffect` ou `setEmprestimo` pra descobrir o refetch). A forma de passar a TX de juros auto também pode variar (pode estar em `emprestimo.transacoes`, ou em outro state).

- [ ] **Step 10.3: Validar manualmente**

1. Subir o backend (`npm run dev` em `backend/`) e o frontend (`npm start` em `controle-gastos-frontend/`).
2. Login e ir na tela do Empréstimo "Estrela" (que está `quitado`).
3. Verificar que o botão "Reverter quitação" aparece ao lado de "Cancelar empréstimo".
4. Clicar → modal aparece com explicação + valor errado (R$ 647,50).
5. Confirmar.
6. Verificar que:
   - Toast de sucesso aparece
   - Tela recarrega
   - Status volta a `quitado` (porque o `recalcularStatus` detecta que ainda atinge)
   - TX de juros auto na tabela mostra R$ 200,00 (em vez de R$ 647,50)
7. Verificar Patrimônio e Relatórios — devem refletir o valor correto.

- [ ] **Step 10.4: Commit**

```bash
git add controle-gastos-frontend/src/
git commit -m "feat(emprestimos-ui): botao reverter quitacao na tela de detalhe"
```

---

## Validação final

Após todas as 10 tasks:

- [ ] **Step V.1: Rodar TODOS os testes backend**

```bash
cd backend && npm test
```

Expected: PASS em todos os testes (incluindo os 4 novos de caminho 2 + os 7 antigos continuam passando).

- [ ] **Step V.2: Verificar o cenário "Estrela" no banco real**

Abrir a UI e confirmar que após reverter, a TX de juros auto do "Estrela" tem valor R$ 200,00.

- [ ] **Step V.3: Confirmar que nenhum Empréstimo legado regrediu**

Abrir a UI e verificar Empréstimos 100% caminho 1 (se existirem) — totais e TX de juros auto devem estar inalterados.
