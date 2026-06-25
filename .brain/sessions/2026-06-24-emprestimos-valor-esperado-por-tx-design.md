---
type: design
status: approved
created: 2026-06-24
approved: 2026-06-24
tags: [emprestimos, design-doc, refactor, valor-esperado-por-tx, simplificacao]
---

# Design Doc — `valorEsperadoRetorno` por Transação + Correção de "Saldo a Receber" e "Lucro/Prejuízo"

> Documento de design para corrigir o modelo conceitualmente errado do `valorEsperadoRetorno` no módulo de Empréstimos. **Substitui** a versão anterior (que tratava `valorEsperadoRetorno` como campo do Empréstimo) e estabelece a regra nova: **cada Transação tem seu próprio `valorEsperadoRetorno`**.

## 1. Contexto e motivação

### 1.1 O caso concreto que motivou

Na rota `/emprestimos/6a3bc4d19673558cc78c136e` ("Estrela"), o usuário vinculou **2 transações de desembolso** ao mesmo Empréstimo:

- TX de R$ 600 (Pix, 02/06/2026) — usuário esperava receber R$ 800 de volta (lucro embutido de R$ 200)
- TX de R$ 500 (Pix, 10/06/2026) — usuário esperava receber R$ 500 de volta (sem lucro)

O sistema atual trata o Empréstimo como tendo **um único** `valorEsperadoRetorno = 800` (herdado da primeira TX). Resultado na tela:

| Card | Valor exibido | Problema |
|------|---------------|----------|
| Valor esperado | R$ 800 | Deveria ser R$ 1.300 (800 + 500) |
| Desembolsado | R$ 1.100 | OK |
| Recebido | R$ 0 | OK |
| Saldo a receber | R$ 800 | Deveria ser R$ 1.300 |
| Prejuízo | R$ 1.100 (vermelho) | Conceito errado: "prejuízo" não deveria existir; o correto é **Lucro esperado = R$ 200** (1.300 - 1.100) |

### 1.2 Modelo conceitual correto (proposto pelo Alisson)

- **Cada Transação** (de gasto) vinculada a um Empréstimo tem seu próprio `valorEsperadoRetorno` = "quanto espero receber de volta especificamente dessa transação".
- **Soma esperada do Empréstimo** = `SUM(t.valorEsperadoRetorno WHERE t.emprestimoId = X AND t.tipo = 'gasto' AND t.status = 'ativo')`.
- **Saldo a receber** = `somaEsperada - recebido` (o que ainda falta entrar vinculado a este Empréstimo).
- **Lucro** = `somaEsperada - somaDesembolsada` (quanto vai lucrar se receber tudo que espera).
- **"Prejuízo" deixa de existir como conceito** — se a soma esperada for menor que a desembolsada (caso degenerado), o card mostra "Lucro" em vermelho (negativo). Na prática, como esperado ≥ desembolso por construção, **prejuízo estrutural não existe**.

### 1.3 Decisões consolidadas

| Tema | Decisão |
|------|---------|
| Onde mora o `valorEsperadoRetorno` | **No documento Transacao** (não mais no Emprestimo) |
| Migration de dados existentes | **Limpeza total** (Alisson ainda não usou em produção) |
| Quitação automática | **Mantém** — `totalReceived >= totalEsperado` (= soma do `valorEsperadoRetorno` das TXs de gasto ativas) |
| Cálculo de lucro realizado | `recebido - desembolsado` (igual hoje — a TX de juros auto é criada com esse valor) |
| Cálculo de lucro esperado (display) | `somaEsperada - somaDesembolsada` |
| Card "Prejuízo" | **Removido** — vira "Lucro" (verde se positivo, vermelho se negativo) |
| Card "Saldo a receber" | **Mantido** — fórmula corrigida para `somaEsperada - recebido` |
| Migration 008 (anterior) | **Mantida** — sem mudanças |

## 2. Mudanças por arquivo

### 2.1 Backend

