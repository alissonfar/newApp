---
type: design
status: draft
created: 2026-06-30
tags: [emprestimos, bug, juros-auto, reversao, recalculo, caminho-pagamento]
related: [2026-06-25-emprestimo-dois-caminhos.md, 2026-06-24-valor-esperado-por-transacao.md]
---

# Design: Bug do cálculo de lucro em Empréstimos (caminho 2) + feature "Reverter quitação"

## Contexto e problema

### O bug original (relatado em 2026-06-30)

Na tela de detalhe do Empréstimo "Estrela", o Empréstimo aparece como **quitado** com:
- Desembolsado: R$ 1.927,50
- Recebido: R$ 2.127,50
- Esperado: R$ 2.127,50
- **Lucro esperado: R$ 200,00** ← correto

Mas na tabela de Movimentações, a **transação de juros automáticos** (a TX de receita gerada pelo sistema na quitação, com flag `emprestimoEhJurosAuto: true`) tem valor **R$ 647,50** ← errado. Devia ser R$ 200,00.

### Causa raiz

O Empréstimo "Estrela" foi vinculado **principalmente pelo caminho 2 (pagamento-level)**: dos 4 desembolsos, 3 estão como `pagamentos[].emprestimoId` (não como `t.emprestimoId`). Apenas 1 está no caminho legado (TX-level).

Hoje, **3 funções de cálculo ignoram o caminho 2**:

1. **`calcularLucro(emprestimoId, usuarioId)`** em `backend/src/services/emprestimoService.js:168-198` — usado em `recalcularStatus` na transição para `quitado` e quando o Empréstimo já está `quitado` e algo muda. Faz aggregate só do caminho 1.
2. **`calcularTotaisRecebEDisbursed(emprestimoId)`** em `backend/src/utils/emprestimoQuitacao.js:46-69` — usado em `recalcularJurosAuto` pra montar a observação da TX de juros auto ("Desembolsos: R$ X, Recebimentos: R$ Y"). Mesmo bug.
3. **`emprestimoAjuste.js`** (caminho 1) — fora de escopo deste design (tem comportamento distinto por design; ver ADR-015).

A **única função que enxerga os 2 caminhos corretamente** é `calcularTotais` em `emprestimoService.js:29-136` (ver ADR-015). Foi atualizada quando o caminho 2 foi introduzido, mas as outras 2 não foram. Resultado: o sistema **calcula totais certos (mostrados nos cards)** mas **gera TX de juros auto errada**.

### Aritmética do caso "Estrela" (reproduzida)

- **Cálculo correto (caminho 1 + caminho 2):** 1.927,50 − 2.127,50 = lucro **R$ 200,00**
- **Cálculo bugado (só caminho 1):** 600 (único gasto no caminho 1) + 1.527,50 (TX de recebimento no caminho 1) → se considerar "lucro = recebimento − desembolso" só do caminho 1, dá **R$ 1.527,50**
- **Valor efetivamente gravado (R$ 647,50):** sugere que houve **múltiplas recriações parciais** da TX de juros auto. Provável cenário: a TX foi criada com um valor X bugado, depois alguma edição/recálculo rodou o `calcularTotaisRecebEDisbursed` (também bugado, mas com talvez outro subset de TXs ativas no momento) e atualizou pra 647,50. A aritmética exata dos 647,50 não é crítica — o que importa é que **toda gravação de TX de juros auto em Empréstimo com caminho 2 está contaminada**.

### Por que isso importa

A TX de juros auto **vira receita normal** nos relatórios, no Patrimônio, no Resumo. Se o sistema grava ela com valor errado, o cálculo de patrimônio do usuário está errado. Esse é um bug de **alta severidade** (afeta saúde financeira pessoal) e **baixa detecção** (só aparece quando você olha os números com cuidado — como o Alisson fez na imagem).

### Como corrigir a TX de juros auto errada do "Estrela" (cenário imediato)

Depois do bug fix, fluxo manual:
1. Reverter a quitação do "Estrela" (botão novo, vide feature abaixo)
2. Sistema deleta a TX de juros auto errada (R$ 647,50)
3. Sistema recria a TX de juros auto com o valor correto (R$ 200,00)
4. Empréstimo volta a status `quitado` automaticamente (porque a recriação dispara `recalcularStatus` que detecta `totalReceived >= totalEsperado`)
5. Patrimônio e relatórios passam a refletir o valor correto

