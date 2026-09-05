# Fix Pessoa em Recebimento/Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD — implement and verify,
> tests are required but not test-first. Each task carries a testability tag (tela / sem tela / não
> testável) — use it, don't re-infer it, when reporting via personal-test-report.

**Goal:** Corrigir 3 pontos do código que leem "a pessoa" de um Recebimento (Settlement) do lado
errado (`receivingTransactionId`, sempre o próprio usuário), fazendo com que a tela de histórico
mostre a pessoa certa e o "Linkar Recebimento" do módulo Fechamento volte a funcionar.

**Architecture:** Uma função pura central `pessoasDoSettlement(settlement)` em
`settlementService.js`, que lê `appliedTransactions[].transactionId.pagamentos[pagamentoIndex]`
(fallback: todos os pagadores da transação se `pagamentoIndex` for `null`/`undefined`). Reaproveitada
por `settlementService.listar()` (retorna `pessoas: [...]` pronto em cada item + corrige o filtro
`pessoa`) e por `fechamentoService.linkarRecebimento()` (valida contra o lado certo). O frontend
(`HistoricoRecebimentosPage.js`) só passa a exibir o campo pronto, sem recalcular.

**Tech Stack:** Node/Express + Mongoose (backend), React (frontend), Jest.

Spec completa: `.brain/specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md`.
ADR: `.brain/decisions/2026-09-05-settlement-pessoa-lado-errado.md`.

---

### Task 1: Função central `pessoasDoSettlement` em `settlementService.js`

**Files:**
- Modify: `backend/src/services/settlementService.js:739-749` (antes do `module.exports`)
- Test: `backend/src/services/__tests__/settlementService.test.js` (novo arquivo)

**Testabilidade:** sem tela — função pura de lógica de negócio, sem endpoint próprio nesta task.

- [ ] **Step 1: Implementar a função**

Em `backend/src/services/settlementService.js`, adicionar logo antes do `module.exports` (linha 741
atual):

```javascript
/**
 * Devolve os nomes de pessoa por trás de um Settlement, lendo do lado certo:
 * appliedTransactions[].transactionId.pagamentos[pagamentoIndex] — a fatia específica que foi
 * quitada — nunca receivingTransactionId (que é sempre o próprio usuário, dinheiro que entrou).
 * Requer que `settlement.appliedTransactions[].transactionId` esteja populado com `pagamentos`.
 * Sem pagamentoIndex (settlements antigos criados via appliedTransactionIds): considera todos os
 * pagadores daquela transação (fallback, pode incluir alguém a mais, nunca a menos que hoje).
 */
function pessoasDoSettlement(settlement) {
  const nomes = new Set();
  for (const at of settlement.appliedTransactions || []) {
    const pagamentos = at.transactionId?.pagamentos || [];
    if (at.pagamentoIndex != null && pagamentos[at.pagamentoIndex]) {
      if (pagamentos[at.pagamentoIndex].pessoa) nomes.add(pagamentos[at.pagamentoIndex].pessoa);
    } else {
      pagamentos.forEach((p) => {
        if (p.pessoa) nomes.add(p.pessoa);
      });
    }
  }
  return [...nomes];
}
```

Depois, atualizar o `module.exports` (linha 741-749 atual) pra incluir a nova função:

```javascript
module.exports = {
  criar,
  excluir,
  listarRecebimentosDisponiveis,
  listarPendentes,
  listar,
  aplicarTagEmPagamentos,
  removerTagDePagamentos,
  pessoasDoSettlement
};
```

- [ ] **Step 2: Criar o arquivo de teste**

Criar `backend/src/services/__tests__/settlementService.test.js`:

