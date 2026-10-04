---
type: design
status: draft
created: 2026-10-03
tags: [emprestimos, quitacao-manual, remocao-tipo-retorno, valor-esperado, refactor]
related: [2026-10-03-emprestimos-correcoes-design, 2026-10-03-emprestimos-correcoes-qa, 2026-06-24-valor-esperado-por-transacao]
---

# Design — Empréstimos: quitação manual + remoção do `tipoRetorno`

> Origem: simulação do cenário real (empréstimo de R$ 2.000 recebido aos poucos). Dois problemas:
> (1) o empréstimo **quita sozinho** ao atingir o esperado e **some do formulário de vínculo** — não
> dá mais para registrar recebimentos (abaixo/acima do esperado quebra após a quitação); (2) a
> dicotomia **juros × sem juros** (`tipoRetorno`) é confusa e redundante.

## Contexto (reproduzido)

Loan R$ 2.000, esperado R$ 2.000, `valor_fixo`:

| Passo | Resultado observado |
|---|---|
| recebimento 500 | ativo, saldo 1.500 ✅ |
| recebimento 500 | ativo, saldo 1.000 ✅ |
| recebimento 1.000 | **quitado**, saldo 0 |
| recebimento 300 | ❌ **impossível vincular** — o form só lista empréstimos `status:'ativo'` e mostra "Esta pessoa não tem empréstimos ativos" |

Também reproduzido: **race** do dropdown (a lista de empréstimos carrega async; agir antes = select ausente). E o dado real "Milena" foi poluído por um gasto com "valor esperado" = 21.232.162.306 (campo obrigatório de gasto + falta de clareza).

## Decisões aprovadas (nesta sessão)

1. **Remover `tipoRetorno`** do módulo (schema, backend, UI). O empréstimo passa a ser descrito **só pelo valor esperado** por lançamento. (Desfaz o F5.)
2. **Quitação manual**: o empréstimo **nunca quita sozinho**. Você recebe quanto quiser (abaixo/acima do esperado) e clica **"Quitar"** quando decidir encerrar.
3. **"Valor esperado de retorno"** vira **opcional com default = valor do lançamento** (gasto).
4. **Não mexer** nos dados do empréstimo real "Milena".

## Modelo resultante

- **Juros** deixa de ser um "tipo": é sempre `lucro realizado = totalRecebido − totalDesembolsado`, materializado na TX `Lucro - {pessoa}` **no momento da quitação manual**.
- `saldoAReceber = max(0, totalEsperado − totalRecebido)` — segue existindo para orientar o usuário.
- Status: `ativo` → (ação manual **Quitar**) → `quitado`; (ação **Reabrir**) → `ativo`. `cancelado` inalterado (bloqueado com vínculos).

## Mudanças por área

### Backend

**`emprestimoService.js`**
- `recalcularStatus`: **remover a transição automática `ativo → quitado`**. Passa a:
  - `cancelado`: no-op.
  - `ativo`: no-op (não cria nem apaga juros).
  - `quitado`: manter a TX de juros em sincronia com o lucro atual (quando TXs mudam) — preserva o comportamento do ramo "já quitado".
- Nova `quitarEmprestimo(emprestimoId, usuarioId)`: exige `ativo`; seta `quitado` + `dataQuitacao`; calcula lucro realizado; cria/atualiza a TX de juros (`recalcularJurosAuto`, que já cobre os 2 caminhos — F1).
- Nova `reabrirEmprestimo(emprestimoId, usuarioId)`: exige `quitado`; seta `ativo` + `dataQuitacao=null`; **deleta** a TX de juros auto.
- `validarDadosEmprestimo`: remover a validação de `tipoRetorno`.

**`emprestimoController.js`**
- `criar`/`atualizar`: parar de ler/gravar `tipoRetorno`; remover o guard de valorEsperadoRetorno inexistente (não muda) — manter só os campos reais.
- Novos handlers `quitar` / `reabrir`. `reverterQuitacao` (rota atual) → substituir por `reabrir` (mantendo semântica explícita; a rota antiga pode virar alias deprecado ou ser removida).
- `listar`/`obterPorId`: `obterEmprestimoComTotais` deixa de depender de `tipoRetorno`.