#### `backend/src/models/transacao.js`
- **ADICIONAR** campo `valorEsperadoRetorno: { type: Number, min: 0, default: null }` ao schema de Transacao.
- Comentário: "Quando setado, esta transação é um desembolso de Empréstimo com expectativa de retorno específico. Null = sem expectativa (recebimento, ou gasto sem Empréstimo)."
- ADICIONAR índice `{ usuario: 1, emprestimoId: 1, tipo: 1 }, { sparse: true }` (otimiza aggregations do service; sparse porque `emprestimoId` é null na maioria das TXs).

#### `backend/src/models/emprestimo.js`
- **REMOVER** campo `valorEsperadoRetorno: { type: Number, required: true, min: 0 }` (linha 14).
- Schema do Empréstimo agora tem: `usuario`, `pessoaId`, `pessoaNomeSnapshot`, `pessoaContatoSnapshot`, `tipoRetorno`, `prazoFinal`, `observacao`, `status`, `dataQuitacao`.
- A constante `TIPOS_RETORNO` permanece.

#### `backend/src/services/emprestimoService.js`

**`calcularTotais` (linha 29)** — adicionar `totalEsperado` no aggregate:
```js
const resultado = await Transacao.aggregate([
  { $match: { emprestimoId, usuario, status: 'ativo', emprestimoEhJurosAuto: { $ne: true } } },
  { $group: { _id: '$tipo', total: { $sum: '$valor' } } }
]);
// ... somar em totalDisbursed / totalReceived ...
// Novo aggregate separado para soma esperada (apenas em gastos):
const esperadoAgg = await Transacao.aggregate([
  { $match: { emprestimoId, usuario, status: 'ativo', tipo: 'gasto', valorEsperadoRetorno: { $ne: null, $gt: 0 } } },
  { $group: { _id: null, total: { $sum: '$valorEsperadoRetorno' } } }
]);
const totalEsperado = esperadoAgg[0]?.total || 0;
return { totalDisbursed, totalReceived, totalEsperado, saldoAReceber: 0, lucro: 0 };
```

**`obterEmprestimoComTotais` (linha 66)** — corrigir fórmulas:
```js
const totalEsperado = totais.totalEsperado;
return {
  ...e,
  totalDisbursed: totais.totalDisbursed,
  totalReceived: totais.totalReceived,
  totalEsperado,  // ← NOVO
  saldoAReceber: Math.max(0, totalEsperado - totais.totalReceived),  // ← CORRIGIDO
  lucro: totalEsperado - totais.totalDisbursed,  // ← CORRIGIDO
  isQuitadoCalculado
};
```

**`calcularLucro` (linha 91)** — sem mudança. Continua `totalReceived - totalDisbursed` (é o **lucro realizado** usado para criar a TX de juros auto).

**`recalcularStatus` (linha 138)** — atualizar referência de `valorEsperado`:
- Trocar `valorEsperado = emprestimo.valorEsperadoRetorno || 0` por `valorEsperado = totais.totalEsperado` (lido do retorno de `calcularTotais`).
- Manter a regra: `atingiuQuitado = valorEsperado > 0 && totais.totalReceived >= valorEsperado`.
- Manter a transição `ativo → quitado` e criação de TX de juros auto (com `lucro` realizado, chamado via `calcularLucro`).

**`validarDadosEmprestimo` (linha 6)** — REMOVER validação de `valorEsperadoRetorno` (não é mais campo do Empréstimo).

#### `backend/src/controllers/emprestimoController.js`

**`criar` (linha 93)** — remover `valorEsperadoRetorno: req.body.valorEsperadoRetorno` do payload de criação do Empréstimo.

**`atualizar` (linha 124)** — remover:
- Bloco `if (req.body.valorEsperadoRetorno !== undefined)` (linhas 155-160)
- Validação de `valorEsperadoRetorno` na chamada de `validarDadosEmprestimo` (linhas 174-180)

**`listar` (linha 16)** — atualizar fórmula (linha 47-48):
```js
saldoAReceber: Math.max(0, totais.totalEsperado - totais.totalReceived),
lucro: totais.totalEsperado - totais.totalDisbursed,
isQuitadoCalculado: totais.totalEsperado > 0 && totais.totalReceived >= totais.totalEsperado
```

