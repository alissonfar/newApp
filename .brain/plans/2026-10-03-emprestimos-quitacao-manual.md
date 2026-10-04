# Empréstimos: Quitação Manual + Remoção do tipoRetorno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax. No TDD — implement and verify; tests required but
> not test-first. Each task carries a testability tag (tela / sem tela / não testável).

**Goal:** Tornar a quitação de empréstimo **manual** (nunca automática) e **remover o `tipoRetorno`** (fim da dicotomia juros/sem juros), com valor esperado opcional (default = valor do lançamento).

**Architecture:** Backend (schema/service/controller/rotas/migração) + frontend (form, hook, lista, detalhe). O `recalcularStatus` deixa de quitar; novas ações explícitas Quitar/Reabrir criam/apagam a TX de juros. Remoção do `tipoRetorno` atravessa schema→UI. Migração `$unset` dos dados.

**Tech Stack:** Node.js + Express + Mongoose (Jest) · React 19 + CRACO + SweetAlert2.

**Spec:** `.brain/specs/2026-10-03-emprestimos-quitacao-manual-design.md`
**Branch:** continuar em `fix/emprestimos-correcoes-qa` (este ciclo desfaz o F5).

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `backend/src/services/emprestimoService.js` | Quitação manual; quitar/reabrir; sem tipoRetorno | 1 |
| `backend/src/controllers/emprestimoController.js` | Handlers quitar/reabrir; remove tipoRetorno | 2 |
| `backend/src/routes/rotasEmprestimo.js` | Rotas `/:id/quitar`, `/:id/reabrir` | 2 |
| `backend/src/controllers/controladorTransacao.js` | Remove sem_juros; default do esperado | 3 |
| `backend/scripts/migrations/010-emprestimo-remove-tipo-retorno.js` | `$unset tipoRetorno` | 4 |
| `controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js` | Remove select tipo; expected opcional | 5 |
| `controle-gastos-frontend/src/hooks/useEmprestimoForm.js` | Remove novoTipoRetorno; validação | 5 |
| `controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js` | Remove "Tipo" | 5 |
| `controle-gastos-frontend/src/utils/emprestimoFormat.js` | Remove `labelTipoRetorno` | 5 |
| `controle-gastos-frontend/src/modals`/detail | Botões Quitar/Reabrir | 6 |
| `controle-gastos-frontend/src/api.js` | `quitarEmprestimo`, `reabrirEmprestimo` | 6 |

---

## Task 1 (sem tela): Service — quitação manual + quitar/reabrir; remove tipoRetorno

**Files:** Modify `backend/src/services/emprestimoService.js`; Test `backend/src/services/__tests__/emprestimoService.test.js`

- [ ] **Step 1: `recalcularStatus` deixa de quitar sozinho.** Substituir o corpo (hoje linhas ~243-285) por:

```js
async function recalcularStatus(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) return null;
  if (emprestimo.status === 'cancelado') return emprestimo;

  // Quitação é MANUAL (ADR novo). Só mantém a TX de juros em sincronia
  // quando o empréstimo já está quitado e algo muda.
  if (emprestimo.status === 'quitado') {
    const lucro = await calcularLucro(emprestimoId, usuarioId);
    await recalcularJurosAuto(emprestimo, lucro);
  }
  return emprestimo;
}
```

- [ ] **Step 2: Novas funções `quitarEmprestimo` / `reabrirEmprestimo`.** Adicionar antes de `reverterQuitacao`:

```js
async function quitarEmprestimo(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) throw new Error('Empréstimo não encontrado.');
  if (emprestimo.status !== 'ativo') throw new Error('Apenas empréstimos ativos podem ser quitados.');

  emprestimo.status = 'quitado';
  emprestimo.dataQuitacao = new Date();
  await emprestimo.save();

  const lucro = await calcularLucro(emprestimoId, usuarioId);
  await recalcularJurosAuto(emprestimo, lucro);

  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioId });
  return await obterEmprestimoComTotais(atualizado);
}

async function reabrirEmprestimo(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) throw new Error('Empréstimo não encontrado.');
  if (emprestimo.status !== 'quitado') throw new Error('Apenas empréstimos quitados podem ser reabertos.');

  await Transacao.deleteOne({ emprestimoId: emprestimo._id, emprestimoEhJurosAuto: true });
  emprestimo.status = 'ativo';
  emprestimo.dataQuitacao = null;
  await emprestimo.save();

  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioId });
  return await obterEmprestimoComTotais(atualizado);
}
```

Manter `reverterQuitacao` como está (será desativada na Task 2) OU removê-la — remover, já que `reabrirEmprestimo` a substitui.