**`controladorTransacao.js`**
- **Remover** toda a lógica de `sem_juros`: `aplicarSemJurosNosPagamentos`, `carregarEmprestimosPorId`, `aplicarRegraSemJurosNaTransacao` e as 4 chamadas.
- **Default do valor esperado**: ao criar/editar um gasto vinculado, se `valorEsperadoRetorno` vier null/undefined, default = valor da TX (caminho 1) / `pagamento.valor` (caminho 2).

**Rotas** (`rotasEmprestimo.js`)
- `POST /:id/quitar`, `POST /:id/reabrir`. (A rota `POST /:id/reverter-quitacao` pode ser mantida como alias de `reabrir` por compatibilidade, ou removida — decidir no plano.)

**Migration** `010-emprestimo-remove-tipo-retorno.js`
- `db.emprestimos.updateMany({}, { $unset: { tipoRetorno: '' } })`. Idempotente. Mantém `valorEsperadoRetorno` como está (inclusive nos antigos `sem_juros`, que já foram forçados a desembolso pelo F5 quando recriados).

### Frontend

**`EmprestimoFormFields.js`**
- Remover o `<select>` "Tipo de retorno". Seção fica: Pessoa → vincular/criar → (select empréstimo OU prazo final) → **Valor esperado de retorno** (opcional, pré-preenchido com o valor da transação).

**`useEmprestimoForm.js`**
- Remover `novoTipoRetorno` / `setNovoTipoRetorno` e a lógica de sem_juros no `validar` (que passa a não exigir o esperado — default vem do backend).
- Pré-preencher `novoValorEsperado` com `valorTotal` (já faz) e permitir vazio.

**`EmprestimoDetalhePage.js`**
- Remover a linha "Tipo de retorno" do info-grid.
- Botões: `ativo` → **"Quitar empréstimo"**; `quitado` → **"Reabrir empréstimo"** (substitui "Recalcular juros" — com quitação manual, o ramo `quitado` do `recalcularStatus` já mantém o juros em sincronia). Manter "Cancelar empréstimo" (inalterado).
- Modal de confirmação para Quitar/Reabrir (SweetAlert2, padrão do projeto).

**`EmprestimosPage.js`** e **`emprestimoFormat.js`**
- Remover "Tipo" e a função `labelTipoRetorno`.

**Race do dropdown (fix pontual)**
- Em `EmprestimoFormFields`/`useEmprestimoForm`, exibir estado de "Carregando empréstimos..." e **bloquear o salvar** enquanto `loadingEmprestimos` (ou a lista não resolveu), evitando o "não aparece o empréstimo".

## Verificação

- **Unit (Jest):** `quitarEmprestimo` (cria juros com lucro), `reabrirEmprestimo` (volta ativo + apaga juros), `recalcularStatus` **não** quita sozinho, default do valor esperado, `validarDadosEmprestimo` sem tipoRetorno.
- **E2E (playwright-cli):** cenário R$ 2.000 — receber 500/500/1000/300: todos vinculáveis, empréstimo segue `ativo`; "Quitar" → `quitado` + `Lucro`; "Reabrir" → `ativo` sem `Lucro`. Confirmar abaixo e acima do esperado.
- **Migração:** rodar em dev e conferir que `tipoRetorno` sumiu e nada quebrou.

## Não-objetivos

- ❌ Migração retroativa de valores (só `$unset tipoRetorno`).
- ❌ Mexer nos dados do "Milena".
- ❌ Conta Fixa / Patrimônio / outros módulos.
- ❌ Reintroduzir FIFO ou qualquer cálculo de juros por taxa.

## Riscos

1. **`recalcularStatus` sem auto-quitação** muda um comportamento central e os testes atuais que assumem auto-quitação precisarão ser reescritos.
2. **Remover `tipoRetorno`** é mudança cross-file (schema, controller, service, form, telas, testes, labels).
3. **Quitação manual** exige decidir o que ocorre com a TX de juros ao **Reabrir** (apagar) e ao editar TXs já quitadas (manter em sincronia).
4. **Branch:** este ciclo **desfaz o F5** do branch `fix/emprestimos-correcoes-qa`. Decidir se parte do branch atual (revertendo F5) ou de `main` (re-aplicando F1–F4). → `worktree-decision-gate` no plano.

## Sequenciamento proposto

1. Backend: quitação manual (service/controller/rotas) + remover tipoRetorno do backend + default do esperado + migração.
2. Frontend: remover tipoRetorno; botões Quitar/Reabrir; expected opcional; fix do race.
3. Testes (unit reescritos + novos) e E2E do cenário R$ 2.000 (abaixo/igual/acima).
