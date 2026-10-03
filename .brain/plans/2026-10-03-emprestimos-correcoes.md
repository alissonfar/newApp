# Correções do Módulo de Empréstimos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD — implement and verify,
> tests are required but not test-first. Each task carries a testability tag (tela / sem tela / não
> testável) — use it, don't re-infer it, when reporting via personal-test-report.

**Goal:** Corrigir 5 achados da bateria QA de 2026-10-03 no módulo de Empréstimos (1 bug de cálculo + 4 mudanças de comportamento/UI), começando pelo bug crítico.

**Architecture:** Todas as mudanças são localizadas no módulo de Empréstimos (backend: `emprestimoService`, `emprestimoQuitacao`, `emprestimoController`, `controladorTransacao`; frontend: tela de detalhe, form de empréstimo e modal). Sem migration, sem refactor amplo. F1 e F3 são backend puro; F5 toca backend (regra) + frontend (trava de campo); F2 toca controller + tela de detalhe; F4 é só copy/rótulo.

**Tech Stack:** Node.js + Express + Mongoose (Jest), React 19 + CRACO + SweetAlert2.

**Spec:** `.brain/specs/2026-10-03-emprestimos-correcoes-design.md`
**ADR:** `.brain/decisions/2026-10-03-emprestimos-correcoes-qa.md`

---

## File Structure

| Arquivo | Responsabilidade | Tasks |
|---|---|---|
| `backend/src/utils/emprestimoQuitacao.js` | Snapshot do último recebimento (caminho 1+2) e criação da TX de juros | 1 |
| `backend/src/utils/__tests__/emprestimoQuitacao.test.js` | Testes do util acima | 1 |
| `backend/src/services/emprestimoService.js` | Agregação de totais do empréstimo | 2 |
| `backend/src/services/__tests__/emprestimoService.test.js` | Testes do service | 2, 3 |
| `backend/src/controllers/controladorTransacao.js` | Create/update de transação (regra sem_juros) | 3 |
| `controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js` | Suíte de campos de empréstimo (trava sem_juros) | 4 |
| `backend/src/controllers/emprestimoController.js` | Bloqueio de cancelamento com vínculos | 5 |
| `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js` | Tela de detalhe (cancelar, label recalcular) | 5, 6 |
| `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js` | Modal de recálculo de juros | 6 |
| `.brain/context/glossary-emprestimos.md` | Glossário (atualizar após implementação) | 7 |

---

## Task 1: F1 — Snapshot do último recebimento cobre caminho pagamento-level

**Files:**
- Modify: `backend/src/utils/emprestimoQuitacao.js:36-44` (buscarSnapshotUltimoRecebimento) e `:104-131` (uso na criação)
- Test: `backend/src/utils/__tests__/emprestimoQuitacao.test.js` (novo teste no describe `recalcularJurosAuto`)

**Testabilidade:** sem tela — efeito é backend (criação de TX), verificável por teste e pelo Mongo.

- [ ] **Step 1: Ampliar `buscarSnapshotUltimoRecebimento` para os 2 caminhos**

Substituir a função em `emprestimoQuitacao.js`:

```js
async function buscarSnapshotUltimoRecebimento(emprestimoId) {
  const recebiveis = await Transacao.find({
    tipo: 'recebivel',
    status: 'ativo',
    emprestimoEhJurosAuto: { $ne: true },
    $or: [
      { emprestimoId },
      { 'pagamentos.emprestimoId': emprestimoId }
    ]
  }).sort({ data: -1 }).lean();
  return recebiveis[0] || null;
}
```

- [ ] **Step 2: Derivar pessoa/tags do pagamento vinculado**

Adicionar helper perto de `buscarSnapshotUltimoRecebimento`:

```js
/**
 * Escolhe o pagamento de referência de um recebível: o que está vinculado a
 * este empréstimo (caminho 2), ou o primeiro pagamento (caminho 1).
 */
function pagamentoReferencia(transacaoRecebivel, emprestimoId) {
  const pags = Array.isArray(transacaoRecebivel?.pagamentos) ? transacaoRecebivel.pagamentos : [];
  const vinculado = pags.find(
    (p) => p && p.emprestimoId && String(p.emprestimoId) === String(emprestimoId)
  );
  return vinculado || pags[0] || null;
}
```

No bloco de criação dentro de `recalcularJurosAuto` (hoje usa `ultima.pagamentos?.[0]` em 2 lugares, `emprestimoQuitacao.js:121`), trocar por:

