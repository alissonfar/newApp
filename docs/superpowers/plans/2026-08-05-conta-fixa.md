# Conta Fixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir o cadastro de despesas/receitas recorrentes mensais ("Conta Fixa") que geram `Transacao` reais automaticamente (cron) ou via confirmação manual, com dia de lançamento e vencimento configuráveis por regra.

**Architecture:** Nova entidade `ContaFixa` (regra recorrente, independente de `Transacao`) + campo `contaFixaId` em `Transacao` (rastro). Um job diário (`node-cron`) processa contas fixas em modo automático; contas em modo confirmação ficam disponíveis como pendência calculada on-the-fly até o usuário confirmar/pular manualmente. Backend em camadas (`routes` → `controllers` → `services` → `models`), consistente com o resto do projeto. Frontend React adiciona uma seção de gerenciamento e uma tela de revisão de pendências, reaproveitando componentes existentes (`TagSelector`, `Card`, `Button`).

**Tech Stack:** Node.js/Express, Mongoose, `decimal.js` (cálculo monetário), `node-cron` (agendamento — dependência nova), Jest (testes unitários da lógica pura), React 19, MUI (`@mui/icons-material`), Context API (`useData`, `AuthContext`).

## Global Constraints

- Todo cálculo monetário usa `decimal.js` (`Decimal.set({ precision: 20, rounding: 4 })`, arredondamento `Decimal.ROUND_HALF_UP`, 2 casas decimais antes de `.toNumber()`) — nunca float puro, seguindo o padrão de `backend/src/services/financial.service.js`.
- Toda rota nova usa `router.use(autenticacao)` do middleware `{ autenticacao } = require('../middlewares/autenticacao')`, e todo dado é escopado por `req.userId`.
- `Transacao.tipo` só aceita `'gasto' | 'recebivel'` (não `'despesa'/'receita'`) — `ContaFixa.tipo` usa o mesmo enum para não precisar de tradução.
- `Transacao` não tem campo `categoria` de topo — categorização vive em `pagamentos[].tags` (`Object` no formato `{ categoriaId: [tagIds] } `). `ContaFixa.tagsPadrao` usa exatamente esse formato.
- Testes automatizados ficam em `backend/src/services/__tests__/*.test.js`, sem config Jest customizada (`npx jest caminho/arquivo.test.js` a partir de `backend/`).
- Por decisão do usuário (primeira vez usando testes automatizados neste projeto): só a lógica pura de cálculo de data/valor (`calcularCiclo`, `montarPagamentos`, `cicloJaProcessado`, `verificarEEncerrar`) recebe testes automatizados. Funções que dependem do banco (`listarPendencias`, `confirmarPendencia`, `pularCiclo`, geração via cron) são validadas manualmente.
- Nunca rodar `npm install`, `npm run build`, migrations ou commit/push automaticamente — sempre parar e pedir para o usuário rodar.

**Pré-requisito antes da Task 5 (cron):** o usuário decidiu usar `node-cron` (sintaxe cron real) em vez do padrão caseiro `setInterval` já usado no projeto. Isso é uma dependência nova — **pare antes da Task 5** e peça para o usuário rodar, a partir de `backend/`:

```bash
npm install node-cron
```

Confirme que ele rodou e que `node-cron` aparece em `backend/package.json` antes de continuar.

---

### Task 1: Model `ContaFixa` + campo `contaFixaId` em `Transacao`

**Files:**
- Create: `backend/src/models/contaFixa.js`
- Modify: `backend/src/models/transacao.js`

**Interfaces:**
- Produces: `ContaFixa` model (Mongoose), campos: `usuario, nome, tipo ('gasto'|'recebivel'), valorEsperado, diaLancamento, diaVencimento, vencimentoMesSeguinte, tagsPadrao, modo ('automatico'|'confirmacao'), pagamentosTemplate: [{pessoa, percentual, tagsOverride}], dataInicio, dataFim, totalRepeticoes, totalGerados, status ('ativa'|'pausada'|'encerrada'), ciclosPulados: [{mes, ano}], ultimoCicloProcessado: {mes, ano}`.
- Produces: `Transacao.contaFixaId` (ObjectId ref `ContaFixa`, opcional).

- [ ] **Step 1: Criar o model `ContaFixa`**

```js
// backend/src/models/contaFixa.js
const mongoose = require('mongoose');

const PagamentoTemplateSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  percentual: { type: Number, required: true, min: 0, max: 100 },
  tagsOverride: { type: Object, default: null }
}, { _id: false });

const CicloSchema = new mongoose.Schema({
  mes: { type: Number, required: true, min: 0, max: 11 },
  ano: { type: Number, required: true }
}, { _id: false });

const ContaFixaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true },
  tipo: { type: String, enum: ['gasto', 'recebivel'], required: true },
  valorEsperado: { type: Number, required: true, min: 0 },
  diaLancamento: { type: Number, required: true, min: 1, max: 31 },
  diaVencimento: { type: Number, required: true, min: 1, max: 31 },
  vencimentoMesSeguinte: { type: Boolean, default: false },
  tagsPadrao: { type: Object, default: {} },
  modo: { type: String, enum: ['automatico', 'confirmacao'], required: true },
  pagamentosTemplate: { type: [PagamentoTemplateSchema], required: true },
  dataInicio: { type: Date, required: true, default: Date.now },
  dataFim: { type: Date, default: null },
  totalRepeticoes: { type: Number, default: null, min: 1 },
  totalGerados: { type: Number, default: 0 },
  status: { type: String, enum: ['ativa', 'pausada', 'encerrada'], default: 'ativa' },
  ciclosPulados: { type: [CicloSchema], default: [] },
  ultimoCicloProcessado: { type: CicloSchema, default: null }
}, {
  timestamps: {
    createdAt: 'dataCriacao',
    updatedAt: 'dataAtualizacao'
  }
});

ContaFixaSchema.index({ usuario: 1, status: 1 });

module.exports = mongoose.model('ContaFixa', ContaFixaSchema);
```

- [ ] **Step 2: Adicionar `contaFixaId` em `Transacao`**

Em `backend/src/models/transacao.js`, adicione a linha abaixo imediatamente após o campo `emprestimoEhJurosAuto` (dentro do bloco "Módulo Empréstimos", por volta da linha 64):