- [ ] **Step 3: Remover `tipoRetorno` da validação.** Em `validarDadosEmprestimo`, remover o bloco:

```js
  if (!parcial || dados.tipoRetorno !== undefined) {
    if (dados.tipoRetorno !== undefined && !TIPOS_RETORNO.includes(dados.tipoRetorno)) {
      erros.push(`tipoRetorno inválido. Valores: ${TIPOS_RETORNO.join(', ')}`);
    }
  }
```
Manter o export `TIPOS_RETORNO`? Não — remover do module.exports também (o schema deixa de ter o enum na Task 4). Atualizar os `module.exports` para incluir `quitarEmprestimo` e `reabrirEmprestimo`, e remover `reverterQuitacao`.

- [ ] **Step 4: Reescrever os testes de `recalcularStatus`** em `emprestimoService.test.js`:
  - Remover/reescrever os casos que assumem auto-quitação (`quitação: recebido >= soma... → quita`, `quitação com lucro zero`, `log warning quando desembolso zero`).
  - Novo: `recalcularStatus` com `status:'ativo'` e `recebido >= esperado` **NÃO** chama `findOneAndUpdate` nem `recalcularJurosAuto` (não quita).
  - Novo: `recalcularStatus` com `status:'quitado'` chama `recalcularJurosAuto` com o lucro atual.
  - Remover os testes de `tipoRetorno` em `validarDadosEmprestimo`.

- [ ] **Step 5: Adicionar testes de `quitarEmprestimo`/`reabrirEmprestimo`:**

```js
describe('emprestimoService.quitarEmprestimo / reabrirEmprestimo', () => {
  test('quitar: ativo → quitado e cria TX de juros com lucro realizado', async () => {
    mockEmprestimoFindOne.mockResolvedValue(makeEmprestimo({ status: 'ativo' }));
    mockAggregateSequence([{ _id: 'gasto', total: 2000 }, { _id: 'recebivel', total: 2300 }], 2000);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'criada', transacao: { _id: 'tx', valor: 300 } });
    const { quitarEmprestimo } = require('../emprestimoService');
    await quitarEmprestimo(String(EMP_ID), USER_ID);
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(expect.objectContaining({ _id: EMP_ID }), 300);
  });

  test('quitar: só ativo pode quitar', async () => {
    mockEmprestimoFindOne.mockResolvedValue(makeEmprestimo({ status: 'quitado' }));
    const { quitarEmprestimo } = require('../emprestimoService');
    await expect(quitarEmprestimo(String(EMP_ID), USER_ID)).rejects.toThrow();
  });
});
```

- [ ] **Step 6:** Run `npx jest emprestimo` (workdir `backend/`, `$env:CI="true"`) → PASS.
- [ ] **Step 7:** (orchestrator commita) `feat(emprestimos): quitacao manual com quitar/reabrir`

---

## Task 2 (sem tela): Controller + rotas — quitar/reabrir; remove tipoRetorno

**Files:** Modify `backend/src/controllers/emprestimoController.js`, `backend/src/routes/rotasEmprestimo.js`

- [ ] **Step 1:** Em `criar`, remover `tipoRetorno: req.body.tipoRetorno || 'valor_fixo'` do `new Emprestimo({...})`.
- [ ] **Step 2:** Em `atualizar`, remover o bloco que valida/seta `tipoRetorno` (~169-174) e a chamada a `req.body.tipoRetorno` na validação final.
- [ ] **Step 3:** Substituir `exports.reverterQuitacao` por handlers:

```js
exports.quitar = async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ erro: 'id inválido.' });
  try {
    res.json(await service.quitarEmprestimo(oid, req.userId));
  } catch (error) {
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('Apenas empréstimos ativos') ? 400 : 500;
    res.status(status).json({ erro: error.message });
  }
};

exports.reabrir = async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ erro: 'id inválido.' });
  try {
    res.json(await service.reabrirEmprestimo(oid, req.userId));
  } catch (error) {
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('Apenas empréstimos quitados') ? 400 : 500;
    res.status(status).json({ erro: error.message });
  }
};
```

- [ ] **Step 4:** Em `rotasEmprestimo.js`, trocar `router.post('/:id/reverter-quitacao', ...)` por:

```js
router.post('/:id/quitar', emprestimoController.quitar);
router.post('/:id/reabrir', emprestimoController.reabrir);
```

- [ ] **Step 5:** Run `npx jest emprestimo` → PASS (sem regressão). `node --check` nos 2 arquivos.
- [ ] **Step 6:** `feat(emprestimos): endpoints quitar e reabrir`

---

