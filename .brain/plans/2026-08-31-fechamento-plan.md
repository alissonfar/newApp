# Fechamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD — implement and verify,
> tests are required but not test-first. Each task carries a testability tag (tela / sem tela / não
> testável) — use it, don't re-infer it, when reporting via personal-test-report.

**Goal:** Implementar o módulo "Fechamento" — substitui a aba "Insights" na sidebar, permitindo
acompanhar o fechamento de várias pessoas por período (transações, valor total, status de
envio/recebimento) numa única tela, com geração/exportação de relatório individual e em lote.

**Architecture:** 2 models novos no backend (`FechamentoCadastro`, `FechamentoInstancia`) seguindo o
padrão em camadas do projeto (`routes → controllers → services → models`). O service de Fechamento
reaproveita sem alterações o `reportEngine` (via `ruleEngine.processWithRules` + `aggregator.aggregate`)
e a técnica de casamento por nome (regex case-insensitive) já usada em `settlementService`. No
frontend, uma página nova (`/fechamento`) com hook próprio orquestra tudo, reaproveitando
`PeriodQuickFilter`, `Card`, `Button`, `StatCard`, `PageHeader` e o motor de PDF já existente
(`@react-pdf/renderer`); a única peça nova é o empacotamento em `.zip` (`jszip`) para exportação em
lote.

**Tech Stack:** Express + Mongoose (backend), React 19 + react-select + react-icons/fa +
`@react-pdf/renderer` + `jszip` (frontend). Sem migrations — nenhum model existente é alterado.

**Referências:**
- Spec: `.brain/specs/2026-08-31-fechamento-design.md`
- ADR: `.brain/decisions/2026-08-31-fechamento-modelagem.md`
- Contexto: `.brain/context/relatorios-recebimentos-infraestrutura.md`
- Mockup validado: https://claude.ai/code/artifact/4492dfdd-c11f-4c2e-beea-b07adb0bc03c

---

### Task 1: Models — `FechamentoCadastro` e `FechamentoInstancia`

**Files:**
- Create: `backend/src/models/fechamentoCadastro.js`
- Create: `backend/src/models/fechamentoInstancia.js`

**Testabilidade:** não testável — só define schema, sem comportamento observável isolado (validado
via Task 2, que usa os models).

- [ ] **Step 1: Criar o model `FechamentoCadastro`**

```javascript
// src/models/fechamentoCadastro.js
const mongoose = require('mongoose');

const FechamentoCadastroSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pessoa: { type: mongoose.Schema.Types.ObjectId, ref: 'Pessoa', required: true },
  modeloRelatorio: { type: mongoose.Schema.Types.ObjectId, ref: 'ModeloRelatorio', required: true },
  ativo: { type: Boolean, default: true }
}, { timestamps: true });

FechamentoCadastroSchema.index({ usuario: 1, pessoa: 1 }, { unique: true });

module.exports = mongoose.model('FechamentoCadastro', FechamentoCadastroSchema);
```

- [ ] **Step 2: Criar o model `FechamentoInstancia`**

```javascript
// src/models/fechamentoInstancia.js
const mongoose = require('mongoose');

const FechamentoInstanciaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  cadastro: { type: mongoose.Schema.Types.ObjectId, ref: 'FechamentoCadastro', required: true },
  dataInicio: { type: Date, required: true },
  dataFim: { type: Date, required: true },
  status: {
    type: String,
    enum: ['aberto', 'enviado', 'aguardando_recebimento', 'recebido'],
    default: 'aberto'
  },
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
  observacoes: { type: String, default: null }
}, { timestamps: true });

FechamentoInstanciaSchema.index({ usuario: 1, cadastro: 1, dataInicio: 1 });
FechamentoInstanciaSchema.index({ usuario: 1, dataInicio: 1, dataFim: 1 });

module.exports = mongoose.model('FechamentoInstancia', FechamentoInstanciaSchema);
```

- [ ] **Step 3: Verificar que o backend sobe sem erro**

Run: `npm run dev` (a partir de `backend/`)
Expected: servidor sobe normalmente, sem erro de "Cannot overwrite model" nem de schema inválido.
Parar o servidor depois (Ctrl+C) — só é smoke de sintaxe, não precisa deixar rodando.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/fechamentoCadastro.js backend/src/models/fechamentoInstancia.js
git commit -m "feat(fechamento): adiciona models FechamentoCadastro e FechamentoInstancia"
```

---

### Task 2: Service — cadastros e busca de transações (motor compartilhado)

**Files:**
- Create: `backend/src/services/fechamentoService.js`

**Testabilidade:** sem tela — lógica de service, validada via Task 6 (testes) e indiretamente pelos
endpoints da Task 4/5.

- [ ] **Step 1: Criar o arquivo com helpers, cadastros e o motor de busca de transações**

```javascript
// src/services/fechamentoService.js
const mongoose = require('mongoose');
const FechamentoCadastro = require('../models/fechamentoCadastro');
const FechamentoInstancia = require('../models/fechamentoInstancia');
const Pessoa = require('../models/pessoa');
const ModeloRelatorio = require('../models/modeloRelatorio');
const Tag = require('../models/tag');
const Transacao = require('../models/transacao');
const Settlement = require('../models/settlement');
const { addContabilizavelCondition } = require('../utils/transacaoContabilizavel');
const { processWithRules } = require('../reportEngine/ruleEngine');
const { aggregate } = require('../reportEngine/aggregator');

const STATUS_MANUAL = ['aberto', 'enviado', 'aguardando_recebimento'];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converte regras do modelo (tag ObjectId populado + effect) para o formato do ruleEngine.
 * Duplicado propositalmente de `reportEngine/index.js` (função pequena, evita acoplar os dois
 * módulos por um detalhe de conversão).
 */
function modelRulesToEngineRules(regras) {
  if (!Array.isArray(regras)) return [];
  return regras.map((r) => {
    const tagRef = r.tag;
    const tagId = tagRef?._id ? tagRef._id.toString() : (tagRef?.toString ? tagRef.toString() : tagRef);
    return tagId ? { tagId, effect: r.effect || 'add' } : null;
  }).filter(Boolean);
}

/**
 * Monta o $and de overlap de período: instância aparece se
 * [instancia.dataInicio, instancia.dataFim] tem interseção com [dataInicio, dataFim] do filtro.
 * Exportado para ser testável isoladamente (ver fechamentoService.test.js).
 */
function periodoOverlapMatch(dataInicioFiltro, dataFimFiltro) {
  const cond = [];
  if (dataFimFiltro) cond.push({ dataInicio: { $lte: new Date(dataFimFiltro + 'T23:59:59.999Z') } });
  if (dataInicioFiltro) cond.push({ dataFim: { $gte: new Date(dataInicioFiltro + 'T00:00:00.000Z') } });
  return cond.length > 0 ? { $and: cond } : {};
}

/**
 * Busca as transações de uma pessoa (por nome, case-insensitive) num período, aplica as regras
 * do modelo de relatório e agrega — reaproveita o reportEngine sem alterá-lo.
 */
async function buscarLinhasEResumo(usuarioId, pessoaNome, dataInicioStr, dataFimStr, modeloDoc) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    'pagamentos.pessoa': new RegExp('^' + escapeRegex(pessoaNome) + '$', 'i')
  };
  if (dataInicioStr || dataFimStr) {
    match.data = {};
    if (dataInicioStr) match.data.$gte = new Date(dataInicioStr + 'T00:00:00.000Z');
    if (dataFimStr) match.data.$lte = new Date(dataFimStr + 'T23:59:59.999Z');
  }
  addContabilizavelCondition(match);

  const transacoes = await Transacao.find(match).sort({ data: -1 }).lean();
  const tags = await Tag.find({ usuario: usuarioId, ativo: true }).lean();

  const regras = modeloDoc ? modelRulesToEngineRules(modeloDoc.regras) : [];
  const aggregationType = modeloDoc?.aggregation || 'default';

  const rows = processWithRules(transacoes, regras, tags, { pessoas: [pessoaNome] });
  const summary = aggregate(rows, aggregationType);

  return { rows, summary };
}

// --- Cadastros ---

async function listarCadastros(usuarioId) {
  return FechamentoCadastro.find({ usuario: usuarioId, ativo: true })
    .populate('pessoa', 'nome contato')
    .populate('modeloRelatorio', 'nome aggregation')
    .sort({ createdAt: -1 })
    .lean();
}