```js
  // Módulo Conta Fixa - rastro de que esta transação foi gerada por uma regra recorrente
  contaFixaId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContaFixa', default: null },
```

E adicione o índice correspondente junto aos outros índices no final do arquivo (por volta da linha 83, antes de `module.exports`):

```js
TransacaoSchema.index({ usuario: 1, contaFixaId: 1 }, { sparse: true });
```

- [ ] **Step 3: Verificar que o servidor ainda inicia sem erros**

Run: `cd backend && node -e "require('./src/models/contaFixa'); require('./src/models/transacao'); console.log('OK')"`
Expected: imprime `OK` sem lançar exceção.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/contaFixa.js backend/src/models/transacao.js
git commit -m "feat(conta-fixa): adiciona model ContaFixa e campo contaFixaId em Transacao"
```

---

### Task 2: `contaFixaService` — cálculo de ciclo (lógica pura, TDD)

**Files:**
- Create: `backend/src/services/contaFixaService.js`
- Test: `backend/src/services/__tests__/contaFixaService.test.js`

**Interfaces:**
- Consumes: nenhuma (funções puras, sem DB).
- Produces:
  - `calcularCiclo(contaFixa, dataReferencia = new Date()) => { mesLancamento: Number, anoLancamento: Number, dataLancamento: Date, dataVencimento: Date }`
  - `cicloJaProcessado(contaFixa, ciclo) => Boolean`
  - `verificarEEncerrar(contaFixa, dataReferencia = new Date()) => Boolean` (muta `contaFixa.status` se necessário; não salva)

- [ ] **Step 1: Escrever os testes de `calcularCiclo`**

```js
// backend/src/services/__tests__/contaFixaService.test.js
const { calcularCiclo, cicloJaProcessado, verificarEEncerrar } = require('../contaFixaService');

describe('calcularCiclo', () => {
  it('calcula lançamento e vencimento no mesmo mês quando vencimentoMesSeguinte é false', () => {
    const contaFixa = { diaLancamento: 1, diaVencimento: 12, vencimentoMesSeguinte: false };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 0, 5)); // 5 de janeiro de 2026

    expect(ciclo.mesLancamento).toBe(0);
    expect(ciclo.anoLancamento).toBe(2026);
    expect(ciclo.dataLancamento).toEqual(new Date(2026, 0, 1));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 0, 12));
  });

  it('calcula vencimento no mês seguinte quando vencimentoMesSeguinte é true', () => {
    const contaFixa = { diaLancamento: 28, diaVencimento: 5, vencimentoMesSeguinte: true };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 0, 28)); // 28 de janeiro de 2026

    expect(ciclo.dataLancamento).toEqual(new Date(2026, 0, 28));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 1, 5)); // 5 de fevereiro
  });

  it('vencimento no mês seguinte cruzando o ano (dezembro -> janeiro)', () => {
    const contaFixa = { diaLancamento: 28, diaVencimento: 5, vencimentoMesSeguinte: true };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 11, 28)); // 28 de dezembro de 2026

    expect(ciclo.dataVencimento).toEqual(new Date(2027, 0, 5));
  });

  it('ajusta dia 31 para o último dia do mês quando o mês é mais curto', () => {
    const contaFixa = { diaLancamento: 31, diaVencimento: 31, vencimentoMesSeguinte: false };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 1, 1)); // fevereiro de 2026 (28 dias, não bissexto)

    expect(ciclo.dataLancamento).toEqual(new Date(2026, 1, 28));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 1, 28));
  });
});

describe('cicloJaProcessado', () => {
  it('retorna false quando ultimoCicloProcessado é null', () => {
    const contaFixa = { ultimoCicloProcessado: null };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(false);
  });

  it('retorna true quando ultimoCicloProcessado bate com o ciclo atual', () => {
    const contaFixa = { ultimoCicloProcessado: { mes: 0, ano: 2026 } };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(true);
  });

  it('retorna false quando ultimoCicloProcessado é de outro mês', () => {
    const contaFixa = { ultimoCicloProcessado: { mes: 11, ano: 2025 } };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(false);
  });
});