```javascript
/**
 * Testes de settlementService.pessoasDoSettlement - regra pura, sem tela.
 */
jest.mock('../../models/settlement', () => jest.fn());
jest.mock('../../models/transacao', () => jest.fn());
jest.mock('../../models/tag', () => jest.fn());
jest.mock('../../models/usuarios', () => jest.fn());

const { pessoasDoSettlement } = require('../settlementService');

describe('settlementService.pessoasDoSettlement', () => {
  test('usa pagamentoIndex quando presente, ignora outros pagadores da mesma transação', () => {
    const settlement = {
      appliedTransactions: [
        {
          pagamentoIndex: 2,
          transactionId: {
            pagamentos: [
              { pessoa: 'Alisson' },
              { pessoa: 'Milena' },
              { pessoa: 'Cleia' }
            ]
          }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia']);
  });

  test('agrega pessoas de múltiplas appliedTransactions distintas (settlement misto)', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } },
        {
          pagamentoIndex: 1,
          transactionId: { pagamentos: [{ pessoa: 'Alisson' }, { pessoa: 'Milena' }] }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia', 'Milena']);
  });

  test('sem pagamentoIndex, usa fallback: todos os pagadores da transação', () => {
    const settlement = {
      appliedTransactions: [
        {
          pagamentoIndex: null,
          transactionId: { pagamentos: [{ pessoa: 'Cleia' }, { pessoa: 'Milena' }] }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia', 'Milena']);
  });

  test('não duplica nomes repetidos entre appliedTransactions', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } },
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia']);
  });

  test('retorna [] quando appliedTransactions está vazio ou ausente', () => {
    expect(pessoasDoSettlement({ appliedTransactions: [] })).toEqual([]);
    expect(pessoasDoSettlement({})).toEqual([]);
  });

  test('ignora pagamento sem nome de pessoa', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: '' }] } }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar os testes, confirmar que passam**

Run (a partir de `backend/`): `npx jest settlementService`
Expected: `PASS` — 6 testes, 0 falhas.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/settlementService.js backend/src/services/__tests__/settlementService.test.js
git commit -m "feat(settlement): adiciona pessoasDoSettlement, le pessoa do lado correto do recebimento"
```

---

### Task 2: Corrigir `settlementService.listar()` — populate, filtro e campo `pessoas`

**Files:**
- Modify: `backend/src/services/settlementService.js:672-739`

**Testabilidade:** sem tela — endpoint `GET /api/settlements` (consumido por telas de outras tasks,
mas esta task isolada só muda o service).

- [ ] **Step 1: Implementar a mudança**

Substituir o bloco atual (linhas 672-739) por:

```javascript
/**
 * Lista settlements do usuário com filtros opcionais:
 *  - pessoa: filtra por pessoa quitada (appliedTransactions[].transactionId.pagamentos[].pessoa) —
 *    NUNCA por receivingTransactionId (que é sempre o próprio usuário, dinheiro que entrou)
 *  - tagId: filtra por tag aplicada
 *  - dataInicio / dataFim: filtra por createdAt
 *  - q: busca textual em descricao do recebimento
 */
async function listar(usuarioId, opts = {}) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 50);
  const skip = (page - 1) * limit;

  const match = { usuario: new mongoose.Types.ObjectId(usuarioId) };

  if (opts.tagId) {
    match.tagId = new mongoose.Types.ObjectId(opts.tagId);
  }

  if (opts.dataInicio || opts.dataFim) {
    match.createdAt = {};
    if (opts.dataInicio) match.createdAt.$gte = new Date(opts.dataInicio + 'T00:00:00.000Z');
    if (opts.dataFim) match.createdAt.$lte = new Date(opts.dataFim + 'T23:59:59.999Z');
  }

  // Pré-filtrar IDs de Transacao que combinam com pessoa/q. Pré-filtro grosseiro por transação
  // (não pelo pagamentoIndex exato) — suficiente pra popular candidatos; validação fina de índice
  // acontece à parte, em fechamentoService.linkarRecebimento.
  const transacaoFilter = { usuario: new mongoose.Types.ObjectId(usuarioId) };
  const needsTransacaoFilter = opts.pessoa || opts.q;
  let allowedAppliedIds = null;
  if (needsTransacaoFilter) {
    if (opts.pessoa) {
      transacaoFilter['pagamentos.pessoa'] = new RegExp(
        '^' + String(opts.pessoa).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
        'i'
      );
    }
    if (opts.q) {
      const safe = String(opts.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      transacaoFilter.descricao = new RegExp(safe, 'i');
    }
    const matching = await Transacao.find(transacaoFilter).select('_id').lean();
    allowedAppliedIds = matching.map((t) => t._id);
    if (allowedAppliedIds.length === 0) {
      return { items: [], total: 0, page, totalPages: 0 };
    }
    match['appliedTransactions.transactionId'] = { $in: allowedAppliedIds };
  }

  const [settlements, total] = await Promise.all([
    Settlement.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('receivingTransactionId', 'descricao valor data pagamentos')
      .populate('tagId', 'nome codigo cor icone')
      .populate('removeTagId', 'nome codigo cor icone')
      .populate('appliedTransactions.transactionId', 'descricao valor data pagamentos')
      .populate('leftoverTransactionId', 'descricao valor')
      .lean(),
    Settlement.countDocuments(match)
  ]);

  const items = settlements.map((s) => ({ ...s, pessoas: pessoasDoSettlement(s) }));

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}
```