**`obterPorId` (linha 61)** — sem mudança direta (delega a `obterEmprestimoComTotais`).

#### `backend/src/controllers/controladorTransacao.js`

**Pontos de criação/edição de Transação** — garantir que o campo `valorEsperadoRetorno` do payload seja persistido na TX. Procurar nos locais:
- `criarTransacao` (POST /api/transacoes)
- `atualizarTransacao` (PUT /api/transacoes/:id)
- Edição inline (PATCH /api/transacoes/:id)

Requer leitura do código atual para identificar exatos pontos de payload.

#### `backend/src/controllers/importacaoController.js`

**`criarEmprestimosParaImportacao` (linha 45-111)** — atualmente o `valorEsperadoRetorno` do `emprestimoConfig` vai pro Empréstimo criado (linha 81). Agora deve ir pra TX criada, não pro Empréstimo:
```js
// ANTES (linha 81):
valorEsperadoRetorno: cfg.valorEsperadoRetorno != null ? Number(cfg.valorEsperadoRetorno) : 0,
// DEPOIS: removido do payload de Emprestimo.create
```
A TX criada na importação recebe o campo `valorEsperadoRetorno: cfg.valorEsperadoRetorno` no payload de `Transacao.create`.

#### `backend/src/utils/emprestimoQuitacao.js`

**`montarObservacao` (linha 27)** — sem mudança (continua referenciando lucro realizado).

**`recalcularJurosAuto` (linha 91)** — sem mudança (continua recebendo `lucro` realizado como argumento).

#### `backend/src/utils/emprestimoAjuste.js`

**`ajustarRecebiveisDeEmprestimo`** — sem mudança. Continua marcando `_emprestimoEsconderNaLista: true` e zerando `valor`/`pagamentos` em gastos/recebíveis vinculados.

#### `backend/scripts/migrations/009-emprestimo-limpeza.js` (NOVO)

**Objetivo:** zerar Empréstimos e desvincular TXs (Alisson não usou em produção).

**Ações idempotentes:**
```js
// 1. Listar Empréstimos antes de deletar (log)
const emprestimos = await Emprestimo.find({ usuario }).select('_id pessoaNomeSnapshot');
console.log(`[migration 009] Encontrados ${emprestimos.length} empréstimos para limpar`);

// 2. Deletar Empréstimos
await Emprestimo.deleteMany({ usuario });

// 3. Desvincular TXs
const result = await Transacao.updateMany(
  { usuario, emprestimoId: { $ne: null } },
  { $set: { emprestimoId: null, emprestimoEhJurosAuto: false } }
);
console.log(`[migration 009] ${result.modifiedCount} transações desvinculadas`);

// 4. Limpar TIs (TransacaoImportada) com emprestimoConfig
const tiResult = await TransacaoImportada.updateMany(
  { usuario, 'emprestimoConfig.ativo': true },
  { $set: { emprestimoConfig: { ativo: false } } }
);
console.log(`[migration 009] ${tiResult.modifiedCount} TIs tiveram emprestimoConfig zerado`);
```

**NÃO destrutivo com TXs originais** — só desvincula. Os gastos/recebíveis continuam ativos, só perdem o vínculo com Empréstimo.

#### `backend/scripts/migrations/README.md`
- Adicionar entrada para migration 009.

#### `backend/src/models/transacaoImportada.js`
- **MANTER** o campo `valorEsperadoRetorno: { type: Number, default: null, min: 0 }` no sub-schema `EmprestimoConfigSchema` (linha 13) — agora ele vai pra TX em vez do Empréstimo.

### 2.2 Frontend

#### `controle-gastos-frontend/src/components/Emprestimos/EmprestimoSecao.js`