async function criarCadastro({ pessoa, modeloRelatorio }, usuarioId) {
  if (!pessoa || !modeloRelatorio) {
    throw new Error('Campos obrigatórios: pessoa, modeloRelatorio.');
  }

  const pessoaDoc = await Pessoa.findOne({ _id: pessoa, usuario: usuarioId, ativo: true });
  if (!pessoaDoc) throw new Error('Pessoa não encontrada.');

  const modeloDoc = await ModeloRelatorio.findOne({ _id: modeloRelatorio, usuario: usuarioId, ativo: true });
  if (!modeloDoc) throw new Error('Modelo de relatório não encontrado.');

  const existente = await FechamentoCadastro.findOne({ usuario: usuarioId, pessoa, ativo: true });
  if (existente) {
    return FechamentoCadastro.findOne({ _id: existente._id, usuario: usuarioId })
      .populate('pessoa', 'nome contato')
      .populate('modeloRelatorio', 'nome aggregation');
  }

  const cadastro = new FechamentoCadastro({ usuario: usuarioId, pessoa, modeloRelatorio, ativo: true });
  await cadastro.save();

  return FechamentoCadastro.findOne({ _id: cadastro._id, usuario: usuarioId })
    .populate('pessoa', 'nome contato')
    .populate('modeloRelatorio', 'nome aggregation');
}

module.exports = {
  STATUS_MANUAL,
  escapeRegex,
  modelRulesToEngineRules,
  periodoOverlapMatch,
  buscarLinhasEResumo,
  listarCadastros,
  criarCadastro
};
```

- [ ] **Step 2: Rodar o backend e confirmar que não há erro de require circular/sintaxe**

Run: `npm run dev` (a partir de `backend/`)
Expected: sobe sem erro. Parar depois (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/fechamentoService.js
git commit -m "feat(fechamento): adiciona cadastros e motor de busca de transações no fechamentoService"
```

---

### Task 3: Service — instâncias (listar, criar, duplicar, detalhe, status, link, excluir)

**Files:**
- Modify: `backend/src/services/fechamentoService.js`

**Testabilidade:** sem tela

- [ ] **Step 1: Adicionar as funções de instância ao final do arquivo, antes do `module.exports`**

```javascript
// --- Instâncias ---

async function obterInstanciaPopulada(id, usuarioId) {
  return FechamentoInstancia.findOne({ _id: id, usuario: usuarioId })
    .populate({
      path: 'cadastro',
      populate: [
        { path: 'pessoa', select: 'nome contato' },
        { path: 'modeloRelatorio', select: 'nome aggregation' }
      ]
    });
}

async function listarInstancias(usuarioId, { dataInicio, dataFim } = {}) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    ...periodoOverlapMatch(dataInicio, dataFim)
  };

  const instancias = await FechamentoInstancia.find(match)
    .sort({ dataInicio: -1 })
    .populate({
      path: 'cadastro',
      populate: [
        { path: 'pessoa', select: 'nome contato' },
        { path: 'modeloRelatorio', populate: { path: 'regras.tag' } }
      ]
    })
    .lean();

  const comResumo = await Promise.all(instancias.map(async (inst) => {
    const pessoaNome = inst.cadastro?.pessoa?.nome;
    if (!pessoaNome) {
      return { ...inst, resumo: { totalValue: '0.00', totalRows: 0 } };
    }
    const dInicio = inst.dataInicio.toISOString().slice(0, 10);
    const dFim = inst.dataFim.toISOString().slice(0, 10);
    const { summary } = await buscarLinhasEResumo(
      usuarioId, pessoaNome, dInicio, dFim, inst.cadastro.modeloRelatorio
    );
    return { ...inst, resumo: summary };
  }));

  return comResumo;
}

async function criarInstancia({ cadastro, pessoa, modeloRelatorio, dataInicio, dataFim }, usuarioId) {
  if (!dataInicio || !dataFim) {
    throw new Error('Campos obrigatórios: dataInicio, dataFim.');
  }

  let cadastroDoc;
  if (cadastro) {
    cadastroDoc = await FechamentoCadastro.findOne({ _id: cadastro, usuario: usuarioId, ativo: true });
    if (!cadastroDoc) throw new Error('Cadastro de Fechamento não encontrado.');
  } else {
    cadastroDoc = await criarCadastro({ pessoa, modeloRelatorio }, usuarioId);
  }

  const instancia = new FechamentoInstancia({
    usuario: usuarioId,
    cadastro: cadastroDoc._id,
    dataInicio: new Date(dataInicio + 'T00:00:00.000Z'),
    dataFim: new Date(dataFim + 'T23:59:59.999Z'),
    status: 'aberto'
  });
  await instancia.save();

  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function duplicarInstancia(id, usuarioId) {
  const original = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!original) throw new Error('Instância não encontrada.');

  const novaDataInicio = new Date(original.dataFim);
  novaDataInicio.setUTCDate(novaDataInicio.getUTCDate() + 1);

  const novaDataFim = new Date(novaDataInicio);
  novaDataFim.setUTCMonth(novaDataFim.getUTCMonth() + 1);
  novaDataFim.setUTCDate(novaDataFim.getUTCDate() - 1);

  const nova = new FechamentoInstancia({
    usuario: usuarioId,
    cadastro: original.cadastro,
    dataInicio: novaDataInicio,
    dataFim: novaDataFim,
    status: 'aberto'
  });
  await nova.save();

  return obterInstanciaPopulada(nova._id, usuarioId);
}

async function obterTransacoesDaInstancia(id, usuarioId) {
  const instancia = await obterInstanciaPopulada(id, usuarioId);
  if (!instancia) throw new Error('Instância não encontrada.');

  const pessoaNome = instancia.cadastro?.pessoa?.nome;
  if (!pessoaNome) return { rows: [], summary: aggregate([], 'default') };

  const modeloDoc = await ModeloRelatorio.findOne({
    _id: instancia.cadastro.modeloRelatorio._id,
    usuario: usuarioId
  }).populate('regras.tag');

  const dInicio = instancia.dataInicio.toISOString().slice(0, 10);
  const dFim = instancia.dataFim.toISOString().slice(0, 10);
  return buscarLinhasEResumo(usuarioId, pessoaNome, dInicio, dFim, modeloDoc);
}

async function atualizarStatus(id, status, usuarioId) {
  if (!STATUS_MANUAL.includes(status)) {
    throw new Error(`Status inválido. Use um de: ${STATUS_MANUAL.join(', ')}.`);
  }
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!instancia) throw new Error('Instância não encontrada.');
  instancia.status = status;
  await instancia.save();
  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function linkarRecebimento(id, settlementId, usuarioId) {
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId }).populate({
    path: 'cadastro',
    populate: { path: 'pessoa', select: 'nome' }
  });
  if (!instancia) throw new Error('Instância não encontrada.');

  const settlement = await Settlement.findOne({ _id: settlementId, usuario: usuarioId })
    .populate('receivingTransactionId', 'pagamentos');
  if (!settlement) throw new Error('Conciliação (Settlement) não encontrada.');

  const pessoaNome = (instancia.cadastro?.pessoa?.nome || '').toLowerCase();
  const pagamentosRecebimento = settlement.receivingTransactionId?.pagamentos || [];
  const bate = pagamentosRecebimento.some((p) => (p.pessoa || '').toLowerCase() === pessoaNome);
  if (!bate) {
    throw new Error('Esta conciliação não pertence a esta pessoa.');
  }

  instancia.settlementId = settlement._id;
  instancia.status = 'recebido';
  await instancia.save();

  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function excluirInstancia(id, usuarioId) {
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!instancia) throw new Error('Instância não encontrada.');
  await FechamentoInstancia.deleteOne({ _id: id, usuario: usuarioId });
  return { mensagem: 'Instância de Fechamento removida.' };
}
```

- [ ] **Step 2: Atualizar o `module.exports` para incluir as novas funções**

```javascript
module.exports = {
  STATUS_MANUAL,
  escapeRegex,
  modelRulesToEngineRules,
  periodoOverlapMatch,
  buscarLinhasEResumo,
  listarCadastros,
  criarCadastro,
  obterInstanciaPopulada,
  listarInstancias,
  criarInstancia,
  duplicarInstancia,
  obterTransacoesDaInstancia,
  atualizarStatus,
  linkarRecebimento,
  excluirInstancia
};
```

- [ ] **Step 3: Rodar o backend e confirmar que não há erro**