Duas mudanças-chave em relação ao original: `populate('appliedTransactions.transactionId', ...)`
agora inclui `pagamentos` no select (linha antes só trazia `descricao valor data`); o filtro `match`
usa `'appliedTransactions.transactionId'` em vez de `receivingTransactionId`; e cada item devolvido
ganha `pessoas: pessoasDoSettlement(s)`.

- [ ] **Step 2: Adicionar teste cobrindo o filtro e o campo `pessoas`**

Adicionar ao final de `backend/src/services/__tests__/settlementService.test.js` (mesmo arquivo da
Task 1), um novo `describe`:

```javascript
describe('settlementService.listar', () => {
  const mongoose = require('mongoose');
  const Settlement = require('../../models/settlement');
  const Transacao = require('../../models/transacao');
  const { listar } = require('../settlementService');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('anexa pessoas: [...] em cada item, lendo appliedTransactions', async () => {
    const usuarioId = new mongoose.Types.ObjectId().toString();
    const settlementFake = {
      _id: new mongoose.Types.ObjectId(),
      appliedTransactions: [
        {
          pagamentoIndex: 0,
          transactionId: { pagamentos: [{ pessoa: 'Cleia' }] }
        }
      ]
    };

    Transacao.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: settlementFake._id }])
      })
    });

    const queryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([settlementFake])
    };
    Settlement.find = jest.fn().mockReturnValue(queryChain);
    Settlement.countDocuments = jest.fn().mockResolvedValue(1);

    const resultado = await listar(usuarioId, { pessoa: 'Cleia' });

    expect(resultado.items[0].pessoas).toEqual(['Cleia']);
    expect(Settlement.find).toHaveBeenCalledWith(
      expect.objectContaining({ 'appliedTransactions.transactionId': { $in: [settlementFake._id] } })
    );
  });
});
```

- [ ] **Step 3: Rodar os testes, confirmar que passam**