**Modo "criar novo empréstimo" (linha 174-213)** — manter o input "Valor esperado de retorno" (linha 177-189), mas o valor vai pro payload de **criar Transação** (não mais pro payload de criar Empréstimo). Mudança:
- O valor é enviado em `transacaoPayload.valorEsperadoRetorno` (campo da TX).
- O `criarEmprestimo` continua sendo chamado, mas SEM `valorEsperadoRetorno` no body.

**Modo "vincular a empréstimo existente" (linha 150-173)** — sem mudança. Não tem campo de valor esperado aqui (TX entra como desembolso puro).

#### `controle-gastos-frontend/src/components/Emprestimos/EmprestimoForm.js`
- **REMOVER** campo `valorEsperadoRetorno` do `ESTADO_INICIAL` (linha 8) e do payload de submit (linha 53).
- Remover input (linha 92-93).
- Remover validação (linha 39).

#### `controle-gastos-frontend/src/components/Transaction/EditarTransacaoItem.js`
- Linha 98 — `valorEsperadoRetorno: st.novoValorEsperado !== '' && ...` — manter e confirmar que vai pro campo `valorEsperadoRetorno` da TX.

#### `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js`

**Linha 168 (Saldo a receber):** sem mudança visual, valor vem do backend corrigido.

**Linha 170-173 (Lucro/Prejuízo):**
```jsx
// ANTES:
<div className={`emp-total-card ${emprestimo.lucro >= 0 ? 'emp-total-pos' : 'emp-total-neg'}`}>
  <span className="emp-total-label">{emprestimo.lucro >= 0 ? 'Lucro' : 'Prejuízo'}</span>
  <span className="emp-total-valor">{formatarMoedaBRL(Math.abs(emprestimo.lucro || 0))}</span>
</div>
// DEPOIS:
<div className={`emp-total-card ${emprestimo.lucro >= 0 ? 'emp-total-pos' : 'emp-total-neg'}`}>
  <span className="emp-total-label">Lucro esperado</span>
  <span className="emp-total-valor">{formatarMoedaBRL(emprestimo.lucro || 0)}</span>
</div>
```
- Label sempre "Lucro esperado" (sem alternar).
- Valor com sinal (sem `Math.abs`).
- Cor verde se positivo, vermelha se negativo.

**Linha 138-140 (Valor esperado):** sem mudança visual, valor vem do backend corrigido.

#### `controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js`

**Totais agregados (linha 31-38):**
```js
const totais = emprestimos.reduce((acc, e) => {
  acc.totalEsperado += Number(e.totalEsperado || 0);  // ← CORRIGIDO (era valorEsperadoRetorno)
  acc.totalRecebido += Number(e.totalReceived || 0);
  acc.totalDesembolsado += Number(e.totalDisbursed || 0);
  acc.lucro += Number(e.lucro || 0);
  return acc;
}, { totalEsperado: 0, totalRecebido: 0, totalDesembolsado: 0, lucro: 0 });
```

**Card de Lucro agregado (linha 91-93):** mudar label para "Lucro esperado" e remover alternância Prejuízo/Lucro.

**Coluna "Valor esperado" da tabela (linha 118):** trocar `e.valorEsperadoRetorno` por `e.totalEsperado`.

**Coluna "Lucro/Prejuízo" da tabela (linha 139-142):** mudar label para "Lucro esperado" (sempre).

#### `controle-gastos-frontend/src/api.js`
- Atualizar `normalizarCamposEmprestimo` (linhas 210-216) se necessário — mas como o campo `valorEsperadoRetorno` deixa de vir do Empréstimo, não precisa de mapeamento especial.

### 2.3 Testes

#### `backend/src/services/__tests__/emprestimoService.test.js`
- Atualizar teste de "quitação normal" (linha 174) — agora cada TX de gasto tem seu próprio `valorEsperadoRetorno`.
- Atualizar teste de "lucro zero" (linha 200) — usar TX com `valorEsperadoRetorno = valor` (= "sem juros").
- Adicionar teste de "valor esperado por TX" — soma de 2 TXs = 1.300, lucro esperado = 1.300 - 1.100 = 200.