Run: `npm run dev` (a partir de `backend/`)
Expected: sobe sem erro. Parar depois (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/fechamentoService.js
git commit -m "feat(fechamento): adiciona ciclo completo de instancias ao fechamentoService"
```

---

### Task 4: Controller

**Files:**
- Create: `backend/src/controllers/controladorFechamento.js`

**Testabilidade:** sem tela

- [ ] **Step 1: Criar o controller**

```javascript
// src/controllers/controladorFechamento.js
const fechamentoService = require('../services/fechamentoService');

exports.listarCadastros = async (req, res) => {
  try {
    const cadastros = await fechamentoService.listarCadastros(req.userId);
    res.json(cadastros);
  } catch (error) {
    console.error('[Fechamento] Erro ao listar cadastros:', error);
    res.status(500).json({ erro: 'Erro ao listar cadastros de Fechamento.' });
  }
};

exports.criarCadastro = async (req, res) => {
  try {
    const { pessoa, modeloRelatorio } = req.body;
    const cadastro = await fechamentoService.criarCadastro({ pessoa, modeloRelatorio }, req.userId);
    res.status(201).json(cadastro);
  } catch (error) {
    console.error('[Fechamento] Erro ao criar cadastro:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar cadastro de Fechamento.' });
  }
};

exports.listarInstancias = async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const instancias = await fechamentoService.listarInstancias(req.userId, { dataInicio, dataFim });
    res.json(instancias);
  } catch (error) {
    console.error('[Fechamento] Erro ao listar instâncias:', error);
    res.status(500).json({ erro: 'Erro ao listar instâncias de Fechamento.' });
  }
};

exports.criarInstancia = async (req, res) => {
  try {
    const { cadastro, pessoa, modeloRelatorio, dataInicio, dataFim } = req.body;
    const instancia = await fechamentoService.criarInstancia(
      { cadastro, pessoa, modeloRelatorio, dataInicio, dataFim },
      req.userId
    );
    res.status(201).json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao criar instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar instância de Fechamento.' });
  }
};

exports.duplicarInstancia = async (req, res) => {
  try {
    const instancia = await fechamentoService.duplicarInstancia(req.params.id, req.userId);
    res.status(201).json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao duplicar instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao duplicar instância de Fechamento.' });
  }
};

exports.obterTransacoesDaInstancia = async (req, res) => {
  try {
    const resultado = await fechamentoService.obterTransacoesDaInstancia(req.params.id, req.userId);
    res.json(resultado);
  } catch (error) {
    console.error('[Fechamento] Erro ao obter transações da instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao obter transações da instância.' });
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const instancia = await fechamentoService.atualizarStatus(req.params.id, status, req.userId);
    res.json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao atualizar status:', error);
    res.status(400).json({ erro: error.message || 'Erro ao atualizar status.' });
  }
};

exports.linkarRecebimento = async (req, res) => {
  try {
    const { settlementId } = req.body;
    const instancia = await fechamentoService.linkarRecebimento(req.params.id, settlementId, req.userId);
    res.json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao linkar recebimento:', error);
    res.status(400).json({ erro: error.message || 'Erro ao linkar recebimento.' });
  }
};