## Task 3 (sem tela): controladorTransacao — remove sem_juros; default do esperado

**Files:** Modify `backend/src/controllers/controladorTransacao.js`; Test `backend/src/services/__tests__/emprestimoService.test.js`

- [ ] **Step 1:** **Remover** as funções `aplicarSemJurosNosPagamentos`, `carregarEmprestimosPorId` e `aplicarRegraSemJurosNaTransacao`, e **todas** as chamadas a elas nos ramos de create/update (as adicionadas no F5). Restaurar os blocos de create/update para simplesmente ler `req.body.valorEsperadoRetorno` como antes do F5.
- [ ] **Step 2:** **Default do valor esperado** — no create (TX-level), após setar `emprestimoId`:

```js
      if (req.body.emprestimoId) {
        await emprestimoService.validarEmprestimoParaTransacao(req.body.emprestimoId, req.userId);
        novaTransacao.emprestimoId = req.body.emprestimoId;
        if (tipo === 'gasto') {
          const ver = Number(req.body.valorEsperadoRetorno);
          novaTransacao.valorEsperadoRetorno = (!isNaN(ver) && ver >= 0) ? ver : valorFinal;
        }
      }
```

No create parcelado e no update, aplicar a mesma regra: quando `valorEsperadoRetorno` não vier (ou for null) e o lançamento for gasto vinculado, default = valor da TX/parcela. No caminho pagamento-level, default = `pagamento.valor`.
- [ ] **Step 3:** Remover os 2 testes de `aplicarSemJurosNosPagamentos` de `emprestimoService.test.js` (o helper deixa de existir).
- [ ] **Step 4:** Run `npm test -- src/services/__tests__/emprestimoService.test.js` e `npx jest emprestimo` → PASS.
- [ ] **Step 5:** `refactor(emprestimos): remove regra sem_juros e define default do valor esperado`

---

## Task 4 (sem tela): Migration 010 + schema

**Files:** Modify `backend/src/models/emprestimo.js`; Create `backend/scripts/migrations/010-emprestimo-remove-tipo-retorno.js`

- [ ] **Step 1:** No schema `Emprestimo`, remover a linha `tipoRetorno: {...}` e o export `TIPOS_RETORNO`. Manter `pessoaId`, `pessoaNomeSnapshot`, `pessoaContatoSnapshot`, `prazoFinal`, `observacao`, `status`, `dataQuitacao`.
- [ ] **Step 2:** Criar a migration (padrão das existentes):