---

## Objetivos

1. **Corrigir o bug** de cálculo de lucro em Empréstimos com caminho 2 (pagamento-level) — afeta 2 funções hoje.
2. **Adicionar feature de "Reverter quitação"** como rede de segurança genérica: se uma quitação automática gerar valor errado (por bug futuro, erro do usuário, ou mudança de TXs vinculadas), tem como voltar atrás em 1 clique sem editar TXs manualmente.
3. **Manter compatibilidade** com Empréstimos 100% caminho 1 (legado) — esses já funcionam e devem continuar funcionando.

## Não-objetivos

- ❌ Refator grande do `emprestimoService` (unificar todos os aggregates numa função só). YAGNI.
- ❌ Cancelamento de Empréstimo com limpeza de TXs (cenário "desfazer completo" rejeitado no brainstorm). Continua como "soft cancel" (status muda, TXs viram órfãs) — pendência conhecida desde 2026-06-21 (ver glossário de Empréstimos).
- ❌ Validação extra de sanidade (warning se lucro > 50% do esperado, etc). Decidido no brainstorm: se o cálculo está certo, não precisa.
- ❌ Log de auditoria / collection `emprestimoEventosLog`. Decidido no brainstorm: YAGNI.
- ❌ Endpoint "recalcular" sem reversão. YAGNI.
- ❌ Migration automática corrigindo todos os Empréstimos afetados. Decidido no brainstorm: reversão caso a caso.

---

## Contexto lido do vault

- **Stack:** Node.js + Express (porta 3001), MongoDB com replica set, JWT + emailVerificado, multi-tenant. Frontend React 19 + CRACO + MUI + Tailwind 4 + SweetAlert2 (modais).
- **Módulo de Empréstimos é maduro e tem decisões documentadas:**
  - **ADR-014** (`2026-06-24-valor-esperado-por-transacao.md`) — `valorEsperadoRetorno` mora na Transação, não no Empréstimo.
  - **ADR-015** (`2026-06-25-emprestimo-dois-caminhos.md`) — 2 caminhos (TX-level legado + pagamento-level novo), com regra de exclusividade mútua. **`calcularTotais` foi atualizado pra cobrir os 2**, mas `calcularLucro` e `calcularTotaisRecebEDisbursed` não.
  - **Glossário de Empréstimos** — `calcularTotais` faz 3 aggregates separados; `calcularLucro` faz 1 (caminho 1 só); `recalcularJurosAuto` faz 1 + usa `calcularTotaisRecebEDisbursed` (também caminho 1 só).
- **Frontend já tem padrão de modal SweetAlert2** em outras telas de Empréstimo.
- **Tela de detalhe do Empréstimo** já tem o botão "Cancelar empréstimo" no header — o botão "Reverter quitação" vai ficar ao lado dele.
- **Testes existentes:** `emprestimoService.test.js` e `emprestimoQuitacao.test.js` cobrem cenário legado (caminho 1). Nenhum cobre cenário caminho 2. Os testes vão continuar passando (não regredimos) e vamos adicionar 4 testes novos (2 em cada arquivo).

---

## Decisões de modelagem

### Decisão 1 — Função privada compartilhada para os aggregates

Os 3 aggregates (caminho 1, caminho 2, esperado pagamento) são quase idênticos nos 3 lugares onde aparecem. Pra evitar que esse bug volte (código duplicado que divergiu), **criar uma função privada `_agregarTotaisEmprestimo(emprestimoId, usuarioId)`** que retorna todos os totais de uma vez. As 3 funções públicas (`calcularTotais`, `calcularLucro`, `calcularTotaisRecebEDisbursed`) consomem ela e retornam só o que cada uma precisa.

**Assinatura (definitiva):**