exports.excluirInstancia = async (req, res) => {
  try {
    const resultado = await fechamentoService.excluirInstancia(req.params.id, req.userId);
    res.json(resultado);
  } catch (error) {
    console.error('[Fechamento] Erro ao excluir instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao excluir instância.' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/controladorFechamento.js
git commit -m "feat(fechamento): adiciona controladorFechamento"
```

---

### Task 5: Rotas + registro no `app.js`

**Files:**
- Create: `backend/src/routes/rotasFechamento.js`
- Modify: `backend/src/app.js`

**Testabilidade:** sem tela — testável via `curl`/Postman contra `/api/fechamento/*`

- [ ] **Step 1: Criar o arquivo de rotas**

```javascript
// src/routes/rotasFechamento.js
const express = require('express');
const router = express.Router();
const controlador = require('../controllers/controladorFechamento');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/cadastros', controlador.listarCadastros);
router.post('/cadastros', controlador.criarCadastro);
router.get('/instancias', controlador.listarInstancias);
router.post('/instancias', controlador.criarInstancia);
router.post('/instancias/:id/duplicar', controlador.duplicarInstancia);
router.get('/instancias/:id/transacoes', controlador.obterTransacoesDaInstancia);
router.patch('/instancias/:id/status', controlador.atualizarStatus);
router.post('/instancias/:id/linkar-recebimento', controlador.linkarRecebimento);
router.delete('/instancias/:id', controlador.excluirInstancia);

module.exports = router;
```

- [ ] **Step 2: Registrar a rota em `backend/src/app.js`**

Localizar a linha (por volta da 74, junto às outras rotas requeridas):
```javascript
const rotasSettlement = require('./routes/rotasSettlement');
```
E adicionar logo abaixo:
```javascript
const rotasFechamento = require('./routes/rotasFechamento');
```

Localizar a linha (por volta da 99, junto aos outros `app.use('/api/...')`):
```javascript
app.use('/api/settlements', rotasSettlement);
```
E adicionar logo abaixo:
```javascript
app.use('/api/fechamento', rotasFechamento);
```

- [ ] **Step 3: Testar manualmente com `curl`**

Suba o backend (`npm run dev` a partir de `backend/`) e obtenha um token válido de login. Depois:

Run:
```bash
curl -s http://localhost:3001/api/fechamento/instancias -H "Authorization: Bearer SEU_TOKEN"
```
Expected: `[]` (array vazio, já que ainda não existem instâncias) e status 200 — não 404/401.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/rotasFechamento.js backend/src/app.js
git commit -m "feat(fechamento): registra rotas /api/fechamento"
```

---

### Task 6: Testes do backend

**Files:**
- Create: `backend/src/services/__tests__/fechamentoService.test.js`

**Testabilidade:** sem tela — validado pelo próprio test runner

- [ ] **Step 1: Escrever os testes (mockando os models, seguindo o padrão de `emprestimoService.test.js`)**

```javascript
// src/services/__tests__/fechamentoService.test.js
const mongoose = require('mongoose');

const mockInstanciaFindOne = jest.fn();

jest.mock('../../models/fechamentoCadastro', () => ({}));
jest.mock('../../models/fechamentoInstancia', () => {
  const Mock = jest.fn();
  Mock.findOne = (...args) => mockInstanciaFindOne(...args);
  return Mock;
});
jest.mock('../../models/pessoa', () => ({}));
jest.mock('../../models/modeloRelatorio', () => ({}));
jest.mock('../../models/tag', () => ({}));
jest.mock('../../models/transacao', () => ({}));
jest.mock('../../models/settlement', () => ({}));

const {
  STATUS_MANUAL,
  periodoOverlapMatch,
  modelRulesToEngineRules,
  atualizarStatus,
  duplicarInstancia
} = require('../fechamentoService');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('periodoOverlapMatch', () => {
  test('sem filtro, retorna objeto vazio (sem restrição)', () => {
    expect(periodoOverlapMatch(undefined, undefined)).toEqual({});
  });

  test('com dataInicio e dataFim, monta $and com dataInicio <= fim E dataFim >= inicio', () => {
    const match = periodoOverlapMatch('2026-08-01', '2026-08-31');
    expect(match.$and).toHaveLength(2);
    expect(match.$and[0].dataInicio.$lte.toISOString()).toContain('2026-08-31');
    expect(match.$and[1].dataFim.$gte.toISOString()).toContain('2026-08-01');
  });
});

describe('modelRulesToEngineRules', () => {
  test('converte regras com tag ObjectId populado', () => {
    const tagId = new mongoose.Types.ObjectId();
    const regras = [{ tag: { _id: tagId }, effect: 'subtract' }];
    expect(modelRulesToEngineRules(regras)).toEqual([
      { tagId: tagId.toString(), effect: 'subtract' }
    ]);
  });

  test('ignora regra sem tag', () => {
    expect(modelRulesToEngineRules([{ effect: 'add' }])).toEqual([]);
  });

  test('retorna array vazio para entrada não-array', () => {
    expect(modelRulesToEngineRules(null)).toEqual([]);
    expect(modelRulesToEngineRules(undefined)).toEqual([]);
  });
});

describe('atualizarStatus', () => {
  test('rejeita status fora de STATUS_MANUAL (ex: "recebido" direto)', async () => {
    await expect(atualizarStatus('id-qualquer', 'recebido', USER_ID))
      .rejects.toThrow(/Status inválido/);
  });

  test('aceita todos os status manuais válidos sem lançar erro de validação', () => {
    // Confirma que a lista exportada bate com a documentada na spec (contrato público).
    expect(STATUS_MANUAL).toEqual(['aberto', 'enviado', 'aguardando_recebimento']);
  });
});

describe('duplicarInstancia', () => {
  test('lança erro quando a instância original não é encontrada', async () => {
    mockInstanciaFindOne.mockResolvedValueOnce(null);
    await expect(duplicarInstancia('id-inexistente', USER_ID))
      .rejects.toThrow('Instância não encontrada.');
  });

  test('avança o período em ~1 mês a partir do dataFim original', async () => {
    const original = {
      _id: 'inst-1',
      cadastro: 'cad-1',
      dataFim: new Date('2026-08-31T23:59:59.999Z')
    };
    mockInstanciaFindOne.mockResolvedValueOnce(original);

    let capturedSave;
    const OriginalMock = require('../../models/fechamentoInstancia');
    OriginalMock.mockImplementationOnce(function (data) {
      capturedSave = data;
      this.save = jest.fn().mockResolvedValue(undefined);
      this._id = 'inst-2';
      Object.assign(this, data);
    });
    // Segunda chamada de findOne (dentro de obterInstanciaPopulada) — populate encadeado
    mockInstanciaFindOne.mockReturnValueOnce({
      populate: () => Promise.resolve({ _id: 'inst-2', ...capturedSave })
    });

    await duplicarInstancia('inst-1', USER_ID);

    expect(capturedSave.dataInicio.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(capturedSave.dataFim.toISOString().slice(0, 10)).toBe('2026-09-30');
    expect(capturedSave.status).toBe('aberto');
  });
});
```

- [ ] **Step 2: Rodar os testes**

Run: `npx jest fechamentoService` (a partir de `backend/`)
Expected: todos os testes passam (PASS).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/__tests__/fechamentoService.test.js
git commit -m "test(fechamento): cobre periodoOverlapMatch, modelRulesToEngineRules, atualizarStatus e duplicarInstancia"
```

---

### Task 7: API client do frontend (`src/api.js`)

**Files:**
- Modify: `controle-gastos-frontend/src/api.js`

**Testabilidade:** não testável isoladamente (funções puras de fetch, validadas em uso pelas telas
das próximas tasks)

- [ ] **Step 1: Adicionar a seção "Fechamento" ao final de `src/api.js`**

```javascript
/* ----- Fechamento ----- */
export async function listarCadastrosFechamento() {
  const resposta = await fetch(`${API_BASE}/fechamento/cadastros`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao listar cadastros de Fechamento.`);
  return Array.isArray(dados) ? dados : [];
}

export async function criarCadastroFechamento(dados) {
  const resposta = await fetch(`${API_BASE}/fechamento/cadastros`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao criar cadastro de Fechamento.`);
  return json;
}

export async function listarInstanciasFechamento({ dataInicio, dataFim } = {}) {
  const q = new URLSearchParams();
  if (dataInicio) q.set('dataInicio', dataInicio);
  if (dataFim) q.set('dataFim', dataFim);
  const query = q.toString() ? `?${q.toString()}` : '';
  const resposta = await fetch(`${API_BASE}/fechamento/instancias${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao listar instâncias de Fechamento.`);
  return Array.isArray(dados) ? dados : [];
}

export async function criarInstanciaFechamento(dados) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao criar instância de Fechamento.`);
  return json;
}

export async function duplicarInstanciaFechamento(id) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias/${id}/duplicar`, {
    method: 'POST',
    headers: getHeaders(false)
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao duplicar instância.`);
  return json;
}

export async function obterTransacoesInstanciaFechamento(id) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias/${id}/transacoes`, {
    headers: getHeaders(false)
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao obter transações da instância.`);
  return json;
}

export async function atualizarStatusInstanciaFechamento(id, status) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias/${id}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ status })
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao atualizar status.`);
  return json;
}

export async function linkarRecebimentoInstanciaFechamento(id, settlementId) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias/${id}/linkar-recebimento`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ settlementId })
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao linkar recebimento.`);
  return json;
}

export async function excluirInstanciaFechamento(id) {
  const resposta = await fetch(`${API_BASE}/fechamento/instancias/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const json = await resposta.json();
  if (!resposta.ok) throw new Error(json?.erro || `Erro ${resposta.status} ao excluir instância.`);
  return json;
}
```

- [ ] **Step 2: Confirmar que o frontend compila**

Run: `npm start` (a partir de `controle-gastos-frontend/`, deixar subir e depois parar com Ctrl+C)
Expected: compila sem erro (`webpack compiled successfully`).

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/api.js
git commit -m "feat(fechamento): adiciona chamadas de API do modulo Fechamento em src/api.js"
```

---

### Task 8: Hook `useFechamento`

**Files:**
- Create: `controle-gastos-frontend/src/hooks/useFechamento.js`

**Testabilidade:** não testável isoladamente (hook de orquestração, validado na tela da Task 12)

- [ ] **Step 1: Criar o hook**

```javascript
// src/hooks/useFechamento.js
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  listarInstanciasFechamento,
  criarInstanciaFechamento,
  duplicarInstanciaFechamento,
  obterTransacoesInstanciaFechamento,
  atualizarStatusInstanciaFechamento,
  linkarRecebimentoInstanciaFechamento,
  excluirInstanciaFechamento
} from '../api';

export default function useFechamento({ dataInicio, dataFim }) {
  const [instancias, setInstancias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandidas, setExpandidas] = useState(new Set());
  const [detalhes, setDetalhes] = useState({}); // { [instanciaId]: { rows, summary, loading } }
  const [selecionadas, setSelecionadas] = useState(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const dados = await listarInstanciasFechamento({ dataInicio, dataFim });
      setInstancias(dados);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar instâncias de Fechamento.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const alternarExpandida = useCallback(async (id) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    setDetalhes((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: { rows: [], summary: null, loading: true } };
    });

    if (!detalhes[id]) {
      try {
        const resultado = await obterTransacoesInstanciaFechamento(id);
        setDetalhes((prev) => ({ ...prev, [id]: { ...resultado, loading: false } }));
      } catch (err) {
        toast.error(err.message || 'Erro ao carregar transações da instância.');
        setDetalhes((prev) => ({ ...prev, [id]: { rows: [], summary: null, loading: false } }));
      }
    }
  }, [detalhes]);

  const criarInstancia = useCallback(async (payload) => {
    await criarInstanciaFechamento(payload);
    toast.success('Instância de Fechamento criada.');
    await carregar();
  }, [carregar]);

  const duplicar = useCallback(async (id) => {
    await duplicarInstanciaFechamento(id);
    toast.success('Instância duplicada para o próximo período.');
    await carregar();
  }, [carregar]);

  const atualizarStatus = useCallback(async (id, status) => {
    await atualizarStatusInstanciaFechamento(id, status);
    toast.success('Status atualizado.');
    await carregar();
  }, [carregar]);

  const linkarRecebimento = useCallback(async (id, settlementId) => {
    await linkarRecebimentoInstanciaFechamento(id, settlementId);
    toast.success('Recebimento linkado — status atualizado para Recebido.');
    await carregar();
  }, [carregar]);

  const excluir = useCallback(async (id) => {
    await excluirInstanciaFechamento(id);
    toast.success('Instância removida.');
    await carregar();
  }, [carregar]);

  const alternarSelecao = useCallback((id) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selecionarTodas = useCallback((marcado) => {
    setSelecionadas(marcado ? new Set(instancias.map((i) => i._id)) : new Set());
  }, [instancias]);

  return {
    instancias,
    loading,
    expandidas,
    detalhes,
    selecionadas,
    carregar,
    alternarExpandida,
    criarInstancia,
    duplicar,
    atualizarStatus,
    linkarRecebimento,
    excluir,
    alternarSelecao,
    selecionarTodas
  };
}
```

- [ ] **Step 2: Confirmar que o frontend compila**

Run: `npm start` (a partir de `controle-gastos-frontend/`, verificar console, depois Ctrl+C)
Expected: compila sem erro.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/hooks/useFechamento.js
git commit -m "feat(fechamento): adiciona hook useFechamento"
```

---

### Task 9: Componente `FechamentoInstanciaCard`

**Files:**
- Create: `controle-gastos-frontend/src/components/Fechamento/FechamentoInstanciaCard.js`
- Create: `controle-gastos-frontend/src/components/Fechamento/FechamentoInstanciaCard.css`

**Testabilidade:** tela — renderizado dentro da página da Task 12, verificado visualmente lá.

- [ ] **Step 1: Criar o componente**

```javascript
// src/components/Fechamento/FechamentoInstanciaCard.js
import React from 'react';
import { FaFileDownload, FaLink, FaChevronDown, FaChevronUp, FaCopy } from 'react-icons/fa';
import Card from '../shared/Card';
import Button from '../shared/Button';
import './FechamentoInstanciaCard.css';

const STATUS_LABEL = {
  aberto: 'Aberto',
  enviado: 'Enviado',
  aguardando_recebimento: 'Aguardando Recebimento',
  recebido: 'Recebido'
};

const STATUS_ORDER = ['aberto', 'enviado', 'aguardando_recebimento', 'recebido'];

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const FechamentoInstanciaCard = ({
  instancia,
  expandida,
  detalhe,
  selecionada,
  onToggleSelecao,
  onToggleExpandir,
  onGerarPDF,
  onDuplicar,
  onAvancarStatus,
  onAbrirLinkRecebimento
}) => {
  const pessoa = instancia.cadastro?.pessoa;
  const statusAtual = instancia.status;
  const statusIndex = STATUS_ORDER.indexOf(statusAtual);
  const proximoStatusManual = statusAtual === 'aberto'
    ? 'enviado'
    : statusAtual === 'enviado'
      ? 'aguardando_recebimento'
      : null;

  return (
    <Card variant="glass" padding="lg" className="fechamento-card">
      <div className="fechamento-card__top">
        <input
          type="checkbox"
          className="fechamento-card__checkbox"
          checked={selecionada}
          onChange={() => onToggleSelecao(instancia._id)}
        />
        <div className="fechamento-card__identity">
          <p className="fechamento-card__name">{pessoa?.nome || 'Pessoa removida'}</p>
          <p className="fechamento-card__period">
            {formatData(instancia.dataInicio)} – {formatData(instancia.dataFim)} · {instancia.cadastro?.modeloRelatorio?.nome}
          </p>
        </div>
        <span className={`fechamento-status-pill fechamento-status-pill--${statusAtual}`}>
          {STATUS_LABEL[statusAtual]}
        </span>
      </div>

      <div className="fechamento-stepper">
        {STATUS_ORDER.map((s, i) => (
          <div key={s} className={`fechamento-stepper__seg ${i <= statusIndex ? 'done' : ''}`} />
        ))}
      </div>
      <div className="fechamento-stepper__labels">
        {STATUS_ORDER.map((s, i) => (
          <span key={s} className={i === statusIndex ? 'current' : ''}>{STATUS_LABEL[s]}</span>
        ))}
      </div>

      <div className="fechamento-card__totalrow">
        <span className="fechamento-card__txcount">
          {instancia.resumo?.totalRows ?? 0} transações
        </span>
        <span className="fechamento-card__total">
          {formatMoeda(instancia.resumo?.totalValue)}
        </span>
      </div>

      {expandida && (
        <div className="fechamento-detail">
          {detalhe?.loading && <p>Carregando transações...</p>}
          {!detalhe?.loading && (detalhe?.rows?.length ?? 0) === 0 && (
            <p className="fechamento-detail__empty">Nenhuma transação encontrada neste período.</p>
          )}
          {!detalhe?.loading && (detalhe?.rows?.length ?? 0) > 0 && (
            <table className="fechamento-tx-table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
              <tbody>
                {detalhe.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{formatData(row.data)}</td>
                    <td>{row.descricao}</td>
                    <td>{formatMoeda(row.valorPagamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="fechamento-link-box">
            {instancia.settlementId ? (
              <span className="fechamento-link-box__text">
                Linkado à conciliação <b>#{String(instancia.settlementId).slice(-6)}</b>
              </span>
            ) : (
              <>
                <span className="fechamento-link-box__text">Nenhum recebimento linkado ainda</span>
                <Button variant="ghost" size="sm" onClick={() => onAbrirLinkRecebimento(instancia)}>
                  <FaLink /> Linkar Recebimento
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="fechamento-card__actions">
        <Button variant="ghost" size="sm" onClick={() => onToggleExpandir(instancia._id)}>
          {expandida ? <FaChevronUp /> : <FaChevronDown />} {expandida ? 'Recolher' : 'Ver detalhe'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onGerarPDF(instancia)}>
          <FaFileDownload /> Gerar PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDuplicar(instancia._id)}>
          <FaCopy /> Duplicar
        </Button>
        {proximoStatusManual && (
          <Button variant="secondary" size="sm" onClick={() => onAvancarStatus(instancia._id, proximoStatusManual)}>
            Marcar como {STATUS_LABEL[proximoStatusManual]}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default FechamentoInstanciaCard;
```

- [ ] **Step 2: Criar o CSS (reaproveita os tokens do design system)**

```css
/* src/components/Fechamento/FechamentoInstanciaCard.css */
.fechamento-card {
  display: flex;
  flex-direction: column;
  gap: var(--cg-spacing-base);
}

.fechamento-card__top {
  display: flex;
  align-items: flex-start;
  gap: var(--cg-spacing-md);
}

.fechamento-card__checkbox {
  width: 17px;
  height: 17px;
  accent-color: var(--cg-color-primary);
  margin-top: 4px;
}

.fechamento-card__identity {
  flex: 1;
  min-width: 0;
}

.fechamento-card__name {
  font-size: 1.0625rem;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--cg-color-text-primary);
}

.fechamento-card__period {
  font-size: 0.8125rem;
  color: var(--cg-color-text-muted);
  margin: 0;
}

.fechamento-status-pill {
  padding: 5px 11px;
  border-radius: var(--cg-radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.fechamento-status-pill--aberto { background: var(--cg-color-border); color: var(--cg-color-text-secondary); }
.fechamento-status-pill--enviado { background: rgba(59, 130, 246, 0.12); color: var(--cg-color-info); }
.fechamento-status-pill--aguardando_recebimento { background: rgba(245, 158, 11, 0.14); color: var(--cg-color-warning); }
.fechamento-status-pill--recebido { background: rgba(16, 185, 129, 0.12); color: var(--cg-color-success); }

.fechamento-stepper {
  display: flex;
  gap: 3px;
}

.fechamento-stepper__seg {
  flex: 1;
  height: 4px;
  background: var(--cg-color-border);
  border-radius: 4px;
}

.fechamento-stepper__seg.done {
  background: var(--cg-color-primary);
}

.fechamento-stepper__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--cg-color-text-muted);
  margin-top: -8px;
}

.fechamento-stepper__labels .current {
  color: var(--cg-color-text-primary);
  font-weight: 600;
}

.fechamento-card__totalrow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: var(--cg-spacing-sm);
  border-top: 1px solid var(--cg-color-border);
}

.fechamento-card__total {
  font-size: 1.625rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--cg-color-text-primary);
}

.fechamento-card__txcount {
  font-size: 0.8125rem;
  color: var(--cg-color-text-muted);
}

.fechamento-detail {
  border-top: 1px solid var(--cg-color-border);
  padding-top: var(--cg-spacing-base);
}

.fechamento-detail__empty {
  color: var(--cg-color-text-muted);
  font-size: 0.875rem;
}

.fechamento-tx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.fechamento-tx-table thead th {
  text-align: left;
  background: var(--cg-color-thead-bg);
  color: var(--cg-color-text-muted);
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  padding: 8px 10px;
}

.fechamento-tx-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--cg-color-border);
  color: var(--cg-color-text-primary);
}

.fechamento-link-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--cg-spacing-sm);
  padding: 10px var(--cg-spacing-md);
  border-radius: var(--cg-radius-md);
  background: var(--cg-color-primary-muted);
  font-size: 0.8125rem;
  margin-top: var(--cg-spacing-sm);
}

.fechamento-link-box__text {
  color: var(--cg-color-text-secondary);
}

.fechamento-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/FechamentoInstanciaCard.js controle-gastos-frontend/src/components/Fechamento/FechamentoInstanciaCard.css
git commit -m "feat(fechamento): adiciona componente FechamentoInstanciaCard"
```

---

### Task 10: Modal "Nova Instância"

**Files:**
- Create: `controle-gastos-frontend/src/components/Fechamento/NovaInstanciaModal.js`
- Create: `controle-gastos-frontend/src/components/Fechamento/NovaInstanciaModal.css`

**Testabilidade:** tela

- [ ] **Step 1: Criar o modal**

```javascript
// src/components/Fechamento/NovaInstanciaModal.js
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';
import ModalTransacao from '../Modal/ModalTransacao';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { listarPessoas, listarModelosRelatorio, listarCadastrosFechamento } from '../../api';
import './NovaInstanciaModal.css';

function mesAtualISO() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: fim.toISOString().slice(0, 10)
  };
}

const NovaInstanciaModal = ({ onClose, onCriar }) => {
  const [pessoas, setPessoas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cadastros, setCadastros] = useState([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);
  const [modeloSelecionado, setModeloSelecionado] = useState(null);
  const periodoInicial = mesAtualISO();
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pessoasData, modelosData, cadastrosData] = await Promise.all([
          listarPessoas(),
          listarModelosRelatorio(),
          listarCadastrosFechamento()
        ]);
        setPessoas(pessoasData);
        setModelos(modelosData);
        setCadastros(cadastrosData);
      } catch (err) {
        toast.error(err.message || 'Erro ao carregar dados para o formulário.');
      }
    })();
  }, []);

  const cadastroExistente = pessoaSelecionada
    ? cadastros.find((c) => c.pessoa?._id === pessoaSelecionada.value)
    : null;

  const handleSalvar = async () => {
    if (!pessoaSelecionada) {
      toast.error('Selecione uma pessoa.');
      return;
    }
    if (!cadastroExistente && !modeloSelecionado) {
      toast.error('Selecione um modelo de relatório para esta pessoa.');
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error('Defina o período (início e fim).');
      return;
    }

    setSalvando(true);
    try {
      await onCriar({
        cadastro: cadastroExistente?._id,
        pessoa: cadastroExistente ? undefined : pessoaSelecionada.value,
        modeloRelatorio: cadastroExistente ? undefined : modeloSelecionado?.value,
        dataInicio,
        dataFim
      });
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao criar instância.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="nova-instancia-modal">
        <h2 className="nova-instancia-modal__title">Nova Instância de Fechamento</h2>

        <div className="nova-instancia-modal__field">
          <label>Pessoa</label>
          <Select
            classNamePrefix="cg-select"
            options={pessoas.map((p) => ({ value: p._id, label: p.nome }))}
            value={pessoaSelecionada}
            onChange={setPessoaSelecionada}
            placeholder="Buscar pessoa..."
          />
        </div>

        {pessoaSelecionada && cadastroExistente && (
          <p className="nova-instancia-modal__hint">
            Modelo padrão desta pessoa: <b>{cadastroExistente.modeloRelatorio?.nome}</b>
          </p>
        )}

        {pessoaSelecionada && !cadastroExistente && (
          <div className="nova-instancia-modal__field">
            <label>Modelo de Relatório (esta pessoa ainda não tem um cadastro)</label>
            <Select
              classNamePrefix="cg-select"
              options={modelos.map((m) => ({ value: m._id, label: m.nome }))}
              value={modeloSelecionado}
              onChange={setModeloSelecionado}
              placeholder="Selecionar modelo..."
            />
          </div>
        )}

        <div className="nova-instancia-modal__field nova-instancia-modal__field--row">
          <div>
            <label>Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label>Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        <div className="nova-instancia-modal__actions">
          <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>Criar</Button>
        </div>
      </Card>
    </ModalTransacao>
  );
};

export default NovaInstanciaModal;
```

- [ ] **Step 2: Criar o CSS**

```css
/* src/components/Fechamento/NovaInstanciaModal.css */
.nova-instancia-modal {
  width: min(480px, 90vw);
}

.nova-instancia-modal__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 var(--cg-spacing-base);
  color: var(--cg-color-text-primary);
}

.nova-instancia-modal__field {
  margin-bottom: var(--cg-spacing-base);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nova-instancia-modal__field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--cg-color-text-secondary);
}

.nova-instancia-modal__field--row {
  flex-direction: row;
  gap: var(--cg-spacing-base);
}

.nova-instancia-modal__field--row > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nova-instancia-modal__field input[type="date"] {
  padding: 8px 10px;
  border-radius: var(--cg-radius-sm);
  border: 1px solid var(--cg-color-border);
  background: var(--cg-color-surface-elevated);
  color: var(--cg-color-text-primary);
}

.nova-instancia-modal__hint {
  font-size: 0.8125rem;
  color: var(--cg-color-text-secondary);
  margin: -8px 0 var(--cg-spacing-base);
}

.nova-instancia-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: var(--cg-spacing-base);
}
```

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/NovaInstanciaModal.js controle-gastos-frontend/src/components/Fechamento/NovaInstanciaModal.css
git commit -m "feat(fechamento): adiciona modal Nova Instancia"
```

---

### Task 11: Modal "Linkar Recebimento"

**Files:**
- Create: `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js`
- Create: `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.css`

**Testabilidade:** tela

- [ ] **Step 1: Criar o modal**

Reaproveita `listarSettlements` (já existente em `src/api.js`, usado por `/recebimentos/historico`) filtrando
por pessoa no cliente, já que o backend de `Settlement.listar` aceita `pessoa` via query string.

```javascript
// src/components/Fechamento/LinkarRecebimentoModal.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ModalTransacao from '../Modal/ModalTransacao';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { listarSettlements } from '../../api';
import './LinkarRecebimentoModal.css';

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const LinkarRecebimentoModal = ({ instancia, onClose, onLinkar }) => {
  const [settlements, setSettlements] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [linkando, setLinkando] = useState(null);

  const pessoaNome = instancia.cadastro?.pessoa?.nome;

  useEffect(() => {
    (async () => {
      try {
        const resultado = await listarSettlements({ pessoa: pessoaNome, limit: 20 });
        setSettlements(resultado.items || []);
      } catch (err) {
        toast.error(err.message || 'Erro ao listar conciliações.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [pessoaNome]);

  const handleLinkar = async (settlementId) => {
    setLinkando(settlementId);
    try {
      await onLinkar(instancia._id, settlementId);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao linkar recebimento.');
    } finally {
      setLinkando(null);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
        <h2 className="linkar-recebimento-modal__title">Linkar Recebimento — {pessoaNome}</h2>

        {carregando && <p>Carregando conciliações...</p>}
        {!carregando && settlements.length === 0 && (
          <p className="linkar-recebimento-modal__empty">
            Nenhuma conciliação encontrada para esta pessoa. Crie uma em "Recebimentos &gt; Nova Conciliação".
          </p>
        )}
        {!carregando && settlements.map((s) => (
          <div key={s._id || s.id} className="linkar-recebimento-modal__item">
            <div>
              <p className="linkar-recebimento-modal__desc">{s.receivingTransactionId?.descricao}</p>
              <p className="linkar-recebimento-modal__meta">
                {formatMoeda(s.totalApplied)} · {new Date(s.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={linkando === (s._id || s.id)}
              onClick={() => handleLinkar(s._id || s.id)}
            >
              Linkar
            </Button>
          </div>
        ))}

        <div className="linkar-recebimento-modal__actions">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </ModalTransacao>
  );
};

export default LinkarRecebimentoModal;
```

- [ ] **Step 2: Criar o CSS**

```css
/* src/components/Fechamento/LinkarRecebimentoModal.css */
.linkar-recebimento-modal {
  width: min(480px, 90vw);
}

.linkar-recebimento-modal__title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--cg-spacing-base);
  color: var(--cg-color-text-primary);
}

.linkar-recebimento-modal__empty {
  color: var(--cg-color-text-muted);
  font-size: 0.875rem;
}

.linkar-recebimento-modal__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--cg-spacing-md);
  padding: var(--cg-spacing-sm) 0;
  border-top: 1px solid var(--cg-color-border);
}

.linkar-recebimento-modal__desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--cg-color-text-primary);
}

.linkar-recebimento-modal__meta {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--cg-color-text-muted);
}

.linkar-recebimento-modal__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--cg-spacing-base);
}
```

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.css
git commit -m "feat(fechamento): adiciona modal Linkar Recebimento"
```

---

### Task 12: Página `/fechamento`

**Files:**
- Create: `controle-gastos-frontend/src/pages/Fechamento/Fechamento.js`
- Create: `controle-gastos-frontend/src/pages/Fechamento/Fechamento.css`

**Testabilidade:** tela

- [ ] **Step 1: Criar a página**

```javascript
// src/pages/Fechamento/Fechamento.js
import React, { useState } from 'react';
import { FaPlus, FaFileDownload } from 'react-icons/fa';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import StatCard from '../../components/shared/StatCard';
import PeriodQuickFilter from '../../components/shared/PeriodQuickFilter';
import FechamentoInstanciaCard from '../../components/Fechamento/FechamentoInstanciaCard';
import NovaInstanciaModal from '../../components/Fechamento/NovaInstanciaModal';
import LinkarRecebimentoModal from '../../components/Fechamento/LinkarRecebimentoModal';
import useFechamento from '../../hooks/useFechamento';
import { useData } from '../../context/DataContext';
import { exportDataToPDF } from '../../utils/export/exportPDF';
import { exportarFechamentosEmLote } from '../../utils/export/exportFechamentoZip';
import { PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import './Fechamento.css';

function mesAtualISO() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: fim.toISOString().slice(0, 10)
  };
}

const Fechamento = () => {
  const { categorias = [], tags = [] } = useData();
  const [periodo, setPeriodo] = useState(mesAtualISO());
  const [modalNovaInstancia, setModalNovaInstancia] = useState(false);
  const [instanciaParaLinkar, setInstanciaParaLinkar] = useState(null);
  const [exportandoLote, setExportandoLote] = useState(false);

  const {
    instancias,
    loading,
    expandidas,
    detalhes,
    selecionadas,
    alternarExpandida,
    criarInstancia,
    duplicar,
    atualizarStatus,
    linkarRecebimento,
    excluir,
    alternarSelecao,
    selecionarTodas
  } = useFechamento(periodo);

  const totalAReceber = instancias.reduce((s, i) => s + (parseFloat(i.resumo?.totalValue) || 0), 0);
  const totalRecebido = instancias
    .filter((i) => i.status === 'recebido')
    .reduce((s, i) => s + (parseFloat(i.resumo?.totalValue) || 0), 0);
  const totalAguardando = instancias
    .filter((i) => i.status === 'aguardando_recebimento')
    .reduce((s, i) => s + (parseFloat(i.resumo?.totalValue) || 0), 0);

  const handleGerarPDF = async (instancia) => {
    const detalhe = detalhes[instancia._id];
    const rows = detalhe?.rows || (await (async () => {
      await alternarExpandida(instancia._id);
      return [];
    })());
    const pessoa = instancia.cadastro?.pessoa?.nome || 'pessoa';
    const periodoLabel = `${periodo.dataInicio}_${periodo.dataFim}`;
    await exportDataToPDF(
      rows,
      { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, selectedPessoas: [pessoa] },
      instancia.resumo,
      categorias,
      tags,
      `fechamento-${pessoa}-${periodoLabel}.pdf`,
      instancia.cadastro?.modeloRelatorio?.aggregation || 'default'
    );
  };

  const handleExportarLote = async () => {
    const selecionadasArr = instancias.filter((i) => selecionadas.has(i._id));
    if (selecionadasArr.length === 0) return;
    setExportandoLote(true);
    try {
      await exportarFechamentosEmLote(selecionadasArr, categorias, tags, periodo);
    } finally {
      setExportandoLote(false);
    }
  };

  return (
    <div className="fechamento-page">
      <PageHeader
        icon={<AssignmentTurnedInIcon />}
        title="Fechamento"
        subtitle="Acompanhe o fechamento de cada pessoa lado a lado, período a período."
        action={
          <Button variant="primary" onClick={() => setModalNovaInstancia(true)}>
            <FaPlus /> Nova Instância
          </Button>
        }
      />

      <Card variant="glass" padding="md" className="fechamento-filterbar">
        <PeriodQuickFilter
          value={PERIODOS_RAPIDOS.MES_ATUAL}
          dataInicio={periodo.dataInicio}
          dataFim={periodo.dataFim}
          onChange={setPeriodo}
        />
      </Card>

      <div className="fechamento-summary-strip">
        <StatCard label="Instâncias no período" value={instancias.length} />
        <StatCard label="Total a receber" value={totalAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        <StatCard label="Já recebido" value={totalRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accentColor="var(--cg-color-success)" />
        <StatCard label="Aguardando" value={totalAguardando.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accentColor="var(--cg-color-warning)" />
      </div>

      <div className="fechamento-bulkbar">
        <label className="fechamento-bulkbar__left">
          <input
            type="checkbox"
            checked={selecionadas.size > 0 && selecionadas.size === instancias.length}
            onChange={(e) => selecionarTodas(e.target.checked)}
          />
          Selecionar todos ({instancias.length})
        </label>
        <Button
          variant="ghost"
          size="sm"
          disabled={selecionadas.size === 0}
          loading={exportandoLote}
          onClick={handleExportarLote}
        >
          <FaFileDownload /> Exportar selecionados (.zip)
        </Button>
      </div>

      {loading && <p>Carregando...</p>}
      {!loading && instancias.length === 0 && (
        <p className="fechamento-empty">Nenhuma instância de Fechamento neste período.</p>
      )}

      <div className="fechamento-grid">
        {instancias.map((instancia) => (
          <FechamentoInstanciaCard
            key={instancia._id}
            instancia={instancia}
            expandida={expandidas.has(instancia._id)}
            detalhe={detalhes[instancia._id]}
            selecionada={selecionadas.has(instancia._id)}
            onToggleSelecao={alternarSelecao}
            onToggleExpandir={alternarExpandida}
            onGerarPDF={handleGerarPDF}
            onDuplicar={duplicar}
            onAvancarStatus={atualizarStatus}
            onAbrirLinkRecebimento={setInstanciaParaLinkar}
          />
        ))}
      </div>

      {modalNovaInstancia && (
        <NovaInstanciaModal
          onClose={() => setModalNovaInstancia(false)}
          onCriar={criarInstancia}
        />
      )}

      {instanciaParaLinkar && (
        <LinkarRecebimentoModal
          instancia={instanciaParaLinkar}
          onClose={() => setInstanciaParaLinkar(null)}
          onLinkar={linkarRecebimento}
        />
      )}
    </div>
  );
};

export default Fechamento;
```

- [ ] **Step 2: Criar o CSS**

```css
/* src/pages/Fechamento/Fechamento.css */
.fechamento-page {
  display: flex;
  flex-direction: column;
  gap: var(--cg-spacing-lg);
}

.fechamento-filterbar {
  display: flex;
  align-items: center;
}

.fechamento-summary-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--cg-spacing-md);
}

.fechamento-bulkbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--cg-spacing-base);
  flex-wrap: wrap;
}

.fechamento-bulkbar__left {
  display: flex;
  align-items: center;
  gap: var(--cg-spacing-sm);
  font-size: 0.875rem;
  color: var(--cg-color-text-secondary);
}

.fechamento-empty {
  color: var(--cg-color-text-muted);
  text-align: center;
  padding: var(--cg-spacing-2xl) 0;
}

.fechamento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--cg-spacing-lg);
  align-items: start;
}

@media (max-width: 640px) {
  .fechamento-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Testar manualmente no navegador**

Suba backend e frontend (`npm run dev` em `backend/`, `npm start` em `controle-gastos-frontend/`).
Acesse `http://localhost:3004/fechamento` (rota só existirá de fato após a Task 14 — se testar antes
dela, acesse via edição temporária de URL não é possível; **adiar este passo de verificação manual
completo para depois da Task 14**, mas confirmar aqui que o arquivo compila sem erro:

Run: `npm start` (a partir de `controle-gastos-frontend/`)
Expected: compila sem erro (`webpack compiled successfully`).

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/pages/Fechamento/Fechamento.js controle-gastos-frontend/src/pages/Fechamento/Fechamento.css
git commit -m "feat(fechamento): adiciona pagina Fechamento"
```

---

### Task 13: Exportação em lote (zip) — instala `jszip`

**Files:**
- Modify: `controle-gastos-frontend/src/utils/export/exportPDF.js`
- Create: `controle-gastos-frontend/src/utils/export/exportFechamentoZip.js`
- Modify: `controle-gastos-frontend/package.json` (via `npm install`)

**Testabilidade:** tela — botão "Exportar selecionados (.zip)" na página do Fechamento

> ⚠️ **Checkpoint de aprovação:** este é o único ponto do plano que instala uma dependência nova
> (`jszip`). Confirme com o Alisson antes de rodar o `npm install` — ele pediu aprovação explícita
> pra isso na spec (seção 4.3).

- [ ] **Step 1: Pedir aprovação e instalar `jszip`**

Run (só depois de aprovado):
```bash
cd controle-gastos-frontend && npm install jszip
```
Expected: adiciona `jszip` a `dependencies` no `package.json` e `package-lock.json`, sem warnings de
peer-dependency quebrada.

- [ ] **Step 2: Extrair a geração do PDF em blob (sem download) em `exportPDF.js`, reaproveitada
  tanto pelo export individual quanto pelo lote**

Modificar `controle-gastos-frontend/src/utils/export/exportPDF.js`: extrair a parte que monta o
Blob (linhas 74-84 do arquivo atual) para uma função exportada `generateReportPdfBlob`, e também
exportar o `sanitize` interno de `buildReportFilename` como `sanitizeFilenamePart` (reaproveitado
pelo export em lote pra nomear cada arquivo por pessoa):

```javascript
// Substituir a função `sanitize` interna de buildReportFilename por uma função no escopo do módulo,
// exportada, e usada tanto ali quanto no export em lote:
export const sanitizeFilenamePart = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 25);
};