#### `backend/src/utils/__tests__/emprestimoAjuste.test.js`
- Sem mudança conceitual (FIFO já foi removido na refatoração anterior). Apenas ajustar fixtures se necessário.

#### `backend/src/utils/__tests__/emprestimoQuitacao.test.js`
- Sem mudança (cálculo de lucro realizado = `recebido - desembolso` permanece).

## 3. Migration 009 — Script de Limpeza

A migration é **idempotente** e **segura** (Alisson confirmou que não há dados de produção). Roda em 4 etapas:

1. Log dos Empréstimos que serão deletados (para auditoria).
2. `Emprestimo.deleteMany({ usuario })`.
3. `Transacao.updateMany({ usuario, emprestimoId: { $ne: null } }, { $set: { emprestimoId: null, emprestimoEhJurosAuto: false } })`.
4. `TransacaoImportada.updateMany({ usuario, 'emprestimoConfig.ativo': true }, { $set: { emprestimoConfig: { ativo: false } } })`.

**Não toca:**
- TXs originais (gastos/recebíveis) — só desvincula.
- Pessoas (Pessoa collection) — Empréstimos deletados não afetam Pessoas.
- Outras collections (Conta, Subconta, Ledger, NetWorth, Pluggy).

## 4. Sequência de implementação (5 passos)

| # | Passo | Arquivos | Validação |
|---|-------|----------|-----------|
| 1 | **Migration 009** | `backend/scripts/migrations/009-emprestimo-limpeza.js`, `backend/scripts/migrations/README.md` | Script roda sem erro, Empréstimos deletados, TXs desvinculadas. |
| 2 | **Schema: campo na Transação, remoção do Empréstimo** | `backend/src/models/transacao.js` (ADD `valorEsperadoRetorno`), `backend/src/models/emprestimo.js` (REMOVE campo) | Schemas carregam sem erro. |
| 3 | **Service: aggregate de totalEsperado + fórmulas corrigidas** | `backend/src/services/emprestimoService.js` (`calcularTotais`, `obterEmprestimoComTotais`, `recalcularStatus`, `validarDadosEmprestimo`) | Cálculos batem com a fórmula nova. `recalcularStatus` ainda detecta quitação. |
| 4 | **Controllers: payload de Empréstimo sem `valorEsperadoRetorno`, payload de Transação com** | `backend/src/controllers/emprestimoController.js`, `backend/src/controllers/controladorTransacao.js`, `backend/src/controllers/importacaoController.js` | POST `/emprestimos` não aceita mais `valorEsperadoRetorno`. POST `/transacoes` aceita. |
| 5 | **Frontend: EmprestimoForm sem campo, EmprestimoDetalhePage/EmprestimosPage com labels corrigidos** | `controle-gastos-frontend/src/components/Emprestimos/EmprestimoForm.js`, `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js`, `controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js`, `controle-gastos-frontend/src/components/Emprestimos/EmprestimoSecao.js` | Form de Empréstimo sem campo de valor. Cards da página de detalhe mostram "Lucro esperado" sempre. |
| 6 | **Testes** | `backend/src/services/__tests__/emprestimoService.test.js` | Testes passam com nova fórmula. |

## 5. Critérios de aceitação

### Backend
- [ ] Migration 009 roda sem erro, deleta Empréstimos, desvincula TXs.
- [ ] Schema do Empréstimo NÃO tem mais `valorEsperadoRetorno`.
- [ ] Schema da Transação TEM `valorEsperadoRetorno` (Number, min 0, default null).
- [ ] `GET /api/emprestimos/:id` retorna `totalEsperado`, `saldoAReceber`, `lucro` com fórmulas novas.
- [ ] `POST /api/emprestimos` rejeita `valorEsperadoRetorno` no body (campo desconhecido).
- [ ] `POST /api/transacoes` aceita `valorEsperadoRetorno` no body (quando vinculado a Empréstimo).
- [ ] `recalcularStatus` ainda detecta quitação quando `totalReceived >= totalEsperado`.
- [ ] TX de juros auto é criada com `valor = recebido - desembolso` (lucro realizado).
- [ ] Testes passam.