```js
// Parâmetros:
//   emprestimoId: string | ObjectId
//   usuarioId:    string | ObjectId
//
// Retorna um objeto com 6 campos, todos Number (podem ser 0):
//   {
//     totalDesembolsadoC1: Number,  // soma de t.valor onde t.emprestimoId = X AND t.tipo = 'gasto'
//     totalDesembolsadoC2: Number,  // soma de pagamentos[].valor onde pagamentos[].emprestimoId = X AND t.tipo = 'gasto'
//     totalRecebidoC1:    Number,   // soma de t.valor onde t.emprestimoId = X AND t.tipo = 'recebivel'
//     totalRecebidoC2:    Number,   // soma de pagamentos[].valor onde pagamentos[].emprestimoId = X AND t.tipo = 'recebivel'
//     totalEsperadoC1:    Number,   // soma de t.valorEsperadoRetorno (gastos caminho 1)
//     totalEsperadoC2:    Number    // soma de pagamentos[].valorEsperadoRetorno (gastos caminho 2, agrupado 1x por TX)
//   }
//
// Onde C1 = caminho 1 (TX-level legado) e C2 = caminho 2 (pagamento-level).
// Somas são feitas separadamente por caminho; quem consome soma se quiser.
async function _agregarTotaisEmprestimo(emprestimoId, usuarioId) { ... }
```

**Por que privada e não exportada:** ela é detalhe de implementação. As 3 funções públicas já têm assinaturas estáveis e documentadas. Exportar mais uma função só polui a API do service.

**Por que não consolidar em 1 só:** `calcularTotais` retorna 3 totais consolidados (já no padrão atual), `calcularLucro` retorna 1 número (lucro), `calcularTotaisRecebEDisbursed` retorna 2 (desembolso + recebimento p/ observação). Manter as 3 públicas preserva contrato e clareza. A função privada é só a base compartilhada.

### Decisão 2 — Service novo `reverterQuitacao` segue o padrão do `recalcularStatus`

O `recalcularStatus` já tem a forma "leio estado, decido, atualizo idempotentemente". O `reverterQuitacao` segue o mesmo formato — fácil de entender, fácil de testar, fácil de manter.

**Idempotência:** chamar `reverterQuitacao` num Empréstimo que NÃO está `quitado` retorna erro 400 (não é no-op silencioso). É uma operação consciente, não retry-safe. Isso é OK — a UI bloqueia o botão se o Empréstimo não está quitado.

### Decisão 3 — Endpoint `POST /:id/reverter-quitacao` (não PUT, não PATCH)

REST semantic: é uma **ação** específica do recurso Empréstimo, não uma atualização parcial. Padrão "verb-oriented" pra ações que não cabem em PUT/PATCH. Coerente com o padrão atual de `POST /api/emprestimos/:id/cancelar` (que também é POST mesmo mudando status).

### Decisão 4 — TXs de desembolso e recebimento permanecem inalteradas na reversão

Decidido no brainstorm: a TX de juros auto é a única coisa que o sistema criou automaticamente. As TXs de desembolso e recebimento são reais (o usuário realmente gastou/recebeu). Reverter não mexe nelas — só na TX auto e no status do Empréstimo.

### Decisão 5 — Modal de confirmação obrigatório

Reverter deleta uma transação e muda status do Empréstimo. É destrutivo. Modal SweetAlert2 com texto explicativo + botão vermelho é o padrão do projeto (já usado em outras confirmações destrutivas).

---

## Arquitetura

### Backend

**Arquivos modificados:**

```
backend/src/
├── services/
│   ├── emprestimoService.js
│   │   ├── NOVA função privada: _agregarTotaisEmprestimo()
│   │   ├── calcularTotais()           # refatorada: usa _agregarTotaisEmprestimo
│   │   ├── calcularLucro()            # refatorada: usa _agregarTotaisEmprestimo
│   │   └── NOVA função pública: reverterQuitacao()
│   └── __tests__/
│       └── emprestimoService.test.js # +2 testes
├── utils/
│   ├── emprestimoQuitacao.js
│   │   └── calcularTotaisRecebEDisbursed()  # refatorada: usa _agregarTotaisEmprestimo
│   └── __tests__/
│       └── emprestimoQuitacao.test.js # +2 testes
├── controllers/
│   └── emprestimoController.js
│       └── NOVO handler: reverterQuitacao()
└── routes/
    └── rotasEmprestimo.js   # NOVA rota: POST /:id/reverter-quitacao
```

**Cuidado de circular dependency:** `emprestimoService` já importa `emprestimoQuitacao` (linha 219 importa `recalcularJurosAuto` lazy dentro de `recalcularStatus`). Vamos seguir o mesmo padrão lazy (require dentro da função) pra evitar cycle entre `emprestimoService` e `emprestimoQuitacao`.