```js
    const ref = pagamentoReferencia(ultima, emprestimoId);
    const nova = new Transacao({
      // ...demais campos iguais...
      pagamentos: [{ pessoa: ref?.pessoa || '', valor: lucroArred, tags: ref?.tags || {} }],
      // ...
    });
```

- [ ] **Step 3: Adicionar teste do caminho pagamento-level**

No `describe('emprestimoQuitacao - recalcularJurosAuto (parâmetro = lucro)')`, adicionar:

```js
  test('criada em caminho 2: pessoa/tags vêm do pagamento vinculado, não do 1º pagamento', async () => {
    const emprestimo = makeEmprestimo();
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(null) });
    mockTransacaoFind.mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve([{
          _id: 'rec2',
          data: new Date('2026-10-03'),
          categoria: 'cat1',
          categoriaNome: 'Cat',
          pagamentos: [
            { pessoa: 'Outro', valor: 100, tags: { x: 1 }, emprestimoId: null },
            { pessoa: 'Estrela', valor: 500, tags: { a: 2 }, emprestimoId: emprestimo._id }
          ]
        }])
      })
    });
    mockTransacaoAggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    let savedInstance = null;
    mockSaveInstance.mockImplementation(function () { savedInstance = this; return Promise.resolve({ _id: 'novoId' }); });

    const resultado = await recalcularJurosAuto(emprestimo, 52.5);

    expect(resultado.acao).toBe('criada');
    expect(savedInstance.pagamentos[0].pessoa).toBe('Estrela');
    expect(savedInstance.pagamentos[0].tags).toEqual({ a: 2 });
  });
```

- [ ] **Step 4: Rodar os testes do util**

Run: `npm test -- src/utils/__tests__/emprestimoQuitacao.test.js` (workdir `backend/`)
Expected: PASS (todos, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/emprestimoQuitacao.js backend/src/utils/__tests__/emprestimoQuitacao.test.js
git commit -m "fix(emprestimos): juros auto enxerga recebimento do caminho pagamento-level"
```

---

## Task 2: F3 — `totalEsperado` do caminho 2 soma por pagamento

**Files:**
- Modify: `backend/src/services/emprestimoService.js:108-141` (esperadoPagamentoAgg)
- Test: `backend/src/services/__tests__/emprestimoService.test.js:474-486` (ajustar comentário) + novo teste

**Testabilidade:** sem tela — cálculo backend, verificado por teste + tela depois.

- [ ] **Step 1: Trocar o agrupamento `$first` por soma por pagamento**

Em `_agregarTotaisEmprestimo`, substituir o `esperadoPagamentoAgg`:

```js
  // Esperado do pagamento (caminho 2): soma o valorEsperadoRetorno de CADA
  // pagamento vinculado (não mais 1x por TX — revisão 2026-10-03, ADR-026).
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
        _id: null,
        total: { $sum: '$pagamentos.valorEsperadoRetorno' }
      }
    }
  ]);
```

E atualizar o comentário acima de `calcularTotais`/no topo da função que dizia "Assume que todos os pagamentos ... têm o mesmo valor esperado".

- [ ] **Step 2: Adicionar teste que inspeciona o pipeline do 3º aggregate**

No `describe('emprestimoService.calcularTotais - pagamento-level')`, adicionar:

```js
  test('esperado do caminho 2 soma por pagamento (sem $first)', async () => {
    mockTransacaoAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 1000 }])
      .mockResolvedValueOnce([{ _id: null, total: 1200 }]);

    const totais = await calcularTotais(String(EMP_ID), USER_ID);
    expect(totais.totalEsperado).toBe(1200);

    const pipelineEsperado = mockTransacaoAggregate.mock.calls[2][0];
    const json = JSON.stringify(pipelineEsperado);
    expect(json).toContain('$pagamentos.valorEsperadoRetorno');
    expect(json).not.toContain('$first');
  });
```

- [ ] **Step 3: Corrigir o comentário do teste existente**

Em `emprestimoService.test.js:474-486`, o teste "TX com 2 pagamentos, AMBOS com mesmo emprestimoId" tem comentário `// esperadoPagamento: 1x por TX` (linha 480). Trocar por `// esperadoPagamento: soma por pagamento (ADR-026)`.

- [ ] **Step 4: Rodar os testes do service**