### Frontend
- [ ] Formulário de Empréstimo (modal `EmprestimoForm`) NÃO tem campo "Valor esperado".
- [ ] `EmprestimoSecao` (no form de TX) tem campo "Valor esperado" que vai pra TX (não pro Empréstimo).
- [ ] `EmprestimoDetalhePage` mostra:
  - Valor esperado = soma dos esperados das TXs (ex: R$ 1.300)
  - Saldo a receber = esperado - recebido (ex: R$ 1.300)
  - Lucro esperado (label sempre) = esperado - desembolsado (ex: R$ 200, verde)
  - "Prejuízo" não aparece mais como label.
- [ ] `EmprestimosPage` (lista) mostra valor esperado agregado, lucro agregado (sempre "Lucro esperado").
- [ ] TX de Empréstimo mostra valor esperado individual no detalhe do Empréstimo: **SIM** — adicionar uma sub-coluna "Esperado" na tabela de movimentações que mostra `t.valorEsperadoRetorno || '—'`. Apenas para `tipo='gasto'` (em recebimentos, não faz sentido).

### UX/Comportamental
- [ ] Criar Empréstimo com 1 TX de gasto (valor 600, esperado 800) → Empréstimo mostra esperado 800, saldo 800, lucro 200.
- [ ] Vincular 2ª TX de gasto (valor 500, esperado 500) → Empréstimo mostra esperado 1.300, saldo 1.300, lucro 200.
- [ ] Criar Empréstimo com 1 TX de gasto (valor 500, esperado 500) → Empréstimo mostra esperado 500, saldo 500, lucro 0.
- [ ] Adicionar recebimento (vinculado) que quita → status `quitado`, TX de juros auto criada (valor = recebido - desembolso).
- [ ] Estornar recebimento que quita → status NÃO reverte (Bloco 2.b), mas lucro realizado cai pra 0 (ou valor recalculado).

## 6. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Migration 009 deletar Empréstimos que Alisson queria manter | Alisson confirmou: "ainda não usei em produção". Migration é reversível manualmente (re-criar Empréstimo) se necessário. |
| TXs desvinculadas perdem vínculo com histórico | Apenas Empréstimo é deletado; TXs continuam existindo. Badge "Empréstimo" some da TX após migration. |
| Frontend mostrar `undefined` se backend não envia `totalEsperado` | Garantir que o backend envia o campo em todas as respostas (`obterPorId`, `listar`, `obterEmprestimoComTotais`). |
| Cálculo de `lucro` na lista ficar diferente do detalhe (após edição) | `recalcularStatus` é chamado após edição; lista é recarregada. |
| Migration 008 (anterior) conflitar com 009 | Sem conflito: 008 normaliza schema, 009 limpa dados. Rodar 008 antes de 009. |
| TX com `valorEsperadoRetorno` setado mas SEM `emprestimoId` (edge case) | Filtro do aggregate usa `emprestimoId` como pré-requisito, então TXs órfãs (sem empréstimo) são ignoradas. |

## 7. Não-objetivos (mantidos da refatoração anterior)

- NÃO migrar para `decimal.js` (decisão consciente, mantida).
- NÃO adicionar UI de recebimento no detalhe (Bloco 6 fora de escopo).
- NÃO adicionar filtros extras na lista (Bloco 6 fora de escopo).
- NÃO tocar middleware `autenticacao` (Pendência 3 mantida).
- NÃO reativar Empréstimos cancelados (decisão anterior).
- NÃO tratar TXs órfãs de cancelamento (Bloco 4 fora de escopo).

## 8. Próximo passo

Após aprovação deste design doc:

1. **Delegar ao `newapp-executor`** (via tool `task` quando Alisson pedir explicitamente) com este design doc como brief.
2. Executor aplica os 6 passos em sequência.
3. Executor reporta a cada fase ou pede `question` se travar.
4. Após conclusão, Alisson valida manualmente o caso da tela (`/emprestimos/6a3bc4d19673558cc78c136e`).