```js
// scripts/migrations/010-emprestimo-remove-tipo-retorno.js
// Remove o campo tipoRetorno do schema de Empréstimo (ADR 2026-10-03).
// Idempotente: unset num campo já ausente é no-op.
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.DB_URI);
  const res = await mongoose.connection.db.collection('emprestimos')
    .updateMany({ tipoRetorno: { $exists: true } }, { $unset: { tipoRetorno: '' } });
  console.log(`Empréstimos normalizados: ${res.modifiedCount}`);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3:** Rodar em dev: `node scripts/migrations/010-emprestimo-remove-tipo-retorno.js` (workdir `backend/`). Conferir no Mongo que `tipoRetorno` sumiu (`db.emprestimos.findOne()` sem o campo) e que nenhum empréstimo quebrou (`npx jest emprestimo` verde).
- [ ] **Step 4:** `chore(emprestimos): migration 010 remove tipoRetorno`

---

## Task 5 (tela): Frontend — remover tipoRetorno

**Files:** `EmprestimoFormFields.js`, `useEmprestimoForm.js`, `EmprestimosPage.js`, `EmprestimoDetalhePage.js`, `emprestimoFormat.js`

- [ ] **Step 1:** `EmprestimoFormFields.js`: remover o bloco `<div className="emp-campo">` do "Tipo de retorno:" (`<select>` de `novoTipoRetorno`) e toda a lógica `semJuros`/`tipoRetornoEfetivo`. O input "Valor esperado de retorno" volta a ser simples, **opcional** (sem `disabled`), com hint "Deixe em branco para usar o valor do lançamento".
- [ ] **Step 2:** `useEmprestimoForm.js`: remover `novoTipoRetorno`/`setNovoTipoRetorno` e a lógica `sem_juros` no `validar`. A validação de gasto passa a: se `novoValorEsperado` vazio → OK (backend usa default); se preenchido, exigir ≥ 0.
- [ ] **Step 3:** `EmprestimosPage.js` e `EmprestimoDetalhePage.js`: remover a linha/coluna "Tipo" e a chamada `labelTipoRetorno(...)`.
- [ ] **Step 4:** `emprestimoFormat.js`: remover a função `labelTipoRetorno` (e referências).
- [ ] **Step 5:** Verificação manual: Home → Nova Transação → Avançado → marcar empréstimo → **não existe mais "Tipo de retorno"**; "Valor esperado" editável e opcional.
- [ ] **Step 6:** `refactor(emprestimos-ui): remove tipoRetorno do formulario e telas`

---

## Task 6 (tela): Frontend — Quitar/Reabrir + race do dropdown

**Files:** `EmprestimoDetalhePage.js`, `ReverterQuitacaoModal.js` (substituir), `api.js`, `EmprestimoFormFields.js`/`useEmprestimoForm.js`

- [ ] **Step 1:** `api.js`: trocar `reverterQuitacaoEmprestimo` por:

```js
export async function quitarEmprestimo(id) {
  return (await fetch(`${API_BASE}/emprestimos/${id}/quitar`, { method: 'POST', headers: getHeaders() })).json();
}
export async function reabrirEmprestimo(id) {
  return (await fetch(`${API_BASE}/emprestimos/${id}/reabrir`, { method: 'POST', headers: getHeaders() })).json();
}
```

- [ ] **Step 2:** `EmprestimoDetalhePage.js`: botões por status:
  - `ativo`: **"Quitar empréstimo"** → `quitarEmprestimo(id)` (modal de confirmação SweetAlert2: "Encerrar o empréstimo? O lucro realizado vira receita.").
  - `quitado`: **"Reabrir empréstimo"** → `reabrirEmprestimo(id)` (modal: "Reabrir? A transação de lucro será removida.").
  - Remover o botão "Recalcular juros" e o uso de `ReverterQuitacaoModal`.
- [ ] **Step 3:** Remover `ReverterQuitacaoModal.js` (ou esvaziar/renomear para um `ConfirmarAcaoModal` genérico).
- [ ] **Step 4 (race):** Em `useEmprestimoForm`, expor `loadingEmprestimos`. Em `NovaTransacaoForm.handleSubmit`, se `emprestimoForm.state.ativo && modo==='vincular' && loadingEmprestimos`, abortar com toast "Aguarde o carregamento dos empréstimos". No `EmprestimoFormFields`, quando `loadingEmprestimos`, mostrar "Carregando empréstimos..." e manter o select de empréstimo desabilitado até carregar.
- [ ] **Step 5:** Verificação manual/E2E: criar empréstimo 2000 → vincular 500, 500, 1000, 300 (todos funcionam, status segue **ativo**); "Quitar" → quitado + linha "Lucro"; "Reabrir" → ativo sem "Lucro".
- [ ] **Step 6:** `feat(emprestimos-ui): acoes quitar/reabrir e fix do race do vinculo`

---

## Task 7 (não testável / verificação): suíte + E2E + glossário

**Files:** `.brain/context/glossary-emprestimos.md`

- [ ] **Step 1:** `npm test` (workdir `backend/`, `$env:CI="true"`) → sem regressão (as 2 falhas pré-existentes `fechamentoService`/`ledgerService` continuam fora de escopo).
- [ ] **Step 2:** E2E do cenário R$ 2.000 (playwright-cli): abaixo (2 pagamentos), igual (atinge esperado → **segue ativo**), acima (paga mais → segue ativo), "Quitar", "Reabrir". Screenshots.
- [ ] **Step 3:** Glossário: atualizar "Quitação" (manual, via ação), "Cancelamento" (inalterado), remover "Tipo de retorno", ajustar "Valor esperado" (opcional, default = lançamento) e "Total esperado".
- [ ] **Step 4:** `docs(vault): glossario alinhado a quitacao manual`

---

## Self-Review
1. Spec coverage: remoção tipoRetorno (T1/T2/T4/T5), quitação manual (T1/T2/T6), expected default (T3), race (T6). ✅
2. Placeholders: T2/T3 descrevem remoções por símbolo (necessário — o código do F5 foi adicionado por subagente e não está transcrito aqui); o restante tem código real.
3. Consistência: `quitarEmprestimo`/`reabrirEmprestimo` usados com o mesmo nome no service, controller, api e UI. ✅
4. Testabilidade: T1–T4 `sem tela`; T5–T6 `tela`; T7 `não testável`(docs) + verificação. ✅

## Riscos
- T1 reescreve a quitação (comportamento central) — os testes atuais de auto-quitação precisam ser reescritos.
- T3 depende de localizar o código do F5 (adicionado pelo subagente) por nome de função.
- Sem a auto-quitação, `obterEmprestimoComTotais.isQuitadoCalculado` deixa de ser usado para transicionar; a UI deve refletir o status real.