### Frontend

**Arquivos modificados:**

```
controle-gastos-frontend/src/
├── pages/
│   └── Emprestimos/
│       └── EmprestimoDetalhes.js   # adiciona botão "Reverter quitação" condicional
├── components/
│   └── Emprestimos/
│       └── NOVO: ReverterQuitacaoModal.js  # modal SweetAlert2 standalone
├── services/  (ou api.js)
│   └── NOVA função: reverterQuitacaoEmprestimo(id) → POST /:id/reverter-quitacao
└── hooks/  (opcional)
    └── NOVO: useReverterQuitacao() # encapsula o fluxo de chamar API + invalidar cache
```

**Decisão sobre hook:** se a chamada for trivial (1 fetch + invalidar query), **NÃO criar hook** — só chama direto. Hook só se tiver state complexo (loading, error, optimistic update). Decidir durante implementação (YAGNI).

---

## Detalhamento técnico

### 1. Função privada `_agregarTotaisEmprestimo(emprestimoId, usuarioId)`

Localização: `backend/src/services/emprestimoService.js` (perto do `calcularTotais`).

Lógica: combina os 3 aggregates que o `calcularTotais` atual já faz (caminho 1, caminho 2, esperado pagamento) numa única função que retorna todos os totais.

**Pseudo-código:**

```js
async function _agregarTotaisEmprestimo(emprestimoId, usuarioId) {
  const objectId = toObjectId(emprestimoId);
  const usuarioObjId = toObjectId(usuarioId);

  // Aggregate 1: TX-level (caminho 1)
  const txLevelAgg = await Transacao.aggregate([
    { $match: { emprestimoId: objectId, usuario: usuarioObjId, status: 'ativo', emprestimoEhJurosAuto: { $ne: true } } },
    { $group: {
      _id: '$tipo',
      total: { $sum: '$valor' },
      totalEsperado: { $sum: { $cond: [{ $eq: ['$tipo', 'gasto'] }, { $ifNull: ['$valorEsperadoRetorno', 0] }, 0] } }
    }}
  ]);

  // Aggregate 2: Pagamento-level (caminho 2)
  const pagamentoLevelAgg = await Transacao.aggregate([
    { $match: { usuario: usuarioObjId, status: 'ativo', emprestimoEhJurosAuto: { $ne: true }, 'pagamentos.emprestimoId': objectId, emprestimoId: { $ne: objectId } } },
    { $unwind: '$pagamentos' },
    { $match: { 'pagamentos.emprestimoId': objectId } },
    { $group: { _id: '$tipo', total: { $sum: '$pagamentos.valor' } } }
  ]);

  // Aggregate 3: Esperado por pagamento (caminho 2, agrupa por TX)
  const esperadoPagamentoAgg = await Transacao.aggregate([
    { $match: { usuario: usuarioObjId, status: 'ativo', tipo: 'gasto', 'pagamentos.emprestimoId': objectId, emprestimoId: { $ne: objectId } } },
    { $unwind: '$pagamentos' },
    { $match: { 'pagamentos.emprestimoId': objectId, 'pagamentos.valorEsperadoRetorno': { $ne: null, $gt: 0 } } },
    { $group: { _id: '$_id', valorEsperado: { $first: '$pagamentos.valorEsperadoRetorno' } } },
    { $group: { _id: null, total: { $sum: '$valorEsperado' } } }
  ]);

  // Monta retorno agregado
  let totalDesembolsadoC1 = 0, totalRecebidoC1 = 0, totalEsperadoC1 = 0;
  let totalDesembolsadoC2 = 0, totalRecebidoC2 = 0;
  for (const r of txLevelAgg) {
    if (r._id === 'gasto') { totalDesembolsadoC1 = r.total; totalEsperadoC1 = r.totalEsperado || 0; }
    else if (r._id === 'recebivel') totalRecebidoC1 = r.total;
  }
  for (const r of pagamentoLevelAgg) {
    if (r._id === 'gasto') totalDesembolsadoC2 = r.total;
    else if (r._id === 'recebivel') totalRecebidoC2 = r.total;
  }
  const totalEsperadoC2 = esperadoPagamentoAgg[0]?.total || 0;

  return {
    totalDesembolsadoC1, totalDesembolsadoC2,
    totalRecebidoC1, totalRecebidoC2,
    totalEsperadoC1, totalEsperadoC2
  };
}
```