Run (a partir de `backend/`): `npx jest settlementService`
Expected: `PASS` — todos os testes anteriores + os novos deste describe.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/settlementService.js backend/src/services/__tests__/settlementService.test.js
git commit -m "fix(settlement): filtro e populate de listar() usam appliedTransactions, nao receivingTransactionId"
```

---

### Task 3: Corrigir `fechamentoService.linkarRecebimento()`

**Files:**
- Modify: `backend/src/services/fechamentoService.js:262-286`
- Test: `backend/src/services/__tests__/fechamentoService.test.js`

**Testabilidade:** sem tela — a task isolada é o service; o efeito visível completo (o botão "Linkar
Recebimento" da tela de Fechamento passando a funcionar) fica coberto pela Task 5 (roteiro manual
fim-a-fim).

- [ ] **Step 1: Implementar a mudança**

Em `backend/src/services/fechamentoService.js`, adicionar o import da nova função (linha 9, junto dos
outros requires):

```javascript
const { pessoasDoSettlement } = require('./settlementService');
```

Substituir o corpo de `linkarRecebimento` (linhas 262-286 atuais):

```javascript
async function linkarRecebimento(id, settlementId, usuarioId) {
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId }).populate({
    path: 'cadastro',
    populate: { path: 'pessoa', select: 'nome' }
  });
  if (!instancia) throw new Error('Instância não encontrada.');

  const settlement = await Settlement.findOne({ _id: settlementId, usuario: usuarioId })
    .populate('appliedTransactions.transactionId', 'pagamentos');
  if (!settlement) throw new Error('Conciliação (Settlement) não encontrada.');

  const pessoaNome = (instancia.cadastro?.pessoa?.nome || '').toLowerCase();
  // A pessoa de um Settlement vem de appliedTransactions (os gastos quitados), nunca de
  // receivingTransactionId (que é sempre o próprio usuário, dinheiro que entrou). Um settlement
  // pode quitar dívidas de mais de uma pessoa ao mesmo tempo — basta aparecer em uma delas.
  const bate = pessoasDoSettlement(settlement).some((nome) => nome.toLowerCase() === pessoaNome);
  if (!bate) {
    throw new Error('Esta conciliação não pertence a esta pessoa.');
  }

  instancia.settlementId = settlement._id;
  instancia.status = 'recebido';
  await instancia.save();

  return obterInstanciaPopulada(instancia._id, usuarioId);
}
```

- [ ] **Step 2: Adicionar teste cobrindo o novo comportamento**

O mock atual de `../../models/settlement` em `fechamentoService.test.js` (linha 19) é
`jest.mock('../../models/settlement', () => jest.fn())` — um mock vazio, sem `findOne`. Precisamos
adicionar `findOne` a esse mock e mockar o módulo `settlementService` (pra isolar o teste da lógica
já coberta na Task 1).

No topo de `backend/src/services/__tests__/fechamentoService.test.js`, junto dos outros
`jest.mock(...)` (linha 19), adicionar:

```javascript
const mockSettlementFindOne = jest.fn();
jest.mock('../../models/settlement', () => {
  const Mock = jest.fn();
  Mock.findOne = (...args) => mockSettlementFindOne(...args);
  return Mock;
});
jest.mock('../settlementService', () => ({
  pessoasDoSettlement: jest.fn()
}));
```

(Isso substitui a linha 19 original `jest.mock('../../models/settlement', () => jest.fn());` —
remover a antiga, deixar só a nova versão com `findOne`.)

Depois, no `require` do topo do arquivo (linha 30-37 atual), adicionar:

```javascript
const { pessoasDoSettlement } = require('../settlementService');
```

Também adicionar `linkarRecebimento` à desestruturação já existente no topo do arquivo (linha 30-37
atual, `const { STATUS_MANUAL, modelRulesToEngineRules, ... } = require('../fechamentoService');`).

E adicionar um novo `describe` ao final do arquivo. Importante: `obterInstanciaPopulada` (chamada
internamente por `linkarRecebimento` ao final, em caso de sucesso) só faz
`FechamentoInstancia.findOne(...).populate(...)` de novo — como esse model já está mockado via
`mockFechamentoInstanciaFindOne`, dá pra satisfazer as duas chamadas em sequência com
`mockReturnValueOnce` empilhado, sem precisar de `jest.spyOn` num método interno do próprio módulo
(que não funciona em CommonJS — a chamada interna usa a referência local da função, não o objeto de
`module.exports`):

```javascript
describe('fechamentoService.linkarRecebimento', () => {
  beforeEach(() => {
    mockFechamentoInstanciaFindOne.mockReset();
    mockSettlementFindOne.mockReset();
    pessoasDoSettlement.mockReset();
  });

  function mockInstanciaEncontrada(nomePessoa) {
    const instanciaMock = {
      _id: 'instancia-1',
      cadastro: { pessoa: { nome: nomePessoa } },
      save: jest.fn().mockResolvedValue(true)
    };
    // 1a chamada a FechamentoInstancia.findOne — feita direto por linkarRecebimento
    mockFechamentoInstanciaFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(instanciaMock)
    });
    return instanciaMock;
  }

  test('linka quando a pessoa aparece em pessoasDoSettlement (mesmo que não seja a única)', async () => {
    const instanciaMock = mockInstanciaEncontrada('Cleia');
    mockSettlementFindOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ _id: 'settlement-1' })
    });
    pessoasDoSettlement.mockReturnValue(['Cleia', 'Milena']);
    // 2a chamada a FechamentoInstancia.findOne — feita dentro de obterInstanciaPopulada
    mockFechamentoInstanciaFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue({ status: 'recebido' })
    });

    const resultado = await linkarRecebimento('instancia-1', 'settlement-1', 'user-1');

    expect(instanciaMock.save).toHaveBeenCalled();
    expect(instanciaMock.status).toBe('recebido');
    expect(instanciaMock.settlementId).toBe('settlement-1');
    expect(resultado).toEqual({ status: 'recebido' });
  });

  test('rejeita quando a pessoa não aparece em pessoasDoSettlement', async () => {
    mockInstanciaEncontrada('Cleia');
    mockSettlementFindOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ _id: 'settlement-1' })
    });
    pessoasDoSettlement.mockReturnValue(['Milena']);

    await expect(
      linkarRecebimento('instancia-1', 'settlement-1', 'user-1')
    ).rejects.toThrow('Esta conciliação não pertence a esta pessoa.');
  });

  test('lança erro quando settlement não é encontrado', async () => {
    mockInstanciaEncontrada('Cleia');
    mockSettlementFindOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    await expect(
      linkarRecebimento('instancia-1', 'settlement-1', 'user-1')
    ).rejects.toThrow('Conciliação (Settlement) não encontrada.');
  });
});
```

- [ ] **Step 3: Rodar os testes, confirmar que passam**

Run (a partir de `backend/`): `npx jest fechamentoService`
Expected: `PASS` — os 3 testes novos + todos os já existentes no arquivo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/fechamentoService.js backend/src/services/__tests__/fechamentoService.test.js
git commit -m "fix(fechamento): linkarRecebimento valida pessoa via appliedTransactions, nao receivingTransactionId"
```