// Dentro de buildReportFilename, trocar a definição local `const sanitize = (str) => {...}`
// por: usar diretamente `sanitizeFilenamePart` no lugar de `sanitize(...)` (mesmo comportamento).

// Nova função exportada — gera o Blob sem disparar download (reaproveitada por exportDataToPDF
// e pelo export em lote do Fechamento):
export const generateReportPdfBlob = async (
  data,
  filterDetails = {},
  summaryInfo = {},
  categorias = [],
  tags = [],
  templateUsed = 'simples'
) => {
  return pdf(
    <ReportDocument
      data={data}
      filterDetails={filterDetails}
      summaryInfo={summaryInfo}
      categorias={categorias}
      tags={tags}
      templateUsed={templateUsed}
    />
  ).toBlob();
};

// exportDataToPDF passa a chamar generateReportPdfBlob em vez de repetir o pdf(...).toBlob():
export const exportDataToPDF = async (
  data,
  filterDetails = {},
  summaryInfo = {},
  categorias = [],
  tags = [],
  filename = 'relatorio.pdf',
  templateUsed = 'simples'
) => {
  try {
    if (!data || data.length === 0) {
      console.warn("Nenhum dado para exportar");
      return;
    }

    const blob = await generateReportPdfBlob(data, filterDetails, summaryInfo, categorias, tags, templateUsed);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};
```

- [ ] **Step 3: Criar `exportFechamentoZip.js`**

```javascript
// src/utils/export/exportFechamentoZip.js
import JSZip from 'jszip';
import { generateReportPdfBlob, sanitizeFilenamePart } from './exportPDF';
import { obterTransacoesInstanciaFechamento } from '../../api';

/**
 * Gera um PDF por instância selecionada e empacota tudo num único .zip.
 * Reaproveita 100% o motor de PDF existente (`@react-pdf/renderer`) — só o empacotamento é novo.
 */
export async function exportarFechamentosEmLote(instancias, categorias, tags, periodo) {
  const zip = new JSZip();

  for (const instancia of instancias) {
    const pessoa = instancia.cadastro?.pessoa?.nome || 'pessoa';
    const { rows, summary } = await obterTransacoesInstanciaFechamento(instancia._id);
    if (!rows || rows.length === 0) continue;

    const blob = await generateReportPdfBlob(
      rows,
      { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, selectedPessoas: [pessoa] },
      summary,
      categorias,
      tags,
      instancia.cadastro?.modeloRelatorio?.aggregation || 'default'
    );

    const nomeArquivo = `${sanitizeFilenamePart(pessoa) || 'pessoa'}-${periodo.dataInicio}-${periodo.dataFim}.pdf`;
    zip.file(nomeArquivo, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fechamentos-${periodo.dataInicio}-${periodo.dataFim}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Testar manualmente**

Na tela `/fechamento` (depois da Task 14), marcar 2+ instâncias com transações e clicar em
"Exportar selecionados (.zip)".
Expected: baixa um arquivo `fechamentos-{inicio}-{fim}.zip` contendo 1 PDF por pessoa selecionada,
com nome `{pessoa}-{inicio}-{fim}.pdf`. Abrir os PDFs e confirmar que os dados batem com o card.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/utils/export/exportPDF.js controle-gastos-frontend/src/utils/export/exportFechamentoZip.js controle-gastos-frontend/package.json controle-gastos-frontend/package-lock.json
git commit -m "feat(fechamento): adiciona exportacao em lote via jszip reaproveitando motor de PDF existente"
```

---

### Task 14: Sidebar / rota — troca Insights por Fechamento

**Files:**
- Modify: `controle-gastos-frontend/src/components/Layout/menuStructure.js`
- Modify: `controle-gastos-frontend/src/App.js`
- Delete: `controle-gastos-frontend/src/pages/Insights/Insights.js`
- Delete: `controle-gastos-frontend/src/pages/Insights/Insights.css`

**Testabilidade:** tela — item de menu, rota e navegação completos

- [ ] **Step 1: Atualizar `menuStructure.js`**

Trocar o import do ícone (linha 12):
```javascript
import LightbulbIcon from '@mui/icons-material/Lightbulb';
```
por:
```javascript
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
```

E trocar a entrada dentro de `relatoriosSection.items` (linha 51):
```javascript
{ type: 'item', name: 'Insights', path: '/insights', icon: LightbulbIcon, key: 'insights' },
```
por:
```javascript
{ type: 'item', name: 'Fechamento', path: '/fechamento', icon: AssignmentTurnedInIcon, key: 'fechamento' },
```

- [ ] **Step 2: Atualizar `App.js`**

Trocar o import (linha 16):
```javascript
import Insights from './pages/Insights/Insights';
```
por:
```javascript
import Fechamento from './pages/Fechamento/Fechamento';
```

E trocar a rota (por volta da linha 133-142):
```javascript
<Route
  path="/insights"
  element={
    <PrivateRoute>
      <MainLayout>
        <Insights />
      </MainLayout>
    </PrivateRoute>
  }
/>
```
por:
```javascript
<Route
  path="/fechamento"
  element={
    <PrivateRoute>
      <MainLayout>
        <Fechamento />
      </MainLayout>
    </PrivateRoute>
  }
/>
```

- [ ] **Step 3: Apagar os arquivos do Insights**

```bash
rm controle-gastos-frontend/src/pages/Insights/Insights.js controle-gastos-frontend/src/pages/Insights/Insights.css
```

- [ ] **Step 4: Testar manualmente no navegador**

Suba backend e frontend, faça login, e:
1. Confirme que o item "Insights" sumiu da sidebar e "Fechamento" aparece no lugar, dentro de
   "Relatórios & Insights", com o ícone novo.
2. Clique em "Fechamento" — a URL deve virar `/fechamento` e a página deve carregar sem erro no
   console.
3. Clique em "+ Nova Instância", selecione uma pessoa existente e um modelo de relatório, defina um
   período com transações reais, e confirme que o card aparece na tela com o total certo.
4. Expanda o card e confirme que a tabela de transações bate com o que existe em `/relatorio` pro
   mesmo filtro de pessoa+período.
5. Clique em "Gerar PDF" e confirme que baixa um PDF válido.
6. Alterne entre light/dark mode (botão sol/lua no menu) e confirme que todas as cores do módulo
   reagem sem reload — pílulas de status, stepper, cards, tabela.

Expected: os 6 passos acima funcionam sem erro no console do navegador.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/components/Layout/menuStructure.js controle-gastos-frontend/src/App.js
git rm controle-gastos-frontend/src/pages/Insights/Insights.js controle-gastos-frontend/src/pages/Insights/Insights.css
git commit -m "feat(fechamento): substitui Insights por Fechamento na sidebar e nas rotas"
```

---

## Self-review desta plan (feito pelo planner, não um subagent)

1. **Cobertura da spec:** modelagem (Task 1), cadastros/instâncias/motor de busca (Tasks 2-3),
   endpoints (Tasks 4-5), testes (Task 6), tela principal com filtro/resumo/grade/accordion (Tasks
   7-9, 12), criação de instância com sugestão de modelo (Task 10), link de recebimento (Task 11),
   exportação individual e em lote (Tasks 12-13), sidebar/rota (Task 14). Nenhum item da seção 4 da
   spec ficou sem task correspondente.
2. **Placeholder scan:** nenhum "TBD"/"implementar depois" — único ponto de pausa explícito é o
   checkpoint de aprovação do `jszip` (Task 13), que é uma ação real, não um placeholder.
3. **Consistência de tipos:** `FechamentoInstancia.status` usa os mesmos 4 valores em model (Task 1),
   service (Task 3, `STATUS_MANUAL` cobre 3 deles + `recebido` automático), controller (Task 4) e
   componente de UI (Task 9, `STATUS_LABEL`/`STATUS_ORDER`). Nomes de função batem entre Tasks 2-3
   (`fechamentoService`) e Task 4 (`controladorFechamento`) e Task 7 (`src/api.js`).
4. **Tag de testabilidade:** cada task tem exatamente uma tag; tasks de model/service puro = "sem
   tela" ou "não testável" (schema sem comportamento isolado); tasks de UI = "tela".