Run: `npm test -- src/services/__tests__/emprestimoService.test.js` (workdir `backend/`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/emprestimoService.js backend/src/services/__tests__/emprestimoService.test.js
git commit -m "fix(emprestimos): totalEsperado do caminho 2 soma por pagamento"
```

---

## Task 3: F5 (backend) — regra `sem_juros` força esperado = desembolso

**Files:**
- Modify: `backend/src/controllers/controladorTransacao.js` (helpers no topo; uso em create single ~531-543, create parcelado ~648-661, update ~722-739 e ~753-764)
- Test: `backend/src/services/__tests__/emprestimoService.test.js` (novo teste do helper puro) — o helper é puro, dá para testar isolado

**Testabilidade:** sem tela — regra de backend; efeito visível depois na tela.

- [ ] **Step 1: Adicionar helper puro no topo de `controladorTransacao.js`**

```js
/**
 * Aplica a regra do tipoRetorno: empréstimo 'sem_juros' → o valor esperado de
 * cada gasto é o próprio valor desembolsado (lucro sempre 0). Fonte de verdade
 * é o backend; o frontend apenas trava o campo. (ADR-026)
 * @param {Array} pagamentos
 * @param {Map<string,{tipoRetorno:string}>} emprestimosPorId
 */
function aplicarSemJurosNosPagamentos(pagamentos, emprestimosPorId) {
  if (!Array.isArray(pagamentos)) return;
  for (const p of pagamentos) {
    if (!p || !p.emprestimoId) continue;
    const emp = emprestimosPorId.get(String(p.emprestimoId));
    if (emp && emp.tipoRetorno === 'sem_juros') {
      p.valorEsperadoRetorno = Number(p.valor) || 0;
    }
  }
}

async function carregarEmprestimosPorId(pagamentos, usuarioId) {
  const ids = [...new Set(
    (pagamentos || []).filter((p) => p && p.emprestimoId).map((p) => String(p.emprestimoId))
  )];
  if (ids.length === 0) return new Map();
  const Emprestimo = require('../models/emprestimo');
  const emps = await Emprestimo.find({ _id: { $in: ids }, usuario: usuarioId })
    .select('tipoRetorno')
    .lean();
  return new Map(emps.map((e) => [String(e._id), e]));
}

module.exports.aplicarSemJurosNosPagamentos = aplicarSemJurosNosPagamentos;
```

- [ ] **Step 2: Enforçar no caminho TX-level (create single)**

Substituir o bloco `if (req.body.emprestimoId) {...}` (linhas ~531-534) e o bloco de `valorEsperadoRetorno` (~538-543) por:

```js
      let emprestimoLegado = null;
      if (req.body.emprestimoId) {
        emprestimoLegado = await emprestimoService.validarEmprestimoParaTransacao(req.body.emprestimoId, req.userId);
        novaTransacao.emprestimoId = req.body.emprestimoId;
      }
      if (emprestimoLegado && emprestimoLegado.tipoRetorno === 'sem_juros' && tipo === 'gasto') {
        novaTransacao.valorEsperadoRetorno = valorFinal;
      } else if (req.body.valorEsperadoRetorno !== undefined && req.body.valorEsperadoRetorno !== null) {
        const ver = Number(req.body.valorEsperadoRetorno);
        if (!isNaN(ver) && ver >= 0) novaTransacao.valorEsperadoRetorno = ver;
      }
      // Caminho pagamento-level: força esperado dos pagamentos sem_juros
      const empsPorId = await carregarEmprestimosPorId(novaTransacao.pagamentos, req.userId);
      aplicarSemJurosNosPagamentos(novaTransacao.pagamentos, empsPorId);
```

- [ ] **Step 3: Enforçar no caminho parcelado (create)**

Antes do bloco de exclusividade (~662), adicionar:

```js
      const empsPorIdParcelado = await carregarEmprestimosPorId(
        transacoesParaInserir.flatMap((t) => t.pagamentos || []),
        req.userId
      );
      transacoesParaInserir.forEach((t) => aplicarSemJurosNosPagamentos(t.pagamentos, empsPorIdParcelado));
```

(E, quando `req.body.emprestimoId` no topo legado do parcelamento for `sem_juros`, o `transacoesParaInserir.forEach(t => t.valorEsperadoRetorno = ver)` deve ser substituído por `= t.valor` — aplicar dentro do mesmo bloco de `emprestimoId` em ~648-651 carregando o empréstimo.)

- [ ] **Step 4: Enforçar no update**

No ramo `if (req.body.emprestimoId !== undefined)` (~722), capturar o emprestimo e, se `sem_juros`, setar `transacao.valorEsperadoRetorno = transacao.valor` (após `transacao.valor` já ter sido atribuído em 710). No ramo `else` (~752), após `transacao.pagamentos = pagamentosAtual`, aplicar:

```js
      const empsPorIdUpdate = await carregarEmprestimosPorId(transacao.pagamentos, req.userId);
      aplicarSemJurosNosPagamentos(transacao.pagamentos, empsPorIdUpdate);
```

- [ ] **Step 5: Teste do helper puro**

Em `emprestimoService.test.js`, no topo (após os requires), importar e testar:

```js
const { aplicarSemJurosNosPagamentos } = require('../../controllers/controladorTransacao');

describe('controladorTransacao.aplicarSemJurosNosPagamentos', () => {
  test('força valorEsperadoRetorno = valor quando o empréstimo é sem_juros', () => {
    const pags = [{ valor: 300, emprestimoId: 'e1', valorEsperadoRetorno: 999 }];
    const emps = new Map([['e1', { tipoRetorno: 'sem_juros' }]]);
    aplicarSemJurosNosPagamentos(pags, emps);
    expect(pags[0].valorEsperadoRetorno).toBe(300);
  });

  test('não mexe quando tipoRetorno é valor_fixo', () => {
    const pags = [{ valor: 300, emprestimoId: 'e1', valorEsperadoRetorno: 999 }];
    const emps = new Map([['e1', { tipoRetorno: 'valor_fixo' }]]);
    aplicarSemJurosNosPagamentos(pags, emps);
    expect(pags[0].valorEsperadoRetorno).toBe(999);
  });
});
```

> Nota de implementação: requerer o controller no teste carrega outros models (Pessoa, Subconta, etc.). Se o require falhar por dependência não mockada, mover `aplicarSemJurosNosPagamentos` para um novo util `backend/src/utils/emprestimoTipoRetorno.js` e testar de lá — mesma lógica, arquivo neutro.

- [ ] **Step 6: Rodar testes**

Run: `npm test -- src/services/__tests__/emprestimoService.test.js` (workdir `backend/`)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/controladorTransacao.js backend/src/services/__tests__/emprestimoService.test.js
git commit -m "feat(emprestimos): tipoRetorno sem_juros forca esperado igual ao desembolso"
```

---

## Task 4: F5 (frontend) — travar o campo "Valor esperado" quando `sem_juros`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js:172-218`
- Test: manual (tela) — o form não tem teste automatizado

**Testabilidade:** tela — mudança visível no formulário de transação (abas Avançado e Pagamentos).

- [ ] **Step 1: Calcular o tipo de retorno efetivo e travar o campo**

Dentro de `EmprestimoFormFields`, antes do `return`:

```js
  const emprestimoSelecionado = state.modo === 'vincular'
    ? state.emprestimosPessoa.find((e) => (e.id || e._id) === state.emprestimoId)
    : null;
  const tipoRetornoEfetivo = state.modo === 'vincular'
    ? emprestimoSelecionado?.tipoRetorno
    : state.novoTipoRetorno;
  const semJuros = tipoRetornoEfetivo === 'sem_juros';
```

- [ ] **Step 2: Auto-preencher e travar o input em `valor_fixo`/`sem_juros`**

No `onChange` do select de tipo de retorno (~176-178):

```js
                onChange={(e) => {
                  const v = e.target.value;
                  setters.setNovoTipoRetorno(v);
                  if (v === 'sem_juros') setters.setNovoValorEsperado(String(valorTotal || ''));
                }}
```

No input "Valor esperado de retorno" (~205-213), trocar `value`/`disabled` e o hint:

```js
              <input
                type="number"
                step="0.01"
                min="0"
                value={semJuros ? String(valorTotal || '') : state.novoValorEsperado}
                onChange={(e) => setters.setNovoValorEsperado(e.target.value)}
                placeholder="0,00"
                disabled={semJuros}
                tabIndex={state.modo === 'vincular' ? ti(98) : ti(97)}
              />
              <small>
                {semJuros
                  ? 'Sem juros: o retorno esperado é o próprio valor emprestado.'
                  : `Sugestão: mesmo valor desta transação (${formatarMoedaBRL(valorTotal || 0)}). Você pode ajustar.`}
              </small>
```

- [ ] **Step 3: Verificação manual**

Run: `npm start` (workdir `controle-gastos-frontend/`) e abrir Home → Nova Transação.
Check: tipo Gasto → Avançado → marcar empréstimo → Criar novo → escolher "Sem juros" → o campo "Valor esperado" fica **desabilitado** e igual ao valor da transação. Voltar para "Valor fixo" → campo reabilita.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/components/Emprestimos/EmprestimoFormFields.js
git commit -m "feat(emprestimos-ui): trava valor esperado quando tipoRetorno sem_juros"
```

---

## Task 5: F2 — Bloquear cancelamento com lançamentos vinculados

**Files:**
- Modify: `backend/src/controllers/emprestimoController.js:200-216` (cancelar)
- Modify: `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js:62-81` (handleCancelar)
- Test: manual E2E (controller sem harness de teste unitário)

**Testabilidade:** tela — botão de cancelar + mensagem, verificável na tela de detalhe.

- [ ] **Step 1: Bloquear no backend**

Substituir o corpo de `exports.cancelar` (após achar o empréstimo, antes de setar `cancelado`):

```js
    const vinculos = await Transacao.countDocuments({
      usuario: req.userId,
      status: 'ativo',
      emprestimoEhJurosAuto: { $ne: true },
      $or: [
        { emprestimoId: emprestimo._id },
        { 'pagamentos.emprestimoId': emprestimo._id }
      ]
    });
    if (vinculos > 0) {
      return res.status(400).json({
        erro: 'Este empréstimo possui lançamentos vinculados. Desvincule-os (ou estorne-os) antes de cancelar.'
      });
    }
    emprestimo.status = 'cancelado';
    await emprestimo.save();
    // Remove a TX de juros auto (do sistema, não bloqueia o cancelamento)
    await Transacao.deleteMany({
      emprestimoId: emprestimo._id,
      emprestimoEhJurosAuto: true
    });
    res.json({ mensagem: 'Empréstimo cancelado.', emprestimo: await service.obterEmprestimoComTotais(emprestimo) });
```

- [ ] **Step 2: Avisar no frontend antes de abrir o modal**

Em `EmprestimoDetalhePage.js`, `handleCancelar`, antes do `Swal.fire` de confirmação:

```js
    const vinculosUsuario = movimentacoes.filter((m) => !m.emprestimoEhJurosAuto);
    if (vinculosUsuario.length > 0) {
      await Swal.fire({
        title: 'Desvincule os lançamentos antes',
        html: 'Este empréstimo ainda tem lançamentos vinculados. Use <em>"Excluir do empréstimo"</em> (ou estorne as transações) antes de cancelar.',
        icon: 'info',
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#2563eb'
      });
      return;
    }
```

- [ ] **Step 3: Verificação manual (E2E)**

Run: back + front no ar. Abrir `/emprestimos/:id` de um empréstimo com lançamento vinculado (ex.: `QA Empr H`).
Check: clicar "Cancelar empréstimo" → aparece o aviso de desvincular (não cancela). Desvincular os lançamentos → clicar cancelar → confirma e cancela; a TX de juros auto (se houver) some.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/emprestimoController.js controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js
git commit -m "fix(emprestimos): bloqueia cancelamento enquanto houver lancamentos vinculados"
```

---

## Task 6: F4 — Renomear "Reverter quitação" para "Recalcular juros"

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js:168-183` (botão)
- Modify: `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js` (textos)

**Testabilidade:** tela — rótulo e modal visíveis.

- [ ] **Step 1: Renomear o botão**

Em `EmprestimoDetalhePage.js`, no botão condicional a `status === 'quitado'`:

```js
                <button
                  onClick={() => {
                    const txJurosAuto = movimentacoes.find(m => m.emprestimoEhJurosAuto);
                    abrirModalReverterQuitacao({ emprestimo, transacaoJurosAuto: txJurosAuto, onConfirmado: () => load() });
                  }}
                  className="emp-btn-secundario"
                  title="Remove e recria a transação de juros automáticos com o valor recalculado"
                >
                  Recalcular juros
                </button>
```

- [ ] **Step 2: Ajustar o modal (título, bullets, toast)**

Em `ReverterQuitacaoModal.js`:

```js
    title: 'Recalcular juros do empréstimo?',
    html: `
      <div style="text-align: left;">
        <p>O sistema vai:</p>
        <ul style="margin: 0.5em 0; padding-left: 1.5em;">
          <li>Remover a transação de juros automáticos atual (${valorErradoTexto})</li>
          <li>Recalcular com os lançamentos vigentes de <strong>${pessoaNome}</strong></li>
          <li>Recriar a transação de juros com o valor correto (se ainda houver lucro)</li>
        </ul>
        <p style="color: var(--cg-color-warning); margin-top: 1em;">
          Se o empréstimo não estiver mais quitado, a transação de juros não é recriada.
        </p>
      </div>
    `,
    confirmButtonText: 'Recalcular',
```

E o toast de sucesso (linha ~68-70):

```js
    toast.success(
      `Juros recalculados. Nova TX de juros com R$ ${novoLucro.toFixed(2).replace('.', ',')}.`
    );
```

- [ ] **Step 3: Verificação manual**

Run: front no ar. Abrir `/emprestimos/:id` de um empréstimo `quitado` (ex.: `QA Empr E` ou o "Estrela").
Check: botão agora diz **"Recalcular juros"**; o modal diz "Recalcular juros do empréstimo?" e **não** promete "voltar a ativo".

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js
git commit -m "fix(emprestimos-ui): renomeia reverter quitacao para recalcular juros"
```

---

## Task 7: Verificação global + atualizar glossário

**Files:**
- Modify: `.brain/context/glossary-emprestimos.md` (termos de cancelamento, reverter→recalcular, tipoRetorno, esperado por pagamento)

**Testabilidade:** não testável — documentação (o comportamento já foi verificado nas tasks 1-6).

- [ ] **Step 1: Rodar a suíte backend completa**

Run: `npm test` (workdir `backend/`)
Expected: PASS (todas as suítes; nenhum teste vermelho).

- [ ] **Step 2: Reexecutar a bateria E2E dos 5 achados**

No ambiente dev (back `:3001` + front `:3004`), via `playwright-cli`:
- F1: criar recebível pagamento-level vinculado ao empréstimo 50/50 e quitar → **existe** a linha "Lucro - …".
- F2: empréstimo com lançamento → cancelar bloqueado; após desvincular → cancela.
- F3: empréstimo multi-pagamento → card "Valor esperado" **=** total da tabela.
- F4: botão/modal dizem "Recalcular juros".
- F5: empréstimo "Sem juros" → **Lucro esperado R$ 0,00**.

- [ ] **Step 3: Atualizar o glossário**

Em `.brain/context/glossary-emprestimos.md`, ajustar:
- "Quitação (Settlement)": remover a afirmação de irreversibilidade; registrar que existe a ação **"Recalcular juros"** (remove+recria a TX auto) e que ela **não** desfaz a quitação.
- "Cancelamento": registrar que agora é **bloqueado** enquanto houver lançamentos vinculados; a TX de juros auto é removida no cancelamento.
- "Tipo de retorno": registrar a regra `sem_juros` → esperado = desembolso (lucro 0).
- "Total esperado do Empréstimo": registrar que o caminho 2 soma **por pagamento** (ADR-026).

- [ ] **Step 4: Commit**

```bash
git add .brain/context/glossary-emprestimos.md
git commit -m "docs(vault): glossario de emprestimos alinhado ao ADR-026"
```

---

## Self-Review

1. **Spec coverage:** F1→Task 1; F3→Task 2; F5→Tasks 3+4; F2→Task 5; F4→Task 6; verificação/glossário→Task 7. ✅
2. **Placeholders:** nenhum "TBD"; todo passo de código tem o bloco real. A única nota de contingência é o require do controller no teste (com fallback explícito para util neutro). ✅
3. **Consistência de nomes:** `aplicarSemJurosNosPagamentos`, `carregarEmprestimosPorId`, `pagamentoReferencia` usados com o mesmo nome em todas as tasks. ✅
4. **Testabilidade:** Task 1/2/3 = `sem tela`; Task 4/5/6 = `tela`; Task 7 = `não testável`. Todas com exatamente uma tag. ✅

## Riscos

- **Task 3** requer `controladorTransacao.js` no teste — se o require puxar dependências não mockadas, mover o helper para `backend/src/utils/emprestimoTipoRetorno.js` (fallback já escrito no Step 5 da task).
- **Task 2** altera `totalEsperado` de empréstimos multi-pagamento existentes (aumenta). Quitação não auto-reverte; só novos recebimentos usam o valor novo.
- **Task 5** é mudança de comportamento visível (bloqueio de cancelamento) — validar a mensagem com o Alisson no teste manual.