---

### Task 4: Corrigir exibição de pessoa em `HistoricoRecebimentosPage.js`

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Recebimentos/HistoricoRecebimentosPage.js:104-108`

**Testabilidade:** tela — `/recebimentos/historico`, coluna "Pessoa" de cada conciliação.

- [ ] **Step 1: Implementar a mudança**

Em `controle-gastos-frontend/src/pages/Recebimentos/HistoricoRecebimentosPage.js`, substituir a
função `pessoaRecebimento` (linhas 104-108 atuais):

```javascript
  const pessoaRecebimento = (s) => {
    const pessoas = s.pessoas || [];
    return pessoas.length > 0 ? pessoas.join(', ') : '-';
  };
```

O campo `s.pessoas` já vem pronto do backend (Task 2, `settlementService.listar`) — o frontend só
exibe, sem recalcular a partir de `receivingTransactionId`.

- [ ] **Step 2: Verificar no navegador**

Abrir `/recebimentos/historico` no preview (`npm start` já deve estar rodando via
`preview_start` com `name` configurado em `.claude/launch.json` — se não estiver, subir com
`preview_start`). Confirmar visualmente que a coluna "Pessoa" de cada conciliação mostra o nome da
pessoa real (ex: "Cleia", "Milena") em vez de "Alisson".

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/pages/Recebimentos/HistoricoRecebimentosPage.js
git commit -m "fix(recebimentos): historico exibe pessoa real do settlement, nao o proprio usuario"
```

---

### Task 5: Verificação fim-a-fim (checkpoint manual)

**Files:** nenhum (task de verificação, sem código novo).

**Testabilidade:** tela — fluxo completo `/recebimentos/historico` + `/fechamento`.

- [ ] **Step 1: Rodar a suíte completa do backend**

Run (a partir de `backend/`): `npm test`
Expected: `PASS` em todos os arquivos, incluindo os 2 arquivos tocados nas Tasks 1-3
(`settlementService.test.js`, `fechamentoService.test.js`) e a suíte pré-existente
(`ledgerService`, `netWorthService`) sem regressão.

- [ ] **Step 2: Roteiro manual — histórico de recebimentos**

1. Abrir `/recebimentos/historico`.
2. Conferir que a coluna "Pessoa" de cada linha mostra nomes reais (ex: "Cleia", "Milena"), não
   "Alisson".
3. Usar o filtro "Pessoa" no topo, selecionar "Cleia" — confirmar que a lista filtra e mostra
   resultados (antes do fix, esse filtro nunca retornava nada).

- [ ] **Step 3: Roteiro manual — Linkar Recebimento no Fechamento**

1. Abrir `/fechamento`.
2. Encontrar (ou criar) uma instância de Fechamento cuja `Pessoa` cadastrada seja "Cleia" (ou outra
   pessoa que você sabe ter recebimentos de fato registrados).
3. Expandir o card, clicar em "Linkar Recebimento".
4. Confirmar que a lista agora mostra conciliações candidatas (antes do fix: sempre vazia).
5. Selecionar uma e clicar "Linkar" — confirmar que o status da instância muda para "Recebido" e o
   `settlementId` fica gravado (sem erro "Esta conciliação não pertence a esta pessoa.").

- [ ] **Step 4: Reportar**

Reportar via `personal-test-report`, usando as tags de testabilidade desta plan (Tasks 1-3: sem
tela; Task 4-5: tela) — sem re-inferir a categoria em tempo de execução.