describe('verificarEEncerrar', () => {
  it('encerra quando dataReferencia passou de dataFim', () => {
    const contaFixa = { status: 'ativa', dataFim: new Date(2026, 0, 1), totalRepeticoes: null };
    const encerrou = verificarEEncerrar(contaFixa, new Date(2026, 0, 2));

    expect(encerrou).toBe(true);
    expect(contaFixa.status).toBe('encerrada');
  });

  it('encerra quando totalGerados atinge totalRepeticoes', () => {
    const contaFixa = { status: 'ativa', dataFim: null, totalRepeticoes: 3, totalGerados: 3 };
    const encerrou = verificarEEncerrar(contaFixa, new Date());

    expect(encerrou).toBe(true);
    expect(contaFixa.status).toBe('encerrada');
  });

  it('não encerra quando ainda não atingiu dataFim nem totalRepeticoes', () => {
    const contaFixa = { status: 'ativa', dataFim: new Date(2027, 0, 1), totalRepeticoes: 12, totalGerados: 3 };
    const encerrou = verificarEEncerrar(contaFixa, new Date(2026, 0, 1));

    expect(encerrou).toBe(false);
    expect(contaFixa.status).toBe('ativa');
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (funções não existem ainda)**

Run: `cd backend && npx jest src/services/__tests__/contaFixaService.test.js`
Expected: FAIL — `Cannot find module '../contaFixaService'` (ou funções `undefined`).

- [ ] **Step 3: Implementar `contaFixaService.js` (parte 1 — ciclo)**

```js
// backend/src/services/contaFixaService.js
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: 4 });

function ultimoDiaDoMes(ano, mesIndexZeroBased) {
  return new Date(ano, mesIndexZeroBased + 1, 0).getDate();
}

function calcularDataDoDia(ano, mesIndexZeroBased, dia) {
  const ultimoDia = ultimoDiaDoMes(ano, mesIndexZeroBased);
  const diaAjustado = Math.min(dia, ultimoDia);
  return new Date(ano, mesIndexZeroBased, diaAjustado);
}

function calcularCiclo(contaFixa, dataReferencia = new Date()) {
  const anoLancamento = dataReferencia.getFullYear();
  const mesLancamento = dataReferencia.getMonth();

  const dataLancamento = calcularDataDoDia(anoLancamento, mesLancamento, contaFixa.diaLancamento);

  let anoVencimento = anoLancamento;
  let mesVencimento = mesLancamento;
  if (contaFixa.vencimentoMesSeguinte) {
    mesVencimento += 1;
    if (mesVencimento > 11) {
      mesVencimento = 0;
      anoVencimento += 1;
    }
  }
  const dataVencimento = calcularDataDoDia(anoVencimento, mesVencimento, contaFixa.diaVencimento);

  return { mesLancamento, anoLancamento, dataLancamento, dataVencimento };
}

function cicloJaProcessado(contaFixa, ciclo) {
  const ultimo = contaFixa.ultimoCicloProcessado;
  if (!ultimo || ultimo.mes == null || ultimo.ano == null) return false;
  return ultimo.mes === ciclo.mesLancamento && ultimo.ano === ciclo.anoLancamento;
}

function verificarEEncerrar(contaFixa, dataReferencia = new Date()) {
  if (contaFixa.status !== 'ativa') return false;

  const passouDataFim = contaFixa.dataFim && dataReferencia > contaFixa.dataFim;
  const atingiuRepeticoes = contaFixa.totalRepeticoes != null && contaFixa.totalGerados >= contaFixa.totalRepeticoes;

  if (passouDataFim || atingiuRepeticoes) {
    contaFixa.status = 'encerrada';
    return true;
  }
  return false;
}

module.exports = {
  calcularCiclo,
  cicloJaProcessado,
  verificarEEncerrar
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest src/services/__tests__/contaFixaService.test.js`
Expected: PASS em todos os testes de `calcularCiclo`, `cicloJaProcessado` e `verificarEEncerrar`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/contaFixaService.js backend/src/services/__tests__/contaFixaService.test.js
git commit -m "feat(conta-fixa): implementa cálculo de ciclo, dedupe e encerramento automático"
```

---

### Task 3: `contaFixaService` — `montarPagamentos` (lógica pura, TDD)

**Files:**
- Modify: `backend/src/services/contaFixaService.js`
- Modify: `backend/src/services/__tests__/contaFixaService.test.js`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `montarPagamentos(pagamentosTemplate, valorTotal, tagsPadrao = {}) => [{ pessoa: String, valor: Number, tags: Object }]`

- [ ] **Step 1: Escrever os testes de `montarPagamentos`**

Adicione ao final de `backend/src/services/__tests__/contaFixaService.test.js`:

```js
const { montarPagamentos } = require('../contaFixaService');

describe('montarPagamentos', () => {
  it('divide o valor proporcionalmente e a soma bate exatamente com o valor total', () => {
    const template = [
      { pessoa: 'Alisson', percentual: 60 },
      { pessoa: 'Outra Pessoa', percentual: 40 }
    ];
    const pagamentos = montarPagamentos(template, 100.01);

    const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(100.01);
    expect(pagamentos[0].valor).toBe(60.01);
    expect(pagamentos[1].valor).toBe(40);
  });

  it('pagamento único (100%) retorna o valor total sem perda de centavos', () => {
    const template = [{ pessoa: 'Alisson', percentual: 100 }];
    const pagamentos = montarPagamentos(template, 33.33);

    expect(pagamentos).toHaveLength(1);
    expect(pagamentos[0].valor).toBe(33.33);
  });

  it('usa tagsOverride do template quando presente, senão cai no tagsPadrao', () => {
    const template = [
      { pessoa: 'Alisson', percentual: 50, tagsOverride: { cat1: ['tagA'] } },
      { pessoa: 'Outra Pessoa', percentual: 50 }
    ];
    const pagamentos = montarPagamentos(template, 100, { catPadrao: ['tagB'] });

    expect(pagamentos[0].tags).toEqual({ cat1: ['tagA'] });
    expect(pagamentos[1].tags).toEqual({ catPadrao: ['tagB'] });
  });

  it('divide três partes iguais sem perder centavos na soma', () => {
    const template = [
      { pessoa: 'A', percentual: 33.34 },
      { pessoa: 'B', percentual: 33.33 },
      { pessoa: 'C', percentual: 33.33 }
    ];
    const pagamentos = montarPagamentos(template, 10);

    const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(10);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && npx jest src/services/__tests__/contaFixaService.test.js -t "montarPagamentos"`
Expected: FAIL — `montarPagamentos is not a function`.

- [ ] **Step 3: Implementar `montarPagamentos`**

Adicione em `backend/src/services/contaFixaService.js`, antes do `module.exports`:

```js
function montarPagamentos(pagamentosTemplate, valorTotal, tagsPadrao = {}) {
  const total = new Decimal(valorTotal);

  const valoresCalculados = pagamentosTemplate.map((p) =>
    total.times(p.percentual).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  );

  const somaParcial = valoresCalculados
    .slice(0, -1)
    .reduce((acc, v) => acc.plus(v), new Decimal(0));

  const ultimoIndice = valoresCalculados.length - 1;
  valoresCalculados[ultimoIndice] = total.minus(somaParcial).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return pagamentosTemplate.map((p, i) => ({
    pessoa: p.pessoa,
    valor: valoresCalculados[i].toNumber(),
    tags: p.tagsOverride || tagsPadrao
  }));
}
```

E atualize o `module.exports` no final do arquivo:

```js
module.exports = {
  calcularCiclo,
  cicloJaProcessado,
  verificarEEncerrar,
  montarPagamentos
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest src/services/__tests__/contaFixaService.test.js`
Expected: PASS em todos os testes (ciclo + pagamentos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/contaFixaService.js backend/src/services/__tests__/contaFixaService.test.js
git commit -m "feat(conta-fixa): implementa divisao proporcional de pagamentos com decimal.js"
```

---

### Task 4: `contaFixaService` — geração, pendências, confirmação e pular (dependente de DB)

**Files:**
- Modify: `backend/src/services/contaFixaService.js`

**Interfaces:**
- Consumes: `calcularCiclo`, `cicloJaProcessado`, `verificarEEncerrar`, `montarPagamentos` (Task 2 e 3); `ContaFixa` (Task 1); `Transacao` (model existente).
- Produces:
  - `gerarTransacaoParaCiclo(contaFixa, ciclo) => Promise<TransacaoDoc>`
  - `processarContasFixasAutomaticas() => Promise<{ processadas: Number, erros: Array<{contaFixaId, mensagem}> }>`
  - `listarPendencias(usuarioId, dataReferencia = new Date()) => Promise<Array<{ contaFixa: ContaFixaDoc, ciclo: Object }>>`
  - `confirmarPendencia(contaFixaId, usuarioId, dadosConfirmados = {}) => Promise<TransacaoDoc>`
  - `pularCiclo(contaFixaId, usuarioId, dataReferencia = new Date()) => Promise<ContaFixaDoc>`

- [ ] **Step 1: Implementar as funções dependentes de banco**

Adicione ao topo de `backend/src/services/contaFixaService.js` (após o `require('decimal.js')`):

```js
const ContaFixa = require('../models/contaFixa');
const Transacao = require('../models/transacao');
```

Adicione antes do `module.exports`:

```js
async function gerarTransacaoParaCiclo(contaFixa, ciclo) {
  const pagamentos = montarPagamentos(contaFixa.pagamentosTemplate, contaFixa.valorEsperado, contaFixa.tagsPadrao);

  const transacao = new Transacao({
    tipo: contaFixa.tipo,
    descricao: contaFixa.nome,
    valor: contaFixa.valorEsperado,
    data: ciclo.dataVencimento,
    usuario: contaFixa.usuario,
    pagamentos,
    contaFixaId: contaFixa._id
  });
  await transacao.save();

  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  contaFixa.totalGerados += 1;
  verificarEEncerrar(contaFixa);
  await contaFixa.save();

  return transacao;
}

async function processarContasFixasAutomaticas() {
  const contasFixas = await ContaFixa.find({ status: 'ativa', modo: 'automatico' });
  const hoje = new Date();
  let processadas = 0;
  const erros = [];

  for (const contaFixa of contasFixas) {
    try {
      const ciclo = calcularCiclo(contaFixa, hoje);
      if (hoje >= ciclo.dataLancamento && !cicloJaProcessado(contaFixa, ciclo)) {
        await gerarTransacaoParaCiclo(contaFixa, ciclo);
        processadas += 1;
      }
    } catch (err) {
      erros.push({ contaFixaId: contaFixa._id, mensagem: err.message });
    }
  }

  return { processadas, erros };
}

async function listarPendencias(usuarioId, dataReferencia = new Date()) {
  const contasFixas = await ContaFixa.find({ usuario: usuarioId, status: 'ativa', modo: 'confirmacao' });
  const pendencias = [];

  for (const contaFixa of contasFixas) {
    const ciclo = calcularCiclo(contaFixa, dataReferencia);
    if (dataReferencia >= ciclo.dataLancamento && !cicloJaProcessado(contaFixa, ciclo)) {
      pendencias.push({ contaFixa, ciclo });
    }
  }

  return pendencias;
}

async function confirmarPendencia(contaFixaId, usuarioId, dadosConfirmados = {}) {
  const contaFixa = await ContaFixa.findOne({ _id: contaFixaId, usuario: usuarioId });
  if (!contaFixa) throw new Error('Conta fixa não encontrada.');

  const ciclo = calcularCiclo(contaFixa);
  if (cicloJaProcessado(contaFixa, ciclo)) {
    throw new Error('Este ciclo já foi processado.');
  }

  const valorFinal = dadosConfirmados.valor != null ? dadosConfirmados.valor : contaFixa.valorEsperado;
  const dataFinal = dadosConfirmados.data ? new Date(dadosConfirmados.data) : ciclo.dataVencimento;
  const pagamentos = dadosConfirmados.pagamentos && dadosConfirmados.pagamentos.length > 0
    ? dadosConfirmados.pagamentos
    : montarPagamentos(contaFixa.pagamentosTemplate, valorFinal, contaFixa.tagsPadrao);

  const transacao = new Transacao({
    tipo: contaFixa.tipo,
    descricao: contaFixa.nome,
    valor: valorFinal,
    data: dataFinal,
    usuario: contaFixa.usuario,
    pagamentos,
    contaFixaId: contaFixa._id
  });
  await transacao.save();

  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  contaFixa.totalGerados += 1;
  verificarEEncerrar(contaFixa);
  await contaFixa.save();

  return transacao;
}

async function pularCiclo(contaFixaId, usuarioId, dataReferencia = new Date()) {
  const contaFixa = await ContaFixa.findOne({ _id: contaFixaId, usuario: usuarioId });
  if (!contaFixa) throw new Error('Conta fixa não encontrada.');

  const ciclo = calcularCiclo(contaFixa, dataReferencia);
  if (cicloJaProcessado(contaFixa, ciclo)) {
    throw new Error('Este ciclo já foi processado.');
  }

  contaFixa.ciclosPulados.push({ mes: ciclo.mesLancamento, ano: ciclo.anoLancamento });
  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  await contaFixa.save();

  return contaFixa;
}
```

Atualize o `module.exports` final:

```js
module.exports = {
  calcularCiclo,
  cicloJaProcessado,
  verificarEEncerrar,
  montarPagamentos,
  gerarTransacaoParaCiclo,
  processarContasFixasAutomaticas,
  listarPendencias,
  confirmarPendencia,
  pularCiclo
};
```

- [ ] **Step 2: Rodar a suíte completa do arquivo pra garantir que nada quebrou**

Run: `cd backend && npx jest src/services/__tests__/contaFixaService.test.js`
Expected: PASS (as funções novas não têm teste automatizado por decisão do usuário, mas o `require` não deve lançar erro de módulo).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/contaFixaService.js
git commit -m "feat(conta-fixa): implementa geracao automatica, pendencias, confirmacao e pular ciclo"
```

---

### Task 5: Cron diário + registro no bootstrap do servidor

**⚠️ Não inicie esta task sem confirmar que o usuário já rodou `npm install node-cron` em `backend/` (ver Pré-requisito no topo do plano).**

**Files:**
- Create: `backend/src/services/contaFixaCronService.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `processarContasFixasAutomaticas` (Task 4).
- Produces: `iniciarCron() => void`, `pararCron() => void` (exportados, seguindo o padrão de `pluggyCronService.js`).

- [ ] **Step 1: Implementar o serviço de cron**

```js
// backend/src/services/contaFixaCronService.js
const cron = require('node-cron');
const { processarContasFixasAutomaticas } = require('./contaFixaService');

let task = null;

function iniciarCron() {
  if (task) return;
  // Todo dia às 3h da manhã
  task = cron.schedule('0 3 * * *', () => {
    processarContasFixasAutomaticas()
      .then((resultado) => console.log('[ContaFixaCron] Execução concluída:', resultado))
      .catch((err) => console.error('[ContaFixaCron] Erro na execução:', err));
  });
}

function pararCron() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { iniciarCron, pararCron };
```

- [ ] **Step 2: Registrar o cron no bootstrap do servidor**

Em `backend/src/app.js`, dentro do callback de `app.listen`, junto ao bloco que já inicia o `pluggyCronService`, adicione:

```js
  try {
    const contaFixaCron = require('./services/contaFixaCronService');
    contaFixaCron.iniciarCron();
  } catch (err) {
    console.warn('[Startup] Falha ao iniciar cron Conta Fixa:', err.message);
  }
```

- [ ] **Step 3: Verificar que o servidor sobe sem erros**

Run: `cd backend && npm start`
Expected: log de "Servidor rodando na porta 3001" (ou porta configurada) sem exceção relacionada a `contaFixaCronService` ou `node-cron`. Encerre o processo (Ctrl+C) depois de confirmar.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/contaFixaCronService.js backend/src/app.js backend/package.json backend/package-lock.json
git commit -m "feat(conta-fixa): adiciona job diario de cron para geracao automatica"
```

---

### Task 6: Controller + rotas `/api/contas-fixas`

**Files:**
- Create: `backend/src/controllers/contaFixaController.js`
- Create: `backend/src/routes/rotasContaFixa.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `ContaFixa` (Task 1), `contaFixaService.{listarPendencias, confirmarPendencia, pularCiclo}` (Task 4), middleware `{ autenticacao }`.
- Produces: rotas HTTP em `/api/contas-fixas` (CRUD + `/pendencias`, `/:id/confirmar`, `/:id/pular`, `/:id/pausar`, `/:id/reativar`).

- [ ] **Step 1: Implementar o controller**

```js
// backend/src/controllers/contaFixaController.js
const ContaFixa = require('../models/contaFixa');
const contaFixaService = require('../services/contaFixaService');

exports.criar = async (req, res) => {
  const {
    nome, tipo, valorEsperado, diaLancamento, diaVencimento, vencimentoMesSeguinte,
    tagsPadrao, modo, pagamentosTemplate, dataInicio, dataFim, totalRepeticoes
  } = req.body;

  if (!nome || !tipo || !valorEsperado || !diaLancamento || !diaVencimento || !modo || !pagamentosTemplate || pagamentosTemplate.length === 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, tipo, valorEsperado, diaLancamento, diaVencimento, modo, pagamentosTemplate.' });
  }

  const somaPercentual = pagamentosTemplate.reduce((acc, p) => acc + p.percentual, 0);
  if (Math.abs(somaPercentual - 100) > 0.01) {
    return res.status(400).json({ erro: 'A soma dos percentuais em pagamentosTemplate deve ser 100.' });
  }

  try {
    const contaFixa = new ContaFixa({
      usuario: req.userId,
      nome,
      tipo,
      valorEsperado,
      diaLancamento,
      diaVencimento,
      vencimentoMesSeguinte: !!vencimentoMesSeguinte,
      tagsPadrao: tagsPadrao || {},
      modo,
      pagamentosTemplate,
      dataInicio: dataInicio || new Date(),
      dataFim: dataFim || null,
      totalRepeticoes: totalRepeticoes || null
    });
    await contaFixa.save();
    res.status(201).json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar conta fixa.', detalhe: error.message });
  }
};

exports.listar = async (req, res) => {
  try {
    const contasFixas = await ContaFixa.find({ usuario: req.userId }).sort({ nome: 1 });
    res.json(contasFixas);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar contas fixas.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter conta fixa.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });

    const camposPermitidos = [
      'nome', 'tipo', 'valorEsperado', 'diaLancamento', 'diaVencimento',
      'vencimentoMesSeguinte', 'tagsPadrao', 'modo', 'pagamentosTemplate',
      'dataInicio', 'dataFim', 'totalRepeticoes'
    ];
    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) contaFixa[campo] = req.body[campo];
    });

    await contaFixa.save();
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar conta fixa.', detalhe: error.message });
  }
};

exports.pausar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndUpdate(
      { _id: req.params.id, usuario: req.userId },
      { status: 'pausada' },
      { new: true }
    );
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao pausar conta fixa.' });
  }
};

exports.reativar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndUpdate(
      { _id: req.params.id, usuario: req.userId, status: 'pausada' },
      { status: 'ativa' },
      { new: true }
    );
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada ou não está pausada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao reativar conta fixa.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndDelete({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir conta fixa.' });
  }
};

exports.listarPendencias = async (req, res) => {
  try {
    const pendencias = await contaFixaService.listarPendencias(req.userId);
    res.json(pendencias);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar pendências.', detalhe: error.message });
  }
};

exports.confirmar = async (req, res) => {
  try {
    const transacao = await contaFixaService.confirmarPendencia(req.params.id, req.userId, req.body);
    res.status(201).json(transacao);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
};

exports.pular = async (req, res) => {
  try {
    const contaFixa = await contaFixaService.pularCiclo(req.params.id, req.userId);
    res.json(contaFixa);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
};
```

- [ ] **Step 2: Implementar as rotas**

```js
// backend/src/routes/rotasContaFixa.js
const express = require('express');
const router = express.Router();
const contaFixaController = require('../controllers/contaFixaController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/pendencias', contaFixaController.listarPendencias);
router.post('/:id/confirmar', contaFixaController.confirmar);
router.post('/:id/pular', contaFixaController.pular);
router.post('/:id/pausar', contaFixaController.pausar);
router.post('/:id/reativar', contaFixaController.reativar);
router.get('/', contaFixaController.listar);
router.post('/', contaFixaController.criar);
router.get('/:id', contaFixaController.obterPorId);
router.put('/:id', contaFixaController.atualizar);
router.delete('/:id', contaFixaController.excluir);

module.exports = router;
```

- [ ] **Step 3: Registrar a rota no `app.js`**

Junto às demais chamadas `app.use('/api/...', ...)` em `backend/src/app.js`, adicione:

```js
app.use('/api/contas-fixas', require('./routes/rotasContaFixa'));
```

- [ ] **Step 4: Testar manualmente com o servidor rodando**

Run: `cd backend && npm run dev`

Em outro terminal (substitua `SEU_TOKEN_JWT` por um token válido de login):

```bash
curl -X POST http://localhost:3001/api/contas-fixas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d "{\"nome\":\"Teste Aluguel\",\"tipo\":\"gasto\",\"valorEsperado\":1000,\"diaLancamento\":1,\"diaVencimento\":5,\"modo\":\"confirmacao\",\"pagamentosTemplate\":[{\"pessoa\":\"Alisson\",\"percentual\":100}]}"
```

Expected: resposta `201` com o documento `ContaFixa` criado.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/contaFixaController.js backend/src/routes/rotasContaFixa.js backend/src/app.js
git commit -m "feat(conta-fixa): adiciona CRUD e endpoints de pendencia/confirmacao/pular"
```

---

### Task 7: Frontend — cliente de API `contaFixaApi`

**Files:**
- Create: `controle-gastos-frontend/src/services/contaFixaApi.js`

**Interfaces:**
- Consumes: `api` default export de `controle-gastos-frontend/src/services/api.js` (cliente axios já configurado com token).
- Produces: `contaFixaApi.{listar, obter, criar, atualizar, excluir, pausar, reativar, listarPendencias, confirmar, pular}` — todas `async`, retornando `response.data`.

- [ ] **Step 1: Implementar o cliente de API**

```js
// controle-gastos-frontend/src/services/contaFixaApi.js
import api from './api';

const contaFixaApi = {
  listar: async () => {
    const response = await api.get('/contas-fixas');
    return response.data;
  },

  obter: async (id) => {
    const response = await api.get(`/contas-fixas/${id}`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/contas-fixas', dados);
    return response.data;
  },

  atualizar: async (id, dados) => {
    const response = await api.put(`/contas-fixas/${id}`, dados);
    return response.data;
  },

  excluir: async (id) => {
    await api.delete(`/contas-fixas/${id}`);
  },

  pausar: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/pausar`);
    return response.data;
  },

  reativar: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/reativar`);
    return response.data;
  },

  listarPendencias: async () => {
    const response = await api.get('/contas-fixas/pendencias');
    return response.data;
  },

  confirmar: async (id, dados) => {
    const response = await api.post(`/contas-fixas/${id}/confirmar`, dados);
    return response.data;
  },

  pular: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/pular`);
    return response.data;
  }
};

export default contaFixaApi;
```

- [ ] **Step 2: Verificar que o build de desenvolvimento não quebra**

Run: `cd controle-gastos-frontend && npx eslint src/services/contaFixaApi.js`
Expected: sem erros de lint.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/services/contaFixaApi.js
git commit -m "feat(conta-fixa): adiciona cliente de API contaFixaApi no frontend"
```

---

### Task 8: Frontend — página de gerenciamento de Contas Fixas (CRUD + menu)

**Files:**
- Create: `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js`
- Create: `controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js`
- Modify: `controle-gastos-frontend/src/components/Layout/menuStructure.js`
- Modify: `controle-gastos-frontend/src/App.js`

**Interfaces:**
- Consumes: `contaFixaApi` (Task 7), `useData()` de `context/DataContext` (fornece `{ categorias, tags }`), `TagSelector` de `components/Transaction/TagSelector.js` (props: `categorias, allTags, paymentTags, onTagsChange`).
- Produces: rota `/contas-fixas` navegável pelo menu lateral.

- [ ] **Step 1: Implementar o modal de formulário (criar/editar)**

```js
// controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import TagSelector from '../../components/Transaction/TagSelector';
import Button from '../../components/shared/Button';

const valorPadraoPagamento = () => ({ pessoa: '', percentual: 100, tagsOverride: null });

const ContaFixaFormModal = ({ contaFixa, onSave, onClose }) => {
  const { categorias, tags } = useData();
  const [form, setForm] = useState(() => contaFixa || {
    nome: '',
    tipo: 'gasto',
    valorEsperado: '',
    diaLancamento: 1,
    diaVencimento: 1,
    vencimentoMesSeguinte: false,
    modo: 'automatico',
    tagsPadrao: {},
    pagamentosTemplate: [valorPadraoPagamento()],
    dataFim: '',
    totalRepeticoes: ''
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const somaPercentual = form.pagamentosTemplate.reduce((acc, p) => acc + Number(p.percentual || 0), 0);

  const atualizarPagamento = (index, campo, valor) => {
    const novos = [...form.pagamentosTemplate];
    novos[index] = { ...novos[index], [campo]: valor };
    setForm({ ...form, pagamentosTemplate: novos });
  };

  const adicionarPagamento = () => {
    setForm({ ...form, pagamentosTemplate: [...form.pagamentosTemplate, valorPadraoPagamento()] });
  };

  const removerPagamento = (index) => {
    setForm({ ...form, pagamentosTemplate: form.pagamentosTemplate.filter((_, i) => i !== index) });
  };

  const handleSalvar = async () => {
    if (Math.abs(somaPercentual - 100) > 0.01) {
      setErro('A soma dos percentuais de divisão deve ser 100%.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSave({
        ...form,
        valorEsperado: Number(form.valorEsperado),
        diaLancamento: Number(form.diaLancamento),
        diaVencimento: Number(form.diaVencimento),
        totalRepeticoes: form.totalRepeticoes ? Number(form.totalRepeticoes) : null,
        dataFim: form.dataFim || null
      });
    } catch (err) {
      setErro(err.message || 'Erro ao salvar conta fixa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="conta-fixa-form-modal">
      <h2>{contaFixa ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}</h2>

      {erro && <p className="conta-fixa-form-erro">{erro}</p>}

      <label>
        Nome
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </label>

      <label>
        Tipo
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="gasto">Despesa</option>
          <option value="recebivel">Receita</option>
        </select>
      </label>

      <label>
        Valor esperado
        <input
          type="number"
          step="0.01"
          value={form.valorEsperado}
          onChange={(e) => setForm({ ...form, valorEsperado: e.target.value })}
        />
      </label>

      <label>
        Dia de lançamento (quando o registro é criado)
        <input
          type="number"
          min="1"
          max="31"
          value={form.diaLancamento}
          onChange={(e) => setForm({ ...form, diaLancamento: e.target.value })}
        />
      </label>

      <label>
        Dia de vencimento (data que vai na transação)
        <input
          type="number"
          min="1"
          max="31"
          value={form.diaVencimento}
          onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={form.vencimentoMesSeguinte}
          onChange={(e) => setForm({ ...form, vencimentoMesSeguinte: e.target.checked })}
        />
        Vencimento cai no mês seguinte ao lançamento
      </label>

      <label>
        Modo
        <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })}>
          <option value="automatico">Automático (lança sozinho)</option>
          <option value="confirmacao">Confirmação manual</option>
        </select>
      </label>

      <label>
        Data fim (opcional)
        <input type="date" value={form.dataFim || ''} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
      </label>

      <label>
        Total de repetições (opcional, ex: financiamento 12x)
        <input
          type="number"
          min="1"
          value={form.totalRepeticoes || ''}
          onChange={(e) => setForm({ ...form, totalRepeticoes: e.target.value })}
        />
      </label>

      <h3>Divisão de pagamento (soma deve ser 100%)</h3>
      {form.pagamentosTemplate.map((p, index) => (
        <div key={index} className="conta-fixa-pagamento-linha">
          <input
            placeholder="Pessoa"
            value={p.pessoa}
            onChange={(e) => atualizarPagamento(index, 'pessoa', e.target.value)}
          />
          <input
            type="number"
            placeholder="%"
            value={p.percentual}
            onChange={(e) => atualizarPagamento(index, 'percentual', e.target.value)}
          />
          {form.pagamentosTemplate.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => removerPagamento(index)}>Remover</Button>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={adicionarPagamento}>+ Adicionar pessoa</Button>
      <p>Soma atual: {somaPercentual}%</p>

      <h3>Categoria/tags padrão</h3>
      <TagSelector
        categorias={categorias}
        allTags={tags}
        paymentTags={form.tagsPadrao}
        onTagsChange={(novasTags) => setForm({ ...form, tagsPadrao: novasTags })}
      />

      <div className="conta-fixa-form-acoes">
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

export default ContaFixaFormModal;
```

- [ ] **Step 2: Implementar a página de listagem**

```js
// controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import contaFixaApi from '../../services/contaFixaApi';
import ContaFixaFormModal from './ContaFixaFormModal';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';

const ContasFixas = () => {
  const navigate = useNavigate();
  const [contasFixas, setContasFixas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaFixaEditando, setContaFixaEditando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listar();
      setContasFixas(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNova = () => {
    setContaFixaEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (contaFixa) => {
    setContaFixaEditando(contaFixa);
    setModalAberto(true);
  };

  const handleSalvar = async (dados) => {
    if (contaFixaEditando) {
      await contaFixaApi.atualizar(contaFixaEditando._id, dados);
    } else {
      await contaFixaApi.criar(dados);
    }
    setModalAberto(false);
    await carregar();
  };

  const handlePausarOuReativar = async (contaFixa) => {
    if (contaFixa.status === 'pausada') {
      await contaFixaApi.reativar(contaFixa._id);
    } else {
      await contaFixaApi.pausar(contaFixa._id);
    }
    await carregar();
  };

  const handleExcluir = async (contaFixa) => {
    if (!window.confirm(`Excluir "${contaFixa.nome}"? Isso não afeta transações já geradas.`)) return;
    await contaFixaApi.excluir(contaFixa._id);
    await carregar();
  };

  return (
    <div className="contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>
                  Ver pendências
                </Button>
                <Button variant="primary" onClick={abrirNova}>+ Nova Conta Fixa</Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : contasFixas.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa cadastrada ainda." />
          ) : (
            <table className="contas-fixas-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Valor esperado</th>
                  <th>Dias (lanç. / venc.)</th>
                  <th>Modo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFixas.map((cf) => (
                  <tr key={cf._id}>
                    <td>{cf.nome}</td>
                    <td>{cf.tipo === 'gasto' ? 'Despesa' : 'Receita'}</td>
                    <td>{formatarMoeda(cf.valorEsperado)}</td>
                    <td>{cf.diaLancamento} / {cf.diaVencimento}</td>
                    <td>{cf.modo === 'automatico' ? 'Automático' : 'Confirmação'}</td>
                    <td>{cf.status}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(cf)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handlePausarOuReativar(cf)}>
                        {cf.status === 'pausada' ? 'Reativar' : 'Pausar'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExcluir(cf)}>Excluir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {modalAberto && (
        <ContaFixaFormModal
          contaFixa={contaFixaEditando}
          onSave={handleSalvar}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
};

export default ContasFixas;
```

- [ ] **Step 3: Adicionar item de menu**

Em `controle-gastos-frontend/src/components/Layout/menuStructure.js`, adicione o import do ícone junto aos demais (por volta da linha 23):

```js
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
```

E dentro de `registrarSection.items` (por volta da linha 75, junto ao item `Tags`), adicione:

```js
    {
      type: 'submenu',
      name: 'Contas Fixas',
      icon: EventRepeatIcon,
      key: 'contas-fixas',
      items: [
        { name: 'Gerenciar', path: '/contas-fixas', icon: EventRepeatIcon, key: 'contas-fixas-lista' },
        { name: 'Pendências do Mês', path: '/contas-fixas/pendencias', icon: EventRepeatIcon, key: 'contas-fixas-pendencias' }
      ]
    },
```

- [ ] **Step 4: Registrar a rota em `App.js`**

Adicione o import junto aos demais (por volta da linha 17):

```js
import ContasFixas from './pages/ContasFixas/ContasFixas';
```

E a rota, seguindo o padrão das demais (por volta da linha 143, próximo à rota `/tags`):

```js
              <Route
                path="/contas-fixas"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <ContasFixas />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
```

- [ ] **Step 5: Testar manualmente no navegador**

Run: `cd controle-gastos-frontend && npm start`

1. Acesse `http://localhost:3004/contas-fixas` (detecte a porta real no terminal, pode não ser 3004).
2. Clique em "+ Nova Conta Fixa", preencha nome, tipo, valor, dias, modo e a divisão de pagamento (soma 100%).
3. Salve e confirme que a conta fixa aparece na tabela.

Expected: conta fixa criada aparece na listagem, com pausar/editar/excluir funcionando.

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js controle-gastos-frontend/src/components/Layout/menuStructure.js controle-gastos-frontend/src/App.js
git commit -m "feat(conta-fixa): adiciona pagina de gerenciamento e item de menu"
```

---

### Task 9: Frontend — página de pendências (confirmação/pular) + card no dashboard

**Files:**
- Create: `controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js`
- Modify: `controle-gastos-frontend/src/App.js`
- Modify: `controle-gastos-frontend/src/pages/Home/Home.js`

**Interfaces:**
- Consumes: `contaFixaApi.{listarPendencias, confirmar, pular}` (Task 7).
- Produces: rota `/contas-fixas/pendencias`; card "Contas Fixas Pendentes" na Home.

- [ ] **Step 1: Implementar a página de revisão de pendências**

```js
// controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js
import React, { useEffect, useState, useCallback } from 'react';
import contaFixaApi from '../../services/contaFixaApi';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';

const PendenciasContasFixas = () => {
  const [pendencias, setPendencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [valoresEditados, setValoresEditados] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listarPendencias();
      setPendencias(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleConfirmar = async (pendencia) => {
    const valorEditado = valoresEditados[pendencia.contaFixa._id];
    await contaFixaApi.confirmar(pendencia.contaFixa._id, {
      valor: valorEditado ? Number(valorEditado) : undefined
    });
    await carregar();
  };

  const handlePular = async (pendencia) => {
    await contaFixaApi.pular(pendencia.contaFixa._id);
    await carregar();
  };

  return (
    <div className="pendencias-contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : pendencias.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa pendente de confirmação." />
          ) : (
            pendencias.map((p) => (
              <div key={p.contaFixa._id} className="pendencia-item">
                <div>
                  <strong>{p.contaFixa.nome}</strong>
                  <p>Vencimento: {new Date(p.ciclo.dataVencimento).toLocaleDateString('pt-BR')}</p>
                </div>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={p.contaFixa.valorEsperado}
                  placeholder={formatarMoeda(p.contaFixa.valorEsperado)}
                  onChange={(e) => setValoresEditados({ ...valoresEditados, [p.contaFixa._id]: e.target.value })}
                />
                <div className="pendencia-item__acoes">
                  <Button variant="ghost" size="sm" onClick={() => handlePular(p)}>Pular este mês</Button>
                  <Button variant="primary" size="sm" onClick={() => handleConfirmar(p)}>Confirmar lançamento</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendenciasContasFixas;
```

- [ ] **Step 2: Registrar a rota em `App.js`**

Adicione o import:

```js
import PendenciasContasFixas from './pages/ContasFixas/PendenciasContasFixas';
```

E a rota, no mesmo padrão das demais:

```js
              <Route
                path="/contas-fixas/pendencias"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <PendenciasContasFixas />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
```

- [ ] **Step 3: Adicionar card de pendências na Home**

Em `controle-gastos-frontend/src/pages/Home/Home.js`, adicione o import junto aos demais (por volta da linha 39):

```js
import contaFixaApi from '../../services/contaFixaApi';
```

Adicione um estado e efeito de carregamento, junto aos outros `useState`/`useEffect` do componente (por volta da linha 73):

```js
  const [totalPendenciasContaFixa, setTotalPendenciasContaFixa] = useState(0);

  useEffect(() => {
    contaFixaApi.listarPendencias()
      .then((pendencias) => setTotalPendenciasContaFixa(pendencias.length))
      .catch(() => setTotalPendenciasContaFixa(0));
  }, []);
```

E adicione um novo `Card` no bloco de "Atalhos" (imediatamente após o `Card` de "atalhos", por volta da linha 366, antes do `Card` do gráfico), visível só quando há pendências:

```js
            {totalPendenciasContaFixa > 0 && (
              <Card variant="glass" padding="md" className="dashboard-section contas-fixas-pendentes">
                <CardContent>
                  <SectionHeader title="Contas Fixas Pendentes" />
                  <p>{totalPendenciasContaFixa} conta{totalPendenciasContaFixa > 1 ? 's' : ''} fixa{totalPendenciasContaFixa > 1 ? 's' : ''} aguardando confirmação este mês.</p>
                  <Button variant="primary" onClick={() => navigate('/contas-fixas/pendencias')}>
                    Revisar agora
                  </Button>
                </CardContent>
              </Card>
            )}
```

- [ ] **Step 4: Testar manualmente no navegador**

1. Crie uma Conta Fixa em modo "Confirmação manual" com dia de lançamento igual ou anterior a hoje (Task 8).
2. Acesse a Home — o card "Contas Fixas Pendentes" deve aparecer com a contagem.
3. Clique em "Revisar agora", edite o valor se quiser, e clique em "Confirmar lançamento".
4. Verifique em `/relatorio` (ou na lista de transações) que a transação foi criada com a data de vencimento correta.
5. Volte a criar outra pendência e clique em "Pular este mês" — confirme que ela desaparece da lista sem gerar transação.

Expected: fluxo completo de pendência → confirmação/pular funcionando ponta a ponta.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js controle-gastos-frontend/src/App.js controle-gastos-frontend/src/pages/Home/Home.js
git commit -m "feat(conta-fixa): adiciona tela de pendencias e card de aviso na home"
```

---

## Rodada final de verificação (após todas as tasks)

- [ ] Rodar `cd backend && npm test` — todos os testes (incluindo os pré-existentes de `ledgerService`/`netWorthService`) devem passar.
- [ ] Roteiro manual completo: criar Conta Fixa automática com data de lançamento hoje, reiniciar o backend e confirmar (via log do cron ou consulta manual no Mongo) que a transação foi gerada.
- [ ] Confirmar visualmente, no formulário de transação normal, que uma transação gerada por Conta Fixa (`contaFixaId` preenchido) continua editável como qualquer outra.