### 2. Refator das 3 funções públicas

```js
async function calcularTotais(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    totalDisbursed: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    totalReceived: t.totalRecebidoC1 + t.totalRecebidoC2,
    totalEsperado: t.totalEsperadoC1 + t.totalEsperadoC2,
    saldoAReceber: 0,   // preenchido em quem consome
    lucro: 0            // preenchido em quem consome
  };
}

async function calcularLucro(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  const totalDesembolsado = t.totalDesembolsadoC1 + t.totalDesembolsadoC2;
  const totalRecebido = t.totalRecebidoC1 + t.totalRecebidoC2;
  return totalRecebido - totalDesembolsado;
}
```

E em `emprestimoQuitacao.js`:

```js
async function calcularTotaisRecebEDisbursed(emprestimoId, usuarioId) {
  const { _agregarTotaisEmprestimo } = require('../services/emprestimoService');
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    desembolso: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    recebimento: t.totalRecebidoC1 + t.totalRecebidoC2
  };
}
```

**Mudança na assinatura de `calcularTotaisRecebEDisbursed`:** passa a receber `(emprestimoId, usuarioId)`. Hoje só recebe `(emprestimoId)`. Os 2 call sites (`emprestimoQuitacao.js:113` e `emprestimoQuitacao.js:147`) precisam ser atualizados pra passar o `usuarioId` (que já tem disponível no `recalcularJurosAuto` via `emprestimo.usuario`).

**Cuidado com o teste existente em `emprestimoQuitacao.test.js:213-228`:** vai precisar ser atualizado pra passar o `usuarioId` também. É mudança mecânica.

### 3. Service `reverterQuitacao`

Localização: `backend/src/services/emprestimoService.js`.

```js
async function reverterQuitacao(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) throw new Error('Empréstimo não encontrado.');
  if (emprestimo.status !== 'quitado') {
    throw new Error('Apenas empréstimos quitados podem ter a quitação revertida.');
  }

  // 1. Deleta TX de juros auto (se existir)
  await Transacao.deleteOne({
    emprestimoId: emprestimo._id,
    emprestimoEhJurosAuto: true,
    status: 'ativo'
  });

  // 2. Volta Empréstimo pra ativo
  emprestimo.status = 'ativo';
  emprestimo.dataQuitacao = null;
  await emprestimo.save();

  // 3. Recalcula status (vai detectar 'ainda quitado' e recriar TX de juros auto)
  await recalcularStatus(emprestimo._id, usuarioId);

  // 4. Retorna Empréstimo detalhado
  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioId });
  return await obterEmprestimoComTotais(atualizado);
}
```

**Por que `deleteOne` em vez de `findOneAndDelete`:** não precisa do doc deletado de volta, só precisa saber se deletou. Mas se quiser retornar o ID da TX deletada pra log, troca pra `findOneAndDelete` e usa o doc retornado.

**Edge case: e se a TX de juros auto já tiver sido deletada manualmente antes?** O `deleteOne` é no-op (0 docs removidos). O `recalcularStatus` no passo 3 vai detectar "ainda quitado" (porque o cálculo vai dizer isso) e recriar a TX. Comportamento desejado.

**Edge case: e se o usuário desvinculou TXs de desembolso depois da quitação?** Aí o `recalcularStatus` pode detectar que NÃO está mais quitado (totalReceived < totalEsperado). Empréstimo fica `ativo` e a TX de juros auto NÃO é recriada. Comportamento desejado — o sistema "vê" que a situação atual não justifica quitação.

### 4. Controller e rota

Localização: `backend/src/controllers/emprestimoController.js`.

```js
exports.reverterQuitacao = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });

    const detalhado = await service.reverterQuitacao(oid, req.userId);
    res.json(detalhado);
  } catch (error) {
    console.error('Erro ao reverter quitação:', error);
    const status = error.message.includes('não encontrado') ? 404
                 : error.message.includes('Apenas empréstimos quitados') ? 400
                 : 500;
    res.status(status).json({ erro: error.message });
  }
};
```

Localização da rota: `backend/src/routes/rotasEmprestimo.js` (verificar arquivo real durante implementação).

```js
router.post('/:id/reverter-quitacao', autenticacao, emprestimoController.reverterQuitacao);
```

### 5. UI — Componente `ReverterQuitacaoModal`

Localização: `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js`.

Usa SweetAlert2 (`import Swal from 'sweetalert2'`, padrão do projeto). Função principal:

```js
export async function abrirModalReverterQuitacao({ emprestimo, transacaoJurosAuto, onConfirmado }) {
  const valorErrado = transacaoJurosAuto?.valor ?? '?';
  const pessoaNome = emprestimo.pessoaNomeSnapshot;

  const resultado = await Swal.fire({
    title: 'Reverter quitação do empréstimo?',
    html: `
      <p>Esta operação irá:</p>
      <ul style="text-align: left; margin: 1em 0;">
        <li>Remover a transação de juros automáticos de <strong>R$ ${valorErrado}</strong></li>
        <li>Voltar o empréstimo com <strong>${pessoaNome}</strong> ao status <strong>ativo</strong></li>
        <li>Recalcular e recriar a transação de juros com o valor correto</li>
      </ul>
      <p style="color: var(--cg-color-warning);">Esta operação não pode ser desfeita automaticamente.</p>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Reverter',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--cg-color-error)',
    cancelButtonColor: 'var(--cg-color-text-secondary)',
  });

  if (!resultado.isConfirmed) return;

  try {
    await reverterQuitacaoEmprestimo(emprestimo._id);
    toast.success('Quitação revertida. Sistema recalculou.');
    onConfirmado?.();
  } catch (error) {
    toast.error(error.response?.data?.erro || 'Erro ao reverter quitação.');
  }
}
```

**Função de API:**

```js
// src/services/api.js (ou src/api.js, conforme padrão do projeto pra Empréstimos)
export async function reverterQuitacaoEmprestimo(id) {
  const response = await api.post(`/emprestimos/${id}/reverter-quitacao`);
  return response.data;
}
```

**Integração na tela de detalhe:** botão "Reverter quitação" no header, ao lado de "Cancelar empréstimo", condicional a `emprestimo.status === 'quitado'`. Clique chama `abrirModalReverterQuitacao({ ... })`. Após sucesso, `onConfirmado` refetcha o Empréstimo.

---

## Fluxos críticos (end-to-end)

### Fluxo 1 — Corrigir o "Estrela" (caso imediato)

1. Bug fix deployado (commit com refator de `calcularLucro` + `calcularTotaisRecebEDisbursed`).
2. Alisson abre a tela de detalhe do Empréstimo "Estrela" (que já tem a feature "Reverter quitação" deployada junto).
3. Clica em "Reverter quitação" → modal explica que vai remover TX de R$ 647,50 e recriar com valor correto.
4. Confirma → sistema deleta TX errada, volta Empréstimo pra `ativo`, recalcula.
5. `recalcularStatus` detecta `totalReceived (2.127,50) >= totalEsperado (2.127,50)` → volta pra `quitado` e cria nova TX de juros auto com `valor = totalRecebido - totalDesembolsado = 2.127,50 - 1.927,50 = 200,00` ✅.
6. Tela recarrega → mostra a TX de juros auto com R$ 200,00. Patrimônio e relatórios corretos.

### Fluxo 2 — Reverter Empréstimo legítimo 100% caminho 1 (caso legado)

1. Alisson tem Empréstimo "João" com 1 desembolso (R$ 500) e 1 recebimento (R$ 600), todos via `t.emprestimoId` (caminho legado).
2. Sistema já quitou certo: TX de juros auto tem R$ 100.
3. Por algum motivo Alisson quer reverter (mudou de ideia, TXs erradas, etc).
4. Clica "Reverter quitação" → modal → confirma.
5. Sistema deleta TX de juros auto (R$ 100), volta pra `ativo`, recalcula.
6. `recalcularStatus` detecta `totalReceived (600) >= totalEsperado (600)` → volta pra `quitado` e recria TX de juros auto com `valor = 600 - 500 = 100` ✅.
7. Tela mostra a mesma TX, valor idêntico. **No-op visualmente**, mas Alisson tem garantia de que tá recalculado do zero.

### Fluxo 3 — Reverter e perceber que Empréstimo não deveria estar quitado

1. Alisson tem Empréstimo "Maria" quitado. Mas ele desvinculou por engano a TX de desembolso principal há 1 dia.
2. Clica "Reverter quitação" → confirma.
3. Sistema deleta TX de juros auto, volta pra `ativo`, recalcula.
4. `recalcularStatus` detecta `totalReceived (menor) < totalEsperado` → Empréstimo fica `ativo` e TX de juros auto **NÃO é recriada**.
5. Tela mostra Empréstimo como `ativo`, sem TX de juros auto. Alisson entende que "o sistema descobriu que não era pra ter quitado mesmo".

---

## Compatibilidade e rollback

### Compatibilidade pra trás

- Assinaturas das funções públicas (`calcularTotais`, `calcularLucro`, `obterEmprestimoComTotais`) **não mudam**. Continua retornando mesma estrutura.
- Assinatura de `calcularTotaisRecebEDisbursed` muda: passa a receber `(emprestimoId, usuarioId)`. 2 call sites atualizados (`emprestimoQuitacao.js:113` e `:147`). É mudança trivial e localizada.
- Nenhuma migration necessária.
- Empréstimos existentes continuam funcionando (legado 100% caminho 1 não é afetado pela refatoração).

### Rollback

Se algo der muito errado:
1. Reverter o commit do bug fix (volta o cálculo bugado, mas pelo menos volta a funcionar como antes).
2. Feature "Reverter quitação" pode ser desabilitada removendo o botão da UI (não impacta nada).

**Risco real:** se o bug fix introduzir regressão em cenário legado (caminho 1), Empréstimos já quitados podem ter TX de juros auto sobrescrita com valor diferente. **Mitigação:** os 7 testes existentes (todos em caminho 1) vão pegar regressão. Por isso vamos rodar `npm test` antes de commitar.

---

## Plano de execução (resumo — detalhamento vai pro writing-plans)

### Fase 1 — Bug fix + testes (pré-requisito de tudo)

1. Implementar `_agregarTotaisEmprestimo` em `emprestimoService.js`.
2. Refatorar `calcularTotais` pra usar a função privada.
3. Refatorar `calcularLucro` pra usar a função privada.
4. Rodar testes existentes → todos passam.
5. Adicionar 2 testes novos em `emprestimoService.test.js` (cálculo correto em cenário 100% caminho 2 e mix caminho 1 + caminho 2).
6. Rodar testes → todos passam (9 no total).
7. Refatorar `calcularTotaisRecebEDisbursed` em `emprestimoQuitacao.js` pra usar a função privada. Atualizar os 2 call sites.
8. Atualizar teste existente em `emprestimoQuitacao.test.js` pra passar `usuarioId`.
9. Adicionar 2 testes novos em `emprestimoQuitacao.test.js` (cálculo correto em cenário caminho 2).
10. Rodar testes → todos passam.
11. Commit: `fix(emprestimos): calcularLucro e calcularTotaisRecebEDisbursed enxergam caminho 2`

### Fase 2 — Service `reverterQuitacao` + controller + rota

1. Implementar `reverterQuitacao` em `emprestimoService.js`.
2. Adicionar handler `reverterQuitacao` em `emprestimoController.js`.
3. Adicionar rota `POST /:id/reverter-quitacao` em `rotasEmprestimo.js`.
4. Commit: `feat(emprestimos): service e endpoint reverter quitacao`

### Fase 3 — UI: botão + modal

1. Adicionar função `reverterQuitacaoEmprestimo(id)` no cliente de API.
2. Criar componente `ReverterQuitacaoModal.js`.
3. Adicionar botão "Reverter quitação" condicional na tela de detalhe.
4. Testar manualmente: cenário do "Estrela" deve ficar com R$ 200,00 após reverter.
5. Commit: `feat(emprestimos-ui): botao reverter quitacao na tela de detalhe`

### Fase 4 — Validação final + correção do "Estrela"

1. Reiniciar backend + frontend.
2. Abrir tela do "Estrela".
3. Clicar "Reverter quitação" → confirmar.
4. Verificar que a TX de juros auto foi recriada com R$ 200,00.
5. Verificar que Patrimônio e Relatórios agora batem.

---

## Testes

### Testes unitários novos (4 no total)

**`emprestimoService.test.js` (2 novos):**

1. `calcularLucro` retorna valor correto em Empréstimo 100% caminho 2 (todos desembolsos via `pagamentos[].emprestimoId`).
2. `calcularTotais` retorna totais corretos em Empréstimo mix (1 desembolso caminho 1 + 2 caminho 2).

**`emprestimoQuitacao.test.js` (2 novos):**

3. `calcularTotaisRecebEDisbursed` retorna desembolso + recebimento corretos em cenário caminho 2.
4. `recalcularJurosAuto` cria TX de juros auto com valor correto em cenário caminho 2 (integração do fix).

### Teste manual (validação E2E)

Cenário "Estrela" — após deploy, a TX de juros auto deve ser R$ 200,00 após reverter e recalcular.

---

## Pontos de atenção / riscos

### Risco 1 — Regressão em Empréstimos já quitados (caminho 1 legado)

Se o bug fix errar a fórmula do `calcularLucro`, Empréstimos 100% caminho 1 podem ter a TX de juros auto sobrescrita com valor diferente na próxima vez que `recalcularStatus` rodar. **Mitigação:** testes existentes (7 testes caminho 1) + rodar `npm test` antes de commitar.

### Risco 2 — Race condition se usuário reverter 2x rápido

Dois cliques rápidos no botão "Reverter" disparam 2 requests. O 2º pode passar pela validação de "ainda é quitado" antes do 1º terminar, e ambos deletarem a TX de juros auto (o 2º deleta o que o 1º recriou). **Mitigação:** botão fica disabled enquanto a request roda (loading state). É o suficiente pro UX.

### Risco 3 — TX de juros auto deletada não pode ser recuperada

A operação é destrutiva. Se Alisson reverter por engano, a TX some (não tem lixeira). **Mitigação:** warning bem explícito no modal ("Esta operação não pode ser desfeita automaticamente"). Aceitável porque o `recalcularStatus` recria a TX automaticamente com o valor correto — então na prática Alisson pode reverter de novo e a TX volta. Não é perda real de dados, é só "fica sem TX por 1 segundo".

### Risco 4 — Circular dependency entre `emprestimoService` e `emprestimoQuitacao`

Já existe lazy require (`require('../utils/emprestimoQuitacao')` dentro de `recalcularStatus`). Vamos seguir o mesmo padrão. **Mitigação:** a função `_agregarTotaisEmprestimo` mora em `emprestimoService.js` e é carregada lazy de `emprestimoQuitacao.js` via `require` dentro da função que precisa (não no topo do arquivo). Se mesmo assim houver erro de ciclo (Node detecta require cíclico), mover `_agregarTotaisEmprestimo` pra um arquivo neutro novo `backend/src/utils/emprestimoAgregados.js` que ambos importam. Decidir durante implementação.

### Risco 5 — Performance: 1 aggregate a mais em cada cálculo

A função privada faz 3 aggregates separados. Hoje o `calcularTotais` já faz 3. As outras 2 funções faziam 1 cada. Com a refatoração, todas vão fazer 3. Em Empréstimos grandes (centenas de TXs), isso pode ser 3x mais lento. **Mitigação:** Empréstimos pessoais raramente passam de 50 TXs vinculadas. 3 aggregates de 50 docs = ~10ms total. Não é problema. **Não otimizar prematuramente.**

---

## Decisões pendentes (pequenas, podem ser resolvidas durante implementação)

1. **Localização exata do arquivo de rotas:** `rotasEmprestimo.js` é o que presumo. Verificar durante implementação.
2. **Hook ou chamada direta da API na UI:** decidir durante implementação baseado na complexidade real.
3. **Cor do botão "Reverter quitação":** sugeiro usar `var(--cg-color-error)` ou `var(--cg-color-warning)` (decisão de design). Decidir na hora de implementar, baseado no que o sistema de tokens tem.
4. **Texto exato do modal:** ajustar copy depois de ver o modal rodando, baseado no tom de voz do resto do app.

---

## Próximos passos (após aprovação deste design)

1. Alisson revisa este design doc (especialmente o ponto 1 — que ele sugeriu "Só correção, sem validação extra" e "Auditoria sob demanda" — pra confirmar que está coerente).
2. Se aprovado, eu chamo a skill `writing-plans` pra gerar o plano de implementação detalhado.
3. Executor aplica Fases 1, 2, 3 (Fase 4 é validação manual que Alisson faz).
4. Alisson valida corrigindo o "Estrela" via UI.
5. Sign-off final.
